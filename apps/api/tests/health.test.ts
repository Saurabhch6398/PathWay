import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@pathway/shared';
import { createApp } from '../src/app';
import { loadEnv } from '../src/config/env';

const app = createApp({ CLIENT_URL: 'http://localhost:5173' });

describe('GET /api/health', () => {
  it('returns a schema-valid body (degraded without a DB connection)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(healthResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('loadEnv', () => {
  it('rejects weak or missing secrets', () => {
    expect(() =>
      loadEnv({ MONGODB_URI: 'mongodb://x', JWT_ACCESS_SECRET: 'short' } as never),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });
});

describe('malformed requests', () => {
  it('answers 400 for broken JSON and 413 for oversized bodies (not 500)', async () => {
    const broken = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(broken.status).toBe(400);
    expect(broken.body.error.code).toBe('BAD_REQUEST');

    const big = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.co', password: 'x'.repeat(2_000_000) });
    expect(big.status).toBe(413);
    expect(big.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
