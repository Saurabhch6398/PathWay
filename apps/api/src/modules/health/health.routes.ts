import { Router } from 'express';
import mongoose from 'mongoose';
import type { HealthResponse } from '@pathway/shared';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  const body: HealthResponse = {
    status: connected ? 'ok' : 'degraded',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database: connected ? 'connected' : 'disconnected',
  };
  res.status(connected ? 200 : 503).json(body);
});
