import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/modules/auth/token.service';
import { setAiProvider, type AiProvider } from '../src/modules/ai/provider';
import * as fake from './fakeModels';

vi.mock('../src/models', () => import('./fakeModels'));

const app = createApp({ CLIENT_URL: 'http://localhost:5173' });
const as = (token: string) => ({ Authorization: `Bearer ${token}` });

const provider = {
  generateJson: vi.fn<AiProvider['generateJson']>(),
  generateText: vi.fn<AiProvider['generateText']>(),
  streamText: vi.fn<AiProvider['streamText']>(),
};

beforeEach(() => {
  for (const m of Object.values(fake)) m.reset();
  Object.values(provider).forEach((fn) => fn.mockReset());
  setAiProvider(provider);
});
afterEach(() => setAiProvider(undefined));

async function signUp(role: 'student' | 'mentor' | 'faculty', email: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: `${role} user`, email, password: 'Passw0rdOK', role });
  return { token: res.body.accessToken as string, id: res.body.user.id as string };
}

const question = (n: number, correctIndex = 1) => ({
  question: `Question number ${n}?`,
  options: [`a${n}`, `b${n}`, `c${n}`, `d${n}`],
  correctIndex,
  explanation: `Because ${n}`,
});
const quizJson = (n = 3) =>
  JSON.stringify({ questions: Array.from({ length: n }, (_, i) => question(i + 1)) });

