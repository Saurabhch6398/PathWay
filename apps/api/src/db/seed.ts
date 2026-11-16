import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { loadEnv } from '../config/env';
import {
  CollaborationModel,
  FacultyProfileModel,
  MentorProfileModel,
  OpportunityModel,
  OrganizationModel,
  RecruiterProfileModel,
  StudentProfileModel,
  UserModel,
} from '../models';

const DEMO_PASSWORD = 'Password123';

async function org(name: string, type: 'company' | 'college', industry?: string) {
  return OrganizationModel.findOneAndUpdate(
    { name, type },
    { $setOnInsert: { name, type, industry, verified: true } },
    { upsert: true, new: true },
  );
}

async function user(name: string, email: string, role: string) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  return UserModel.findOneAndUpdate(
    { email },
    { $setOnInsert: { name, email, role, passwordHash } },
    { upsert: true, new: true },
  );
}

const profile = (
  model:
    | typeof StudentProfileModel
    | typeof MentorProfileModel
    | typeof FacultyProfileModel
    | typeof RecruiterProfileModel,
  userId: unknown,
  data: object,
) =>
  // @ts-expect-error union of models: each accepts a `user` filter and arbitrary $setOnInsert data
  model.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, ...data } },
    { upsert: true },
  );

async function main() {
  const env = loadEnv();
  if (env.NODE_ENV === 'production') throw new Error('Refusing to seed demo data in production');
  await mongoose.connect(env.MONGODB_URI);

  const [college, technova, cloudsphere] = await Promise.all([
    org('Demo University', 'college'),
    org('TechNova Labs', 'company', 'Software & AI'),
    org('CloudSphere Systems', 'company', 'Cloud Infrastructure'),
  ]);

  await user('Admin', 'admin@pathway.dev', 'admin');

  const student = await user('Demo Student', 'student@pathway.dev', 'student');
  await profile(StudentProfileModel, student._id, {
    college: college._id,
    course: 'CSIT',
    batch: '2025-29',
    targetRole: 'Full Stack Software Engineer',
    skills: [
      { name: 'React', proficiency: 70 },
      { name: 'Node.js', proficiency: 60 },
    ],
  });

  const mentor = await user('Demo Mentor', 'mentor@pathway.dev', 'mentor');
  await profile(MentorProfileModel, mentor._id, {
    title: 'Senior Software Architect',
    company: technova._id,
    experienceYears: 12,
    expertise: ['System Design', 'Node.js'],
  });

  const mentor2 = await user('Priya Sharma', 'mentor2@pathway.dev', 'mentor');
  await profile(MentorProfileModel, mentor2._id, {
    title: 'Engineering Manager',
    company: cloudsphere._id,
    experienceYears: 10,
    expertise: ['Career Growth', 'Cloud'],
  });
  const mentor3 = await user('Arjun Kapoor', 'mentor3@pathway.dev', 'mentor');
  await profile(MentorProfileModel, mentor3._id, {
    title: 'AI/ML Lead',
    company: technova._id,
    experienceYears: 14,
    expertise: ['Machine Learning', 'Python'],
  });

  const faculty = await user('Demo Faculty', 'faculty@pathway.dev', 'faculty');
  await profile(FacultyProfileModel, faculty._id, {
    college: college._id,
    department: 'CSE',
    designation: 'Associate Professor',
  });

  const recruiter = await user('Demo Recruiter', 'recruiter@pathway.dev', 'recruiter');
  await profile(RecruiterProfileModel, recruiter._id, {
    company: cloudsphere._id,
    designation: 'Talent Acquisition Lead',
  });

  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000);
  const opportunities = [
    {
      title: 'Software Engineer Intern',
      kind: 'internship',
      company: technova._id,
      location: 'Bengaluru (Hybrid)',
      duration: '6 months',
      compensation: '₹25,000/month',
      skills: ['React', 'Node.js', 'MongoDB'],
      description:
        'Work on cloud-native web services and UI components with a mentor from the platform team.',
      deadline: inDays(30),
    },
    {
      title: 'Build an Authenticated REST API',
      kind: 'gig',
      company: cloudsphere._id,
      location: 'Remote',
      duration: '5 hours',
      compensation: '₹3,500',
      skills: ['Node.js', 'JWT', 'MongoDB'],
      description: 'Micro-internship: design and ship a JWT-secured REST API with tests.',
    },
    {
      title: 'Responsive Product Landing Page',
      kind: 'gig',
      company: technova._id,
      location: 'Remote',
      duration: '3 hours',
      compensation: '₹1,500',
      skills: ['React', 'Tailwind CSS'],
      description: 'Micro-internship: turn a design into a fast, accessible landing page.',
    },
    {
      title: 'Frontend Developer',
      kind: 'job',
      company: cloudsphere._id,
      location: 'Pune',
      duration: 'Full-time',
      compensation: '₹8 LPA',
      skills: ['React', 'TypeScript'],
      description: 'Build and own dashboards used by enterprise customers.',
      deadline: inDays(45),
    },
    {
      title: 'ML Engineer Intern',
      kind: 'internship',
      company: technova._id,
      location: 'Hyderabad',
      duration: '6 months',
      compensation: '₹30,000/month',
      skills: ['Python', 'PyTorch'],
      description: 'Train, benchmark and deploy predictive models.',
      deadline: inDays(20),
    },
    {
      title: 'SQL Business Analytics Challenge',
      kind: 'gig',
      company: cloudsphere._id,
      location: 'Remote',
      duration: '3 hours',
      compensation: '₹1,800',
      skills: ['SQL'],
      description: 'Micro-internship: write analytical queries for a financial report.',
    },
  ];
  for (const o of opportunities) {
    await OpportunityModel.findOneAndUpdate(
      { title: o.title, company: o.company },
      { $setOnInsert: { ...o, postedBy: recruiter._id } },
      { upsert: true },
    );
  }

  const collaborations = [
    {
      type: 'mou',
      title: 'Cloud skilling MoU',
      partner: 'CloudSphere Systems',
      status: 'active',
      description: 'Joint certification track and guest lectures for final-year students.',
    },
    {
      type: 'fdp',
      title: 'Applied AI faculty development programme',
      partner: 'TechNova Labs',
      status: 'proposed',
      description: 'Five-day FDP on building LLM-powered applications.',
    },
    {
      type: 'industry_project',
      title: 'Campus placement analytics dashboard',
      partner: 'TechNova Labs',
      status: 'draft',
    },
  ];
  for (const c of collaborations) {
    await CollaborationModel.findOneAndUpdate(
      { faculty: faculty._id, title: c.title },
      { $setOnInsert: { ...c, faculty: faculty._id } },
      { upsert: true },
    );
  }

  console.log(
    `Seeded. Demo logins: {admin,student,mentor,mentor2,mentor3,faculty,recruiter}@pathway.dev / ${DEMO_PASSWORD}`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
