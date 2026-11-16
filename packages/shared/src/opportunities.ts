import { z } from 'zod';

export const OPPORTUNITY_KINDS = ['job', 'internship', 'gig'] as const;
export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];

export const opportunityQuerySchema = z.object({
  kind: z.enum(OPPORTUNITY_KINDS).optional(),
  q: z.string().trim().max(100).optional(),
  skill: z.string().trim().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type OpportunityQuery = z.infer<typeof opportunityQuerySchema>;

export const applySchema = z.object({ message: z.string().trim().max(1000).optional() });
export type ApplyInput = z.infer<typeof applySchema>;

export interface OpportunityDto {
  id: string;
  title: string;
  kind: OpportunityKind;
  company: string | null;
  description: string;
  location: string;
  duration?: string;
  compensation?: string;
  skills: string[];
  status: 'open' | 'closed';
  deadline: string | null;
  createdAt: string;
}

export const APPLICATION_STATUSES = [
  'submitted',
  'shortlisted',
  'rejected',
  'accepted',
  'withdrawn',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface ApplicationDto {
  id: string;
  status: ApplicationStatus;
  message?: string;
  createdAt: string;
  opportunity: { id: string; title: string; kind: OpportunityKind; company: string | null } | null;
}
