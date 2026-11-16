import type { z } from 'zod';
import { AppError } from '../../common/errors';
import { getAiProvider } from './provider';

const stripFences = (text: string) =>
  text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

/** Asks the model for JSON and validates it; one retry because LLM output is occasionally malformed. */
export async function generateValidated<T>(
  schema: z.ZodType<T>,
  opts: { system: string; prompt: string },
): Promise<T> {
  const provider = getAiProvider();
  for (let attempt = 1; ; attempt++) {
    const text = await provider.generateJson(opts);
    try {
      return schema.parse(JSON.parse(stripFences(text)));
    } catch {
      if (attempt >= 2) {
        throw new AppError(
          502,
          'The AI returned an unexpected response. Please try again.',
          'AI_BAD_OUTPUT',
        );
      }
    }
  }
}
