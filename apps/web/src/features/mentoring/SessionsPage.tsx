import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SessionDto, SessionStatusInput } from '@pathway/shared';
import { Button, EmptyState, ErrorText, LoadingText } from '../../components/Feedback';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { errorMessage, formatDateTime } from '../../lib/format';

type Next = SessionStatusInput['status'];

/** Actions each side can take on a session in its current status (mirrors the API rules). */
function actionsFor(
  role: 'student' | 'mentor',
  status: SessionDto['status'],
): { label: string; next: Next; variant?: 'danger' }[] {
  if (status === 'pending') {
    return role === 'mentor'
      ? [
          { label: 'Confirm', next: 'confirmed' },
          { label: 'Decline', next: 'cancelled', variant: 'danger' },
        ]
      : [{ label: 'Cancel', next: 'cancelled', variant: 'danger' }];
  }
  if (status === 'confirmed') {
    return role === 'mentor'
      ? [
          { label: 'Mark completed', next: 'completed' },
          { label: 'Cancel', next: 'cancelled', variant: 'danger' },
        ]
      : [{ label: 'Cancel', next: 'cancelled', variant: 'danger' }];
  }
  return [];
}

export function SessionsPage() {
  const { user } = useAuth();
  const role = user?.role === 'mentor' ? 'mentor' : 'student';
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api<{ sessions: SessionDto[] }>('/sessions/me').then((r) => r.sessions),
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Next }) =>
      api(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });

  if (isLoading) return <LoadingText />;
  if (error || !data) return <ErrorText message={errorMessage(error)} />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My sessions</h1>
      {update.error && <ErrorText message={errorMessage(update.error)} />}
      {data.length === 0 && (
        <EmptyState>
          {role === 'student'
            ? 'No sessions yet. Book one from the Mentors tab.'
            : 'No session requests yet.'}
        </EmptyState>
      )}
      <ul className="space-y-3">
        {data.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-4 shadow-sm"
          >
            <div>
              <p className="font-medium">{s.topic}</p>
              <p className="text-sm text-slate-600">
                {formatDateTime(s.startsAt)} · {s.durationMinutes} min · with{' '}
                {role === 'student' ? s.mentor.name : s.student.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={s.status} />
              {actionsFor(role, s.status).map((a) => (
                <Button
                  key={a.next}
                  variant={a.variant ?? 'secondary'}
                  disabled={update.isPending}
                  onClick={() => update.mutate({ id: s.id, status: a.next })}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
