import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import type { Role } from '@pathway/shared';
import { AdvisorPage } from '../features/ai/AdvisorPage';
import { QuizPage } from '../features/ai/QuizPage';
import { SkillGapPage } from '../features/ai/SkillGapPage';
import { AdminTicketsPage } from '../features/helpdesk/AdminTicketsPage';
import { HelpPage } from '../features/helpdesk/HelpPage';
import { ApplicationsPage } from '../features/opportunities/ApplicationsPage';
import { OpportunitiesPage } from '../features/opportunities/OpportunitiesPage';
import { OpportunityDetailPage } from '../features/opportunities/OpportunityDetailPage';
import { MentorsPage } from '../features/mentoring/MentorsPage';
import { SessionsPage } from '../features/mentoring/SessionsPage';
import { CollaborationsPage } from '../features/faculty/CollaborationsPage';
import { FacultyDashboard } from '../features/faculty/FacultyDashboard';
import { FacultyProfilePage } from '../features/faculty/FacultyProfilePage';
import { InsightsPage } from '../features/faculty/InsightsPage';
import { MentorDashboard } from '../features/mentor/MentorDashboard';
import { MentorProfilePage } from '../features/mentor/MentorProfilePage';
import { MenteesPage } from '../features/mentor/MenteesPage';
import { ApplicantsPage } from '../features/recruiter/ApplicantsPage';
import { CompanyPage } from '../features/recruiter/CompanyPage';
import { PostingsPage } from '../features/recruiter/PostingsPage';
import { RecruiterDashboard } from '../features/recruiter/RecruiterDashboard';
import { TalentPage } from '../features/recruiter/TalentPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { DashboardPage } from '../pages/DashboardPage';
import { HomePage } from '../pages/HomePage';
import { ErrorPage, NotFoundPage } from '../pages/NotFoundPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { GuestOnly, RequireRole } from './guards';
import { RootLayout } from './RootLayout';
import { SectionLayout, type NavItem } from './SectionLayout';

/** One guarded area per role: guard -> shared sub-navigation -> pages. */
const area = (
  role: Role,
  links: NavItem[],
  pages: RouteObject[],
  home: React.ReactNode = <DashboardPage />,
): RouteObject => ({
  path: role,
  element: <RequireRole roles={[role]} />,
  children: [
    {
      element: <SectionLayout links={links} />,
      children: [{ index: true, element: home }, ...pages],
    },
  ],
});

const studentLinks: NavItem[] = [
  { to: '/student', label: 'Dashboard', end: true },
  { to: '/student/profile', label: 'Profile' },
  { to: '/student/opportunities', label: 'Opportunities' },
  { to: '/student/applications', label: 'Applications' },
  { to: '/student/mentors', label: 'Mentors' },
  { to: '/student/sessions', label: 'Sessions' },
  { to: '/student/quizzes', label: 'Quizzes' },
  { to: '/student/skill-gap', label: 'Skill gap' },
  { to: '/student/advisor', label: 'Advisor' },
];

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      {
        element: <GuestOnly />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
        ],
      },
      area('student', studentLinks, [
        { path: 'profile', element: <ProfilePage /> },
        { path: 'opportunities', element: <OpportunitiesPage /> },
        { path: 'opportunities/:id', element: <OpportunityDetailPage /> },
        { path: 'applications', element: <ApplicationsPage /> },
        { path: 'mentors', element: <MentorsPage /> },
        { path: 'sessions', element: <SessionsPage /> },
        { path: 'quizzes', element: <QuizPage /> },
        { path: 'skill-gap', element: <SkillGapPage /> },
        { path: 'advisor', element: <AdvisorPage /> },
      ]),
      area(
        'mentor',
        [
          { to: '/mentor', label: 'Dashboard', end: true },
          { to: '/mentor/profile', label: 'Profile' },
          { to: '/mentor/mentees', label: 'Mentees' },
          { to: '/mentor/sessions', label: 'Sessions' },
        ],
        [
          { path: 'profile', element: <MentorProfilePage /> },
          { path: 'mentees', element: <MenteesPage /> },
          { path: 'sessions', element: <SessionsPage /> },
        ],
        <MentorDashboard />,
      ),
      area(
        'faculty',
        [
          { to: '/faculty', label: 'Dashboard', end: true },
          { to: '/faculty/profile', label: 'Profile' },
          { to: '/faculty/collaborations', label: 'Collaborations' },
          { to: '/faculty/insights', label: 'Insights' },
          { to: '/faculty/advisor', label: 'Advisor' },
        ],
        [
          { path: 'profile', element: <FacultyProfilePage /> },
          { path: 'collaborations', element: <CollaborationsPage /> },
          { path: 'insights', element: <InsightsPage /> },
          { path: 'advisor', element: <AdvisorPage /> },
        ],
        <FacultyDashboard />,
      ),
      area(
        'admin',
        [
          { to: '/admin', label: 'Dashboard', end: true },
          { to: '/admin/tickets', label: 'Tickets' },
        ],
        [{ path: 'tickets', element: <AdminTicketsPage /> }],
      ),
      area(
        'recruiter',
        [
          { to: '/recruiter', label: 'Dashboard', end: true },
          { to: '/recruiter/company', label: 'Company' },
          { to: '/recruiter/postings', label: 'Postings' },
          { to: '/recruiter/talent', label: 'Talent' },
        ],
        [
          { path: 'company', element: <CompanyPage /> },
          { path: 'postings', element: <PostingsPage /> },
          { path: 'postings/:id', element: <ApplicantsPage /> },
          { path: 'talent', element: <TalentPage /> },
        ],
        <RecruiterDashboard />,
      ),
      // Help centre: any signed-in role
      { element: <RequireRole />, children: [{ path: 'help', element: <HelpPage /> }] },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
