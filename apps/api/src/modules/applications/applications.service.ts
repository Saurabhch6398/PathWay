import type { ApplicationDto } from '@pathway/shared';
import { AppError, notFound } from '../../common/errors';
import { ApplicationModel } from '../../models';

interface ApplicationLike {
  _id: unknown;
  status: ApplicationDto['status'];
  message?: string | null;
  createdAt?: Date;
  opportunity?: {
    _id: unknown;
    title: string;
    kind: NonNullable<ApplicationDto['opportunity']>['kind'];
    company?: { name?: string } | null;
  } | null;
}

const toDto = (a: ApplicationLike): ApplicationDto => ({
  id: String(a._id),
  status: a.status,
  message: a.message ?? undefined,
  createdAt: (a.createdAt ?? new Date(0)).toISOString(),
  opportunity: a.opportunity
    ? {
        id: String(a.opportunity._id),
        title: a.opportunity.title,
        kind: a.opportunity.kind,
        company: a.opportunity.company?.name ?? null,
      }
    : null,
});

export async function listMyApplications(studentId: string) {
  const items = await ApplicationModel.find({ student: studentId })
    .sort({ createdAt: -1 })
    .populate({
      path: 'opportunity',
      select: 'title kind company',
      populate: { path: 'company', select: 'name' },
    })
    .lean();
  return items.map((a) => toDto(a as unknown as ApplicationLike));
}

export async function withdrawApplication(studentId: string, id: string) {
  // Scoped to the student, so other people's applications look like they don't exist.
  const application = await ApplicationModel.findOne({ _id: id, student: studentId });
  if (!application) throw notFound('Application not found');
  if (application.status !== 'submitted') {
    throw new AppError(
      409,
      `A ${application.status} application can't be withdrawn`,
      'INVALID_STATE',
    );
  }
  application.status = 'withdrawn';
  await application.save();
  return { id: String(application._id), status: application.status };
}
