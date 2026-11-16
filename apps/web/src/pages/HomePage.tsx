import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import type { HealthResponse } from '@pathway/shared';
import { ApiError, api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { homeFor } from '../lib/roles';

// The health endpoint answers 503 with a valid body while the DB is down; show that state too.
const fetchHealth = () =>
  api<HealthResponse>('/health').catch((err) => {
    if (err instanceof ApiError && err.status === 503) return err.data as HealthResponse;
    throw err;
  });

export function HomePage() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({ queryKey: ['health'], queryFn: fetchHealth });

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const label = isLoading
    ? 'checking…'
    : isError || !data
      ? 'unreachable'
      : `${data.status} (db ${data.database})`;

  return (
    <section className="rounded-xl border bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-bold">PathWay</h1>
      <p className="mt-2 text-slate-600">
        Industry Career OS: connecting students, mentors, faculty and recruiters.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          to="/register"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Create account
        </Link>
        <Link
          to="/login"
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-100"
        >
          Sign in
        </Link>
      </div>
      <p className="mt-6 text-xs text-slate-500">
        API status: <strong>{label}</strong>
      </p>
    </section>
  );
}
