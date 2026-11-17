import { GoogleGenAI } from '@google/genai';
import { AppError } from '../../common/errors';
import type { AiProvider, ChatTurn } from './provider';

// Gemini expects a conversation to start with a user turn, so drop any leading assistant messages.
const toContents = (messages: ChatTurn[]) =>
  messages
    .slice(
      Math.max(
        0,
        messages.findIndex((m) => m.role === 'user'),
      ),
    )
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

const upstreamError = (cause: unknown) => {
  console.error('Gemini request failed:', cause instanceof Error ? cause.message : cause);
  return new AppError(
    502,
    'The AI service is unavailable right now. Please try again.',
    'AI_UPSTREAM',
  );
};

export function createGeminiProvider(opts: { apiKey: string; models: string[] }): AiProvider {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });

  /** Tries each configured model in order until one works. */
  async function withFallback<T>(run: (model: string) => Promise<T>): Promise<T> {
    let last: unknown;
    for (const model of opts.models) {
      try {
        return await run(model);
      } catch (err) {
        console.warn(`Gemini model ${model} failed:`, err instanceof Error ? err.message : err);
        last = err;
      }
    }
    throw upstreamError(last);
  }

  return {
    generateJson: ({ system, prompt }) =>
      withFallback(async (model) => {
        const res = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: system,
            responseMimeType: 'application/json',
            temperature: 0.4,
          },
        });
        return res.text ?? '';
      }),

    generateText: ({ system, messages }) =>
      withFallback(async (model) => {
        const res = await ai.models.generateContent({
          model,
          contents: toContents(messages),
          config: { systemInstruction: system, temperature: 0.4, maxOutputTokens: 800 },
        });
        return res.text ?? '';
      }),

    async *streamText({ system, messages, signal }) {
      let last: unknown;
      for (const model of opts.models) {
        let started = false;
        try {
          const stream = await ai.models.generateContentStream({
            model,
            contents: toContents(messages),
            config: {
              systemInstruction: system,
              temperature: 0.4,
              maxOutputTokens: 800,
              abortSignal: signal,
            },
          });
          for await (const chunk of stream) {
            if (chunk.text) {
              started = true;
              yield chunk.text;
            }
          }
          return;
        } catch (err) {
          if (started || signal?.aborted) throw err; // can't switch models mid-answer
          last = err;
        }
      }
      throw upstreamError(last);
    },
  };
}
