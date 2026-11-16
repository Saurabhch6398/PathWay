import type { RecruiterProfileDto } from '@pathway/shared';
import { AppError, notFound } from '../../common/errors';
import { isDuplicateKeyError } from '../../common/mongo';
import { OrganizationModel, RecruiterProfileModel } from '../../models';

interface ProfileLike {
  designation?: string | null;
  company?: { _id: unknown; name?: string } | null;
}

const toDto = (p: ProfileLike): RecruiterProfileDto => ({
  designation: p.designation ?? undefined,
  company: p.company ? { id: String(p.company._id), name: p.company.name ?? '' } : null,
});

export async function getRecruiterProfile(userId: string) {
  const profile = await RecruiterProfileModel.findOne({ user: userId })
    .populate('company', 'name')
    .lean();
  if (!profile) throw notFound('Recruiter profile not found');
  return toDto(profile as unknown as ProfileLike);
}

/**
 * Company names are unique and belong to the recruiter who registered them. Without this check anyone
 * could post jobs as an existing company just by typing its name (there is no invite flow yet).
 */
async function claimCompany(userId: string, name: string) {
  let org = await OrganizationModel.findOne({ name, type: 'company' });
  if (!org) {
    try {
      org = await OrganizationModel.create({ name, type: 'company', createdBy: userId });
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      org = await OrganizationModel.findOne({ name, type: 'company' });
    }
  }
  if (!org) throw new AppError(500, 'Could not register the company');

  const profile = await RecruiterProfileModel.findOne({ user: userId }).lean();
  const alreadyLinked = profile?.company && String(profile.company) === String(org._id);
  if (String(org.createdBy) !== userId && !alreadyLinked) {
    throw new AppError(
      409,
      'This company is already registered by another account. Contact support to be linked to it.',
      'COMPANY_TAKEN',
    );
  }
  return org;
}

export async function updateRecruiterProfile(
  userId: string,
  input: { companyName?: string; designation?: string },
) {
  const set: Record<string, unknown> = {};
  if (input.designation !== undefined) set.designation = input.designation;
  if (input.companyName) set.company = (await claimCompany(userId, input.companyName))._id;

  const profile = await RecruiterProfileModel.findOneAndUpdate(
    { user: userId },
    { $set: set },
    { new: true },
  )
    .populate('company', 'name')
    .lean();
  if (!profile) throw notFound('Recruiter profile not found');
  return toDto(profile as unknown as ProfileLike);
}
