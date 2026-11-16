export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });

export const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'Something went wrong';
