import bcrypt from 'bcryptjs';
import type { LoginInput, RegisterInput, UserDto } from '@pathway/shared';
import { AppError, unauthorized } from '../../common/errors';
import { isDuplicateKeyError } from '../../common/mongo';
import {
  FacultyProfileModel,
  MentorProfileModel,
  RecruiterProfileModel,
  StudentProfileModel,
  UserModel,
} from '../../models';
import { consumeRefreshToken, issueRefreshToken, signAccessToken } from './token.service';

const ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;
// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', ROUNDS);

type UserLike = { _id: unknown; name: string; email: string; role: UserDto['role'] };

export const toUserDto = (u: UserLike): UserDto => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
});

const profileModels = {
  student: StudentProfileModel,
  mentor: MentorProfileModel,
  faculty: FacultyProfileModel,
  recruiter: RecruiterProfileModel,
} as const;

async function startSession(user: UserLike) {
  const dto = toUserDto(user);
  return {
    accessToken: signAccessToken(dto),
    refreshToken: await issueRefreshToken(dto.id),
    user: dto,
  };
}

export async function register(input: RegisterInput) {
  const emailTaken = new AppError(409, 'An account with this email already exists', 'EMAIL_TAKEN');
  if (await UserModel.exists({ email: input.email })) throw emailTaken;
  const passwordHash = await bcrypt.hash(input.password, ROUNDS);
  let user;
  try {
    user = await UserModel.create({
      name: input.name,
      email: input.email,
      role: input.role,
      passwordHash,
    });
  } catch (err) {
    // Two simultaneous sign-ups can both pass the check above; the unique index rejects the loser.
    throw isDuplicateKeyError(err) ? emailTaken : err;
  }
  try {
    // Standalone MongoDB has no transactions, so undo the user if the profile fails.
    await profileModels[input.role].create({ user: user._id });
  } catch (err) {
    await UserModel.deleteOne({ _id: user._id });
    throw err;
  }
  return startSession(user);
}

export async function login({ email, password }: LoginInput) {
  const user = await UserModel.findOne({ email }).select('+passwordHash');
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid || !user.isActive) throw unauthorized('Invalid email or password');
  return startSession(user);
}

/** Rotates the refresh token: the presented one is consumed and a new pair is issued. */
export async function refresh(rawToken: string) {
  const userId = await consumeRefreshToken(rawToken);
  const user = await UserModel.findById(userId);
  if (!user || !user.isActive) throw unauthorized('Session expired');
  return startSession(user);
}

export async function getCurrentUser(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user || !user.isActive) throw unauthorized('Account not available');
  return toUserDto(user);
}
