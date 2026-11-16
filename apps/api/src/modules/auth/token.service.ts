import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { roleSchema, type Role } from '@pathway/shared';
import { getEnv } from '../../config/env';
import { unauthorized } from '../../common/errors';
import { RefreshTokenModel } from '../../models';

export const ACCESS_TTL = '15m';
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export function signAccessToken(user: { id: string; role: Role }): string {
  return jwt.sign({ role: user.role }, getEnv().JWT_ACCESS_SECRET, {
    subject: user.id,
    expiresIn: ACCESS_TTL,
    algorithm: 'HS256',
  });
}

const accessPayload = z.object({ sub: z.string(), role: roleSchema });

export function verifyAccessToken(token: string): { userId: string; role: Role } {
  try {
    const decoded = jwt.verify(token, getEnv().JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
    const { sub, role } = accessPayload.parse(decoded);
    return { userId: sub, role };
  } catch {
    throw unauthorized('Invalid or expired token');
  }
}

/** Opaque random token; the raw value goes to the client cookie, the hash to the DB. */
export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(48).toString('hex');
  await RefreshTokenModel.create({
    user: userId,
    tokenHash: sha256(raw),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return raw;
}

/** Single-use: the old token is deleted atomically, so replaying it fails. */
export async function consumeRefreshToken(raw: string): Promise<string> {
  const doc = await RefreshTokenModel.findOneAndDelete({ tokenHash: sha256(raw) });
  if (!doc || doc.expiresAt.getTime() < Date.now()) throw unauthorized('Session expired');
  return String(doc.user);
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  await RefreshTokenModel.deleteOne({ tokenHash: sha256(raw) });
}
