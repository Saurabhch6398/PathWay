import { z } from 'zod';

/** Roles a person may choose at sign-up. `admin` is never self-service. */
export const REGISTERABLE_ROLES = ['student', 'mentor', 'faculty', 'recruiter'] as const;

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'));
// bcrypt only uses the first 72 bytes, so cap the length.
export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(72, 'At most 72 characters')
  .regex(/[A-Za-z]/, 'Must contain a letter')
  .regex(/\d/, 'Must contain a number');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(100),
  email,
  password: passwordSchema,
  role: z.enum(REGISTERABLE_ROLES),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password') });
export type LoginInput = z.infer<typeof loginSchema>;

export const userDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['student', 'mentor', 'faculty', 'recruiter', 'admin']),
});
export type UserDto = z.infer<typeof userDtoSchema>;

export const authResponseSchema = z.object({ accessToken: z.string(), user: userDtoSchema });
export type AuthResponse = z.infer<typeof authResponseSchema>;
