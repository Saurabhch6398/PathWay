import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import * as fake from './fakeModels';

vi.mock('../src/models', () => import('./fakeModels'));

const app = createApp({ CLIENT_URL: 'http://localhost:5173' });
const as = (token: string) => ({ Authorization: `Bearer ${token}` });
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

beforeEach(() => {
  for (const m of Object.values(fake)) m.reset();
});

type Role = 'student' | 'mentor' | 'faculty';
async function signUp(role: Role, email: string, name = `${role} ${email}`) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'Passw0rdOK', role });
  return { token: res.body.accessToken as string, id: res.body.user.id as string };
}

describe('mentor profile', () => {
  it('lets a mentor edit their profile and hide themselves from students', async () => {
    const mentor = await signUp('mentor', 'm@x.com', 'Priya Sharma');
    const student = await signUp('student', 's@x.com');
    const patch = (body: object) =>
      request(app).patch('/api/mentors/me').set(as(mentor.token)).send(body);

    const res = await patch({
      title: 'Staff Engineer',
      companyName: 'Acme',
      experienceYears: 9,
      expertise: ['Go', 'Kubernetes'],
    });
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({
      title: 'Staff Engineer',
      companyName: 'Acme',
      experienceYears: 9,
      available: true,
    });
    expect(
      (await request(app).get('/api/mentors/me').set(as(mentor.token))).body.profile.expertise,
    ).toEqual(['Go', 'Kubernetes']);

    const list = await request(app).get('/api/mentors').set(as(student.token));
    expect(list.body.mentors[0]).toMatchObject({
      name: 'Priya Sharma',
      title: 'Staff Engineer',
      company: 'Acme',
    });

    await patch({ available: false });
    expect(
      (await request(app).get('/api/mentors').set(as(student.token))).body.mentors,
    ).toHaveLength(0);
  });

  it('validates input and keeps the area mentor-only', async () => {
    const mentor = await signUp('mentor', 'm@x.com');
    const student = await signUp('student', 's@x.com');
    const patch = (body: object) =>
      request(app).patch('/api/mentors/me').set(as(mentor.token)).send(body);
    expect((await patch({ expertise: ['Go', 'go'] })).status).toBe(400);
    expect((await patch({ experienceYears: -1 })).status).toBe(400);
    expect((await request(app).get('/api/mentors/me').set(as(student.token))).status).toBe(403);
    expect((await request(app).get('/api/mentors/me/mentees').set(as(student.token))).status).toBe(
      403,
    );
  });
});

describe('mentee pipeline', () => {
  let mentor: { token: string; id: string };
  let mentorProfileId: string;
  beforeEach(async () => {
    mentor = await signUp('mentor', 'm@x.com');
    mentorProfileId = fake.MentorProfileModel.all()[0]!._id;
  });

  const book = (token: string, days: number, topic = 'Career planning') =>
    request(app)
      .post(`/api/mentors/${mentorProfileId}/sessions`)
      .set(as(token))
      .send({ startsAt: inDays(days), topic });
  const setStatus = (id: string, status: string, token = mentor.token) =>
    request(app).patch(`/api/sessions/${id}`).set(as(token)).send({ status });

  it('builds the pipeline from real sessions, ignoring declined requests', async () => {
    const asha = await signUp('student', 'asha@x.com', 'Asha Rao');
    const ravi = await signUp('student', 'ravi@x.com', 'Ravi Kumar');
    await request(app)
      .patch('/api/students/me')
      .set(as(asha.token))
      .send({ course: 'CSIT', targetRole: 'SRE', skills: [{ name: 'Linux', proficiency: 60 }] });

    const a1 = (await book(asha.token, 2)).body.session.id;
    const a2 = (await book(asha.token, 3)).body.session.id;
    await setStatus(a1, 'confirmed');
    await setStatus(a2, 'confirmed');
    await setStatus(a2, 'completed');
    const r1 = (await book(ravi.token, 4)).body.session.id;
    await setStatus(r1, 'cancelled'); // declined: Ravi is not a mentee

    const res = await request(app).get('/api/mentors/me/mentees').set(as(mentor.token));
    expect(res.body.mentees).toHaveLength(1);
    expect(res.body.mentees[0]).toMatchObject({
      stage: 'new',
      notes: '',
      sessions: { total: 2, completed: 1, upcoming: 1 },
      student: {
        id: asha.id,
        name: 'Asha Rao',
        course: 'CSIT',
        targetRole: 'SRE',
        skills: [{ name: 'Linux', proficiency: 60 }],
      },
    });
    expect(JSON.stringify(res.body)).not.toContain('@x.com');

    const pending = await book(ravi.token, 5);
    expect(pending.status).toBe(201);
    const summary = await request(app).get('/api/mentors/me/summary').set(as(mentor.token));
    expect(summary.body.summary).toEqual({
      pendingRequests: 1,
      upcomingConfirmed: 1,
      completedSessions: 1,
      mentees: 2,
    });
  });

  it('saves stage and private notes, only for real mentees, and never shows notes to students', async () => {
    const asha = await signUp('student', 'asha@x.com', 'Asha Rao');
    const stranger = await signUp('student', 'o@x.com', 'Other Student');
    const otherMentor = await signUp('mentor', 'm2@x.com');
    await book(asha.token, 2);

    const patch = (id: string, body: object, token = mentor.token) =>
      request(app).patch(`/api/mentors/me/mentees/${id}`).set(as(token)).send(body);

    expect(
      (await patch(asha.id, { stage: 'active', notes: 'Strong in DSA; weak on system design.' }))
        .body.mentee,
    ).toEqual({
      stage: 'active',
      notes: 'Strong in DSA; weak on system design.',
    });
    expect((await patch(asha.id, { stage: 'paused' })).body.mentee).toEqual({
      stage: 'paused',
      notes: 'Strong in DSA; weak on system design.',
    });
    expect(fake.MentorshipModel.all()).toHaveLength(1); // updated in place, not duplicated

    const list = await request(app).get('/api/mentors/me/mentees').set(as(mentor.token));
    expect(list.body.mentees[0]).toMatchObject({
      stage: 'paused',
      notes: 'Strong in DSA; weak on system design.',
    });

    expect((await patch(stranger.id, { stage: 'active' })).status).toBe(404); // never booked with this mentor
    expect((await patch(asha.id, { stage: 'active' }, otherMentor.token)).status).toBe(404); // someone else's mentee
    expect((await patch(asha.id, { stage: 'hired' })).status).toBe(400);
    expect((await patch(asha.id, {})).status).toBe(400);
    expect(
      (await request(app).get('/api/mentors/me/mentees').set(as(otherMentor.token))).body.mentees,
    ).toHaveLength(0);

    const mine = await request(app).get('/api/sessions/me').set(as(asha.token));
    expect(JSON.stringify(mine.body)).not.toContain('system design');
  });
});

