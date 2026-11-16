import type { FacultyProfileDto } from '@pathway/shared';
import { notFound } from '../../common/errors';
import { FacultyProfileModel } from '../../models';

interface Like {
  collegeName?: string | null;
  department?: string | null;
  designation?: string | null;
}
const toDto = (p: Like): FacultyProfileDto => ({
  collegeName: p.collegeName ?? undefined,
  department: p.department ?? undefined,
  designation: p.designation ?? undefined,
});

export async function getFacultyProfile(userId: string) {
  const profile = await FacultyProfileModel.findOne({ user: userId }).lean();
  if (!profile) throw notFound('Faculty profile not found');
  return toDto(profile);
}

export async function updateFacultyProfile(userId: string, input: FacultyProfileDto) {
  const profile = await FacultyProfileModel.findOneAndUpdate(
    { user: userId },
    { $set: input },
    { new: true },
  ).lean();
  if (!profile) throw notFound('Faculty profile not found');
  return toDto(profile);
}
