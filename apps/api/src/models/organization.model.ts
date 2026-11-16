import { Schema, model } from 'mongoose';

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['company', 'college'], required: true },
    industry: String,
    website: String,
    verified: { type: Boolean, default: false },
    // The recruiter who registered the company; only they (and admins) can post under it.
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
organizationSchema.index({ name: 1, type: 1 }, { unique: true });

export const OrganizationModel = model('Organization', organizationSchema);
