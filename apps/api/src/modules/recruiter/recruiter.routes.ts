import { Router } from 'express';
import {
  applicationDecisionSchema,
  opportunityInputSchema,
  opportunityUpdateSchema,
  recruiterProfileUpdateSchema,
  talentQuerySchema,
} from '@pathway/shared';
import { authenticate, requireRole } from '../../common/auth';
import { getId, validate } from '../../common/validate';
import { getAnalytics } from './analytics.service';
import { decideApplication, listApplicants } from './applicants.service';
import { getRecruiterProfile, updateRecruiterProfile } from './company.service';
import { createPosting, listPostings, updatePosting } from './postings.service';
import { searchTalent } from './talent.service';

export const recruiterRouter = Router();

recruiterRouter.use(authenticate, requireRole('recruiter'));

recruiterRouter.get('/me', async (req, res) => {
  res.json({ profile: await getRecruiterProfile(req.auth!.userId) });
});
recruiterRouter.patch('/me', validate({ body: recruiterProfileUpdateSchema }), async (req, res) => {
  res.json({ profile: await updateRecruiterProfile(req.auth!.userId, req.body) });
});

recruiterRouter.get('/opportunities', async (req, res) => {
  res.json({ opportunities: await listPostings(req.auth!.userId) });
});
recruiterRouter.post(
  '/opportunities',
  validate({ body: opportunityInputSchema }),
  async (req, res) => {
    res.status(201).json({ opportunity: await createPosting(req.auth!.userId, req.body) });
  },
);
recruiterRouter.patch(
  '/opportunities/:id',
  validate({ body: opportunityUpdateSchema }),
  async (req, res) => {
    res.json({ opportunity: await updatePosting(req.auth!.userId, getId(req), req.body) });
  },
);
recruiterRouter.get('/opportunities/:id/applications', async (req, res) => {
  res.json({ applicants: await listApplicants(req.auth!.userId, getId(req)) });
});

recruiterRouter.patch(
  '/applications/:id',
  validate({ body: applicationDecisionSchema }),
  async (req, res) => {
    res.json({
      application: await decideApplication(req.auth!.userId, getId(req), req.body.status),
    });
  },
);

recruiterRouter.get('/students', async (req, res) => {
  res.json(await searchTalent(talentQuerySchema.parse(req.query)));
});
recruiterRouter.get('/analytics', async (req, res) => {
  res.json({ analytics: await getAnalytics(req.auth!.userId) });
});
