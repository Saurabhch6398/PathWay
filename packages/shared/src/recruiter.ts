import { z } from 'zod';
import { OPPORTUNITY_KINDS, type ApplicationStatus, type OpportunityDto } from './opportunities';
import type { Skill } from './profile';

export const recruiterProfileUpdateSchema = z.object({
  companyName: z.string().trim().min(2, 'Enter your company name').max(100).optional(),
  designation: z.string().trim().max(100).optional(),
});
export interface RecruiterProfileDto {
  designation?: string;
  company: { id: string; name: string } | null;
}

// Defaults live only on the create schema: Zod 4 applies defaults even inside `.partial()`,
// which would silently overwrite fields on PATCH.
const fields = {
  title: z.string().trim().min(3, 'Enter a title').max(120),
  kind: z.enum(OPPORTUNITY_KINDS),
  description: z.string().trim().min(20, 'Describe the role in a little more detail').max(4000),
  location: z.string().trim().min(1).max(100),
  duration: z.string().trim().max(60).optional(),
  compensation: z.string().trim().max(60).optional(),
  skills: z
    .array(z.string().trim().min(1).max(50))
    .max(15, 'At most 15 skills')
    .refine(
      (l) => new Set(l.map((s) => s.toLowerCase())).size === l.length,
      'Each skill can only be listed once',
    ),
  deadline: z.iso
    .datetime('Choose a valid deadline')
    .refine((v) => new Date(v).getTime() > Date.now(), 'The deadline must be in the future'),
};

export const opportunityInputSchema = z.object({
  ...fields,
  location: fields.location.default('Remote'),
  skills: fields.skills.default([]),
  deadline: fields.deadline.optional(),
});
export type OpportunityInput = z.input<typeof opportunityInputSchema>;

export const opportunityUpdateSchema = z
  .object(fields)
  .partial()
  .extend({ status: z.enum(['open', 'closed']).optional() });

export interface RecruiterOpportunityDto extends OpportunityDto {
  applicantCount: number;
}

export const applicationDecisionSchema = z.object({
  status: z.enum(['shortlisted', 'accepted', 'rejected']),
});
export type ApplicationDecision = z.infer<typeof applicationDecisionSchema>['status'];

export interface ApplicantDto {
  id: string;
  status: ApplicationStatus;
  message?: string;
  createdAt: string;
  student: {
    id: string;
    name: string;
    email: string;
    course?: string;
    batch?: string;
    targetRole?: string;
    skills: Skill[];
  };
}

export const talentQuerySchema = z.object({
  skill: z.string().trim().max(50).optional(),
  role: z.string().trim().max(100).optional(),
  minProficiency: z.coerce.number().int().min(0).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type TalentQuery = z.infer<typeof talentQuerySchema>;

/** Deliberately has no email/phone: recruiters reach students through applications. */
export interface TalentDto {
  id: string;
  name: string;
  course?: string;
  batch?: string;
  targetRole?: string;
  skills: Skill[];
}

export interface RecruiterAnalyticsDto {
  opportunities: { open: number; closed: number };
  applications: {
    total: number;
    submitted: number;
    shortlisted: number;
    accepted: number;
    rejected: number;
  };
}
