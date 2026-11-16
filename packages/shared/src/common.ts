import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const idParamsSchema = z.object({ id: objectIdSchema });

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}
