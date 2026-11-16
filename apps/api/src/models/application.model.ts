import { Schema, model } from 'mongoose';
import { APPLICATION_STATUSES } from '@pathway/shared';

const applicationSchema = new Schema(
  {
    opportunity: { type: Schema.Types.ObjectId, ref: 'Opportunity', required: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: String,
    status: { type: String, enum: APPLICATION_STATUSES, default: 'submitted' },
  },
  { timestamps: true },
);
// One application per student per opportunity.
applicationSchema.index({ opportunity: 1, student: 1 }, { unique: true });

export const ApplicationModel = model('Application', applicationSchema);
