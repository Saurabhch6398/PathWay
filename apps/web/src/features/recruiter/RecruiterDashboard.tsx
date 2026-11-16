import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { RecruiterAnalyticsDto, RecruiterProfileDto } from '@pathway/shared';
import { ErrorText, LoadingText } from '../../components/Feedback';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { errorMessage } from '../../lib/format';

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-xl border bg-white p-4 shadow-sm">
    <p className="text-2xl font-bold">{value}</p>
    <p className="text-sm text-slate-600">{label}</p>
  </div>
);

export function RecruiterDashboard() {
  const { user } = useAuth();
  const profile = useQuery({
    queryKey: ['recruiter-profile'],
    queryFn: () => api<{ profile: RecruiterProfileDto }>('/recruiter/me').then((r) => r.profile),
  });
  const analytics = useQuery({
    queryKey: ['recruiter-analytics'],
    queryFn: () =>
      api<{ analytics: RecruiterAnalyticsDto }>('/recruiter/analytics').then((r) => r.analytics),
  });

  const a = analytics.data;
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
        <p className="text-slate-600">{profile.data?.company?.name ?? 'Recruiter dashboard'}</p>
      </div>

      {profile.data && !profile.data.company && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          Add your company before posting opportunities.{' '}
          <Link to="/recruiter/company" className="font-medium text-indigo-700 underline">
            Set up company
          </Link>
        </div>
      )}

      {analytics.isLoading && <LoadingText />}
      {analytics.error && <ErrorText message={errorMessage(analytics.error)} />}
      {a && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Open postings" value={a.opportunities.open} />
            <Stat label="Closed postings" value={a.opportunities.closed} />
            <Stat label="Total applicants" value={a.applications.total} />
            <Stat label="To review" value={a.applications.submitted} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Shortlisted" value={a.applications.shortlisted} />
            <Stat label="Accepted" value={a.applications.accepted} />
            <Stat label="Rejected" value={a.applications.rejected} />
          </div>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/recruiter/postings"
          className="rounded-xl border bg-white p-5 shadow-sm hover:border-indigo-300"
        >
          <p className="font-semibold text-indigo-700">Postings</p>
          <p className="mt-1 text-sm text-slate-600">Create opportunities and review applicants.</p>
        </Link>
        <Link
          to="/recruiter/talent"
          className="rounded-xl border bg-white p-5 shadow-sm hover:border-indigo-300"
        >
          <p className="font-semibold text-indigo-700">Talent search</p>
          <p className="mt-1 text-sm text-slate-600">
            Find students by skill, level and target role.
          </p>
        </Link>
      </div>
    </section>
  );
}
