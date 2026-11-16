import { NavLink, Outlet } from 'react-router-dom';

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

/** Sub-navigation shared by every page inside a role's area. */
export function SectionLayout({ links }: { links: NavItem[] }) {
  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-1 border-b pb-3">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
