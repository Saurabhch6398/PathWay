import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTicketSchema, type TicketDto } from '@pathway/shared';
import { ChatPanel } from '../../components/ChatPanel';
import { Button, ErrorText } from '../../components/Feedback';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../lib/api';
import { errorMessage, formatDate } from '../../lib/format';

export function HelpPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ subject: '', description: '' });
  const [validation, setValidation] = useState('');

  const tickets = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => api<{ tickets: TicketDto[] }>('/helpdesk/tickets/me').then((r) => r.tickets),
  });
  const create = useMutation({
    mutationFn: (body: object) =>
      api('/helpdesk/tickets', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      setForm({ subject: '', description: '' });
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = createTicketSchema.safeParse(form);
    if (!parsed.success)
      return setValidation(parsed.error.issues[0]?.message ?? 'Check your input');
    setValidation('');
    create.mutate(parsed.data);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">Help centre</h1>
        <ChatPanel
          ask={async (messages, onToken) => {
            const { reply } = await api<{ reply: string }>('/helpdesk/chat', {
              method: 'POST',
              body: JSON.stringify({ messages }),
            });
            onToken(reply);
          }}
          intro="Ask how anything in PathWay works. If I can't solve it, raise a ticket."
          placeholder="How do I…?"
        />
      </section>

      <section className="space-y-4">
        <form onSubmit={onSubmit} className="space-y-3 rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Raise a ticket</h2>
          <input
            aria-label="Subject"
            placeholder="Subject"
            value={form.subject}
            maxLength={120}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            aria-label="Description"
            rows={4}
            placeholder="What went wrong?"
            value={form.description}
            maxLength={2000}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          {validation && <ErrorText message={validation} />}
          {create.error && <ErrorText message={errorMessage(create.error)} />}
          {create.isSuccess && <p className="text-sm text-green-700">Ticket submitted.</p>}
          <Button disabled={create.isPending}>
            {create.isPending ? 'Submitting…' : 'Submit ticket'}
          </Button>
        </form>

        {tickets.data && tickets.data.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">My tickets</h2>
            <ul className="divide-y rounded-xl border bg-white text-sm shadow-sm">
              {tickets.data.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span>
                    {t.subject} <span className="text-slate-500">· {formatDate(t.createdAt)}</span>
                  </span>
                  <StatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
