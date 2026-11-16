const COLORS: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800',
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  accepted: 'bg-green-100 text-green-800',
  shortlisted: 'bg-indigo-100 text-indigo-800',
  draft: 'bg-slate-100 text-slate-700',
  proposed: 'bg-amber-100 text-amber-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-slate-200 text-slate-700',
  cancelled: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-slate-200 text-slate-700',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${COLORS[status] ?? 'bg-slate-100'}`}
    >
      {status}
    </span>
  );
}
