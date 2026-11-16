import type { RecruiterAnalyticsDto } from '@pathway/shared';
import { ApplicationModel, OpportunityModel } from '../../models';

export async function getAnalytics(userId: string): Promise<RecruiterAnalyticsDto> {
  const opportunities = await OpportunityModel.find({ postedBy: userId }).lean();
  const ids = opportunities.map((o) => o._id);
  const applications = ids.length
    ? await ApplicationModel.find({
        opportunity: { $in: ids },
        status: { $ne: 'withdrawn' },
      }).lean()
    : [];

  const by = (status: string) => applications.filter((a) => a.status === status).length;
  return {
    opportunities: {
      open: opportunities.filter((o) => o.status === 'open').length,
      closed: opportunities.filter((o) => o.status === 'closed').length,
    },
    applications: {
      total: applications.length,
      submitted: by('submitted'),
      shortlisted: by('shortlisted'),
      accepted: by('accepted'),
      rejected: by('rejected'),
    },
  };
}
