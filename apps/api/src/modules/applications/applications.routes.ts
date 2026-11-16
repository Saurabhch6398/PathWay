import { Router } from 'express';
import { authenticate, requireRole } from '../../common/auth';
import { getId } from '../../common/validate';
import * as service from './applications.service';

export const applicationsRouter = Router();

applicationsRouter.use(authenticate, requireRole('student'));

applicationsRouter.get('/me', async (req, res) => {
  res.json({ applications: await service.listMyApplications(req.auth!.userId) });
});

applicationsRouter.post('/:id/withdraw', async (req, res) => {
  res.json({ application: await service.withdrawApplication(req.auth!.userId, getId(req)) });
});
