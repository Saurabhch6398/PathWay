import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/** Per-user limit for endpoints that cost money (LLM calls). Use after `authenticate`. */
export const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? ''),
  message: { error: { code: 'RATE_LIMITED', message: 'Too many AI requests, slow down a little' } },
});
