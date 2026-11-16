import { z } from 'zod';

export const facultyProfileUpdateSchema = z.object({
  collegeName: z.string().trim().max(150).optional(),
  department: z.string().trim().max(100).optional(),
  designation: z.string().trim().max(100).optional(),
});
export interface FacultyProfileDto {
  collegeName?: string;
  department?: string;
  designation?: string;
}

export const COLLABORATION_TYPES = [
  'mou',
  'faculty_swap',
  'fdp',
  'consultancy',
  'research',
  'industry_project',
] as const;
export type CollaborationType = (typeof COLLABORATION_TYPES)[number];
export const COLLABORATION_LABELS: Record<CollaborationType, string> = {
  mou: 'MoU',
  faculty_swap: 'Faculty swap',
  fdp: 'FDP',
  consultancy: 'Consultancy',
  research: 'Research collaboration',
  industry_project: 'Industry project',
};

export const COLLABORATION_STATUSES = [
  'draft',
  'proposed',
  'active',
  'completed',
  'cancelled',
] as const;
export type CollaborationStatus = (typeof COLLABORATION_STATUSES)[number];

const date = z.iso.date('Use a valid date');
const fields = {
  type: z.enum(COLLABORATION_TYPES),
  title: z.string().trim().min(3, 'Enter a title').max(150),
  partner: z.string().trim().min(2, 'Enter the partner organisation').max(150),
  description: z.string().trim().max(3000).optional(),
  startDate: date.optional(),
  endDate: date.optional(),
  notes: z.string().trim().max(2000).optional(),
};
const datesInOrder = (v: { startDate?: string; endDate?: string }) =>
  !v.startDate || !v.endDate || v.endDate >= v.startDate;
const DATE_MESSAGE = {
  message: 'The end date must not be before the start date',
  path: ['endDate'],
};

export const collaborationInputSchema = z.object(fields).refine(datesInOrder, DATE_MESSAGE);
export type CollaborationInput = z.infer<typeof collaborationInputSchema>;

export const collaborationUpdateSchema = z
  .object(fields)
  .partial()
  .extend({ status: z.enum(COLLABORATION_STATUSES).optional() })
  .refine(datesInOrder, DATE_MESSAGE);
export type CollaborationUpdate = z.infer<typeof collaborationUpdateSchema>;

export interface CollaborationDto {
  id: string;
  type: CollaborationType;
  title: string;
  partner: string;
  description?: string;
  status: CollaborationStatus;
  startDate?: string;
  endDate?: string;
  notes?: string;
  createdAt: string;
}

export const insightsQuerySchema = z.object({
  course: z.string().trim().max(100).optional(),
  batch: z.string().trim().max(20).optional(),
});
export type InsightsQuery = z.infer<typeof insightsQuerySchema>;

export interface InsightsDto {
  students: number;
  /** Groups smaller than this are never shown, so individuals can't be picked out. */
  minGroupSize: number;
  restricted: boolean;
  topSkills: { name: string; students: number; averageProficiency: number }[];
  targetRoles: { role: string; students: number }[];
  applications: { total: number; shortlisted: number; accepted: number; rejected: number };
}
