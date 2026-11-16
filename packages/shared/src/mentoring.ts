import { z } from 'zod';

export const SESSION_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const bookSessionSchema = z.object({
  startsAt: z.iso.datetime('Choose a valid date and time'),
  topic: z.string().trim().min(3, 'Describe the topic').max(200),
});
export type BookSessionInput = z.infer<typeof bookSessionSchema>;

export const sessionStatusSchema = z.object({
  status: z.enum(['confirmed', 'cancelled', 'completed']),
});
export type SessionStatusInput = z.infer<typeof sessionStatusSchema>;

export interface MentorDto {
  id: string;
  name: string;
  title?: string;
  company: string | null;
  experienceYears?: number;
  expertise: string[];
}

export interface SessionDto {
  id: string;
  startsAt: string;
  durationMinutes: number;
  topic: string;
  status: SessionStatus;
  mentor: { id: string; name: string };
  student: { id: string; name: string };
}
