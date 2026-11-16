import type { Paginated, TalentDto, TalentQuery } from '@pathway/shared';
import { escapeRegex } from '../../common/mongo';
import { StudentProfileModel } from '../../models';

interface TalentProfileLike {
  user?: { _id: unknown; name?: string } | null;
  course?: string | null;
  batch?: string | null;
  targetRole?: string | null;
  skills?: { name: string; proficiency?: number | null }[];
}

export async function searchTalent(query: TalentQuery): Promise<Paginated<TalentDto>> {
  // `$ne: false` also matches profiles created before the visibility flag existed.
  const filter: Record<string, unknown> = { visibleToRecruiters: { $ne: false } };
  if (query.role) filter.targetRole = { $regex: escapeRegex(query.role), $options: 'i' };
  if (query.skill || query.minProficiency !== undefined) {
    filter.skills = {
      $elemMatch: {
        ...(query.skill
          ? { name: { $regex: `^${escapeRegex(query.skill)}$`, $options: 'i' } }
          : {}),
        ...(query.minProficiency !== undefined
          ? { proficiency: { $gte: query.minProficiency } }
          : {}),
      },
    };
  }

  const [profiles, total] = await Promise.all([
    StudentProfileModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate('user', 'name')
      .lean(),
    StudentProfileModel.countDocuments(filter),
  ]);

  return {
    items: profiles.map((p) => {
      const profile = p as unknown as TalentProfileLike;
      return {
        id: String(profile.user?._id),
        name: profile.user?.name ?? 'Student',
        course: profile.course ?? undefined,
        batch: profile.batch ?? undefined,
        targetRole: profile.targetRole ?? undefined,
        skills: (profile.skills ?? []).map((s) => ({
          name: s.name,
          proficiency: s.proficiency ?? 0,
        })),
      };
    }),
    page: query.page,
    limit: query.limit,
    total,
  };
}
