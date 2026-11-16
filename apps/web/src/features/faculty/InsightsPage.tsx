import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { InsightsDto } from '@pathway/shared';
import { ErrorText, LoadingText } from '../../components/Feedback';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/format';

const input = 'rounded-lg border border-slate-300 px-3 py-2 text-sm';

function Bars({ rows }: { rows: { label: string; value: number; note?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex justify-between">
            <span>{r.label}</span>
            <span className="text-slate-500">
              {r.value} student{r.value === 1 ? '' : 's'}
              {r.note ? ` · ${r.note}` : ''}
            </span>
          </div>
          <div className="mt-1 h-2 rounded bg-slate-100">
            <div
              className="h-2 rounded bg-indigo-500"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function InsightsPage() {
  const [filters, setFilters] = useState({ course: '', batch: '' });
  const { data, isLoading, error } = useQuery({
    queryKey: ['insights', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) if (v.trim()) params.set(k, v.trim());
      return api<{ insights: InsightsDto }>(`/faculty/insights?${params}`).then((r) => r.insights);
    },
  });

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Cohort insights</h1>
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Course"
          placeholder="Course, e.g. CSIT"
          value={filters.course}
          onChange={(e) => setFilters({ ...filters, course: e.target.value })}
          className={input}
        />
        <input
          aria-label="Batch"
          placeholder="Batch, e.g. 2025-29"
          value={filters.batch}
          onChange={(e) => setFilters({ ...filters, batch: e.target.value })}
          className={input}
        />
      </div>

      {isLoading && <LoadingText />}
      {error && <ErrorText message={errorMessage(error)} />}
      {data && (
        <>
          <p className="text-sm text-slate-600">
            <strong>{data.students}</strong> student{data.students === 1 ? '' : 's'} in this cohort
          </p>
          {data.restricted ? (
            <p className="rounded-xl border border-dashed bg-white p-6 text-sm text-slate-500">
              Details are hidden for cohorts under {data.minGroupSize} students so that no
              individual can be identified. Widen the filters to see more.
            </p>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {(
                  [
                    ['Applications', data.applications.total],
                    ['Shortlisted', data.applications.shortlisted],
                    ['Accepted', data.applications.accepted],
                    ['Rejected', data.applications.rejected],
                  ] as const
                ).map(([l, v]) => (
                  <div key={l} className="rounded-xl border bg-white p-4 shadow-sm">
                    <p className="text-2xl font-bold">{v}</p>
                    <p className="text-sm text-slate-600">{l}</p>
                  </div>
                ))}
              </div>
              <section className="rounded-xl border bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Most common skills</h2>
                {data.topSkills.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No skill is shared by enough students yet.
                  </p>
                ) : (
                  <Bars
                    rows={data.topSkills.map((s) => ({
                      label: s.name,
                      value: s.students,
                      note: `avg level ${s.averageProficiency}`,
                    }))}
                  />
                )}
              </section>
              <section className="rounded-xl border bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Target roles</h2>
                {data.targetRoles.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No role is shared by enough students yet.
                  </p>
                ) : (
                  <Bars
                    rows={data.targetRoles.map((r) => ({ label: r.role, value: r.students }))}
                  />
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
