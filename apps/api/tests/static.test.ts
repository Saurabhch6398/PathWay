import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';

vi.mock('../src/models', () => import('./fakeModels'));

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pathway-web-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><div id="root"></div>');
  fs.writeFileSync(path.join(dir, 'assets', 'index-abc123.js'), 'console.log(1)');
  fs.writeFileSync(path.join(dir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const app = () => createApp({ CLIENT_URL: 'http://localhost:5173', staticDir: dir });

describe('serving the web app', () => {
  it('serves index.html at / and for client-side routes, without caching it', async () => {
    for (const route of ['/', '/login', '/student/opportunities/abc123']) {
      const res = await request(app()).get(route);
      expect(res.status).toBe(200);
      expect(res.text).toContain('id="root"');
      expect(res.headers['cache-control']).toBe('no-cache');
    }
  });

  it('caches hashed assets for a year and revalidates other files', async () => {
    const asset = await request(app()).get('/assets/index-abc123.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    const icon = await request(app()).get('/favicon.svg');
    expect(icon.status).toBe(200);
    expect(icon.headers['cache-control']).toContain('max-age=0');
  });

  it('does not turn missing files or API routes into index.html', async () => {
    expect((await request(app()).get('/assets/missing.js')).status).toBe(404);
    expect((await request(app()).get('/robots.txt')).status).toBe(404);
    const api = await request(app()).get('/api/nope');
    expect(api.status).toBe(404);
    expect(api.headers['content-type']).toContain('application/json');
    expect((await request(app()).post('/login').send({})).status).toBe(404); // only GET/HEAD get the page
  });

  it('keeps API responses out of caches', async () => {
    const res = await request(app()).get('/api/health');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('refuses to start without a built web app', () => {
    expect(() => createApp({ CLIENT_URL: 'http://x', staticDir: path.join(dir, 'nope') })).toThrow(
      /Web app not found/,
    );
  });
});

describe('without a web app (development)', () => {
  it('leaves non-API routes as JSON 404s', async () => {
    const res = await request(createApp({ CLIENT_URL: 'http://localhost:5173' })).get('/');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
  });
});
