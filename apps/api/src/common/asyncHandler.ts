import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Optional helper; Express 5 already forwards rejected promises to the error handler. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