describe('faculty profile and collaborations', () => {
  const body = {
    type: 'mou',
    title: 'Cloud skilling MoU',
    partner: 'CloudSphere Systems',
    startDate: '2027-01-10',
    endDate: '2027-12-31',
  };

  it('updates the faculty profile and is faculty-only', async () => {
    const f = await signUp('faculty', 'f@x.com');
    const s = await signUp('student', 's@x.com');
    const res = await request(app)
      .patch('/api/faculty/me')
      .set(as(f.token))
      .send({ collegeName: 'Demo University', department: 'CSE' });
    expect(res.body.profile).toEqual({ collegeName: 'Demo University', department: 'CSE' });
    expect((await request(app).get('/api/faculty/me').set(as(s.token))).status).toBe(403);
  });

  it('creates drafts, validates input and filters the list', async () => {
    const f = await signUp('faculty', 'f@x.com');
    const create = (b: object) =>
      request(app).post('/api/faculty/collaborations').set(as(f.token)).send(b);

    const ok = await create(body);
    expect(ok.status).toBe(201);
    expect(ok.body.collaboration).toMatchObject({
      type: 'mou',
      status: 'draft',
      startDate: '2027-01-10',
      endDate: '2027-12-31',
    });
    await create({ type: 'fdp', title: 'AI FDP', partner: 'TechNova Labs' });

    expect((await create({ ...body, type: 'party' })).status).toBe(400);
    expect((await create({ ...body, startDate: '2027-05-01', endDate: '2027-04-01' })).status).toBe(
      400,
    );
    expect((await create({ ...body, startDate: 'next week' })).status).toBe(400);
    expect((await create({ ...body, partner: '' })).status).toBe(400);

    const get = (qs: string) =>
      request(app).get(`/api/faculty/collaborations?${qs}`).set(as(f.token));
    expect((await get('')).body.collaborations).toHaveLength(2);
    expect((await get('type=fdp')).body.collaborations).toHaveLength(1);
    expect((await get('status=active')).body.collaborations).toHaveLength(0);
  });

  it('enforces the lifecycle, protects finished records and keeps fields on partial edits', async () => {
    const f = await signUp('faculty', 'f@x.com');
    const id = (await request(app).post('/api/faculty/collaborations').set(as(f.token)).send(body))
      .body.collaboration.id;
    const patch = (b: object) =>
      request(app).patch(`/api/faculty/collaborations/${id}`).set(as(f.token)).send(b);

    expect((await patch({ status: 'active' })).body.error.code).toBe('INVALID_STATE'); // draft can't skip "proposed"
    const edit = await patch({ title: 'Cloud skilling MoU v2', notes: 'Signed copy pending' });
    expect(edit.body.collaboration).toMatchObject({
      title: 'Cloud skilling MoU v2',
      partner: 'CloudSphere Systems',
      startDate: '2027-01-10',
      status: 'draft',
    });
    expect((await patch({ endDate: '2026-12-01' })).body.error.code).toBe('INVALID_DATES'); // vs the stored start date

    expect((await patch({ status: 'proposed' })).body.collaboration.status).toBe('proposed');
    expect((await patch({ status: 'active' })).body.collaboration.status).toBe('active');
    expect((await patch({ status: 'completed' })).body.collaboration.status).toBe('completed');
    expect((await patch({ title: 'Too late' })).body.error.code).toBe('INVALID_STATE');
    expect((await patch({ status: 'active' })).status).toBe(409);
  });

  it('keeps each faculty member’s records private', async () => {
    const a = await signUp('faculty', 'a@x.com');
    const b = await signUp('faculty', 'b@x.com');
    const id = (await request(app).post('/api/faculty/collaborations').set(as(a.token)).send(body))
      .body.collaboration.id;
    expect(
      (await request(app).get('/api/faculty/collaborations').set(as(b.token))).body.collaborations,
    ).toHaveLength(0);
    expect(
      (
        await request(app)
          .patch(`/api/faculty/collaborations/${id}`)
          .set(as(b.token))
          .send({ status: 'proposed' })
      ).status,
    ).toBe(404);
  });
});

