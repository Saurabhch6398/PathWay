import type {
  MenteeDto,
  MenteeStage,
  MentorProfileUpdate,
  MentorSelfDto,
  MentorSummaryDto,
  SessionStatus,
} from '@pathway/shared';
import { notFound } from '../../common/errors';
import { isDuplicateKeyError } from '../../common/mongo';
import {
  MentorProfileModel,
  MentorSessionModel,
  MentorshipModel,
  StudentProfileModel,
} from '../../models';

interface MentorLike {
  title?: string | null;
  companyName?: string | null;
  company?: { name?: string } | null;
  experienceYears?: number | null;
  expertise?: string[];
  available?: boolean | null;
}

const toSelfDto = (m: MentorLike): MentorSelfDto => ({
  title: m.title ?? undefined,
  companyName: m.companyName ?? m.company?.name ?? undefined,
  experienceYears: m.experienceYears ?? undefined,
  expertise: m.expertise ?? [],
  available: m.available ?? true,
});

export async function getMentorSelf(userId: string) {
  const profile = await MentorProfileModel.findOne({ user: userId })
    .populate('company', 'name')
    .lean();
  if (!profile) throw notFound('Mentor profile not found');
  return toSelfDto(profile as unknown as MentorLike);
}

export async function updateMentorSelf(userId: string, input: MentorProfileUpdate) {
  const profile = await MentorProfileModel.findOneAndUpdate(
    { user: userId },
    { $set: input },
    { new: true, runValidators: true },
  )
    .populate('company', 'name')
    .lean();
  if (!profile) throw notFound('Mentor profile not found');
  return toSelfDto(profile as unknown as MentorLike);
}

interface SessionRow {
  status: SessionStatus;
  startsAt: Date;
  student: { _id: unknown; name?: string };
}

/** Sessions with students that haven't been declined or cancelled. */
const LIVE = ['pending', 'confirmed', 'completed'] as const;

export async function getMentorSummary(userId: string): Promise<MentorSummaryDto> {
  const sessions = (await MentorSessionModel.find({
    mentor: userId,
  }).lean()) as unknown as (SessionRow & {
    student: unknown;
  })[];
  const now = Date.now();
  return {
    pendingRequests: sessions.filter((s) => s.status === 'pending').length,
    upcomingConfirmed: sessions.filter(
      (s) => s.status === 'confirmed' && s.startsAt.getTime() > now,
    ).length,
    completedSessions: sessions.filter((s) => s.status === 'completed').length,
    mentees: new Set(sessions.filter((s) => s.status !== 'cancelled').map((s) => String(s.student)))
      .size,
  };
}

export async function listMentees(userId: string): Promise<MenteeDto[]> {
  const sessions = (await MentorSessionModel.find({ mentor: userId, status: { $in: LIVE } })
    .sort({ startsAt: -1 })
    .populate('student', 'name')
    .lean()) as unknown as SessionRow[];

  const byStudent = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    if (!s.student) continue; // account no longer exists
    const key = String(s.student._id);
    byStudent.set(key, [...(byStudent.get(key) ?? []), s]);
  }
  const ids = [...byStudent.keys()];
  if (ids.length === 0) return [];

  const [profiles, mentorships] = await Promise.all([
    StudentProfileModel.find({ user: { $in: ids } }).lean(),
    MentorshipModel.find({ mentor: userId, student: { $in: ids } }).lean(),
  ]);
  const profileOf = new Map(profiles.map((p) => [String(p.user), p]));
  const mentorshipOf = new Map(mentorships.map((m) => [String(m.student), m]));
  const now = Date.now();

  return ids.map((id) => {
    const rows = byStudent.get(id)!;
    const profile = profileOf.get(id);
    const mentorship = mentorshipOf.get(id);
    return {
      student: {
        id,
        name: rows[0]!.student.name ?? 'Student',
        course: profile?.course ?? undefined,
        batch: profile?.batch ?? undefined,
        targetRole: profile?.targetRole ?? undefined,
        skills: (profile?.skills ?? []).map((s) => ({
          name: s.name,
          proficiency: s.proficiency ?? 0,
        })),
      },
      stage: (mentorship?.stage ?? 'new') as MenteeStage,
      notes: mentorship?.notes ?? '',
      sessions: {
        total: rows.length,
        completed: rows.filter((r) => r.status === 'completed').length,
        upcoming: rows.filter((r) => r.status === 'confirmed' && r.startsAt.getTime() > now).length,
      },
      lastSessionAt: rows[0]!.startsAt.toISOString(), // rows are newest first
    };
  });
}

export async function updateMentee(
  userId: string,
  studentId: string,
  input: { stage?: MenteeStage; notes?: string },
) {
  // Only students the mentor actually has a (non-cancelled) session with.
  if (
    !(await MentorSessionModel.exists({
      mentor: userId,
      student: studentId,
      status: { $in: LIVE },
    }))
  ) {
    throw notFound('Mentee not found');
  }
  const apply = async () => {
    const existing = await MentorshipModel.findOne({ mentor: userId, student: studentId });
    if (!existing) return null;
    Object.assign(existing, input);
    await existing.save();
    return existing;
  };

  let mentorship = await apply();
  if (!mentorship) {
    try {
      mentorship = await MentorshipModel.create({ mentor: userId, student: studentId, ...input });
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      mentorship = await apply(); // created concurrently
    }
  }
  return { stage: (mentorship?.stage ?? 'new') as MenteeStage, notes: mentorship?.notes ?? '' };
}
