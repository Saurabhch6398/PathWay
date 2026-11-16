import { Router } from 'express';
import { sessionStatusSchema } from '@pathway/shared';
import { authenticate, requireRole } from '../../common/auth';
import { getId, validate } from '../../common/validate';
import * as service from './sessions.service';

export const sessionsRouter = Router();

sessionsRouter.use(authenticate, requireRole('student', 'mentor'));

sessionsRouter.get('/me', async (req, res) => {
  const role = req.auth!.role === 'mentor' ? 'mentor' : 'student';
  res.json({ sessions: await service.listMySessions(req.auth!.userId, role) });
});

sessionsRouter.patch('/:id', validate({ body: sessionStatusSchema }), async (req, res) => {
  res.json({
    session: await service.updateSessionStatus(req.auth!.userId, getId(req), req.body.status),
  });
});
