import type { BookSessionInput, MentorDto } from '@pathway/shared';
import { AppError, notFound } from '../../common/errors';
import { isDuplicateKeyError } from '../../common/mongo';
import { MentorProfileModel, MentorSessionModel } from '../../models';
import { getSessionDto } from '../sessions/sessions.service';

interface MentorLike {
  _id: unknown;
  user?: { name?: string } | null;
  title?: string | null;
  companyName?: string | null;
  company?: { name?: string } | null;
  experienceYears?: number | null;
  expertise?: string[];
}

const toMentorDto = (m: MentorLike): MentorDto => ({
  id: String(m._id),
  name: m.user?.name ?? 'Mentor',
  title: m.title ?? undefined,
  company: m.companyName ?? m.company?.name ?? null,
  experienceYears: m.experienceYears ?? undefined,
  expertise: m.expertise ?? [],
});

export async function listMentors() {
  const mentors = await MentorProfileModel.find({ available: true })
    .populate('user', 'name')
    .populate('company', 'name')
    .lean();
  return mentors.map((m) => toMentorDto(m as unknown as MentorLike));
}

export async function getMentor(id: string) {
  const mentor = await MentorProfileModel.findById(id)
    .populate('user', 'name')
    .populate('company', 'name')
    .lean();
  if (!mentor) throw notFound('Mentor not found');
  return toMentorDto(mentor as unknown as MentorLike);
}

const MAX_DAYS_AHEAD = 90;
const LIVE = ['pending', 'confirmed'] as const;

export async function bookSession(
  studentId: string,
  mentorProfileId: string,
  input: BookSessionInput,
) {
  const mentor = await MentorProfileModel.findById(mentorProfileId).lean();
  if (!mentor || !mentor.available) throw notFound('Mentor not found');

  const startsAt = new Date(input.startsAt);
  const now = Date.now();
  if (startsAt.getTime() <= now)
    throw new AppError(400, 'Choose a time in the future', 'INVALID_TIME');
  if (startsAt.getTime() > now + MAX_DAYS_AHEAD * 86_400_000) {
    throw new AppError(
      400,
      `Sessions can be booked up to ${MAX_DAYS_AHEAD} days ahead`,
      'INVALID_TIME',
    );
  }

  const taken = new AppError(409, 'That time slot is already booked', 'SLOT_TAKEN');
  if (await MentorSessionModel.exists({ mentor: mentor.user, startsAt, status: { $in: LIVE } }))
    throw taken;
  try {
    const session = await MentorSessionModel.create({
      mentor: mentor.user,
      student: studentId,
      startsAt,
      topic: input.topic,
    });
    return await getSessionDto(session._id);
  } catch (err) {
    // The partial unique index guards against two students booking the same slot at once.
    throw isDuplicateKeyError(err) ? taken : err;
  }
}