describe('cohort insights', () => {
  const insights = (token: string, qs = '') =>
    request(app).get(`/api/faculty/insights?${qs}`).set(as(token));

  async function seedCohort() {
    const mk = async (email: string, patch: object) => {
      const s = await signUp('student', email);
      await request(app).patch('/api/students/me').set(as(s.token)).send(patch);
      return s;
    };
    const students = [
      await mk('1@x.com', {
        course: 'CSIT',
        targetRole: 'Backend Engineer',
        skills: [
          { name: 'Node.js', proficiency: 60 },
          { name: 'React', proficiency: 50 },
        ],
      }),
      await mk('2@x.com', {
        course: 'CSIT',
        targetRole: 'backend engineer',
        skills: [
          { name: 'node.js', proficiency: 80 },
          { name: 'React', proficiency: 70 },
        ],
      }),
      await mk('3@x.com', {
        course: 'CSIT',
        targetRole: 'Backend Engineer',
        skills: [{ name: 'Node.js', proficiency: 100 }],
      }),
      await mk('4@x.com', {
        course: 'ECE',
        targetRole: 'Designer',
        skills: [{ name: 'Figma', proficiency: 90 }],
      }),
    ];
    const company = await fake.OrganizationModel.create({ name: 'Acme', type: 'company' });
    const opp = await fake.OpportunityModel.create({
      company: company._id,
      title: 'Role',
      kind: 'job',
      description: 'd',
    });
    for (const s of students.slice(0, 3))
      await request(app).post(`/api/opportunities/${opp._id}/apply`).set(as(s.token)).send({});
    fake.ApplicationModel.all()[0]!.status = 'accepted';
    fake.ApplicationModel.all()[1]!.status = 'shortlisted';
    return students;
  }

  it('aggregates a cohort and hides groups smaller than the minimum size', async () => {
    const f = await signUp('faculty', 'f@x.com');
    await seedCohort();

    const res = await insights(f.token, 'course=csit'); // case-insensitive
    expect(res.status).toBe(200);
    expect(res.body.insights).toMatchObject({
      students: 3,
      minGroupSize: 3,
      restricted: false,
      applications: { total: 3, shortlisted: 1, accepted: 1, rejected: 0 },
    });
    // Node.js has 3 students (merged case-insensitively); React has only 2, so it is hidden.
    expect(res.body.insights.topSkills).toEqual([
      { name: 'Node.js', students: 3, averageProficiency: 80 },
    ]);
    expect(res.body.insights.targetRoles).toEqual([{ role: 'Backend Engineer', students: 3 }]);
  });

  it('shows only a headcount for cohorts that are too small to be anonymous', async () => {
    const f = await signUp('faculty', 'f@x.com');
    await seedCohort();
    const res = await insights(f.token, 'course=ECE');
    expect(res.body.insights).toMatchObject({
      students: 1,
      restricted: true,
      topSkills: [],
      targetRoles: [],
      applications: { total: 0, shortlisted: 0, accepted: 0, rejected: 0 },
    });
  });

  it('is faculty-only', async () => {
    const s = await signUp('student', 's@x.com');
    expect((await insights(s.token)).status).toBe(403);
  });
});
