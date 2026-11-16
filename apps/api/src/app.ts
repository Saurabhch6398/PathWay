import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { Env } from './config/env';
import { requestLogger } from './common/requestLogger';
import { mountWebApp } from './common/staticWeb';
import { errorHandler, notFoundHandler } from './common/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { healthRouter } from './modules/health/health.routes';
import { aiRouter } from './modules/ai/ai.routes';
import { facultyRouter } from './modules/faculty/faculty.routes';
import { helpdeskRouter } from './modules/helpdesk/helpdesk.routes';
import { applicationsRouter } from './modules/applications/applications.routes';
import { mentorsRouter } from './modules/mentors/mentors.routes';
import { opportunitiesRouter } from './modules/opportunities/opportunities.routes';
import { recruiterRouter } from './modules/recruiter/recruiter.routes';
import { sessionsRouter } from './modules/sessions/sessions.routes';
import { studentsRouter } from './modules/students/students.routes';

/** Builds the Express app without side effects (no DB, no listen) so tests can import it. */
export interface AppOptions extends Pick<Env, 'CLIENT_URL'> {
  /** Built web app to serve alongside the API (production). */
  staticDir?: string;
  /** Reverse proxies in front of the app, so req.ip and rate limits use the real client address. */
  trustProxy?: number;
  logRequests?: boolean;
}

export function createApp(env: AppOptions) {
  const app = express();
  if (env.trustProxy) app.set('trust proxy', env.trustProxy);

  app.use(helmet());
  if (env.logRequests) app.use(requestLogger);
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  // API responses are per-user: never let a browser or proxy cache them.
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(
    '/api',
    rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }),
  );

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/students', studentsRouter);
  app.use('/api/opportunities', opportunitiesRouter);
  app.use('/api/applications', applicationsRouter);
  app.use('/api/mentors', mentorsRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/helpdesk', helpdeskRouter);
  app.use('/api/recruiter', recruiterRouter);
  app.use('/api/faculty', facultyRouter);

  if (env.staticDir) mountWebApp(app, env.staticDir);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
