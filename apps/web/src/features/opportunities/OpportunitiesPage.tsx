import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { OPPORTUNITY_KINDS, type OpportunityDto, type Paginated } from '@pathway/shared';
import { Button, EmptyState, ErrorText, LoadingText } from '../../components/Feedback';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/format';

const KIND_LABEL = { job: 'Job', internship: 'Internship', gig: 'Micro-internship' } as const;
const LIMIT = 6;

export function OpportunitiesPage() {
  const [filters, setFilters] = useState({ kind: '', q: '', skill: '' });
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['opportunities', filters, page],
    placeholderData: keepPreviousData,
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      for (const [k, v] of Object.entries(filters)) if (v.trim()) params.set(k, v.trim());
      return api<Paginated<OpportunityDto>>(`/opportunities?${params}`);
    },
  });

  const change = (patch: Partial<typeof filters>) => {
    setFilters({ ...filters, ...patch });
    setPage(1);
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Opportunities</h1>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Type"
          value={filters.kind}
          onChange={(e) => change({ kind: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          {OPPORTUNITY_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <input
          aria-label="Search title"
          placeholder="Search title"
          value={filters.q}
          onChange={(e) => change({ q: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          aria-label="Skill"
          placeholder="Skill, e.g. React"
          value={filters.skill}
          onChange={(e) => change({ skill: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {isLoading && <LoadingText />}
      {error && <ErrorText message={errorMessage(error)} />}
      {data && data.items.length === 0 && (
        <EmptyState>No opportunities match your filters.</EmptyState>
      )}

      <ul className="space-y-3">
        {data?.items.map((o) => (
          <li key={o.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link to={o.id} className="font-semibold text-indigo-700 hover:underline">
                  {o.title}
                </Link>
                <p className="text-sm text-slate-600">
                  {o.company ?? 'Company'} · {o.location}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium">
                {KIND_LABEL[o.kind]}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {[o.duration, o.compensation].filter(Boolean).join(' · ')}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {o.skills.map((s) => (
                <span key={s} className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                  {s}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {data && data.total > data.limit && (
        <div className="flex items-center gap-3 text-sm">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {pages}
          </span>
          <Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
