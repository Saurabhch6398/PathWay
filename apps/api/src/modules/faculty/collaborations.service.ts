import type {
  CollaborationDto,
  CollaborationInput,
  CollaborationStatus,
  CollaborationType,
  CollaborationUpdate,
} from '@pathway/shared';
import { AppError, notFound } from '../../common/errors';
import { CollaborationModel } from '../../models';

interface Like {
  _id: unknown;
  type: CollaborationType;
  title: string;
  partner: string;
  description?: string | null;
  status: CollaborationStatus;
  startDate?: Date | null;
  endDate?: Date | null;
  notes?: string | null;
  createdAt?: Date;
}

const day = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined);
const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);

const toDto = (c: Like): CollaborationDto => ({
  id: String(c._id),
  type: c.type,
  title: c.title,
  partner: c.partner,
  description: c.description ?? undefined,
  status: c.status,
  startDate: day(c.startDate),
  endDate: day(c.endDate),
  notes: c.notes ?? undefined,
  createdAt: (c.createdAt ?? new Date(0)).toISOString(),
});

const TRANSITIONS: Record<CollaborationStatus, CollaborationStatus[]> = {
  draft: ['proposed', 'cancelled'],
  proposed: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export async function listCollaborations(
  userId: string,
  filter: { type?: string; status?: string },
) {
  const query: Record<string, unknown> = { faculty: userId };
  if (filter.type) query.type = filter.type;
  if (filter.status) query.status = filter.status;
  const items = await CollaborationModel.find(query).sort({ createdAt: -1 }).lean();
  return items.map((c) => toDto(c as unknown as Like));
}

export async function createCollaboration(userId: string, input: CollaborationInput) {
  const { startDate, endDate, ...rest } = input;
  const created = await CollaborationModel.create({
    ...rest,
    faculty: userId,
    startDate: startDate ? toDate(startDate) : undefined,
    endDate: endDate ? toDate(endDate) : undefined,
  });
  return toDto(created as unknown as Like);
}

export async function updateCollaboration(userId: string, id: string, input: CollaborationUpdate) {
  // Scoped to the owner, so other faculty members' records look like they don't exist.
  const record = await CollaborationModel.findOne({ _id: id, faculty: userId });
  if (!record) throw notFound('Collaboration not found');

  const { status, startDate, endDate, ...rest } = input;
  if (['completed', 'cancelled'].includes(record.status)) {
    throw new AppError(409, `A ${record.status} collaboration can't be edited`, 'INVALID_STATE');
  }
  if (
    status &&
    status !== record.status &&
    !TRANSITIONS[record.status as CollaborationStatus].includes(status)
  ) {
    throw new AppError(
      409,
      `A ${record.status} collaboration can't become ${status}`,
      'INVALID_STATE',
    );
  }

  const start = startDate ? toDate(startDate) : record.startDate;
  const end = endDate ? toDate(endDate) : record.endDate;
  if (start && end && end < start) {
    throw new AppError(400, 'The end date must not be before the start date', 'INVALID_DATES');
  }

  Object.assign(record, rest, status ? { status } : {});
  if (startDate) record.startDate = start;
  if (endDate) record.endDate = end;
  await record.save();
  return toDto(record as unknown as Like);
}