describe('quizzes', () => {
  it('generates a quiz without leaking the answer key, and wraps the topic as data', async () => {
    provider.generateJson.mockResolvedValue('```json\n' + quizJson(3) + '\n```'); // fenced output is tolerated
    const { token } = await signUp('student', 's@x.com');

    const res = await request(app)
      .post('/api/ai/quizzes')
      .set(as(token))
      .send({ topic: 'Node.js', difficulty: 'beginner', count: 3 });

    expect(res.status).toBe(201);
    expect(res.body.quiz.questions).toHaveLength(3);
    expect(JSON.stringify(res.body)).not.toContain('correctIndex');
    expect(provider.generateJson.mock.calls[0]![0].prompt).toContain('<topic>Node.js</topic>');
    expect(fake.QuizModel.all()[0]!.questions[0].correctIndex).toBe(1); // kept server-side
  });

  it('retries once on malformed output, then gives up with 502', async () => {
    const { token } = await signUp('student', 's@x.com');
    provider.generateJson.mockResolvedValueOnce('not json').mockResolvedValueOnce(quizJson(3));
    const ok = await request(app)
      .post('/api/ai/quizzes')
      .set(as(token))
      .send({ topic: 'SQL', count: 3 });
    expect(ok.status).toBe(201);
    expect(provider.generateJson).toHaveBeenCalledTimes(2);

    provider.generateJson.mockReset().mockResolvedValue('{"questions":[{"question":"x"}]}');
    const bad = await request(app)
      .post('/api/ai/quizzes')
      .set(as(token))
      .send({ topic: 'SQL', count: 3 });
    expect(bad.status).toBe(502);
    expect(bad.body.error.code).toBe('AI_BAD_OUTPUT');
  });

  it('validates input, is student-only and reports when AI is not configured', async () => {
    const { token } = await signUp('student', 's@x.com');
    const mentor = await signUp('mentor', 'm@x.com');
    const gen = (t: string, body: object) =>
      request(app).post('/api/ai/quizzes').set(as(t)).send(body);

    expect((await gen(token, { topic: 'x', count: 3 })).status).toBe(400);
    expect((await gen(token, { topic: 'Node.js', count: 50 })).status).toBe(400);
    expect((await gen(mentor.token, { topic: 'Node.js' })).status).toBe(403);

    setAiProvider(undefined); // no GEMINI_API_KEY in the test env
    const res = await gen(token, { topic: 'Node.js' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_NOT_CONFIGURED');
  });

  describe('submitting', () => {
    let token: string;
    let quizId: string;
    beforeEach(async () => {
      ({ token } = await signUp('student', 's@x.com'));
      provider.generateJson.mockResolvedValue(quizJson(4));
      quizId = (
        await request(app)
          .post('/api/ai/quizzes')
          .set(as(token))
          .send({ topic: 'Node.js', count: 4 })
      ).body.quiz.id;
    });
    const submit = (answers: (number | null)[], t = token) =>
      request(app).post(`/api/ai/quizzes/${quizId}/submit`).set(as(t)).send({ answers });

    it('grades server-side, reveals answers, adds the topic as a skill and blocks resubmission', async () => {
      const res = await submit([1, 1, 0, null]); // correct answer is index 1 everywhere
      expect(res.status).toBe(200);
      expect(res.body.result).toMatchObject({
        score: 2,
        total: 4,
        percent: 50,
        skill: { name: 'Node.js', proficiency: 50 },
      });
      expect(res.body.result.answers[2]).toMatchObject({
        yourAnswer: 0,
        correctIndex: 1,
        explanation: 'Because 3',
      });
      expect(res.body.result.answers[3].yourAnswer).toBeNull();
      expect(fake.StudentProfileModel.all()[0]!.skills).toEqual([
        { name: 'Node.js', proficiency: 50 },
      ]);

      expect((await submit([1, 1, 1, 1])).body.error.code).toBe('ALREADY_SUBMITTED');
    });

    it('blends the score into an existing skill', async () => {
      fake.StudentProfileModel.all()[0]!.skills = [{ name: 'node.js', proficiency: 50 }];
      const res = await submit([1, 1, 1, 1]); // 100%: 50*0.4 + 100*0.6 = 80
      expect(res.body.result.skill).toEqual({ name: 'node.js', proficiency: 80 });
    });

    it('rejects a wrong number of answers and other students’ quizzes', async () => {
      expect((await submit([1, 1])).status).toBe(400);
      const other = await signUp('student', 'o@x.com');
      expect((await submit([1, 1, 1, 1], other.token)).status).toBe(404);
    });

    it('lists history with topic and score', async () => {
      await submit([1, 1, 1, 0]);
      const res = await request(app).get('/api/ai/quizzes/me').set(as(token));
      expect(res.body.history).toEqual([
        expect.objectContaining({ topic: 'Node.js', score: 3, total: 4 }),
      ]);
    });
  });
});

describe('skill gap', () => {
  const analysis = {
    summary: 'Solid base',
    strengths: ['React'],
    gaps: [{ skill: 'Docker', priority: 'high', reason: 'Used in most backend roles' }],
    nextSteps: ['Containerise a project'],
  };

  it('needs a target role, then analyses the profile skills', async () => {
    const { token } = await signUp('student', 's@x.com');
    const run = (body: object = {}) =>
      request(app).post('/api/ai/skill-gap').set(as(token)).send(body);

    expect((await run()).body.error.code).toBe('TARGET_ROLE_REQUIRED');

    await request(app)
      .patch('/api/students/me')
      .set(as(token))
      .send({ targetRole: 'Backend Engineer', skills: [{ name: 'React', proficiency: 70 }] });
    provider.generateJson.mockResolvedValue(JSON.stringify(analysis));

    const res = await run();
    expect(res.status).toBe(200);
    expect(res.body.analysis).toMatchObject({
      targetRole: 'Backend Engineer',
      gaps: [{ skill: 'Docker', priority: 'high' }],
    });
    const prompt = provider.generateJson.mock.calls[0]![0].prompt;
    expect(prompt).toContain('Backend Engineer');
    expect(prompt).toContain('"React"');

    // an explicit role overrides the profile
    await run({ targetRole: 'Data Analyst' });
    expect(provider.generateJson.mock.calls[1]![0].prompt).toContain('Data Analyst');
  });
});

const readSse = (req: request.Test) =>
  req.buffer(true).parse((res, cb) => {
    let data = '';
    res.on('data', (c: Buffer) => (data += c));
    res.on('end', () => cb(null, data));
  });

async function* tokens(...parts: string[]) {
  for (const p of parts) yield p;
}

describe('advisor (SSE)', () => {
  const body = { messages: [{ role: 'user', content: 'What should I learn next?' }] };

  it('streams tokens then [DONE], with the student profile in the system prompt', async () => {
    const { token } = await signUp('student', 's@x.com');
    await request(app).patch('/api/students/me').set(as(token)).send({ targetRole: 'SRE' });
    provider.streamText.mockReturnValue(tokens('Learn ', 'Linux.'));

    const res = await readSse(request(app).post('/api/ai/advisor').set(as(token)).send(body));
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.body).toBe(
      'data: {"token":"Learn "}\n\ndata: {"token":"Linux."}\n\ndata: [DONE]\n\n',
    );
    expect(provider.streamText.mock.calls[0]![0].system).toContain('SRE');
    expect(provider.streamText.mock.calls[0]![0].messages).toEqual(body.messages);
  });

  it('sends an SSE error event if the model fails mid-stream', async () => {
    const { token } = await signUp('student', 's@x.com');
    provider.streamText.mockReturnValue(
      (async function* () {
        yield 'Par';
        throw new Error('boom');
      })(),
    );
    const res = await readSse(request(app).post('/api/ai/advisor').set(as(token)).send(body));
    expect(res.body).toContain('event: error');
    expect(res.body).not.toContain('[DONE]');
  });

  it('validates the conversation, restricts roles, and allows faculty', async () => {
    const student = await signUp('student', 's@x.com');
    const mentor = await signUp('mentor', 'm@x.com');
    const faculty = await signUp('faculty', 'f@x.com');
    const post = (t: string, b: object) => request(app).post('/api/ai/advisor').set(as(t)).send(b);

    expect((await post(student.token, { messages: [] })).status).toBe(400);
    expect(
      (await post(student.token, { messages: [{ role: 'assistant', content: 'hi' }] })).status,
    ).toBe(400);
    expect(
      (await post(student.token, { messages: [{ role: 'user', content: 'x'.repeat(2001) }] }))
        .status,
    ).toBe(400);
    expect((await post(mentor.token, body)).status).toBe(403);

    provider.streamText.mockReturnValue(tokens('ok'));
    await readSse(request(app).post('/api/ai/advisor').set(as(faculty.token)).send(body));
    expect(provider.streamText.mock.calls[0]![0].system).toContain('faculty');
  });

  it('returns a JSON 503 (not a broken stream) when AI is not configured', async () => {
    const { token } = await signUp('student', 's@x.com');
    setAiProvider(undefined);
    const res = await request(app).post('/api/ai/advisor').set(as(token)).send(body);
    expect(res.status).toBe(503);
    expect(res.headers['content-type']).toContain('application/json');
  });
});

describe('helpdesk', () => {
  it('answers chat questions', async () => {
    const { token } = await signUp('student', 's@x.com');
    provider.generateText.mockResolvedValue('  Go to Opportunities.  ');
    const res = await request(app)
      .post('/api/helpdesk/chat')
      .set(as(token))
      .send({ messages: [{ role: 'user', content: 'How do I apply?' }] });
    expect(res.body).toEqual({ reply: 'Go to Opportunities.' });
    expect(provider.generateText.mock.calls[0]![0].system).toContain('helpdesk');
  });

  it('creates and lists my tickets, and keeps the admin queue admin-only', async () => {
    const student = await signUp('student', 's@x.com');
    const other = await signUp('student', 'o@x.com');
    const create = await request(app)
      .post('/api/helpdesk/tickets')
      .set(as(student.token))
      .send({ subject: 'Cannot book', description: 'The booking form shows an error.' });
    expect(create.status).toBe(201);
    expect(create.body.ticket.status).toBe('open');
    expect(
      (
        await request(app)
          .post('/api/helpdesk/tickets')
          .set(as(student.token))
          .send({ subject: 'x', description: 'short' })
      ).status,
    ).toBe(400);

    expect(
      (await request(app).get('/api/helpdesk/tickets/me').set(as(student.token))).body.tickets,
    ).toHaveLength(1);
    expect(
      (await request(app).get('/api/helpdesk/tickets/me').set(as(other.token))).body.tickets,
    ).toHaveLength(0);
    expect((await request(app).get('/api/helpdesk/tickets').set(as(student.token))).status).toBe(
      403,
    );

    const admin = await fake.UserModel.create({ name: 'Admin', email: 'a@x.com', role: 'admin' });
    const adminToken = signAccessToken({ id: String(admin._id), role: 'admin' });
    const all = await request(app).get('/api/helpdesk/tickets').set(as(adminToken));
    expect(all.body.tickets[0]).toMatchObject({
      subject: 'Cannot book',
      user: { name: 'student user', email: 's@x.com' },
    });

    const id = create.body.ticket.id;
    const upd = await request(app)
      .patch(`/api/helpdesk/tickets/${id}`)
      .set(as(adminToken))
      .send({ status: 'resolved' });
    expect(upd.body.ticket.status).toBe('resolved');
    expect(
      (
        await request(app)
          .patch(`/api/helpdesk/tickets/${id}`)
          .set(as(student.token))
          .send({ status: 'resolved' })
      ).status,
    ).toBe(403);
  });
});
