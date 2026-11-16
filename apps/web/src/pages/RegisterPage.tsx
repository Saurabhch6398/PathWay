import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { REGISTERABLE_ROLES, registerSchema } from '@pathway/shared';
import { z } from 'zod';
import { Field } from '../components/Field';
import { useAuth } from '../lib/auth';
import { ROLE_LABELS, homeFor } from '../lib/roles';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) return setErrors(z.flattenError(parsed.error).fieldErrors);
    setErrors({});
    setBusy(true);
    try {
      const user = await register(parsed.data);
      navigate(homeFor(user.role), { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-sm space-y-4 rounded-xl border bg-white p-6 shadow-sm"
    >
      <h1 className="text-xl font-semibold">Create your account</h1>
      <Field
        label="Full name"
        name="name"
        autoComplete="name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        error={errors.name?.[0]}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        error={errors.email?.[0]}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        error={errors.password?.[0]}
      />
      <div>
        <label htmlFor="role" className="mb-1 block text-sm font-medium text-slate-700">
          I am a
        </label>
        <select
          id="role"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {REGISTERABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>
      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}
      <button
        disabled={busy}
        className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {busy ? 'Creating…' : 'Create account'}
      </button>
      <p className="text-center text-sm text-slate-600">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-indigo-600">
          Sign in
        </Link>
      </p>
    </form>
  );
}
