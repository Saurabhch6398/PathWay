import { Router } from 'express';
import { bookSessionSchema, menteeUpdateSchema, mentorProfileUpdateSchema } from '@pathway/shared';
import { authenticate, requireRole } from '../../common/auth';
import { getId, validate } from '../../common/validate';
import * as self from './mentorSelf.service';
import * as service from './mentors.service';

export const mentorsRouter = Router();

mentorsRouter.use(authenticate);

// --- the signed-in mentor's own area. Must come before `/:id` so "me" isn't read as an id. ---
mentorsRouter.get('/me', requireRole('mentor'), async (req, res) => {
  res.json({ profile: await self.getMentorSelf(req.auth!.userId) });
});
mentorsRouter.patch(
  '/me',
  requireRole('mentor'),
  validate({ body: mentorProfileUpdateSchema }),
  async (req, res) => {
    res.json({ profile: await self.updateMentorSelf(req.auth!.userId, req.body) });
  },
);
mentorsRouter.get('/me/summary', requireRole('mentor'), async (req, res) => {
  res.json({ summary: await self.getMentorSummary(req.auth!.userId) });
});
mentorsRouter.get('/me/mentees', requireRole('mentor'), async (req, res) => {
  res.json({ mentees: await self.listMentees(req.auth!.userId) });
});
mentorsRouter.patch(
  '/me/mentees/:id',
  requireRole('mentor'),
  validate({ body: menteeUpdateSchema }),
  async (req, res) => {
    res.json({ mentee: await self.updateMentee(req.auth!.userId, getId(req), req.body) });
  },
);

// --- student-facing ---
mentorsRouter.get('/', async (_req, res) => {
  res.json({ mentors: await service.listMentors() });
});

mentorsRouter.get('/:id', async (req, res) => {
  res.json({ mentor: await service.getMentor(getId(req)) });
});

mentorsRouter.post(
  '/:id/sessions',
  requireRole('student'),
  validate({ body: bookSessionSchema }),
  async (req, res) => {
    res
      .status(201)
      .json({ session: await service.bookSession(req.auth!.userId, getId(req), req.body) });
  },
);
