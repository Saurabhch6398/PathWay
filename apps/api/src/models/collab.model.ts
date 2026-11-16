import { Schema, model } from 'mongoose';
import { COLLABORATION_STATUSES, COLLABORATION_TYPES, MENTEE_STAGES } from '@pathway/shared';

/** A mentor's private pipeline entry for one student (the student never sees it). */
const mentorshipSchema = new Schema(
  {
    mentor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    stage: { type: String, enum: MENTEE_STAGES, default: 'new' },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);
mentorshipSchema.index({ mentor: 1, student: 1 }, { unique: true });
export const MentorshipModel = model('Mentorship', mentorshipSchema);

/** Faculty-tracked industry collaboration: MoUs, swaps, FDPs, consultancy, research, projects. */
export const CollaborationModel = model(
  'Collaboration',
  new Schema(
    {
      faculty: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      type: { type: String, enum: COLLABORATION_TYPES, required: true },
      title: { type: String, required: true, trim: true },
      partner: { type: String, required: true, trim: true },
      description: String,
      status: { type: String, enum: COLLABORATION_STATUSES, default: 'draft' },
      startDate: Date,
      endDate: Date,
      notes: String,
    },
    { timestamps: true },
  ),
);
