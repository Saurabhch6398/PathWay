import { Router } from 'express';
import { studentProfileUpdateSchema } from '@pathway/shared';
import { authenticate, requireRole } from '../../common/auth';
import { validate } from '../../common/validate';
import * as service from './students.service';

export const studentsRouter = Router();

studentsRouter.use(authenticate, requireRole('student'));

studentsRouter.get('/me', async (req, res) => {
  res.json({ profile: await service.getStudentProfile(req.auth!.userId) });
});

studentsRouter.patch('/me', validate({ body: studentProfileUpdateSchema }), async (req, res) => {
  res.json({ profile: await service.updateStudentProfile(req.auth!.userId, req.body) });
});
