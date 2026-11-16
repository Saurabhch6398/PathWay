import type { InsightsDto, InsightsQuery } from '@pathway/shared';
import { escapeRegex } from '../../common/mongo';
import { ApplicationModel, StudentProfileModel } from '../../models';

/** Aggregates are only shown for groups of at least this many students. */
export const MIN_GROUP_SIZE = 3;
const MAX_STUDENTS = 5000;

const exactly = (value: string) => ({ $regex: `^${escapeRegex(value)}$`, $options: 'i' });

export async function getInsights(query: InsightsQuery): Promise<InsightsDto> {
  const filter: Record<string, unknown> = {};
  if (query.course) filter.course = exactly(query.course);
  if (query.batch) filter.batch = exactly(query.batch);

  const profiles = await StudentProfileModel.find(filter).limit(MAX_STUDENTS).lean();
  const empty: InsightsDto = {
    students: profiles.length,
    minGroupSize: MIN_GROUP_SIZE,
    restricted: true,
    topSkills: [],
    targetRoles: [],
    applications: { total: 0, shortlisted: 0, accepted: 0, rejected: 0 },
  };
  // A tiny cohort would let someone read off an individual's data, so show only the headcount.
  if (profiles.length < MIN_GROUP_SIZE) return empty;

  const skills = new Map<string, { name: string; students: number; total: number }>();
  const roles = new Map<string, { role: string; students: number }>();
  for (const p of profiles) {
    for (const s of p.skills ?? []) {
      const key = s.name.toLowerCase();
      const entry = skills.get(key) ?? { name: s.name, students: 0, total: 0 };
      entry.students += 1;
      entry.total += s.proficiency ?? 0;
      skills.set(key, entry);
    }
    const role = p.targetRole?.trim();
    if (role) {
      const entry = roles.get(role.toLowerCase()) ?? { role, students: 0 };
      entry.students += 1;
      roles.set(role.toLowerCase(), entry);
    }
  }

  const applications = await ApplicationModel.find({
    student: { $in: profiles.map((p) => String(p.user)) },
    status: { $ne: 'withdrawn' },
  }).lean();
  const count = (status: string) => applications.filter((a) => a.status === status).length;

  return {
    ...empty,
    restricted: false,
    topSkills: [...skills.values()]
      .filter((s) => s.students >= MIN_GROUP_SIZE)
      .sort((a, b) => b.students - a.students || a.name.localeCompare(b.name))
      .slice(0, 10)
      .map((s) => ({
        name: s.name,
        students: s.students,
        averageProficiency: Math.round(s.total / s.students),
      })),
    targetRoles: [...roles.values()]
      .filter((r) => r.students >= MIN_GROUP_SIZE)
      .sort((a, b) => b.students - a.students || a.role.localeCompare(b.role))
      .slice(0, 10),
    applications: {
      total: applications.length,
      shortlisted: count('shortlisted'),
      accepted: count('accepted'),
      rejected: count('rejected'),
    },
  };
}
