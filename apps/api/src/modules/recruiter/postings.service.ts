import type { OpportunityInput, RecruiterOpportunityDto } from '@pathway/shared';
import { opportunityInputSchema, opportunityUpdateSchema } from '@pathway/shared';
import type { z } from 'zod';
import { AppError, notFound } from '../../common/errors';
import { ApplicationModel, OpportunityModel, RecruiterProfileModel } from '../../models';
import { toOpportunityDto } from '../opportunities/opportunities.service';

type OppLike = Parameters<typeof toOpportunityDto>[0];

async function loadDto(id: unknown, applicantCount: number): Promise<RecruiterOpportunityDto> {
  const o = await OpportunityModel.findById(id).populate('company', 'name').lean();
  if (!o) throw notFound('Opportunity not found');
  return { ...toOpportunityDto(o as unknown as OppLike), applicantCount };
}

/** An opportunity the recruiter posted; anyone else's looks like it doesn't exist. */
export async function findOwned(userId: string, id: string) {
  const opportunity = await OpportunityModel.findOne({ _id: id, postedBy: userId });
  if (!opportunity) throw notFound('Opportunity not found');
  return opportunity;
}

export async function createPosting(userId: string, raw: OpportunityInput) {
  const input = opportunityInputSchema.parse(raw);
  const profile = await RecruiterProfileModel.findOne({ user: userId }).lean();
  if (!profile?.company) {
    throw new AppError(400, 'Set your company before posting opportunities', 'COMPANY_REQUIRED');
  }
  const opportunity = await OpportunityModel.create({
    ...input,
    deadline: input.deadline ? new Date(input.deadline) : undefined,
    company: profile.company,
    postedBy: userId,
  });
  return loadDto(opportunity._id, 0);
}

export async function updatePosting(
  userId: string,
  id: string,
  input: z.infer<typeof opportunityUpdateSchema>,
) {
  const opportunity = await findOwned(userId, id);
  const { deadline, ...rest } = input;
  Object.assign(opportunity, rest, deadline ? { deadline: new Date(deadline) } : {});
  await opportunity.save();
  const count = await ApplicationModel.countDocuments({
    opportunity: id,
    status: { $ne: 'withdrawn' },
  });
  return loadDto(opportunity._id, count);
}

export async function listPostings(userId: string): Promise<RecruiterOpportunityDto[]> {
  const opportunities = await OpportunityModel.find({ postedBy: userId })
    .sort({ createdAt: -1 })
    .populate('company', 'name')
    .lean();
  const ids = opportunities.map((o) => o._id);
  const applications = ids.length
    ? await ApplicationModel.find({
        opportunity: { $in: ids },
        status: { $ne: 'withdrawn' },
      }).lean()
    : [];

  const counts = new Map<string, number>();
  for (const a of applications)
    counts.set(String(a.opportunity), (counts.get(String(a.opportunity)) ?? 0) + 1);

  return opportunities.map((o) => ({
    ...toOpportunityDto(o as unknown as OppLike),
    applicantCount: counts.get(String(o._id)) ?? 0,
  }));
}
