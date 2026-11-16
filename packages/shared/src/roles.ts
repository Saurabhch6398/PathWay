import { z } from 'zod';

export const ROLES = ['student', 'mentor', 'faculty', 'recruiter', 'admin'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;
