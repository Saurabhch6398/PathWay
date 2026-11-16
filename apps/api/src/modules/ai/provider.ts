import { AppError } from '../../common/errors';
import { getEnv } from '../../config/env';
import { createGeminiProvider } from './gemini.provider';

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

/** For tests. */
export const setAiProvider = (provider: AiProvider | undefined) => {
  override = provider;
};

export function getAiProvider(): AiProvider {
  if (override) return override;
  const env = getEnv();
  if (!env.GEMINI_API_KEY) {
    throw new AppError(503, 'AI features are not configured on this server', 'AI_NOT_CONFIGURED');
  }
  return (gemini ??= createGeminiProvider({
    apiKey: env.GEMINI_API_KEY,
    models: env.GEMINI_MODELS.split(',')
      .map((m) => m.trim())
      .filter(Boolean),
  }));
}
