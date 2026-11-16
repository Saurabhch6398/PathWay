import { z } from 'zod';

export const skillSchema = z.object({
  name: z.string().trim().min(1, 'Skill name is required').max(50),
  proficiency: z.number().int().min(0).max(100),
});
export type Skill = z.infer<typeof skillSchema>;

export const studentProfileUpdateSchema = z.object({
  course: z.string().trim().max(100).optional(),
  batch: z.string().trim().max(20).optional(),
  targetRole: z.string().trim().max(100).optional(),
  visibleToRecruiters: z.boolean().optional(),
  skills: z
    .array(skillSchema)
    .max(30, 'At most 30 skills')
    .refine(
      (list) => new Set(list.map((s) => s.name.toLowerCase())).size === list.length,
      'Each skill can only be listed once',
    )
    .optional(),
});
export type StudentProfileUpdate = z.infer<typeof studentProfileUpdateSchema>;

export interface StudentProfileDto {
  course?: string;
  batch?: string;
  targetRole?: string;
  skills: Skill[];
  careerReadiness: number;
  experienceScore: number;
  visibleToRecruiters: boolean;
}
