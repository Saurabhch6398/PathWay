import fs from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';

/**
 * Serves the built React app from the same origin as the API (so the refresh-token cookie needs no CORS).
 * - /assets/* are content-hashed by Vite, so they are cached for a year.
 * - Everything else (index.html included) is revalidated, so a new deploy shows up immediately.
 * - Unknown client-side routes get index.html; /api/* and missing files (anything with an extension) do not.
 */
export function mountWebApp(app: Express, dir: string) {
  const root = path.resolve(dir);
  const indexFile = path.join(root, 'index.html');
  if (!fs.existsSync(indexFile)) {
    throw new Error(`Web app not found at ${root}. Run "npm run build" first or set STATIC_DIR.`);
  }

  app.use(
    '/assets',
    express.static(path.join(root, 'assets'), {
      maxAge: '1y',
      immutable: true,
    }),
  );
  app.use(express.static(root, { index: false, maxAge: 0 }));
  app.use((req, res, next) => {
    const wantsPage =
      (req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api');
    if (!wantsPage || path.extname(req.path)) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
  });
}
