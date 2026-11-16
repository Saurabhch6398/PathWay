import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Paginated, TalentDto } from '@pathway/shared';
import { Button, EmptyState, ErrorText, LoadingText } from '../../components/Feedback';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/format';

const LIMIT = 8;

export function TalentPage() {
  const [filters, setFilters] = useState({ skill: '', role: '', minProficiency: '' });
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['talent', filters, page],
    placeholderData: keepPreviousData,
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      for (const [k, v] of Object.entries(filters)) if (v.trim()) params.set(k, v.trim());
      return api<Paginated<TalentDto>>(`/recruiter/students?${params}`);
    },
  });
  const change = (patch: Partial<typeof filters>) => {
    setFilters({ ...filters, ...patch });
    setPage(1);
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const input = 'rounded-lg border border-slate-300 px-3 py-2 text-sm';

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Talent search</h1>
      <p className="text-sm text-slate-500">
        Only students who allow recruiters to find them are listed. Contact details are shared when
        a student applies to your posting.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Skill"
          placeholder="Skill, e.g. React"
          value={filters.skill}
          onChange={(e) => change({ skill: e.target.value })}
          className={input}
        />
        <input
          aria-label="Minimum proficiency"
          type="number"
          min={0}
          max={100}
          placeholder="Min level (0–100)"
          value={filters.minProficiency}
          onChange={(e) => change({ minProficiency: e.target.value })}
          className={`${input} w-44`}
        />
        <input
          aria-label="Target role"
          placeholder="Target role"
          value={filters.role}
          onChange={(e) => change({ role: e.target.value })}
          className={input}
        />
      </div>

      {isLoading && <LoadingText />}
      {error && <ErrorText message={errorMessage(error)} />}
      {data && data.items.length === 0 && <EmptyState>No students match these filters.</EmptyState>}

      <ul className="grid gap-3 sm:grid-cols-2">
        {data?.items.map((t) => (
          <li key={t.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="font-semibold">{t.name}</p>
            <p className="text-sm text-slate-600">
              {[t.course, t.batch].filter(Boolean).join(' · ') || 'Student'}
            </p>
            {t.targetRole && <p className="text-sm text-slate-600">Wants to be: {t.targetRole}</p>}
            <div className="mt-2 flex flex-wrap gap-1">
              {t.skills.map((s) => (
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
