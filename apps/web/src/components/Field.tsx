import type { InputHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Field({ label, error, id, ...props }: FieldProps) {
  const fieldId = id ?? props.name;
  return (
    <div>
      <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={fieldId}
        {...props}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
