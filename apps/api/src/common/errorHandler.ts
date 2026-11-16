import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError, z } from 'zod';
import { AppError } from './errors';

export const notFoundHandler: RequestHandler = (req, res) => {
  res
    .status(404)
    .json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: z.flattenError(err) },
    });
  }
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
  }
  // Client errors raised by Express itself (malformed JSON, oversized body, ...).
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const tooLarge = status === 413;
    return res.status(status).json({
      error: {
        code: tooLarge ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        message: tooLarge ? 'Request body is too large' : 'Invalid request',
      },
    });
  }
  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
};
