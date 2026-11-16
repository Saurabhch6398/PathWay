import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { AdminError, createAdminUser } from '../src/db/createAdmin';
import * as fake from './fakeModels';

vi.mock('../src/models', () => import('./fakeModels'));

const app = createApp({ CLIENT_URL: 'http://localhost:5173' });
const input = { name: 'Site Admin', email: 'Admin@Example.com', password: 'a-long-passphrase-1' };

beforeEach(() => {
  for (const m of Object.values(fake)) m.reset();
});

describe('createAdminUser', () => {
  it('creates an admin who can sign in and use admin-only endpoints', async () => {
    expect(await createAdminUser(input)).toEqual({ email: 'admin@example.com', created: true });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: input.password });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('admin');
    const tickets = await request(app)
      .get('/api/helpdesk/tickets')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(tickets.status).toBe(200);
    expect(fake.UserModel.all()[0]!.passwordHash).not.toContain(input.password);
  });

  it('enforces a stronger password than ordinary sign-up', async () => {
    await expect(createAdminUser({ ...input, password: 'Passw0rd1' })).rejects.toThrow(
      /at least 12 characters/,
    );
    await expect(createAdminUser({ ...input, email: 'nope' })).rejects.toBeInstanceOf(AdminError);
    expect(fake.UserModel.all()).toHaveLength(0);
  });

  it('never silently changes an existing account, and promotes only when asked', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Normal Student',
      email: 'admin@example.com',
      password: 'Passw0rdOK',
      role: 'student',
    });

    await expect(createAdminUser(input)).rejects.toThrow(/already exists as a student.*--promote/);
    expect(fake.UserModel.all()[0]!.role).toBe('student');

    expect(await createAdminUser(input, true)).toEqual({
      email: 'admin@example.com',
      created: false,
    });
    expect(fake.UserModel.all()[0]!.role).toBe('admin');
    await expect(createAdminUser(input, true)).rejects.toThrow(/already an admin/);
  });
});
