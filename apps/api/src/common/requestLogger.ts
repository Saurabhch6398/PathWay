import type { RequestHandler } from 'express';

/** One JSON line per request (path only, so tokens or query strings never reach the logs). */
export const requestLogger: RequestHandler = (req, res, next) => {
  if (req.path === '/api/health') return next(); // platform health checks are noise
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    console.log(
      JSON.stringify({
        t: new Date().toISOString(),
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Math.round(Number(process.hrtime.bigint() - started) / 1e6),
        user: req.auth?.userId,
      }),
    );
  });
  next();
};
