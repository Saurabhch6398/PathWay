import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  COLLABORATION_LABELS,
  COLLABORATION_STATUSES,
  COLLABORATION_TYPES,
  collaborationInputSchema,
  type CollaborationDto,
  type CollaborationStatus,
} from '@pathway/shared';
import { Button, EmptyState, ErrorText, LoadingText } from '../../components/Feedback';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../lib/api';
import { errorMessage, formatDate } from '../../lib/format';

/** Mirrors the API's allowed status changes. */
const NEXT: Record<
  CollaborationStatus,
  { label: string; to: CollaborationStatus; danger?: boolean }[]
> = {
  draft: [
    { label: 'Mark as proposed', to: 'proposed' },
    { label: 'Cancel', to: 'cancelled', danger: true },
  ],
  proposed: [
    { label: 'Mark as active', to: 'active' },
    { label: 'Cancel', to: 'cancelled', danger: true },
  ],
  active: [
    { label: 'Mark as completed', to: 'completed' },
    { label: 'Cancel', to: 'cancelled', danger: true },
  ],
  completed: [],
  cancelled: [],
};
const EMPTY = { type: 'mou', title: '', partner: '', description: '', startDate: '', endDate: '' };
const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
const label = 'mb-1 block text-sm font-medium text-slate-700';

export function CollaborationsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ type: '', status: '' });
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['collaborations', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
      return api<{ collaborations: CollaborationDto[] }>(`/faculty/collaborations?${params}`).then(
        (r) => r.collaborations,
      );
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['collaborations'] });
  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CollaborationStatus }) =>
      api(`/faculty/collaborations/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: refresh,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Industry collaborations</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New collaboration'}
        </Button>
      </div>
      {showForm && (
        <CollaborationForm
          onCreated={() => {
            setShowForm(false);
            refresh();
          }}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Type"
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          {COLLABORATION_TYPES.map((t) => (
            <option key={t} value={t}>
              {COLLABORATION_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm capitalize"
        >
          <option value="">All statuses</option>
          {COLLABORATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <LoadingText />}
      {error && <ErrorText message={errorMessage(error)} />}
      {move.error && <ErrorText message={errorMessage(move.error)} />}
      {data && data.length === 0 && <EmptyState>No collaborations found.</EmptyState>}

      <ul className="space-y-3">
        {data?.map((c) => (
          <li key={c.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{c.title}</p>
                <p className="text-sm text-slate-600">
                  {COLLABORATION_LABELS[c.type]} · {c.partner}
                </p>
                {(c.startDate || c.endDate) && (
                  <p className="text-xs text-slate-500">
                    {c.startDate ? formatDate(c.startDate) : '…'} –{' '}
                    {c.endDate ? formatDate(c.endDate) : '…'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={c.status} />
                {NEXT[c.status].map((n) => (
                  <Button
                    key={n.to}
                    variant={n.danger ? 'danger' : 'secondary'}
                    disabled={move.isPending}
                    onClick={() => move.mutate({ id: c.id, status: n.to })}
                  >
                    {n.label}
                  </Button>
                ))}
              </div>
            </div>
            {c.description && (
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{c.description}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CollaborationForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState(EMPTY);
  const [validation, setValidation] = useState('');
  const create = useMutation({
    mutationFn: (body: object) =>
      api('/faculty/collaborations', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: onCreated,
  });
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = collaborationInputSchema.safeParse({
      type: form.type,
      title: form.title,
      partner: form.partner,
      description: form.description || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
    });
    if (!parsed.success)
      return setValidation(parsed.error.issues[0]?.message ?? 'Check your input');
    setValidation('');
    create.mutate(parsed.data);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 rounded-xl border bg-white p-5 shadow-sm sm:grid-cols-2"
    >
      <div>
        <label htmlFor="type" className={label}>
          Type
        </label>
        <select id="type" value={form.type} onChange={set('type')} className={field}>
          {COLLABORATION_TYPES.map((t) => (
            <option key={t} value={t}>
              {COLLABORATION_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="partner" className={label}>
          Partner organisation
        </label>
        <input
          id="partner"
          value={form.partner}
          onChange={set('partner')}
          maxLength={150}
          className={field}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="title" className={label}>
          Title
        </label>
        <input
          id="title"
          value={form.title}
          onChange={set('title')}
          maxLength={150}
          className={field}
        />
      </div>
      <div>
        <label htmlFor="startDate" className={label}>
          Start date
        </label>
        <input
          id="startDate"
          type="date"
          value={form.startDate}
          onChange={set('startDate')}
          className={field}
        />
      </div>
      <div>
        <label htmlFor="endDate" className={label}>
          End date
        </label>
        <input
          id="endDate"
          type="date"
          value={form.endDate}
          onChange={set('endDate')}
          className={field}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="description" className={label}>
          Description (optional)
        </label>
        <textarea
          id="description"
          rows={3}
          value={form.description}
          onChange={set('description')}
          maxLength={3000}
          className={field}
        />
      </div>
      <div className="sm:col-span-2">
        {validation && <ErrorText message={validation} />}
        {create.error && <ErrorText message={errorMessage(create.error)} />}
        <Button className="mt-1" disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Save as draft'}
        </Button>
      </div>
    </form>
  );
}
