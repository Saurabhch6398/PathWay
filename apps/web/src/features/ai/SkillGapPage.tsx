import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { SkillGapDto } from '@pathway/shared';
import { Button, ErrorText } from '../../components/Feedback';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/format';

const PRIORITY_STYLE = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-slate-200 text-slate-700',
} as const;

export function SkillGapPage() {
  const [role, setRole] = useState('');
  const analyze = useMutation({
    mutationFn: () =>
      api<{ analysis: SkillGapDto }>('/ai/skill-gap', {
        method: 'POST',
        body: JSON.stringify(role.trim() ? { targetRole: role.trim() } : {}),
      }).then((r) => r.analysis),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    analyze.mutate();
  }
  const data = analyze.data;

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Skill-gap analysis</h1>
      <form
        onSubmit={onSubmit}
        className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4 shadow-sm"
      >
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="role" className="mb-1 block text-sm font-medium text-slate-700">
            Target role
          </label>
          <input
            id="role"
            value={role}
            maxLength={100}
            placeholder="Leave empty to use the role on your profile"
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <Button disabled={analyze.isPending}>
          {analyze.isPending ? 'Analysing…' : 'Analyse my skills'}
        </Button>
      </form>
      {analyze.error && <ErrorText message={errorMessage(analyze.error)} />}

      {data && (
        <div className="space-y-5 rounded-xl border bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm text-slate-500">Target role</p>
            <p className="text-lg font-semibold">{data.targetRole}</p>
            <p className="mt-2 text-slate-700">{data.summary}</p>
          </div>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Strengths</h2>
            <div className="flex flex-wrap gap-1">
              {data.strengths.map((s) => (
                <span key={s} className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-800">
                  {s}
                </span>
              ))}
            </div>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Gaps to close</h2>
            <ul className="space-y-2">
              {data.gaps.map((g) => (
                <li key={g.skill} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{g.skill}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[g.priority]}`}
                    >
                      {g.priority} priority
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{g.reason}</p>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Next steps</h2>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
              {data.nextSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}
