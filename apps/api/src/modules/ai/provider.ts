import { AppError } from '../../common/errors';
import { getEnv } from '../../config/env';
import { createGeminiProvider } from './gemini.provider';
import { createGroqProvider } from './groq.provider';
import { createMockProvider } from './mock.provider';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** The only surface the rest of the app uses to talk to an LLM (easy to swap or fake in tests). */
export interface AiProvider {
  /** Returns raw JSON text. */
  generateJson(opts: { system: string; prompt: string }): Promise<string>;
  generateText(opts: { system: string; messages: ChatTurn[] }): Promise<string>;
  streamText(opts: {
    system: string;
    messages: ChatTurn[];
    signal?: AbortSignal;
  }): AsyncIterable<string>;
}

let override: AiProvider | undefined;
let gemini: AiProvider | undefined;
let groq: AiProvider | undefined;
let mock: AiProvider | undefined;
let resilient: AiProvider | undefined;

function createFallbackProvider(primary: AiProvider, fallback: AiProvider): AiProvider {
  return {
    async generateJson(opts) {
      try {
        return await primary.generateJson(opts);
      } catch (err) {
        console.warn('Primary AI failed, falling back to mock provider:', err instanceof Error ? err.message : err);
        return await fallback.generateJson(opts);
      }
    },
    async generateText(opts) {
      try {
        return await primary.generateText(opts);
      } catch (err) {
        console.warn('Primary AI failed, falling back to mock provider:', err instanceof Error ? err.message : err);
        return await fallback.generateText(opts);
      }
    },
    async *streamText(opts) {
      let started = false;
      try {
        for await (const chunk of primary.streamText(opts)) {
          started = true;
          yield chunk;
        }
        return;
      } catch (err) {
        if (started || opts.signal?.aborted) throw err;
        console.warn('Primary AI stream failed, falling back to mock provider:', err instanceof Error ? err.message : err);
        for await (const chunk of fallback.streamText(opts)) {
          yield chunk;
        }
      }
    },
  };
}

/** For tests. */
export const setAiProvider = (provider: AiProvider | undefined) => {
  override = provider;
};

export function getAiProvider(): AiProvider {
  if (override) return override;
  if (resilient) return resilient;
  const env = getEnv();

  const getMock = () => (mock ??= createMockProvider());

  let active: AiProvider | undefined;

  // If Groq API key is configured, use Groq
  if (env.GROQ_API_KEY) {
    active = (groq ??= createGroqProvider({
      apiKey: env.GROQ_API_KEY,
      models: env.GROQ_MODELS.split(',')
        .map((m) => m.trim())
        .filter(Boolean),
    }));
  } else if (env.GEMINI_API_KEY) {
    // Fallback to Gemini if configured
    active = (gemini ??= createGeminiProvider({
      apiKey: env.GEMINI_API_KEY,
      models: env.GEMINI_MODELS.split(',')
        .map((m) => m.trim())
        .filter(Boolean),
    }));
  }

  // In test mode, keep strict behavior so tests can assert AI_NOT_CONFIGURED
  if (env.NODE_ENV === 'test') {
    if (active) return active;
    if (env.AI_OFFLINE_MODE === 'true') return getMock();
    throw new AppError(
      503,
      'AI features are not configured on this server. Set GROQ_API_KEY or GEMINI_API_KEY.',
      'AI_NOT_CONFIGURED',
    );
  }

  // In production / development: always ensure seamless fallback to mock so users never see 502
  if (active) {
    return (resilient = createFallbackProvider(active, getMock()));
  }

  // If no external keys configured, use mock provider directly
  return (resilient = getMock());
}
