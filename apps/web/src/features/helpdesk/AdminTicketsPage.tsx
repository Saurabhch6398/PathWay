import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TICKET_STATUSES, type TicketDto, type TicketStatus } from '@pathway/shared';
import { EmptyState, ErrorText, LoadingText } from '../../components/Feedback';
import { api } from '../../lib/api';
import { errorMessage, formatDate } from '../../lib/format';

export function AdminTicketsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['all-tickets'],
    queryFn: () => api<{ tickets: TicketDto[] }>('/helpdesk/tickets').then((r) => r.tickets),
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatus }) =>
      api(`/helpdesk/tickets/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['all-tickets'] }),
  });

  if (isLoading) return <LoadingText />;
  if (error || !data) return <ErrorText message={errorMessage(error)} />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Support tickets</h1>
      {update.error && <ErrorText message={errorMessage(update.error)} />}
      {data.length === 0 && <EmptyState>No tickets yet.</EmptyState>}
      <ul className="space-y-3">
        {data.map((t) => (
          <li key={t.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{t.subject}</p>
                <p className="text-xs text-slate-500">
                  {t.user?.name} ({t.user?.email}) · {formatDate(t.createdAt)}
                </p>
              </div>
              <select
                aria-label={`Status of ${t.subject}`}
                value={t.status}
                onChange={(e) =>
                  update.mutate({ id: t.id, status: e.target.value as TicketStatus })
                }
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
              >
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{t.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
