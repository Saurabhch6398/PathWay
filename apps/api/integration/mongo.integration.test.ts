/*
 * Integration tests against a real MongoDB:
 *   docker compose up -d mongo
 *   TEST_MONGODB_URI=mongodb://localhost:27017 npm run test:integration -w @pathway/api
 *
 * The unit tests use in-memory fakes. This suite covers what fakes can't prove: that the indexes really
 * exist and hold under simultaneous requests, and that populate / $elemMatch / array updates behave
 * on real documents.
 */
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { setAiProvider } from '../src/modules/ai/provider';
import { ApplicationModel, MentorSessionModel, RefreshTokenModel, UserModel } from '../src/models';

const uri = process.env.TEST_MONGODB_URI;
const app = createApp({ CLIENT_URL: 'http://localhost:5173' });
const as = (token: string) => ({ Authorization: `Bearer ${token}` });
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

type Role = 'student' | 'mentor' | 'recruiter' | 'faculty';
async function signUp(role: Role, email: string, name = `${role} ${email}`) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'Passw0rdOK', role });
  expect(res.status, `register ${email}: ${JSON.stringify(res.body)}`).toBe(201);
  return {
    token: res.body.accessToken as string,
    id: res.body.user.id as string,
    cookie: res.headers['set-cookie']![0]!.split(';')[0]!,
  };
}
interface IndexInfo {
  key: Record<string, unknown>;
  unique?: boolean;
  expireAfterSeconds?: number;
  partialFilterExpression?: unknown;
}
const indexesOf = async (model: { collection: { indexes: () => Promise<unknown> } }) =>
  (await model.collection.indexes()) as IndexInfo[];

