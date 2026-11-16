import type { Role } from '@pathway/shared';

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate` once the access token has been verified. */
      auth?: { userId: string; role: Role };
    }
  }
}
