import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import * as fake from './fakeModels';

vi.mock('../src/models', () => import('./fakeModels'));

const app = createApp({ CLIENT_URL: 'http://localhost:5173' });
const DAY = 86_400_000;
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();

beforeEach(() => {
  for (const m of Object.values(fake)) m.reset();
});

async function signUp(role: 'student' | 'mentor' | 'recruiter', email: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: `${role} ${email}`, email, password: 'Passw0rdOK', role });
  return { token: res.body.accessToken as string, id: res.body.user.id as string };
}
const as = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('student profile', () => {
  it('updates and returns the profile, rejecting bad skills', async () => {
    const { token } = await signUp('student', 's@x.com');
    const patch = await request(app)
      .patch('/api/students/me')
      .set(as(token))
      .send({
        course: 'CSIT',
        targetRole: 'Backend Engineer',
        skills: [{ name: 'Node.js', proficiency: 70 }],
      });
    expect(patch.status).toBe(200);
    expect(patch.body.profile).toMatchObject({
      course: 'CSIT',
      skills: [{ name: 'Node.js', proficiency: 70 }],
    });

    const get = await request(app).get('/api/students/me').set(as(token));
    expect(get.body.profile.targetRole).toBe('Backend Engineer');

    for (const skills of [
      [{ name: 'Go', proficiency: 101 }],
      [
        { name: 'Go', proficiency: 5 },
        { name: 'go', proficiency: 9 },
      ],
    ]) {
      const bad = await request(app).patch('/api/students/me').set(as(token)).send({ skills });
      expect(bad.status).toBe(400);
    }
  });

  it('is student-only', async () => {
    const { token } = await signUp('mentor', 'm@x.com');
    expect((await request(app).patch('/api/students/me').set(as(token)).send({})).status).toBe(403);
  });
});

