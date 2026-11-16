import { Router } from 'express';
import { chatRequestSchema, createTicketSchema, ticketStatusSchema } from '@pathway/shared';
import { authenticate, requireRole } from '../../common/auth';
import { aiLimiter } from '../../common/rateLimit';
import { getId, validate } from '../../common/validate';
import * as service from './helpdesk.service';

export const helpdeskRouter = Router();

helpdeskRouter.use(authenticate);

helpdeskRouter.post('/chat', aiLimiter, validate({ body: chatRequestSchema }), async (req, res) => {
  res.json({ reply: await service.helpdeskReply(req.body.messages) });
});

helpdeskRouter.post('/tickets', validate({ body: createTicketSchema }), async (req, res) => {
  res.status(201).json({ ticket: await service.createTicket(req.auth!.userId, req.body) });
});

helpdeskRouter.get('/tickets/me', async (req, res) => {
  res.json({ tickets: await service.listMyTickets(req.auth!.userId) });
});

// Admin-only (requireRole always lets `admin` through, and nobody else is listed).
helpdeskRouter.get('/tickets', requireRole(), async (_req, res) => {
  res.json({ tickets: await service.listAllTickets() });
});

helpdeskRouter.patch(
  '/tickets/:id',
  requireRole(),
  validate({ body: ticketStatusSchema }),
  async (req, res) => {
    res.json({ ticket: await service.updateTicketStatus(getId(req), req.body.status) });
  },
);
