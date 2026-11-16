import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import type { ApplicantDto, ApplicationDecision, RecruiterOpportunityDto } from '@pathway/shared';
import { Button, EmptyState, ErrorText, LoadingText } from '../../components/Feedback';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../lib/api';
import { errorMessage, formatDate } from '../../lib/format';

const ACTIONS: Record<string, { label: string; next: ApplicationDecision; variant?: 'danger' }[]> =
  {
    submitted: [
      { label: 'Shortlist', next: 'shortlisted' },
      { label: 'Reject', next: 'rejected', variant: 'danger' },
    ],
    shortlisted: [
      { label: 'Accept', next: 'accepted' },
      { label: 'Reject', next: 'rejected', variant: 'danger' },
    ],
  };

export function ApplicantsPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const applicants = useQuery({
    queryKey: ['applicants', id],
    queryFn: () =>
      api<{ applicants: ApplicantDto[] }>(`/recruiter/opportunities/${id}/applications`).then(
        (r) => r.applicants,
      ),
  });
  const postings = useQuery({
    queryKey: ['recruiter-postings'],
    queryFn: () =>
      api<{ opportunities: RecruiterOpportunityDto[] }>('/recruiter/opportunities').then(
        (r) => r.opportunities,
      ),
  });
  const decide = useMutation({
    mutationFn: ({ appId, status }: { appId: string; status: ApplicationDecision }) =>
      api(`/recruiter/applications/${appId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicants', id] });
      queryClient.invalidateQueries({ queryKey: ['recruiter-analytics'] });
    },
  });

  if (applicants.isLoading) return <LoadingText />;
  if (applicants.error || !applicants.data)
    return <ErrorText message={errorMessage(applicants.error)} />;
  const title = postings.data?.find((p) => p.id === id)?.title;

  return (
    <div className="space-y-4">
      <Link to="/recruiter/postings" className="text-sm text-indigo-600">
        ← Postings
      </Link>
      <h1 className="text-xl font-semibold">Applicants{title ? ` for ${title}` : ''}</h1>
      {decide.error && <ErrorText message={errorMessage(decide.error)} />}
      {applicants.data.length === 0 && <EmptyState>No applicants yet.</EmptyState>}

      <ul className="space-y-3">
        {applicants.data.map((a) => (
          <li key={a.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{a.student.name}</p>
                <p className="text-sm text-slate-600">
                  {a.student.email}
                  {[a.student.course, a.student.batch].filter(Boolean).length > 0 &&
                    ` · ${[a.student.course, a.student.batch].filter(Boolean).join(' ')}`}
                </p>
                {a.student.targetRole && (
                  <p className="text-sm text-slate-600">Target role: {a.student.targetRole}</p>
                )}
                <p className="text-xs text-slate-500">Applied {formatDate(a.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={a.status} />
                {ACTIONS[a.status]?.map((act) => (
                  <Button
                    key={act.next}
                    variant={act.variant ?? 'secondary'}
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ appId: a.id, status: act.next })}
                  >
                    {act.label}
                  </Button>
                ))}
              </div>
            </div>
            {a.message && (
              <p className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm">
                {a.message}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-1">
              {a.student.skills.map((s) => (
                <span
                  key={s.name}
                  className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
                >
                  {s.name} {s.proficiency}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
