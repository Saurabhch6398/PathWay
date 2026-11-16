import type { Role } from '@pathway/shared';

export const homeFor = (role: Role) => `/${role}`;

export const ROLE_LABELS: Record<Role, string> = {
  student: 'Student',
  mentor: 'Mentor',
  faculty: 'Faculty / HOD',
  recruiter: 'Recruiter',
  admin: 'Admin',
};
