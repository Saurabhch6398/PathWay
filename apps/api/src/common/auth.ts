import type { RequestHandler } from 'express';
import type { Role } from '@pathway/shared';
import { forbidden, unauthorized } from './errors';
import { verifyAccessToken } from '../modules/auth/token.service';

/** Requires `Authorization: Bearer <access token>` and sets `req.auth`. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(unauthorized('Missing access token'));
  try {
    req.auth = verifyAccessToken(header.slice(7));
    next();
  } catch (err) {
    next(err);
  }
};

/** Use after `authenticate`: only the listed roles (admin always passes). */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    const role = req.auth?.role;
    if (!role) return next(unauthorized());
    if (role !== 'admin' && !roles.includes(role))
      return next(forbidden('Insufficient permissions'));
    next();
  };
