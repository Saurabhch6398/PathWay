import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MENTEE_STAGES, type MenteeDto, type MenteeStage } from '@pathway/shared';
import { Button, EmptyState, ErrorText, LoadingText } from '../../components/Feedback';
import { api } from '../../lib/api';
import { errorMessage, formatDate } from '../../lib/format';

const STAGE_LABEL: Record<MenteeStage, string> = {
  new: 'New',
  active: 'Active',
  paused: 'Paused',
  graduated: 'Graduated',
};

export function MenteesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['mentees'],
    queryFn: () => api<{ mentees: MenteeDto[] }>('/mentors/me/mentees').then((r) => r.mentees),
  });
  if (isLoading) return <LoadingText />;
  if (error || !data) return <ErrorText message={errorMessage(error)} />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Mentees</h1>
      <p className="text-sm text-slate-500">
        Students who have booked a session with you. Notes are private to you.
      </p>
      {data.length === 0 && (
        <EmptyState>No mentees yet. They appear once a student books a session.</EmptyState>
      )}
      <div className="grid gap-4 lg:grid-cols-4">
        {MENTEE_STAGES.map((stage) => {
          const column = data.filter((m) => m.stage === stage);
          return (
            <section key={stage} className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">
                {STAGE_LABEL[stage]} ({column.length})
              </h2>
              {column.map((m) => (
                <MenteeCard key={m.student.id} mentee={m} />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function MenteeCard({ mentee }: { mentee: MenteeDto }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(mentee.notes);
  const update = useMutation({
    mutationFn: (body: { stage?: MenteeStage; notes?: string }) =>
      api(`/mentors/me/mentees/${mentee.student.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mentees'] }),
  });
  const s = mentee.student;

  return (
    <article className="space-y-2 rounded-xl border bg-white p-3 text-sm shadow-sm">
      <div>
        <p className="font-semibold">{s.name}</p>
        <p className="text-xs text-slate-600">{[s.course, s.batch].filter(Boolean).join(' · ')}</p>
        {s.targetRole && <p className="text-xs text-slate-600">Wants to be: {s.targetRole}</p>}
      </div>
      <div className="flex flex-wrap gap-1">
        {s.skills.map((k) => (
          <span key={k.name} className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700">
            {k.name} {k.proficiency}
          </span>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        {mentee.sessions.total} session{mentee.sessions.total === 1 ? '' : 's'} ·{' '}
        {mentee.sessions.completed} done · {mentee.sessions.upcoming} upcoming
        {mentee.lastSessionAt ? ` · last ${formatDate(mentee.lastSessionAt)}` : ''}
      </p>
      <select
        aria-label={`Stage for ${s.name}`}
        value={mentee.stage}
        disabled={update.isPending}
        onChange={(e) => update.mutate({ stage: e.target.value as MenteeStage })}
        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
      >
        {MENTEE_STAGES.map((st) => (
          <option key={st} value={st}>
            {STAGE_LABEL[st]}
          </option>
        ))}
      </select>
      <textarea
        aria-label={`Private notes for ${s.name}`}
        rows={3}
        maxLength={2000}
        placeholder="Private notes…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
      />
      {update.error && <ErrorText message={errorMessage(update.error)} />}
      {notes !== mentee.notes && (
        <Button
          variant="secondary"
          disabled={update.isPending}
          onClick={() => update.mutate({ notes })}
        >
          Save notes
        </Button>
      )}
    </article>
  );
}
