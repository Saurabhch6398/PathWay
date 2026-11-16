import type { CookieOptions, Request, Response } from 'express';
import type { AuthResponse } from '@pathway/shared';
import { getEnv } from '../../config/env';
import { unauthorized } from '../../common/errors';
import * as authService from './auth.service';
import { REFRESH_TTL_MS, revokeRefreshToken } from './token.service';

const COOKIE = 'pw_refresh';

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: getEnv().NODE_ENV === 'production',
  path: '/api/auth', // the browser only sends it to auth endpoints
});

function respondWithSession(
  res: Response,
  session: { accessToken: string; refreshToken: string; user: AuthResponse['user'] },
  status = 200,
) {
  res.cookie(COOKIE, session.refreshToken, { ...cookieOptions(), maxAge: REFRESH_TTL_MS });
  res
    .status(status)
    .json({ accessToken: session.accessToken, user: session.user } satisfies AuthResponse);
}

export async function register(req: Request, res: Response) {
  respondWithSession(res, await authService.register(req.body), 201);
}

export async function login(req: Request, res: Response) {
  respondWithSession(res, await authService.login(req.body));
}

export async function refresh(req: Request, res: Response) {
  const raw = req.cookies?.[COOKIE];
  if (!raw) throw unauthorized('No session');
  try {
    respondWithSession(res, await authService.refresh(raw));
  } catch (err) {
    res.clearCookie(COOKIE, cookieOptions());
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  const raw = req.cookies?.[COOKIE];
  if (raw) await revokeRefreshToken(raw);
  res.clearCookie(COOKIE, cookieOptions());
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  res.json({ user: await authService.getCurrentUser(req.auth!.userId) });
}
