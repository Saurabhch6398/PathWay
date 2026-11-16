import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import type { OpportunityDto } from '@pathway/shared';
import { Button, ErrorText, LoadingText } from '../../components/Feedback';
import { api } from '../../lib/api';
import { errorMessage, formatDate } from '../../lib/format';

export function OpportunityDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['opportunity', id],
    queryFn: () =>
      api<{ opportunity: OpportunityDto }>(`/opportunities/${id}`).then((r) => r.opportunity),
  });

  const apply = useMutation({
    mutationFn: () =>
      api(`/opportunities/${id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ message: message.trim() || undefined }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
  });

  if (isLoading) return <LoadingText />;
  if (error || !data) return <ErrorText message={errorMessage(error)} />;

  return (
    <article className="max-w-2xl space-y-4 rounded-xl border bg-white p-6 shadow-sm">
      <Link to="/student/opportunities" className="text-sm text-indigo-600">
        ← All opportunities
      </Link>
      <h1 className="text-2xl font-bold">{data.title}</h1>
      <p className="text-slate-600">
        {data.company ?? 'Company'} · {data.location}
      </p>
      <p className="text-sm text-slate-500">
        {[
          data.duration,
          data.compensation,
          data.deadline && `Apply by ${formatDate(data.deadline)}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <p className="whitespace-pre-line text-slate-800">{data.description}</p>
      <div className="flex flex-wrap gap-1">
        {data.skills.map((s) => (
          <span key={s} className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
            {s}
          </span>
        ))}
      </div>

      <div className="border-t pt-4">
        {apply.isSuccess ? (
          <p className="text-sm text-green-700">
            Application sent. Track it under{' '}
            <Link to="/student/applications" className="font-medium underline">
              My applications
            </Link>
            .
          </p>
        ) : (
          <>
            <label htmlFor="msg" className="mb-1 block text-sm font-medium text-slate-700">
              Message (optional)
            </label>
            <textarea
              id="msg"
              rows={3}
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {apply.error && <ErrorText message={errorMessage(apply.error)} />}
            <Button
              className="mt-2"
              disabled={apply.isPending || data.status !== 'open'}
              onClick={() => apply.mutate()}
            >
              {data.status !== 'open' ? 'Closed' : apply.isPending ? 'Applying…' : 'Apply'}
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
