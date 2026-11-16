import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { bookSessionSchema, type MentorDto } from '@pathway/shared';
import { Button, EmptyState, ErrorText, LoadingText } from '../../components/Feedback';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/format';

export function MentorsPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['mentors'],
    queryFn: () => api<{ mentors: MentorDto[] }>('/mentors').then((r) => r.mentors),
  });

  if (isLoading) return <LoadingText />;
  if (error || !data) return <ErrorText message={errorMessage(error)} />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Mentors</h1>
      {data.length === 0 && <EmptyState>No mentors are available right now.</EmptyState>}
      <ul className="space-y-3">
        {data.map((m) => (
          <li key={m.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">{m.name}</p>
                <p className="text-sm text-slate-600">
                  {[m.title, m.company].filter(Boolean).join(' at ')}
                  {m.experienceYears ? ` · ${m.experienceYears} yrs` : ''}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.expertise.map((e) => (
                    <span
                      key={e}
                      className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>
              <Button variant="secondary" onClick={() => setOpenId(openId === m.id ? null : m.id)}>
                {openId === m.id ? 'Close' : 'Book a session'}
              </Button>
            </div>
            {openId === m.id && <BookingForm mentorId={m.id} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BookingForm({ mentorId }: { mentorId: string }) {
  const queryClient = useQueryClient();
  const [when, setWhen] = useState('');
  const [topic, setTopic] = useState('');
  const [validation, setValidation] = useState('');

  const book = useMutation({
    mutationFn: (body: object) =>
      api(`/mentors/${mentorId}/sessions`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // <input type="datetime-local"> gives local time without zone; convert to a UTC ISO string.
    const startsAt = when ? new Date(when).toISOString() : '';
    const parsed = bookSessionSchema.safeParse({ startsAt, topic });
    if (!parsed.success)
      return setValidation(parsed.error.issues[0]?.message ?? 'Check your input');
    setValidation('');
    book.mutate(parsed.data);
  }

  if (book.isSuccess) {
    return (
      <p className="mt-3 text-sm text-green-700">
        Request sent. The mentor will confirm it. See{' '}
        <Link to="/student/sessions" className="font-medium underline">
          My sessions
        </Link>
        .
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
      <div>
        <label
          htmlFor={`when-${mentorId}`}
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Date and time
        </label>
        <input
          id={`when-${mentorId}`}
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label
          htmlFor={`topic-${mentorId}`}
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Topic
        </label>
        <input
          id={`topic-${mentorId}`}
          value={topic}
          maxLength={200}
          placeholder="What do you want to discuss?"
          onChange={(e) => setTopic(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        {validation && <ErrorText message={validation} />}
        {book.error && <ErrorText message={errorMessage(book.error)} />}
        <Button className="mt-1" disabled={book.isPending}>
          {book.isPending ? 'Sending…' : 'Request session'}
        </Button>
      </div>
    </form>
  );
}
