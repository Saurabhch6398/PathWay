import { AppError } from '../../common/errors';
import { getEnv } from '../../config/env';
import { createGeminiProvider } from './gemini.provider';
import { createGroqProvider } from './groq.provider';

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

/** For tests. */
export const setAiProvider = (provider: AiProvider | undefined) => {
  override = provider;
};

export function getAiProvider(): AiProvider {
  if (override) return override;
  const env = getEnv();

  // If Groq API key is configured, use Groq
  if (env.GROQ_API_KEY) {
    return (groq ??= createGroqProvider({
      apiKey: env.GROQ_API_KEY,
      models: env.GROQ_MODELS.split(',')
        .map((m) => m.trim())
        .filter(Boolean),
    }));
  }

  // Fallback to Gemini if configured
  if (env.GEMINI_API_KEY) {
    return (gemini ??= createGeminiProvider({
      apiKey: env.GEMINI_API_KEY,
      models: env.GEMINI_MODELS.split(',')
        .map((m) => m.trim())
        .filter(Boolean),
    }));
  }

  throw new AppError(
    503,
    'AI features are not configured on this server. Set GROQ_API_KEY or GEMINI_API_KEY.',
    'AI_NOT_CONFIGURED',
  );
}
