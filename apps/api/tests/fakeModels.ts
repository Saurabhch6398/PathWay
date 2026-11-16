/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * In-memory stand-ins for the Mongoose models so route tests run without a database.
 * They implement only what the app uses: find/findOne/findById (+ sort/skip/limit/populate/lean),
 * create, exists, countDocuments, findOneAndUpdate($set), findOneAndDelete, deleteOne and doc.save().
 */
import { randomBytes } from 'node:crypto';

type Doc = Record<string, any>;
type Unique = { fields: string[]; where?: (d: Doc) => boolean };
interface Config {
  unique?: Unique[];
  refs?: Record<string, string>; // field -> name of the referenced model
  defaults?: Doc;
}

const registry: Record<string, ReturnType<typeof makeModel>> = {};

const eq = (a: unknown, b: unknown) =>
  a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : String(a) === String(b);

function matchValue(actual: any, cond: any): boolean {
  const isOperatorObject =
    cond && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond);
  if (!isOperatorObject) {
    return Array.isArray(actual) ? actual.some((a) => eq(a, cond)) : eq(actual, cond);
  }
  return Object.entries(cond).every(([op, v]: [string, any]) => {
    switch (op) {
      case '$in':
        return v.some((x: unknown) => matchValue(actual, x));
      case '$ne':
        return !matchValue(actual, v);
      case '$gte':
        return actual >= v;
      case '$lte':
        return actual <= v;
      case '$elemMatch':
        return Array.isArray(actual) && actual.some((el) => matches(el, v));
      case '$options':
        return true;
      case '$regex': {
        const re = new RegExp(String(v), cond.$options);
        return Array.isArray(actual)
          ? actual.some((a) => re.test(String(a)))
          : re.test(String(actual ?? ''));
      }
      default:
        throw new Error(`fake model: unsupported operator ${op}`);
    }
  });
}

const matches = (d: Doc, q: Doc) => Object.entries(q).every(([k, v]) => matchValue(d[k], v));

function makeModel(name: string, config: Config = {}) {
  let docs: Doc[] = [];

  const pick = (doc: Doc, select?: string) => {
    if (!select) return { ...doc };
    const out: Doc = { _id: doc._id };
    for (const f of select.split(' ')) out[f] = doc[f];
    return out;
  };

  const populateDoc = (model: string, doc: Doc, spec: any): Doc => {
    const { path, select, populate } = typeof spec === 'string' ? { path: spec } : spec;
    const target = registry[config.refs?.[path] ?? registry[model]?.refsFor(path) ?? ''];
    const ref = doc[path] && target?.all().find((d) => eq(d._id, doc[path]));
    let populated: Doc | null = ref ? pick(ref, select) : null;
    if (populated && populate) populated = target!.populateOne(populated, populate);
    return { ...doc, [path]: populated };
  };

  class FakeQuery {
    private sortSpec?: Record<string, 1 | -1>;
    private skipN = 0;
    private limitN = Infinity;
    private specs: any[] = [];
    constructor(
      private source: Doc[],
      private single: boolean,
    ) {}
    sort(s: Record<string, 1 | -1>) {
      this.sortSpec = s;
      return this;
    }
    skip(n: number) {
      this.skipN = n;
      return this;
    }
    limit(n: number) {
      this.limitN = n;
      return this;
    }
    populate(spec: any, select?: string) {
      this.specs.push(select ? { path: spec, select } : spec);
      return this;
    }
    select() {
      return this;
    }
    lean() {
      return this;
    }
    then(res: (v: any) => unknown, rej?: (e: unknown) => unknown) {
      return this.exec().then(res, rej);
    }
    private async exec() {
      let out = [...this.source];
      if (this.sortSpec) {
        const [[key, dir]] = Object.entries(this.sortSpec) as [[string, 1 | -1]];
        out.sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * dir);
      }
      out = out.slice(this.skipN, this.skipN + this.limitN);
      // Without populate the stored object is returned so doc.save() mutations stick.
      if (this.specs.length)
        out = out.map((d) => this.specs.reduce((acc, s) => populateDoc(name, acc, s), d));
      return this.single ? (out[0] ?? null) : out;
    }
  }

  const conflicts = (candidate: Doc) =>
    (config.unique ?? []).some(({ fields, where }) => {
      if (where && !where(candidate)) return false;
      return docs.some((d) => (!where || where(d)) && fields.every((f) => eq(d[f], candidate[f])));
    });

  const model = {
    all: () => docs,
    reset: () => {
      docs = [];
    },
    refsFor: (path: string) => config.refs?.[path],
    populateOne: (doc: Doc, spec: any) => populateDoc(name, doc, spec),
    create: async (data: Doc) => {
      const doc: Doc = {
        _id: randomBytes(12).toString('hex'),
        createdAt: new Date(),
        ...config.defaults,
        ...data,
      };
      if (conflicts(doc)) throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      Object.defineProperty(doc, 'save', { value: async () => doc, enumerable: false });
      docs.push(doc);
      return doc;
    },
    find: (q: Doc = {}) =>
      new FakeQuery(
        docs.filter((d) => matches(d, q)),
        false,
      ),
    findOne: (q: Doc) =>
      new FakeQuery(
        docs.filter((d) => matches(d, q)),
        true,
      ),
    findById: (id: unknown) =>
      new FakeQuery(
        docs.filter((d) => eq(d._id, id)),
        true,
      ),
    countDocuments: async (q: Doc = {}) => docs.filter((d) => matches(d, q)).length,
    exists: async (q: Doc) => docs.find((d) => matches(d, q)) ?? null,
    findOneAndUpdate: (q: Doc, update: { $set?: Doc }) => {
      const doc = docs.find((d) => matches(d, q));
      if (doc) Object.assign(doc, update.$set);
      return new FakeQuery(doc ? [doc] : [], true);
    },
    findOneAndDelete: async (q: Doc) => {
      const i = docs.findIndex((d) => matches(d, q));
      return i < 0 ? null : docs.splice(i, 1)[0];
    },
    deleteOne: async (q: Doc) => {
      docs = docs.filter((d) => !matches(d, q));
    },
  };
  registry[name] = model;
  return model;
}

