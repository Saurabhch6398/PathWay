import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginSchema, registerSchema } from '@pathway/shared';
import { authenticate } from '../../common/auth';
import { validate } from '../../common/validate';
import * as controller from './auth.controller';

export const authRouter = Router();

// Brute-force protection on the credential endpoints.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again later' } },
});

authRouter.post(
  '/register',
  credentialLimiter,
  validate({ body: registerSchema }),
  controller.register,
);
authRouter.post('/login', credentialLimiter, validate({ body: loginSchema }), controller.login);
authRouter.post('/refresh', controller.refresh);
authRouter.post('/logout', controller.logout);
authRouter.get('/me', authenticate, controller.me);
