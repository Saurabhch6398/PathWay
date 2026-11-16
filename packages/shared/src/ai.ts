import { z } from 'zod';

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const generateQuizSchema = z.object({
  topic: z.string().trim().min(2, 'Enter a topic').max(60, 'Keep the topic under 60 characters'),
  difficulty: z.enum(DIFFICULTIES).default('intermediate'),
  count: z.number().int().min(3).max(10).default(5),
});
export type GenerateQuizInput = z.input<typeof generateQuizSchema>;

export const submitQuizSchema = z.object({
  // null = left unanswered
  answers: z.array(z.number().int().min(0).max(3).nullable()).min(1).max(10),
});

export interface QuizQuestionDto {
  question: string;
  options: string[];
}
export interface QuizDto {
  id: string;
  topic: string;
  difficulty: Difficulty;
  questions: QuizQuestionDto[];
}
export interface QuizResultDto {
  score: number;
  total: number;
  percent: number;
  answers: { yourAnswer: number | null; correctIndex: number; explanation: string }[];
  skill: { name: string; proficiency: number } | null;
}
export interface QuizHistoryItemDto {
  id: string;
  topic: string;
  difficulty: Difficulty;
  score: number;
  total: number;
  createdAt: string;
}

export const skillGapRequestSchema = z.object({
  targetRole: z.string().trim().min(2).max(100).optional(),
});
export interface SkillGapDto {
  targetRole: string;
  summary: string;
  strengths: string[];
  gaps: { skill: string; priority: 'high' | 'medium' | 'low'; reason: string }[];
  nextSteps: string[];
}

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(2000),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1)
    .max(12)
    .refine((m) => m[m.length - 1]?.role === 'user', 'The last message must be from the user'),
});

export const TICKET_STATUSES = ['open', 'in_progress', 'resolved'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3, 'Add a short subject').max(120),
  description: z.string().trim().min(10, 'Describe the problem in a little more detail').max(2000),
});
export const ticketStatusSchema = z.object({ status: z.enum(TICKET_STATUSES) });

export interface TicketDto {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  createdAt: string;
  user?: { id: string; name: string; email: string };
}
