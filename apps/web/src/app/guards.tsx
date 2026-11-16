import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@pathway/shared';
import { useAuth } from '../lib/auth';
import { homeFor } from '../lib/roles';

const Loading = () => <p className="p-6 text-sm text-slate-500">Loading…</p>;

/** Signed-in users only; optionally restricted to certain roles (admin always passes). */
export function RequireRole({ roles }: { roles?: Role[] }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && user.role !== 'admin' && !roles.includes(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />;
  }
  return <Outlet />;
}

/** Login / register pages: signed-in users are sent to their dashboard instead. */
export function GuestOnly() {
  const { user, status } = useAuth();
  if (status === 'loading') return <Loading />;
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}
