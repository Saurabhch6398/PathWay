import { Router } from 'express';
import { applySchema, opportunityQuerySchema } from '@pathway/shared';
import { authenticate, requireRole } from '../../common/auth';
import { getId, validate } from '../../common/validate';
import * as service from './opportunities.service';

export const opportunitiesRouter = Router();

opportunitiesRouter.use(authenticate);

opportunitiesRouter.get('/', async (req, res) => {
  res.json(await service.listOpportunities(opportunityQuerySchema.parse(req.query)));
});

opportunitiesRouter.get('/:id', async (req, res) => {
  res.json({ opportunity: await service.getOpportunity(getId(req)) });
});

opportunitiesRouter.post(
  '/:id/apply',
  requireRole('student'),
  validate({ body: applySchema }),
  async (req, res) => {
    const application = await service.applyToOpportunity(
      req.auth!.userId,
      getId(req),
      req.body.message,
    );
    res.status(201).json({ application });
  },
);
