import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import * as fake from './fakeModels';

vi.mock('../src/models', () => import('./fakeModels'));

const app = createApp({ CLIENT_URL: 'http://localhost:5173' });
const student = {
  name: 'Asha Rao',
  email: 'asha@example.com',
  password: 'Passw0rdOK',
  role: 'student',
};

beforeEach(() => {
  for (const m of Object.values(fake)) m.reset();
});

describe('POST /api/auth/register', () => {
  it('creates the user and role profile, returns a token and an httpOnly refresh cookie', async () => {
    const res = await request(app).post('/api/auth/register').send(student);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'asha@example.com', role: 'student' });
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(res.headers['set-cookie']?.[0]).toMatch(/pw_refresh=.*HttpOnly/i);
    expect(fake.StudentProfileModel.all()).toHaveLength(1);
    expect(fake.UserModel.all()[0]!.passwordHash).not.toBe(student.password);
  });

  it('normalises email casing and rejects duplicates with 409', async () => {
    await request(app).post('/api/auth/register').send(student);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...student, email: '  ASHA@Example.com ' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it.each([
    ['weak password', { password: 'short' }],
    ['password without a number', { password: 'onlyletters' }],
    ['bad email', { email: 'nope' }],
    ['admin self-registration', { role: 'admin' }],
  ])('rejects %s with 400', async (_name, patch) => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...student, ...patch });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(student);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: student.email, password: student.password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: student.email, password: 'Wrong1234' });
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'x@example.com', password: 'Wrong1234' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });
});

describe('GET /api/auth/me and RBAC', () => {
  it('requires a valid bearer token', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const bad = await request(app).get('/api/auth/me').set('Authorization', 'Bearer garbage');
    expect(bad.status).toBe(401);
  });

  it('returns the current user', async () => {
    const reg = await request(app).post('/api/auth/register').send(student);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(student.email);
  });

  it('lets a student read /students/me but forbids a mentor', async () => {
    const s = await request(app).post('/api/auth/register').send(student);
    const m = await request(app)
      .post('/api/auth/register')
      .send({ ...student, email: 'mentor@example.com', role: 'mentor' });

    const ok = await request(app)
      .get('/api/students/me')
      .set('Authorization', `Bearer ${s.body.accessToken}`);
    expect(ok.status).toBe(200);
    const denied = await request(app)
      .get('/api/students/me')
      .set('Authorization', `Bearer ${m.body.accessToken}`);
    expect(denied.status).toBe(403);
  });
});

describe('refresh + logout', () => {
  it('rotates the refresh token and rejects reuse of the old one', async () => {
    const reg = await request(app).post('/api/auth/register').send(student);
    const oldCookie = reg.headers['set-cookie']![0]!.split(';')[0]!;

    const first = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie);
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toEqual(expect.any(String));
    const newCookie = first.headers['set-cookie']![0]!.split(';')[0]!;
    expect(newCookie).not.toBe(oldCookie);

    const replay = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie);
    expect(replay.status).toBe(401);
  });

  it('has no session without a cookie', async () => {
    expect((await request(app).post('/api/auth/refresh')).status).toBe(401);
  });

  it('logout revokes the refresh token', async () => {
    const reg = await request(app).post('/api/auth/register').send(student);
    const cookie = reg.headers['set-cookie']![0]!.split(';')[0]!;
    expect((await request(app).post('/api/auth/logout').set('Cookie', cookie)).status).toBe(204);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).status).toBe(401);
  });
});

describe('concurrent sign-ups', () => {
  it('returns 409 (not 500) for the loser when two requests race on the same email', async () => {
    const results = await Promise.all([
      request(app).post('/api/auth/register').send(student),
      request(app).post('/api/auth/register').send(student),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(fake.UserModel.all()).toHaveLength(1);
  });
});
