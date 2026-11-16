import type { ApplicantDto, ApplicationDecision, ApplicationStatus } from '@pathway/shared';
import { AppError, notFound } from '../../common/errors';
import { ApplicationModel, OpportunityModel, StudentProfileModel } from '../../models';
import { findOwned } from './postings.service';

interface ApplicationLike {
  _id: unknown;
  status: ApplicationStatus;
  message?: string | null;
  createdAt?: Date;
  student: { _id: unknown; name?: string; email?: string };
}

export async function listApplicants(
  userId: string,
  opportunityId: string,
): Promise<ApplicantDto[]> {
  await findOwned(userId, opportunityId);

  const applications = (
    (await ApplicationModel.find({
      opportunity: opportunityId,
      status: { $ne: 'withdrawn' },
    })
      .sort({ createdAt: -1 })
      .populate('student', 'name email')
      .lean()) as unknown as ApplicationLike[]
  ).filter((a) => a.student); // skip applicants whose account no longer exists

  const profiles = applications.length
    ? await StudentProfileModel.find({
        user: { $in: applications.map((a) => String(a.student._id)) },
      }).lean()
    : [];
  const profileByUser = new Map(profiles.map((p) => [String(p.user), p]));

  return applications.map((a) => {
    const profile = profileByUser.get(String(a.student._id));
    return {
      id: String(a._id),
      status: a.status,
      message: a.message ?? undefined,
      createdAt: (a.createdAt ?? new Date(0)).toISOString(),
      student: {
        id: String(a.student._id),
        name: a.student.name ?? '',
        email: a.student.email ?? '',
        course: profile?.course ?? undefined,
        batch: profile?.batch ?? undefined,
        targetRole: profile?.targetRole ?? undefined,
        skills: (profile?.skills ?? []).map((s) => ({
          name: s.name,
          proficiency: s.proficiency ?? 0,
        })),
      },
    };
  });
}

const TRANSITIONS: Record<ApplicationStatus, ApplicationDecision[]> = {
  submitted: ['shortlisted', 'rejected'],
  shortlisted: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
  withdrawn: [],
};

export async function decideApplication(
  userId: string,
  applicationId: string,
  next: ApplicationDecision,
) {
  const application = await ApplicationModel.findById(applicationId);
  // Only applications to the recruiter's own postings are reachable.
  const owned =
    application &&
    (await OpportunityModel.exists({ _id: application.opportunity, postedBy: userId }));
  if (!application || !owned) throw notFound('Application not found');

  if (!TRANSITIONS[application.status].includes(next)) {
    throw new AppError(
      409,
      `A ${application.status} application can't become ${next}`,
      'INVALID_STATE',
    );
  }
  application.status = next;
  await application.save();
  return { id: String(application._id), status: application.status };
}