const live = (d: Doc) => ['pending', 'confirmed'].includes(d.status);

export const UserModel = makeModel('User', {
  unique: [{ fields: ['email'] }],
  defaults: { isActive: true },
});
export const RefreshTokenModel = makeModel('RefreshToken', { unique: [{ fields: ['tokenHash'] }] });
export const OrganizationModel = makeModel('Organization', {
  unique: [{ fields: ['name', 'type'] }],
});
export const StudentProfileModel = makeModel('StudentProfile', {
  unique: [{ fields: ['user'] }],
  defaults: { skills: [], careerReadiness: 0, experienceScore: 0, visibleToRecruiters: true },
  refs: { user: 'User' },
});
export const MentorProfileModel = makeModel('MentorProfile', {
  unique: [{ fields: ['user'] }],
  refs: { user: 'User', company: 'Organization' },
  defaults: { available: true, expertise: [] },
});
export const FacultyProfileModel = makeModel('FacultyProfile', { unique: [{ fields: ['user'] }] });
export const RecruiterProfileModel = makeModel('RecruiterProfile', {
  unique: [{ fields: ['user'] }],
  refs: { company: 'Organization' },
});
export const OpportunityModel = makeModel('Opportunity', {
  refs: { company: 'Organization' },
  defaults: { status: 'open', skills: [], location: 'Remote' },
});
export const ApplicationModel = makeModel('Application', {
  unique: [{ fields: ['opportunity', 'student'] }],
  refs: { opportunity: 'Opportunity', student: 'User' },
  defaults: { status: 'submitted' },
});
export const MentorSessionModel = makeModel('MentorSession', {
  unique: [{ fields: ['mentor', 'startsAt'], where: live }],
  refs: { mentor: 'User', student: 'User' },
  defaults: { status: 'pending', durationMinutes: 30 },
});

export const QuizModel = makeModel('Quiz');
export const QuizAttemptModel = makeModel('QuizAttempt', {
  unique: [{ fields: ['quiz', 'student'] }],
  refs: { quiz: 'Quiz' },
});
export const TicketModel = makeModel('Ticket', {
  refs: { user: 'User' },
  defaults: { status: 'open' },
});

export const MentorshipModel = makeModel('Mentorship', {
  unique: [{ fields: ['mentor', 'student'] }],
  defaults: { stage: 'new', notes: '' },
});
export const CollaborationModel = makeModel('Collaboration', { defaults: { status: 'draft' } });
