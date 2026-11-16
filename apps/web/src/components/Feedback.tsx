export const LoadingText = () => <p className="text-sm text-slate-500">Loading…</p>;

export const ErrorText = ({ message }: { message: string }) => (
  <p role="alert" className="text-sm text-red-600">
    {message}
  </p>
);

export const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">
    {children}
  </p>
);

export const Button = ({
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
}) => {
  const styles = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'border bg-white hover:bg-slate-100',
    danger: 'border border-red-300 text-red-700 hover:bg-red-50',
  }[variant];
  return (
    <button
      {...props}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${styles} ${className}`}
    />
  );
};
