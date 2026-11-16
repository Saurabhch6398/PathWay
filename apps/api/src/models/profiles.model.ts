import { Schema, model } from 'mongoose';

const userRef = { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true };
const orgRef = { type: Schema.Types.ObjectId, ref: 'Organization' };

// Skills are embedded: they're always read with the student and never queried alone.
const skillSchema = new Schema(
  {
    name: { type: String, required: true },
    proficiency: { type: Number, min: 0, max: 100, default: 0 },
  },
  { _id: false },
);

export const StudentProfileModel = model(
  'StudentProfile',
  new Schema(
    {
      user: userRef,
      college: orgRef,
      course: String,
      batch: String,
      targetRole: String,
      // Recruiters can find students in talent search unless they opt out.
      visibleToRecruiters: { type: Boolean, default: true },
      skills: { type: [skillSchema], default: [] },
      careerReadiness: { type: Number, min: 0, max: 100, default: 0 },
      experienceScore: { type: Number, min: 0, max: 100, default: 0 },
    },
    { timestamps: true },
  ),
);

export const MentorProfileModel = model(
  'MentorProfile',
  new Schema(
    {
      user: userRef,
      title: String,
      company: orgRef,
      companyName: String, // self-declared; shown in preference to `company`
      experienceYears: { type: Number, min: 0 },
      expertise: { type: [String], default: [] },
      available: { type: Boolean, default: true },
    },
    { timestamps: true },
  ),
);

export const FacultyProfileModel = model(
  'FacultyProfile',
  new Schema(
    {
      user: userRef,
      college: orgRef,
      collegeName: String,
      department: String,
      designation: String,
    },
    { timestamps: true },
  ),
);

export const RecruiterProfileModel = model(
  'RecruiterProfile',
  new Schema({ user: userRef, company: orgRef, designation: String }, { timestamps: true }),
);
