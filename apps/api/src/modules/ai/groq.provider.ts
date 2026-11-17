import { AppError } from '../../common/errors';
import type { AiProvider, ChatTurn } from './provider';

const upstreamError = (cause: unknown) => {
  console.error('Groq request failed:', cause instanceof Error ? cause.message : cause);
  return new AppError(
    502,
    'The AI service is unavailable right now. Please try again.',
    'AI_UPSTREAM',
  );
};

export function createGroqProvider(opts: { apiKey: string; models: string[] }): AiProvider {
  const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  const headers = {
    Authorization: `Bearer ${opts.apiKey}`,
    'Content-Type': 'application/json',
  };

  /** Tries each configured model in order until one works. */
  async function withFallback<T>(run: (model: string) => Promise<T>): Promise<T> {
    let last: unknown;
    for (const model of opts.models) {
      try {
        return await run(model);
      } catch (err) {
        console.warn(`Groq model ${model} failed:`, err instanceof Error ? err.message : err);
        last = err;
      }
    }
    throw upstreamError(last);
  }

  return {
    generateJson: ({ system, prompt }) =>
      withFallback(async (model) => {
        const res = await fetch(GROQ_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
          }),
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          throw new Error(`Groq HTTP ${res.status}: ${errBody}`);
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error('Empty response from Groq');
        return text;
      }),

    generateText: ({ system, messages }) =>
      withFallback(async (model) => {
        const res = await fetch(GROQ_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: [{ role: 'system', content: system }, ...messages],
            temperature: 0.4,
            max_tokens: 800,
          }),
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          throw new Error(`Groq HTTP ${res.status}: ${errBody}`);
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        return data.choices?.[0]?.message?.content ?? '';
      }),

    async *streamText({ system, messages, signal }) {
      let last: unknown;
      for (const model of opts.models) {
        let started = false;
        try {
          const res = await fetch(GROQ_URL, {
            method: 'POST',
            headers,
            signal,
            body: JSON.stringify({
              model,
              messages: [{ role: 'system', content: system }, ...messages],
              stream: true,
              temperature: 0.4,
              max_tokens: 800,
            }),
          });

          if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            throw new Error(`Groq HTTP ${res.status}: ${errBody}`);
          }

          if (!res.body) throw new Error('No readable stream received from Groq');

          const decoder = new TextDecoder();
          let buffer = '';

          for await (const chunk of res.body as AsyncIterable<Uint8Array>) {
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data:')) continue;
              const payload = trimmed.slice(5).trim();
              if (payload === '[DONE]') return;

              try {
                const parsed = JSON.parse(payload) as {
                  choices?: Array<{ delta?: { content?: string } }>;
                };
                const token = parsed.choices?.[0]?.delta?.content;
                if (token) {
                  started = true;
                  yield token;
                }
              } catch {
                // Ignore incomplete line parses
              }
            }
          }
          return;
        } catch (err) {
          if (started || signal?.aborted) throw err;
          last = err;
        }
      }
      throw upstreamError(last);
    },
  };
}
