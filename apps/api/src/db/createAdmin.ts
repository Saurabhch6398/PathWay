import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { loginSchema, passwordSchema } from '@pathway/shared';
import { z } from 'zod';
import { UserModel } from '../models';

const adminInput = z.object({
  name: z.string().trim().min(2).max(100),
  email: loginSchema.shape.email,
  // Stricter than for ordinary users: an admin can read every support ticket.
  password: passwordSchema.min(12, 'Admin passwords need at least 12 characters'),
});

export class AdminError extends Error {}

/** Creates an admin, or with `promote` turns an existing account into one. Exported for tests. */
export async function createAdminUser(
  raw: { name: string; email: string; password: string },
  promote = false,
) {
  const parsed = adminInput.safeParse(raw);
  if (!parsed.success)
    throw new AdminError(
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  const { name, email, password } = parsed.data;

  const existing = await UserModel.findOne({ email });
  if (existing) {
    if (existing.role === 'admin') throw new AdminError(`${email} is already an admin`);
    if (!promote)
      throw new AdminError(
        `${email} already exists as a ${existing.role}. Re-run with --promote to make them an admin.`,
      );
    existing.role = 'admin';
    await existing.save();
    return { email, created: false };
  }
  await UserModel.create({
    name,
    email,
    role: 'admin',
    passwordHash: await bcrypt.hash(password, 12),
  });
  return { email, created: true };
}

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Reads a password without echoing it to the terminal. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
    process.stdout.write(question);
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => undefined;
    rl.question('', (answer) => {
      (rl as unknown as { _writeToOutput: typeof write })._writeToOutput = write;
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const email = arg('email');
  const name = arg('name');
  if (!email || !name) {
    console.error('Usage: create-admin --email you@example.com --name "Your Name" [--promote]');
    console.error(
      'The password is read from the ADMIN_PASSWORD environment variable, or asked for interactively.',
    );
    process.exit(1);
  }
  const password =
    process.env.ADMIN_PASSWORD ?? (await promptHidden('Password (min 12 characters): '));

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  try {
    const result = await createAdminUser(
      { name, email, password },
      process.argv.includes('--promote'),
    );
    console.log(
      result.created ? `Created admin ${result.email}` : `Promoted ${result.email} to admin`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

// Only run when executed directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof AdminError ? err.message : err);
    process.exit(1);
  });
}
