import type { SessionDto, SessionStatus, SessionStatusInput } from '@pathway/shared';
import { AppError, forbidden, notFound } from '../../common/errors';
import { MentorSessionModel } from '../../models';

interface SessionLike {
  _id: unknown;
  startsAt: Date;
  durationMinutes?: number | null;
  topic: string;
  status: SessionStatus;
  mentor: { _id: unknown; name?: string };
  student: { _id: unknown; name?: string };
}

export const toSessionDto = (s: SessionLike): SessionDto => ({
  id: String(s._id),
  startsAt: s.startsAt.toISOString(),
  durationMinutes: s.durationMinutes ?? 30,
  topic: s.topic,
  status: s.status,
  mentor: { id: String(s.mentor._id), name: s.mentor.name ?? 'Mentor' },
  student: { id: String(s.student._id), name: s.student.name ?? 'Student' },
});

export async function listMySessions(userId: string, role: 'student' | 'mentor') {
  const items = await MentorSessionModel.find({ [role]: userId })
    .sort({ startsAt: 1 })
    .populate('mentor', 'name')
    .populate('student', 'name')
    .lean();
  return items.map((s) => toSessionDto(s as unknown as SessionLike));
}

export async function getSessionDto(id: unknown) {
  const s = await MentorSessionModel.findById(id)
    .populate('mentor', 'name')
    .populate('student', 'name')
    .lean();
  return s ? toSessionDto(s as unknown as SessionLike) : null;
}

// What each side may do. Students can only cancel; mentors run the session lifecycle.
const ALLOWED: Record<'student' | 'mentor', SessionStatusInput['status'][]> = {
  student: ['cancelled'],
  mentor: ['confirmed', 'cancelled', 'completed'],
};
const TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['cancelled', 'completed'],
  cancelled: [],
  completed: [],
};

export async function updateSessionStatus(
  userId: string,
  sessionId: string,
  next: SessionStatusInput['status'],
) {
  const session = await MentorSessionModel.findById(sessionId);
  const side = !session
    ? null
    : String(session.mentor) === userId
      ? 'mentor'
      : String(session.student) === userId
        ? 'student'
        : null;
  // Strangers get the same 404 as a missing session.
  if (!session || !side) throw notFound('Session not found');

  if (!ALLOWED[side].includes(next)) throw forbidden(`A ${side} can't mark a session ${next}`);
  if (!TRANSITIONS[session.status].includes(next)) {
    throw new AppError(409, `A ${session.status} session can't become ${next}`, 'INVALID_STATE');
  }
  session.status = next;
  await session.save();
  return getSessionDto(session._id);
}
