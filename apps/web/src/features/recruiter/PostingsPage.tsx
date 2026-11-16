import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  OPPORTUNITY_KINDS,
  opportunityInputSchema,
  type RecruiterOpportunityDto,
} from '@pathway/shared';
import { Button, EmptyState, ErrorText, LoadingText } from '../../components/Feedback';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../lib/api';
import { errorMessage, formatDate } from '../../lib/format';

const KIND_LABEL = { job: 'Job', internship: 'Internship', gig: 'Micro-internship' } as const;
const EMPTY = {
  title: '',
  kind: 'internship',
  description: '',
  location: '',
  duration: '',
  compensation: '',
  skills: '',
  deadline: '',
};

export function PostingsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['recruiter-postings'],
    queryFn: () =>
      api<{ opportunities: RecruiterOpportunityDto[] }>('/recruiter/opportunities').then(
        (r) => r.opportunities,
      ),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['recruiter-postings'] });
    queryClient.invalidateQueries({ queryKey: ['recruiter-analytics'] });
  };
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'open' | 'closed' }) =>
      api(`/recruiter/opportunities/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: refresh,
  });

  if (isLoading) return <LoadingText />;
  if (error || !data) return <ErrorText message={errorMessage(error)} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Postings</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New posting'}
        </Button>
      </div>

      {showForm && (
        <PostingForm
          onCreated={() => {
            setShowForm(false);
            refresh();
          }}
        />
      )}
      {setStatus.error && <ErrorText message={errorMessage(setStatus.error)} />}
      {data.length === 0 && !showForm && <EmptyState>You haven't posted anything yet.</EmptyState>}

      <ul className="space-y-3">
        {data.map((o) => (
          <li
            key={o.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-4 shadow-sm"
          >
            <div>
              <p className="font-semibold">{o.title}</p>
              <p className="text-sm text-slate-600">
                {KIND_LABEL[o.kind]} · {o.location}
                {o.deadline ? ` · apply by ${formatDate(o.deadline)}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={o.status === 'open' ? 'confirmed' : 'withdrawn'} />
              <span className="text-xs capitalize text-slate-500">{o.status}</span>
              <Link to={o.id} className="text-sm font-medium text-indigo-700 hover:underline">
                {o.applicantCount} applicant{o.applicantCount === 1 ? '' : 's'}
              </Link>
              <Button
                variant="secondary"
                disabled={setStatus.isPending}
                onClick={() =>
                  setStatus.mutate({ id: o.id, status: o.status === 'open' ? 'closed' : 'open' })
                }
              >
                {o.status === 'open' ? 'Close' : 'Reopen'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PostingForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState(EMPTY);
  const [validation, setValidation] = useState('');
  const create = useMutation({
    mutationFn: (body: object) =>
      api('/recruiter/opportunities', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: onCreated,
  });
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = opportunityInputSchema.safeParse({
      title: form.title,
      kind: form.kind,
      description: form.description,
      location: form.location.trim() || undefined,
      duration: form.duration.trim() || undefined,
      compensation: form.compensation.trim() || undefined,
      skills: form.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      // A date picker gives a day; the deadline is the end of that day in the recruiter's timezone.
      deadline: form.deadline ? new Date(`${form.deadline}T23:59:59`).toISOString() : undefined,
    });
    if (!parsed.success)
      return setValidation(parsed.error.issues[0]?.message ?? 'Check your input');
    setValidation('');
    create.mutate(parsed.data);
  }

  const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
  const label = 'mb-1 block text-sm font-medium text-slate-700';
  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 rounded-xl border bg-white p-5 shadow-sm sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <label htmlFor="title" className={label}>
          Title
        </label>
        <input
          id="title"
          value={form.title}
          onChange={set('title')}
          maxLength={120}
          className={input}
        />
      </div>
      <div>
        <label htmlFor="kind" className={label}>
          Type
        </label>
        <select id="kind" value={form.kind} onChange={set('kind')} className={input}>
          {OPPORTUNITY_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="location" className={label}>
          Location
        </label>
        <input
          id="location"
          value={form.location}
          placeholder="Remote"
          onChange={set('location')}
          className={input}
        />
      </div>
      <div>
        <label htmlFor="duration" className={label}>
          Duration
        </label>
        <input
          id="duration"
          value={form.duration}
          placeholder="e.g. 6 months"
          onChange={set('duration')}
          className={input}
        />
      </div>
      <div>
        <label htmlFor="compensation" className={label}>
          Compensation
        </label>
        <input
          id="compensation"
          value={form.compensation}
          placeholder="e.g. ₹25,000/month"
          onChange={set('compensation')}
          className={input}
        />
      </div>
      <div>
        <label htmlFor="skills" className={label}>
          Skills (comma separated)
        </label>
        <input
          id="skills"
          value={form.skills}
          placeholder="React, Node.js"
          onChange={set('skills')}
          className={input}
        />
      </div>
      <div>
        <label htmlFor="deadline" className={label}>
          Apply by (optional)
        </label>
        <input
          id="deadline"
          type="date"
          value={form.deadline}
          onChange={set('deadline')}
          className={input}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="description" className={label}>
          Description
        </label>
        <textarea
          id="description"
          rows={5}
          value={form.description}
          onChange={set('description')}
          maxLength={4000}
          className={input}
        />
      </div>
      <div className="sm:col-span-2">
        {validation && <ErrorText message={validation} />}
        {create.error && <ErrorText message={errorMessage(create.error)} />}
        <Button className="mt-1" disabled={create.isPending}>
          {create.isPending ? 'Publishing…' : 'Publish'}
        </Button>
      </div>
    </form>
  );
}
