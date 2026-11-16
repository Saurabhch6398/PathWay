import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { CollaborationDto } from '@pathway/shared';
import { ErrorText, LoadingText } from '../../components/Feedback';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { errorMessage } from '../../lib/format';

export function FacultyDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['collaborations', { type: '', status: '' }],
    queryFn: () =>
      api<{ collaborations: CollaborationDto[] }>('/faculty/collaborations').then(
        (r) => r.collaborations,
      ),
  });
  const count = (status: string) => data?.filter((c) => c.status === status).length ?? 0;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
        <p className="text-slate-600">Faculty dashboard</p>
      </div>
      {isLoading && <LoadingText />}
      {error && <ErrorText message={errorMessage(error)} />}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(['draft', 'proposed', 'active', 'completed'] as const).map((s) => (
            <Link
              key={s}
              to="/faculty/collaborations"
              className="rounded-xl border bg-white p-4 shadow-sm hover:border-indigo-300"
            >
              <p className="text-2xl font-bold">{count(s)}</p>
              <p className="text-sm capitalize text-slate-600">{s} collaborations</p>
            </Link>
          ))}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/faculty/insights"
          className="rounded-xl border bg-white p-5 shadow-sm hover:border-indigo-300"
        >
          <p className="font-semibold text-indigo-700">Cohort insights</p>
          <p className="mt-1 text-sm text-slate-600">
            Skills, target roles and application outcomes of your students.
          </p>
        </Link>
        <Link
          to="/faculty/advisor"
          className="rounded-xl border bg-white p-5 shadow-sm hover:border-indigo-300"
        >
          <p className="font-semibold text-indigo-700">AI academic advisor</p>
          <p className="mt-1 text-sm text-slate-600">
            Ask about collaboration, curriculum and placements.
          </p>
        </Link>
      </div>
    </section>
  );
}
