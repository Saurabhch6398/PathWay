import { Router } from 'express';
import {
  collaborationInputSchema,
  collaborationUpdateSchema,
  facultyProfileUpdateSchema,
  insightsQuerySchema,
} from '@pathway/shared';
import { authenticate, requireRole } from '../../common/auth';
import { getId, validate } from '../../common/validate';
import {
  createCollaboration,
  listCollaborations,
  updateCollaboration,
} from './collaborations.service';
import { getInsights } from './insights.service';
import { getFacultyProfile, updateFacultyProfile } from './profile.service';

export const facultyRouter = Router();

facultyRouter.use(authenticate, requireRole('faculty'));

facultyRouter.get('/me', async (req, res) => {
  res.json({ profile: await getFacultyProfile(req.auth!.userId) });
});
facultyRouter.patch('/me', validate({ body: facultyProfileUpdateSchema }), async (req, res) => {
  res.json({ profile: await updateFacultyProfile(req.auth!.userId, req.body) });
});

facultyRouter.get('/collaborations', async (req, res) => {
  const { type, status } = req.query;
  res.json({
    collaborations: await listCollaborations(req.auth!.userId, {
      type: typeof type === 'string' ? type : undefined,
      status: typeof status === 'string' ? status : undefined,
    }),
  });
});
facultyRouter.post(
  '/collaborations',
  validate({ body: collaborationInputSchema }),
  async (req, res) => {
    res.status(201).json({ collaboration: await createCollaboration(req.auth!.userId, req.body) });
  },
);
facultyRouter.patch(
  '/collaborations/:id',
  validate({ body: collaborationUpdateSchema }),
  async (req, res) => {
    res.json({ collaboration: await updateCollaboration(req.auth!.userId, getId(req), req.body) });
  },
);

facultyRouter.get('/insights', async (req, res) => {
  res.json({ insights: await getInsights(insightsQuerySchema.parse(req.query)) });
});
