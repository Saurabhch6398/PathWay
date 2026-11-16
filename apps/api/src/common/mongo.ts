export const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
