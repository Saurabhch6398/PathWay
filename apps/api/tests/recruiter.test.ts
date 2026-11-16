import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import * as fake from './fakeModels';

vi.mock('../src/models', () => import('./fakeModels'));

const app = createApp({ CLIENT_URL: 'http://localhost:5173' });
const as = (token: string) => ({ Authorization: `Bearer ${token}` });
const DAY = 86_400_000;
const description = 'Work with our platform team on production services and ship real features.';

beforeEach(() => {
  for (const m of Object.values(fake)) m.reset();
});

async function signUp(
  role: 'student' | 'recruiter' | 'mentor',
  email: string,
  name = `${role} ${email}`,
) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'Passw0rdOK', role });
  return { token: res.body.accessToken as string, id: res.body.user.id as string };
}
async function recruiterAt(email: string, companyName?: string) {
  const r = await signUp('recruiter', email);
  if (companyName) {
    await request(app)
      .patch('/api/recruiter/me')
      .set(as(r.token))
      .send({ companyName, designation: 'Talent Lead' });
  }
  return r;
}
const post = (token: string, body: object = {}) =>
  request(app)
    .post('/api/recruiter/opportunities')
    .set(as(token))
    .send({
      title: 'Backend Intern',
      kind: 'internship',
      description,
      skills: ['Node.js'],
      ...body,
    });

