import { execFile } from 'node:child_process';
import fs from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';

vi.mock('../src/models', () => import('./fakeModels'));

const run = promisify(execFile);
const script = path.resolve(__dirname, '../../../scripts/smoke.mjs');
let server: Server;
let url: string;
let dir: string;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pathway-smoke-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><div id="root"></div>');
  // The real health check needs a database; pretend the connection is up.
  vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);
  server = createApp({ CLIENT_URL: 'http://localhost:5173', staticDir: dir }).listen(0);
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const smoke = (...args: string[]) =>
  run('node', [script, url, ...args]).then(
    (r) => ({ code: 0, out: r.stdout }),
    (e: { code: number; stdout: string }) => ({ code: e.code, out: e.stdout }),
  );

describe('scripts/smoke.mjs', () => {
  it('passes the read-only checks against a healthy deployment', async () => {
    const { code, out } = await smoke();
    expect(out).toContain('All checks passed');
    expect(out).not.toContain('✗');
    expect(code).toBe(0);
  });

  it('passes the account flow (register, cookie flags, refresh rotation, logout)', async () => {
    const { code, out } = await smoke('--register');
    expect(out).toContain('refresh rotates the token and rejects the old one');
    expect(out).not.toContain('✗');
    expect(code).toBe(0);
  });

  it('fails loudly when the database is down', async () => {
    vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(0);
    const { code, out } = await smoke();
    vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);
    expect(code).toBe(1);
    expect(out).toContain('✗ API is up and connected to the database');
  });
});
