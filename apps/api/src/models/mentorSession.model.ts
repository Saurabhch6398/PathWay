import { Schema, model } from 'mongoose';
import { SESSION_STATUSES } from '@pathway/shared';

const mentorSessionSchema = new Schema(
  {
    mentor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startsAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 30 },
    topic: { type: String, required: true },
    status: { type: String, enum: SESSION_STATUSES, default: 'pending' },
  },
  { timestamps: true },
);
// A mentor can't have two live sessions at the same time; cancelled slots become free again.
mentorSessionSchema.index(
  { mentor: 1, startsAt: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } } },
);

export const MentorSessionModel = model('MentorSession', mentorSessionSchema);
