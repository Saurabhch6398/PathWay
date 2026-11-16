import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ApplicationDto } from '@pathway/shared';
import { Button, EmptyState, ErrorText, LoadingText } from '../../components/Feedback';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../lib/api';
import { errorMessage, formatDate } from '../../lib/format';

export function ApplicationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['applications'],
    queryFn: () =>
      api<{ applications: ApplicationDto[] }>('/applications/me').then((r) => r.applications),
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => api(`/applications/${id}/withdraw`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
  });

  if (isLoading) return <LoadingText />;
  if (error || !data) return <ErrorText message={errorMessage(error)} />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My applications</h1>
      {withdraw.error && <ErrorText message={errorMessage(withdraw.error)} />}
      {data.length === 0 && (
        <EmptyState>
          You haven't applied yet.{' '}
          <Link to="/student/opportunities" className="font-medium text-indigo-600">
            Browse opportunities
          </Link>
        </EmptyState>
      )}
      <ul className="space-y-3">
        {data.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-4 rounded-xl border bg-white p-4 shadow-sm"
          >
            <div>
              <p className="font-medium">{a.opportunity?.title ?? 'Removed opportunity'}</p>
              <p className="text-sm text-slate-600">
                {a.opportunity?.company ?? ''} · Applied {formatDate(a.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={a.status} />
              {a.status === 'submitted' && (
                <Button
                  variant="secondary"
                  disabled={withdraw.isPending}
                  onClick={() => withdraw.mutate(a.id)}
                >
                  Withdraw
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
