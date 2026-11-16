import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ROLE_LABELS } from '../lib/roles';

interface QuickLink {
  to: string;
  title: string;
  text: string;
}

// Recruiter, mentor and faculty have their own dashboards in features/*.
const QUICK_LINKS: Record<string, QuickLink[]> = {
  student: [
    {
      to: '/student/profile',
      title: 'My profile',
      text: 'Keep your course, target role and skills up to date.',
    },
    {
      to: '/student/opportunities',
      title: 'Opportunities',
      text: 'Jobs, internships and micro-internship gigs.',
    },
    {
      to: '/student/applications',
      title: 'My applications',
      text: 'Track and withdraw your applications.',
    },
    { to: '/student/mentors', title: 'Mentors', text: 'Book a session with an industry mentor.' },
    {
      to: '/student/sessions',
      title: 'My sessions',
      text: 'Your upcoming and past mentoring sessions.',
    },
    {
      to: '/student/quizzes',
      title: 'AI quizzes',
      text: 'Test yourself on any topic and grow your skill scores.',
    },
    {
      to: '/student/skill-gap',
      title: 'Skill-gap analysis',
      text: 'See what to learn next for your target role.',
    },
    {
      to: '/student/advisor',
      title: 'AI career advisor',
      text: 'Chat about careers, learning plans and interviews.',
    },
  ],
  admin: [
    { to: '/admin/tickets', title: 'Support tickets', text: 'Review and resolve user tickets.' },
  ],
};

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  const links = QUICK_LINKS[user.role] ?? [];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
        <p className="text-slate-600">{ROLE_LABELS[user.role]} dashboard</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="rounded-xl border bg-white p-5 shadow-sm hover:border-indigo-300"
          >
            <p className="font-semibold text-indigo-700">{l.title}</p>
            <p className="mt-1 text-sm text-slate-600">{l.text}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
