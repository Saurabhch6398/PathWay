import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ROLE_LABELS } from '../lib/roles';

export function RootLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <Link to="/" className="text-lg font-semibold">
          PathWay
        </Link>
        {user ? (
          <div className="flex items-center gap-4 text-sm">
            <Link to="/help" className="text-slate-600 hover:text-indigo-700">
              Help
            </Link>
            <span>
              {user.name} <span className="text-slate-500">· {ROLE_LABELS[user.role]}</span>
            </span>
            <button
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              className="rounded-lg border px-3 py-1.5 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link to="/login" className="text-sm font-medium text-indigo-600">
            Sign in
          </Link>
        )}
      </header>
      <main className="mx-auto max-w-4xl p-6">
        <Outlet />
      </main>
    </div>
  );
}
