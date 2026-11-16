import type { OpportunityDto, OpportunityQuery, Paginated } from '@pathway/shared';
import { AppError, notFound } from '../../common/errors';
import { escapeRegex, isDuplicateKeyError } from '../../common/mongo';
import { ApplicationModel, OpportunityModel } from '../../models';

interface OpportunityLike {
  _id: unknown;
  title: string;
  kind: OpportunityDto['kind'];
  company?: { name?: string } | null;
  description: string;
  location?: string | null;
  duration?: string | null;
  compensation?: string | null;
  skills?: string[];
  status: OpportunityDto['status'];
  deadline?: Date | null;
  createdAt?: Date;
}

export const toOpportunityDto = (o: OpportunityLike): OpportunityDto => ({
  id: String(o._id),
  title: o.title,
  kind: o.kind,
  company: o.company?.name ?? null,
  description: o.description,
  location: o.location ?? 'Remote',
  duration: o.duration ?? undefined,
  compensation: o.compensation ?? undefined,
  skills: o.skills ?? [],
  status: o.status,
  deadline: o.deadline ? o.deadline.toISOString() : null,
  createdAt: (o.createdAt ?? new Date(0)).toISOString(),
});

export async function listOpportunities(
  query: OpportunityQuery,
): Promise<Paginated<OpportunityDto>> {
  const filter: Record<string, unknown> = { status: 'open' };
  if (query.kind) filter.kind = query.kind;
  if (query.q) filter.title = { $regex: escapeRegex(query.q), $options: 'i' };
  if (query.skill) filter.skills = { $regex: `^${escapeRegex(query.skill)}$`, $options: 'i' };

  const [items, total] = await Promise.all([
    OpportunityModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate('company', 'name')
      .lean(),
    OpportunityModel.countDocuments(filter),
  ]);
  return {
    items: items.map((o) => toOpportunityDto(o as unknown as OpportunityLike)),
    page: query.page,
    limit: query.limit,
    total,
  };
}

export async function getOpportunity(id: string) {
  const o = await OpportunityModel.findById(id).populate('company', 'name').lean();
  if (!o) throw notFound('Opportunity not found');
  return toOpportunityDto(o as unknown as OpportunityLike);
}

export async function applyToOpportunity(
  studentId: string,
  opportunityId: string,
  message?: string,
) {
  const opportunity = await OpportunityModel.findById(opportunityId).lean();
  if (!opportunity) throw notFound('Opportunity not found');
  if (opportunity.status !== 'open')
    throw new AppError(409, 'This opportunity is closed', 'CLOSED');
  if (opportunity.deadline && opportunity.deadline.getTime() < Date.now()) {
    throw new AppError(409, 'The application deadline has passed', 'DEADLINE_PASSED');
  }

  const alreadyApplied = new AppError(409, 'You have already applied', 'ALREADY_APPLIED');
  if (await ApplicationModel.exists({ opportunity: opportunityId, student: studentId }))
    throw alreadyApplied;
  try {
    const application = await ApplicationModel.create({
      opportunity: opportunityId,
      student: studentId,
      message,
    });
    return { id: String(application._id), status: application.status };
  } catch (err) {
    // Two simultaneous requests can both pass the check above; the unique index catches the loser.
    throw isDuplicateKeyError(err) ? alreadyApplied : err;
  }
}
