import { z } from 'zod';
import type { Skill } from './profile';

export const mentorProfileUpdateSchema = z.object({
  title: z.string().trim().max(100).optional(),
  // Self-declared and unverified, shown to students next to the mentor's name.
  companyName: z.string().trim().max(100).optional(),
  experienceYears: z.number().int().min(0).max(60).optional(),
  expertise: z
    .array(z.string().trim().min(1).max(40))
    .max(15, 'At most 15 areas')
    .refine(
      (l) => new Set(l.map((s) => s.toLowerCase())).size === l.length,
      'Each area can only be listed once',
    )
    .optional(),
  available: z.boolean().optional(),
});
export type MentorProfileUpdate = z.infer<typeof mentorProfileUpdateSchema>;

export interface MentorSelfDto {
  title?: string;
  companyName?: string;
  experienceYears?: number;
  expertise: string[];
  available: boolean;
}

export const MENTEE_STAGES = ['new', 'active', 'paused', 'graduated'] as const;
export type MenteeStage = (typeof MENTEE_STAGES)[number];

export const menteeUpdateSchema = z
  .object({
    stage: z.enum(MENTEE_STAGES).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => v.stage !== undefined || v.notes !== undefined, 'Nothing to update');

export interface MenteeDto {
  student: {
    id: string;
    name: string;
    course?: string;
    batch?: string;
    targetRole?: string;
    skills: Skill[];
  };
  stage: MenteeStage;
  /** Private to the mentor: students never see these. */
  notes: string;
  sessions: { total: number; completed: number; upcoming: number };
  lastSessionAt?: string;
}

export interface MentorSummaryDto {
  pendingRequests: number;
  upcomingConfirmed: number;
  completedSessions: number;
  mentees: number;
}
