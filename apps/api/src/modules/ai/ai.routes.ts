import { Router } from 'express';
import {
  chatRequestSchema,
  generateQuizSchema,
  skillGapRequestSchema,
  submitQuizSchema,
} from '@pathway/shared';
import { authenticate, requireRole } from '../../common/auth';
import { aiLimiter } from '../../common/rateLimit';
import { getId, validate } from '../../common/validate';
import { streamAdvisor } from './advisor.service';
import * as quizzes from './quiz.service';
import { analyzeSkillGap } from './skillGap.service';

export const aiRouter = Router();

aiRouter.use(authenticate);

aiRouter.post(
  '/quizzes',
  requireRole('student'),
  aiLimiter,
  validate({ body: generateQuizSchema }),
  async (req, res) => {
    res.status(201).json({ quiz: await quizzes.generateQuiz(req.auth!.userId, req.body) });
  },
);

aiRouter.get('/quizzes/me', requireRole('student'), async (req, res) => {
  res.json({ history: await quizzes.listQuizHistory(req.auth!.userId) });
});

aiRouter.post(
  '/quizzes/:id/submit',
  requireRole('student'),
  validate({ body: submitQuizSchema }),
  async (req, res) => {
    res.json({ result: await quizzes.submitQuiz(req.auth!.userId, getId(req), req.body.answers) });
  },
);

aiRouter.post(
  '/skill-gap',
  requireRole('student'),
  aiLimiter,
  validate({ body: skillGapRequestSchema }),
  async (req, res) => {
    res.json({ analysis: await analyzeSkillGap(req.auth!.userId, req.body.targetRole) });
  },
);

aiRouter.post(
  '/advisor',
  requireRole('student', 'faculty'),
  aiLimiter,
  validate({ body: chatRequestSchema }),
  (req, res) => streamAdvisor(req, res, req.body.messages),
);
