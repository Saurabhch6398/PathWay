import { Schema, model } from 'mongoose';
import { OPPORTUNITY_KINDS } from '@pathway/shared';

/** Jobs, internships and micro-internship gigs share one collection, told apart by `kind`. */
const opportunitySchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    company: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    kind: { type: String, enum: OPPORTUNITY_KINDS, required: true, index: true },
    description: { type: String, required: true },
    location: { type: String, default: 'Remote' },
    duration: String,
    compensation: String,
    skills: { type: [String], default: [] },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    deadline: Date,
    postedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
opportunitySchema.index({ status: 1, createdAt: -1 });

export const OpportunityModel = model('Opportunity', opportunitySchema);
