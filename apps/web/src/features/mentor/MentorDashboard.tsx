import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { MentorSummaryDto } from '@pathway/shared';
import { ErrorText, LoadingText } from '../../components/Feedback';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { errorMessage } from '../../lib/format';

const Stat = ({ label, value, to }: { label: string; value: number; to: string }) => (
  <Link to={to} className="rounded-xl border bg-white p-4 shadow-sm hover:border-indigo-300">
    <p className="text-2xl font-bold">{value}</p>
    <p className="text-sm text-slate-600">{label}</p>
  </Link>
);

export function MentorDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['mentor-summary'],
    queryFn: () => api<{ summary: MentorSummaryDto }>('/mentors/me/summary').then((r) => r.summary),
  });

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
        <p className="text-slate-600">Mentor dashboard</p>
      </div>
      {isLoading && <LoadingText />}
      {error && <ErrorText message={errorMessage(error)} />}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Requests to review" value={data.pendingRequests} to="/mentor/sessions" />
          <Stat label="Upcoming sessions" value={data.upcomingConfirmed} to="/mentor/sessions" />
          <Stat label="Completed sessions" value={data.completedSessions} to="/mentor/sessions" />
          <Stat label="Mentees" value={data.mentees} to="/mentor/mentees" />
        </div>
      )}
      <p className="text-sm text-slate-500">
        Students can only book you while “Available for new sessions” is on in your{' '}
        <Link to="/mentor/profile" className="text-indigo-700 underline">
          profile
        </Link>
        .
      </p>
    </section>
  );
}
