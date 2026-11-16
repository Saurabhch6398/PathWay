import type { StudentProfileDto, StudentProfileUpdate } from '@pathway/shared';
import { notFound } from '../../common/errors';
import { StudentProfileModel } from '../../models';

interface ProfileLike {
  course?: string | null;
  batch?: string | null;
  targetRole?: string | null;
  skills?: { name: string; proficiency?: number | null }[];
  careerReadiness?: number | null;
  experienceScore?: number | null;
  visibleToRecruiters?: boolean | null;
}

const toDto = (p: ProfileLike): StudentProfileDto => ({
  course: p.course ?? undefined,
  batch: p.batch ?? undefined,
  targetRole: p.targetRole ?? undefined,
  skills: (p.skills ?? []).map((s) => ({ name: s.name, proficiency: s.proficiency ?? 0 })),
  careerReadiness: p.careerReadiness ?? 0,
  experienceScore: p.experienceScore ?? 0,
  visibleToRecruiters: p.visibleToRecruiters ?? true,
});

export async function getStudentProfile(userId: string) {
  const profile = await StudentProfileModel.findOne({ user: userId }).lean();
  if (!profile) throw notFound('Student profile not found');
  return toDto(profile);
}

export async function updateStudentProfile(userId: string, input: StudentProfileUpdate) {
  const profile = await StudentProfileModel.findOneAndUpdate(
    { user: userId },
    { $set: input },
    { new: true, runValidators: true },
  ).lean();
  if (!profile) throw notFound('Student profile not found');
  return toDto(profile);
}