describe.skipIf(!uri)('real MongoDB', () => {
  beforeAll(async () => {
    await mongoose.connect(uri!, { dbName: `pathway_it_${Date.now()}` });
    await Promise.all(Object.values(mongoose.models).map((m) => m.init())); // build indexes, like server.ts
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  beforeEach(async () => {
    setAiProvider(undefined);
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
  });

  it('reports a healthy database', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('connected');
  });

  describe('indexes', () => {
    it('exist as the app expects', async () => {
      expect((await indexesOf(RefreshTokenModel)).some((i) => i.expireAfterSeconds === 0)).toBe(
        true,
      );
      expect((await indexesOf(UserModel)).some((i) => i.unique && 'email' in i.key)).toBe(true);
      expect(
        (await indexesOf(ApplicationModel)).some(
          (i) => i.unique && 'opportunity' in i.key && 'student' in i.key,
        ),
      ).toBe(true);
      expect(
        (await indexesOf(MentorSessionModel)).some(
          (i) => i.unique && 'mentor' in i.key && 'startsAt' in i.key && i.partialFilterExpression,
        ),
      ).toBe(true);
    });
  });

  describe('simultaneous requests', () => {
    it('let only one of two identical sign-ups win', async () => {
      const body = {
        name: 'Asha Rao',
        email: 'asha@x.com',
        password: 'Passw0rdOK',
        role: 'student',
      };
      const results = await Promise.all([
        request(app).post('/api/auth/register').send(body),
        request(app).post('/api/auth/register').send(body),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await UserModel.countDocuments({ email: 'asha@x.com' })).toBe(1);
    });

    it('let only one of two bookings of the same mentor slot win, and free the slot when cancelled', async () => {
      const mentor = await signUp('mentor', 'm@x.com');
      const s1 = await signUp('student', 's1@x.com');
      const s2 = await signUp('student', 's2@x.com');
      const profileId = (await request(app).get('/api/mentors').set(as(s1.token))).body.mentors[0]
        .id;
      const startsAt = inDays(3);
      const book = (token: string) =>
        request(app)
          .post(`/api/mentors/${profileId}/sessions`)
          .set(as(token))
          .send({ startsAt, topic: 'Career planning' });

      const results = await Promise.all([book(s1.token), book(s2.token)]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);

      const winner = results.find((r) => r.status === 201)!;
      const loserToken = results[0]!.status === 201 ? s2.token : s1.token;
      await request(app)
        .patch(`/api/sessions/${winner.body.session.id}`)
        .set(as(mentor.token))
        .send({ status: 'cancelled' });
      expect((await book(loserToken)).status).toBe(201); // the partial index ignores cancelled sessions
    });

    it('let only one of two identical applications win', async () => {
      const recruiter = await signUp('recruiter', 'r@x.com');
      await request(app)
        .patch('/api/recruiter/me')
        .set(as(recruiter.token))
        .send({ companyName: 'Acme Labs' });
      const opp = await request(app)
        .post('/api/recruiter/opportunities')
        .set(as(recruiter.token))
        .send({
          title: 'Backend Intern',
          kind: 'internship',
          description: 'Work on real production services with our team.',
        });
      const student = await signUp('student', 's@x.com');

      const apply = () =>
        request(app)
          .post(`/api/opportunities/${opp.body.opportunity.id}/apply`)
          .set(as(student.token))
          .send({});
      const results = await Promise.all([apply(), apply()]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await ApplicationModel.countDocuments()).toBe(1);
    });
  });

  it('rotates refresh tokens and rejects a replayed one', async () => {
    const { cookie } = await signUp('student', 's@x.com');
    const first = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(first.status).toBe(200);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/auth/refresh')
          .set('Cookie', first.headers['set-cookie']![0]!.split(';')[0]!)
      ).status,
    ).toBe(200);
  });

  it('runs the whole recruiter → student → mentor journey with populated data', async () => {
    // recruiter posts
    const recruiter = await signUp('recruiter', 'r@x.com', 'Rita Rao');
    await request(app)
      .patch('/api/recruiter/me')
      .set(as(recruiter.token))
      .send({ companyName: 'Acme Labs', designation: 'Talent Lead' });
    const posted = await request(app)
      .post('/api/recruiter/opportunities')
      .set(as(recruiter.token))
      .send({
        title: 'Backend Intern',
        kind: 'internship',
        description: 'Work on real production services with our team.',
        skills: ['Node.js'],
        deadline: inDays(10),
      });
    expect(posted.body.opportunity).toMatchObject({ company: 'Acme Labs', status: 'open' });

    // student browses and applies
    const student = await signUp('student', 'asha@x.com', 'Asha Rao');
    await request(app)
      .patch('/api/students/me')
      .set(as(student.token))
      .send({
        course: 'CSIT',
        targetRole: 'Backend Engineer',
        skills: [{ name: 'Node.js', proficiency: 80 }],
      });
    const list = await request(app)
      .get('/api/opportunities?skill=node.js&q=intern')
      .set(as(student.token));
    expect(list.body.items[0]).toMatchObject({ title: 'Backend Intern', company: 'Acme Labs' });
    const oppId = list.body.items[0].id;
    expect(
      (
        await request(app)
          .post(`/api/opportunities/${oppId}/apply`)
          .set(as(student.token))
          .send({ message: 'Keen to learn' })
      ).status,
    ).toBe(201);
    const mine = await request(app).get('/api/applications/me').set(as(student.token)); // nested populate
    expect(mine.body.applications[0].opportunity).toMatchObject({
      title: 'Backend Intern',
      company: 'Acme Labs',
    });

    // recruiter reviews
    const applicants = await request(app)
      .get(`/api/recruiter/opportunities/${oppId}/applications`)
      .set(as(recruiter.token));
    expect(applicants.body.applicants[0]).toMatchObject({
      message: 'Keen to learn',
      student: { name: 'Asha Rao', email: 'asha@x.com', course: 'CSIT' },
    });
    await request(app)
      .patch(`/api/recruiter/applications/${applicants.body.applicants[0].id}`)
      .set(as(recruiter.token))
      .send({ status: 'shortlisted' });
    expect(
      (await request(app).get('/api/applications/me').set(as(student.token))).body.applications[0]
        .status,
    ).toBe('shortlisted');

    // talent search uses $elemMatch on the embedded skills array
    const find = (qs: string) =>
      request(app).get(`/api/recruiter/students?${qs}`).set(as(recruiter.token));
    expect(
      (await find('skill=node.js&minProficiency=70')).body.items.map(
        (i: { name: string }) => i.name,
      ),
    ).toEqual(['Asha Rao']);
    expect((await find('skill=node.js&minProficiency=90')).body.items).toEqual([]);
    expect((await find('role=backend')).body.total).toBe(1);

    // mentoring
    const mentor = await signUp('mentor', 'm@x.com', 'Priya Sharma');
    await request(app)
      .patch('/api/mentors/me')
      .set(as(mentor.token))
      .send({ title: 'Staff Engineer', companyName: 'CloudSphere', expertise: ['Go'] });
    const mentors = await request(app).get('/api/mentors').set(as(student.token));
    expect(mentors.body.mentors[0]).toMatchObject({ name: 'Priya Sharma', company: 'CloudSphere' });
    const session = await request(app)
      .post(`/api/mentors/${mentors.body.mentors[0].id}/sessions`)
      .set(as(student.token))
      .send({ startsAt: inDays(2), topic: 'Career planning' });
    expect(session.status).toBe(201);
    const theirs = await request(app).get('/api/sessions/me').set(as(mentor.token));
    expect(theirs.body.sessions[0]).toMatchObject({
      student: { name: 'Asha Rao' },
      mentor: { name: 'Priya Sharma' },
    });
    await request(app)
      .patch(`/api/sessions/${session.body.session.id}`)
      .set(as(mentor.token))
      .send({ status: 'confirmed' });
    await request(app)
      .patch(`/api/mentors/me/mentees/${student.id}`)
      .set(as(mentor.token))
      .send({ stage: 'active', notes: 'Promising' });
    const mentees = await request(app).get('/api/mentors/me/mentees').set(as(mentor.token));
    expect(mentees.body.mentees[0]).toMatchObject({
      stage: 'active',
      notes: 'Promising',
      sessions: { upcoming: 1 },
      student: { course: 'CSIT' },
    });
  });

  it('updates the skills array when a quiz is submitted, and aggregates cohorts for faculty', async () => {
    const quiz = JSON.stringify({
      questions: [1, 2, 3].map((n) => ({
        question: `Question ${n}?`,
        options: ['a', 'b', 'c', 'd'].map((o) => `${o}${n}`),
        correctIndex: 0,
        explanation: 'x',
      })),
    });
    setAiProvider({
      generateJson: vi.fn().mockResolvedValue(quiz),
      generateText: vi.fn(),
      streamText: vi.fn(),
    });

    const students = [];
    for (const [i, level] of [50, 60, 70].entries()) {
      const s = await signUp('student', `s${i}@x.com`);
      await request(app)
        .patch('/api/students/me')
        .set(as(s.token))
        .send({
          course: 'CSIT',
          targetRole: 'Backend Engineer',
          skills: [{ name: 'Node.js', proficiency: level }],
        });
      students.push(s);
    }
    const first = students[0]!;
    const generated = await request(app)
      .post('/api/ai/quizzes')
      .set(as(first.token))
      .send({ topic: 'Node.js', count: 3 });
    expect(JSON.stringify(generated.body)).not.toContain('correctIndex');
    const result = await request(app)
      .post(`/api/ai/quizzes/${generated.body.quiz.id}/submit`)
      .set(as(first.token))
      .send({ answers: [0, 0, 0] });
    expect(result.body.result).toMatchObject({
      score: 3,
      percent: 100,
      skill: { name: 'Node.js', proficiency: 80 },
    }); // 50*0.4 + 100*0.6
    expect(
      (await request(app).get('/api/students/me').set(as(first.token))).body.profile.skills,
    ).toEqual([{ name: 'Node.js', proficiency: 80 }]);
    expect(
      (
        await request(app)
          .post(`/api/ai/quizzes/${generated.body.quiz.id}/submit`)
          .set(as(first.token))
          .send({ answers: [0, 0, 0] })
      ).status,
    ).toBe(409);

    const faculty = await signUp('faculty', 'f@x.com');
    const insights = await request(app)
      .get('/api/faculty/insights?course=csit')
      .set(as(faculty.token));
    expect(insights.body.insights).toMatchObject({ students: 3, restricted: false });
    expect(insights.body.insights.topSkills).toEqual([
      { name: 'Node.js', students: 3, averageProficiency: 70 },
    ]); // (80+60+70)/3
  });
});