describe('company setup', () => {
  it('starts without a company, then registers one', async () => {
    const r = await recruiterAt('r@x.com');
    expect(
      (await request(app).get('/api/recruiter/me').set(as(r.token))).body.profile.company,
    ).toBeNull();

    const res = await request(app)
      .patch('/api/recruiter/me')
      .set(as(r.token))
      .send({ companyName: 'Acme Labs', designation: 'HR' });
    expect(res.body.profile).toMatchObject({ designation: 'HR', company: { name: 'Acme Labs' } });
    expect(fake.OrganizationModel.all()[0]).toMatchObject({
      name: 'Acme Labs',
      type: 'company',
      createdBy: r.id,
    });
  });

  it('stops other accounts from claiming an existing company, but lets the linked recruiter re-save it', async () => {
    const owner = await recruiterAt('a@x.com', 'Acme Labs');
    const intruder = await recruiterAt('b@x.com');
    const res = await request(app)
      .patch('/api/recruiter/me')
      .set(as(intruder.token))
      .send({ companyName: 'Acme Labs' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COMPANY_TAKEN');

    // A company that exists but has no registrant (e.g. seeded) can only be reused by someone already linked to it.
    const seeded = await fake.OrganizationModel.create({ name: 'TechNova', type: 'company' });
    expect(
      (
        await request(app)
          .patch('/api/recruiter/me')
          .set(as(owner.token))
          .send({ companyName: 'TechNova' })
      ).status,
    ).toBe(409);
    Object.assign(fake.RecruiterProfileModel.all()[0]!, { company: seeded._id });
    expect(
      (
        await request(app)
          .patch('/api/recruiter/me')
          .set(as(owner.token))
          .send({ companyName: 'TechNova' })
      ).status,
    ).toBe(200);
  });

  it('is recruiter-only', async () => {
    const s = await signUp('student', 's@x.com');
    expect((await request(app).get('/api/recruiter/me').set(as(s.token))).status).toBe(403);
    expect((await request(app).get('/api/recruiter/me')).status).toBe(401);
  });
});

describe('postings', () => {
  it('requires a company, validates input and applies defaults', async () => {
    const noCompany = await recruiterAt('r@x.com');
    const blocked = await post(noCompany.token);
    expect(blocked.status).toBe(400);
    expect(blocked.body.error.code).toBe('COMPANY_REQUIRED');

    const r = await recruiterAt('r2@x.com', 'Acme Labs');
    for (const bad of [
      { description: 'too short' },
      { kind: 'volunteer' },
      { deadline: new Date(Date.now() - DAY).toISOString() },
      { skills: ['React', 'react'] },
    ]) {
      expect((await post(r.token, bad)).status).toBe(400);
    }

    const ok = await post(r.token);
    expect(ok.status).toBe(201);
    expect(ok.body.opportunity).toMatchObject({
      title: 'Backend Intern',
      company: 'Acme Labs',
      location: 'Remote',
      status: 'open',
      applicantCount: 0,
    });
  });

  it('closing a posting hides it from students and does not overwrite other fields', async () => {
    const r = await recruiterAt('r@x.com', 'Acme Labs');
    const student = await signUp('student', 's@x.com');
    const id = (await post(r.token, { location: 'Pune', skills: ['Node.js', 'SQL'] })).body
      .opportunity.id;

    expect((await request(app).get('/api/opportunities').set(as(student.token))).body.total).toBe(
      1,
    );

    const res = await request(app)
      .patch(`/api/recruiter/opportunities/${id}`)
      .set(as(r.token))
      .send({ status: 'closed' });
    expect(res.body.opportunity).toMatchObject({
      status: 'closed',
      location: 'Pune',
      skills: ['Node.js', 'SQL'],
    });
    expect((await request(app).get('/api/opportunities').set(as(student.token))).body.total).toBe(
      0,
    );

    const edit = await request(app)
      .patch(`/api/recruiter/opportunities/${id}`)
      .set(as(r.token))
      .send({ title: 'Senior Intern', status: 'open' });
    expect(edit.body.opportunity).toMatchObject({
      title: 'Senior Intern',
      status: 'open',
      location: 'Pune',
    });
  });

  it('only lets the owner see and change their postings', async () => {
    const a = await recruiterAt('a@x.com', 'Acme Labs');
    const b = await recruiterAt('b@x.com', 'Beta Corp');
    const id = (await post(a.token)).body.opportunity.id;

    expect(
      (await request(app).get('/api/recruiter/opportunities').set(as(b.token))).body.opportunities,
    ).toHaveLength(0);
    expect(
      (
        await request(app)
          .patch(`/api/recruiter/opportunities/${id}`)
          .set(as(b.token))
          .send({ status: 'closed' })
      ).status,
    ).toBe(404);
    expect(
      (await request(app).get(`/api/recruiter/opportunities/${id}/applications`).set(as(b.token)))
        .status,
    ).toBe(404);
  });
});

describe('applicants and decisions', () => {
  it('shows applicants with their profile, excludes withdrawn, and enforces the status flow', async () => {
    const r = await recruiterAt('r@x.com', 'Acme Labs');
    const other = await recruiterAt('o@x.com', 'Beta Corp');
    const oppId = (await post(r.token)).body.opportunity.id;

    const asha = await signUp('student', 'asha@x.com', 'Asha Rao');
    const ravi = await signUp('student', 'ravi@x.com', 'Ravi Kumar');
    await request(app)
      .patch('/api/students/me')
      .set(as(asha.token))
      .send({ course: 'CSIT', skills: [{ name: 'Node.js', proficiency: 80 }] });
    await request(app)
      .post(`/api/opportunities/${oppId}/apply`)
      .set(as(asha.token))
      .send({ message: 'Keen to learn' });
    const raviApp = (
      await request(app).post(`/api/opportunities/${oppId}/apply`).set(as(ravi.token)).send({})
    ).body.application.id;
    await request(app).post(`/api/applications/${raviApp}/withdraw`).set(as(ravi.token));

    const list = await request(app)
      .get(`/api/recruiter/opportunities/${oppId}/applications`)
      .set(as(r.token));
    expect(list.body.applicants).toHaveLength(1);
    expect(list.body.applicants[0]).toMatchObject({
      status: 'submitted',
      message: 'Keen to learn',
      student: {
        name: 'Asha Rao',
        email: 'asha@x.com',
        course: 'CSIT',
        skills: [{ name: 'Node.js', proficiency: 80 }],
      },
    });
    expect(
      (await request(app).get('/api/recruiter/opportunities').set(as(r.token))).body
        .opportunities[0].applicantCount,
    ).toBe(1);

    const appId = list.body.applicants[0].id;
    const decide = (status: string, token = r.token) =>
      request(app).patch(`/api/recruiter/applications/${appId}`).set(as(token)).send({ status });

    expect((await decide('accepted')).status).toBe(409); // must shortlist first
    expect((await decide('submitted')).status).toBe(400); // not a valid decision
    expect((await decide('shortlisted', other.token)).status).toBe(404); // someone else's posting
    expect((await decide('shortlisted')).body.application.status).toBe('shortlisted');
    expect((await decide('accepted')).body.application.status).toBe('accepted');
    expect((await decide('rejected')).status).toBe(409); // accepted is final

    const mine = await request(app).get('/api/applications/me').set(as(asha.token));
    expect(mine.body.applications[0].status).toBe('accepted');
    // a student can't withdraw once the recruiter has decided
    expect(
      (await request(app).post(`/api/applications/${appId}/withdraw`).set(as(asha.token))).status,
    ).toBe(409);
  });
});

describe('talent search', () => {
  beforeEach(async () => {
    const mk = async (email: string, name: string, patch: object) => {
      const s = await signUp('student', email, name);
      await request(app).patch('/api/students/me').set(as(s.token)).send(patch);
      return s;
    };
    await mk('a@x.com', 'Asha', {
      targetRole: 'Backend Engineer',
      skills: [
        { name: 'Node.js', proficiency: 80 },
        { name: 'SQL', proficiency: 40 },
      ],
    });
    await mk('b@x.com', 'Bhavna', {
      targetRole: 'Frontend Developer',
      skills: [{ name: 'React', proficiency: 90 }],
    });
    await mk('c@x.com', 'Chirag', {
      targetRole: 'Backend Engineer',
      skills: [{ name: 'Node.js', proficiency: 30 }],
      visibleToRecruiters: false,
    });
  });

  const search = (token: string, qs = '') =>
    request(app).get(`/api/recruiter/students?${qs}`).set(as(token));

  it('filters by skill, minimum proficiency and role, hides opted-out students, and never exposes email', async () => {
    const r = await recruiterAt('r@x.com', 'Acme Labs');
    const all = await search(r.token);
    expect(all.body.total).toBe(2); // Chirag opted out
    expect(JSON.stringify(all.body)).not.toContain('@x.com');

    const names = (res: request.Response) => res.body.items.map((i: { name: string }) => i.name);
    expect(names(await search(r.token, 'skill=node.js'))).toEqual(['Asha']);
    expect(names(await search(r.token, 'skill=Node.js&minProficiency=90'))).toEqual([]);
    expect(names(await search(r.token, 'skill=SQL&minProficiency=40'))).toEqual(['Asha']);
    expect(names(await search(r.token, 'minProficiency=85'))).toEqual(['Bhavna']);
    expect(names(await search(r.token, 'role=backend'))).toEqual(['Asha']);
    expect((await search(r.token, 'minProficiency=500')).status).toBe(400);
  });

  it('treats profiles from before the visibility flag existed as visible, and paginates', async () => {
    const r = await recruiterAt('r@x.com', 'Acme Labs');
    delete fake.StudentProfileModel.all()[2]!.visibleToRecruiters; // Chirag, legacy data without the flag
    delete fake.StudentProfileModel.all()[2]!.visibleToRecruiters;
    expect((await search(r.token)).body.total).toBe(3);
    const page = await search(r.token, 'limit=2&page=2');
    expect(page.body).toMatchObject({ total: 3, page: 2 });
    expect(page.body.items).toHaveLength(1);
  });

  it('lets students toggle their visibility', async () => {
    const s = await signUp('student', 'new@x.com');
    const res = await request(app)
      .patch('/api/students/me')
      .set(as(s.token))
      .send({ visibleToRecruiters: false });
    expect(res.body.profile.visibleToRecruiters).toBe(false);
  });
});

describe('analytics', () => {
  it('counts postings and applications by status for the recruiter only', async () => {
    const r = await recruiterAt('r@x.com', 'Acme Labs');
    const other = await recruiterAt('o@x.com', 'Beta Corp');
    const open = (await post(r.token)).body.opportunity.id;
    const closed = (await post(r.token, { title: 'Old role' })).body.opportunity.id;
    await request(app)
      .patch(`/api/recruiter/opportunities/${closed}`)
      .set(as(r.token))
      .send({ status: 'closed' });

    const s1 = await signUp('student', 's1@x.com');
    const s2 = await signUp('student', 's2@x.com');
    const s3 = await signUp('student', 's3@x.com');
    for (const s of [s1, s2, s3])
      await request(app).post(`/api/opportunities/${open}/apply`).set(as(s.token)).send({});
    const apps = (
      await request(app).get(`/api/recruiter/opportunities/${open}/applications`).set(as(r.token))
    ).body.applicants;
    await request(app)
      .patch(`/api/recruiter/applications/${apps[0].id}`)
      .set(as(r.token))
      .send({ status: 'shortlisted' });
    await request(app)
      .patch(`/api/recruiter/applications/${apps[1].id}`)
      .set(as(r.token))
      .send({ status: 'rejected' });

    const res = await request(app).get('/api/recruiter/analytics').set(as(r.token));
    expect(res.body.analytics).toEqual({
      opportunities: { open: 1, closed: 1 },
      applications: { total: 3, submitted: 1, shortlisted: 1, accepted: 0, rejected: 1 },
    });
    const empty = await request(app).get('/api/recruiter/analytics').set(as(other.token));
    expect(empty.body.analytics.applications.total).toBe(0);
  });
});
