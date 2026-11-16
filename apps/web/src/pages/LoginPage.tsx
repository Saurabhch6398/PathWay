import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loginSchema } from '@pathway/shared';
import { z } from 'zod';
import { Field } from '../components/Field';
import { useAuth } from '../lib/auth';
import { homeFor } from '../lib/roles';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) return setErrors(z.flattenError(parsed.error).fieldErrors);
    setErrors({});
    setBusy(true);
    try {
      const user = await login(parsed.data);
      navigate(from ?? homeFor(user.role), { replace: true });
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
      <h1 className="text-xl font-semibold">Sign in</h1>
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
        autoComplete="current-password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        error={errors.password?.[0]}
      />
      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}
      <button
        disabled={busy}
        className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center text-sm text-slate-600">
        New here?{' '}
        <Link to="/register" className="font-medium text-indigo-600">
          Create an account
        </Link>
      </p>
    </form>
  );
}