describe('opportunities', () => {
  let company: { _id: string };
  beforeEach(async () => {
    company = (await fake.OrganizationModel.create({ name: 'TechNova', type: 'company' })) as {
      _id: string;
    };
    const base = { company: company._id, description: 'desc' };
    await fake.OpportunityModel.create({
      ...base,
      title: 'React Intern',
      kind: 'internship',
      skills: ['React'],
      createdAt: new Date(3),
    });
    await fake.OpportunityModel.create({
      ...base,
      title: 'Node Gig',
      kind: 'gig',
      skills: ['Node.js'],
      createdAt: new Date(2),
    });
    await fake.OpportunityModel.create({
      ...base,
      title: 'Java Developer',
      kind: 'job',
      skills: ['Java'],
      createdAt: new Date(1),
    });
    await fake.OpportunityModel.create({
      ...base,
      title: 'Old Role',
      kind: 'job',
      status: 'closed',
    });
  });

  it('requires login', async () => {
    expect((await request(app).get('/api/opportunities')).status).toBe(401);
  });

  it('lists open opportunities newest first, with the company name', async () => {
    const { token } = await signUp('student', 's@x.com');
    const res = await request(app).get('/api/opportunities').set(as(token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items.map((o: { title: string }) => o.title)).toEqual([
      'React Intern',
      'Node Gig',
      'Java Developer',
    ]);
    expect(res.body.items[0].company).toBe('TechNova');
  });

  it('filters by kind, title search and skill, and paginates', async () => {
    const { token } = await signUp('student', 's@x.com');
    const get = (qs: string) => request(app).get(`/api/opportunities?${qs}`).set(as(token));
    expect((await get('kind=gig')).body.items).toHaveLength(1);
    expect((await get('q=react')).body.items[0].title).toBe('React Intern');
    expect((await get('skill=JAVA')).body.items[0].title).toBe('Java Developer');
    const page2 = await get('limit=2&page=2');
    expect(page2.body).toMatchObject({ total: 3, page: 2, limit: 2 });
    expect(page2.body.items).toHaveLength(1);
    expect((await get('kind=bogus')).status).toBe(400);
  });

  it('shows one opportunity, 404 for unknown and 400 for a malformed id', async () => {
    const { token } = await signUp('student', 's@x.com');
    const id = fake.OpportunityModel.all()[0]!._id;
    expect(
      (await request(app).get(`/api/opportunities/${id}`).set(as(token))).body.opportunity.title,
    ).toBe('React Intern');
    expect(
      (await request(app).get('/api/opportunities/aaaaaaaaaaaaaaaaaaaaaaaa').set(as(token))).status,
    ).toBe(404);
    expect((await request(app).get('/api/opportunities/nope').set(as(token))).status).toBe(400);
  });

  it('lets a student apply once, and blocks closed, expired and non-student applications', async () => {
    const { token } = await signUp('student', 's@x.com');
    const [open, , , closed] = fake.OpportunityModel.all();
    const apply = (id: unknown, t = token) =>
      request(app).post(`/api/opportunities/${id}/apply`).set(as(t)).send({ message: 'Hi' });

    expect((await apply(open!._id)).status).toBe(201);
    const again = await apply(open!._id);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_APPLIED');
    expect((await apply(closed!._id)).body.error.code).toBe('CLOSED');

    const expired = await fake.OpportunityModel.create({
      company: company._id,
      title: 'Late',
      kind: 'job',
      description: 'd',
      deadline: new Date(Date.now() - DAY),
    });
    expect((await apply(expired._id)).body.error.code).toBe('DEADLINE_PASSED');

    const recruiter = await signUp('recruiter', 'r@x.com');
    expect((await apply(open!._id, recruiter.token)).status).toBe(403);
  });
});

describe('applications', () => {
  it('lists my applications with opportunity details and supports withdrawing once', async () => {
    const company = await fake.OrganizationModel.create({ name: 'CloudSphere', type: 'company' });
    const opp = await fake.OpportunityModel.create({
      company: company._id,
      title: 'API Gig',
      kind: 'gig',
      description: 'd',
    });
    const a = await signUp('student', 'a@x.com');
    const b = await signUp('student', 'b@x.com');
    await request(app).post(`/api/opportunities/${opp._id}/apply`).set(as(a.token)).send({});

    const list = await request(app).get('/api/applications/me').set(as(a.token));
    expect(list.body.applications).toHaveLength(1);
    expect(list.body.applications[0]).toMatchObject({
      status: 'submitted',
      opportunity: { title: 'API Gig', kind: 'gig', company: 'CloudSphere' },
    });
    expect(
      (await request(app).get('/api/applications/me').set(as(b.token))).body.applications,
    ).toHaveLength(0);

    const id = list.body.applications[0].id;
    expect(
      (await request(app).post(`/api/applications/${id}/withdraw`).set(as(b.token))).status,
    ).toBe(404);
    expect(
      (await request(app).post(`/api/applications/${id}/withdraw`).set(as(a.token))).body
        .application.status,
    ).toBe('withdrawn');
    expect(
      (await request(app).post(`/api/applications/${id}/withdraw`).set(as(a.token))).status,
    ).toBe(409);
  });
});

describe('mentors and sessions', () => {
  let mentor: { token: string; id: string };
  let mentorProfileId: string;
  beforeEach(async () => {
    mentor = await signUp('mentor', 'm@x.com');
    const company = await fake.OrganizationModel.create({ name: 'TechNova', type: 'company' });
    const profile = fake.MentorProfileModel.all()[0]!;
    Object.assign(profile, { title: 'Architect', company: company._id, expertise: ['Node.js'] });
    mentorProfileId = profile._id;
  });

  const book = (token: string, startsAt: string, topic = 'System design') =>
    request(app)
      .post(`/api/mentors/${mentorProfileId}/sessions`)
      .set(as(token))
      .send({ startsAt, topic });

  it('lists mentors with name, title and company', async () => {
    const { token } = await signUp('student', 's@x.com');
    const res = await request(app).get('/api/mentors').set(as(token));
    expect(res.body.mentors[0]).toMatchObject({
      id: mentorProfileId,
      title: 'Architect',
      company: 'TechNova',
      expertise: ['Node.js'],
    });
    expect(res.body.mentors[0].name).toContain('mentor');
  });

  it('books a session, rejects past/too-far times, double bookings and mentors booking', async () => {
    const s1 = await signUp('student', 's1@x.com');
    const s2 = await signUp('student', 's2@x.com');
    const slot = inDays(2);

    const ok = await book(s1.token, slot);
    expect(ok.status).toBe(201);
    expect(ok.body.session).toMatchObject({ status: 'pending', topic: 'System design' });

    const taken = await book(s2.token, slot);
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe('SLOT_TAKEN');
    expect((await book(s2.token, inDays(-1))).status).toBe(400);
    expect((await book(s2.token, inDays(200))).status).toBe(400);
    expect((await book(s2.token, 'tomorrow-ish')).status).toBe(400);
    expect((await book(mentor.token, inDays(3))).status).toBe(403);
  });

  it('lets the mentor run the lifecycle, limits the student to cancelling, and frees cancelled slots', async () => {
    const student = await signUp('student', 's@x.com');
    const stranger = await signUp('student', 'other@x.com');
    const slot = inDays(2);
    const id = (await book(student.token, slot)).body.session.id as string;
    const patch = (token: string, status: string) =>
      request(app).patch(`/api/sessions/${id}`).set(as(token)).send({ status });

    expect((await patch(stranger.token, 'cancelled')).status).toBe(404);
    expect((await patch(student.token, 'confirmed')).status).toBe(403);
    expect((await patch(mentor.token, 'completed')).status).toBe(409); // must confirm first
    expect((await patch(mentor.token, 'confirmed')).body.session.status).toBe('confirmed');

    const mine = await request(app).get('/api/sessions/me').set(as(mentor.token));
    expect(mine.body.sessions).toHaveLength(1);
    expect(mine.body.sessions[0].student.name).toContain('student');
    expect(
      (await request(app).get('/api/sessions/me').set(as(stranger.token))).body.sessions,
    ).toHaveLength(0);

    expect((await patch(student.token, 'cancelled')).body.session.status).toBe('cancelled');
    expect((await patch(mentor.token, 'confirmed')).status).toBe(409); // cancelled is final
    expect((await book(stranger.token, slot)).status).toBe(201); // slot is free again
  });
});
