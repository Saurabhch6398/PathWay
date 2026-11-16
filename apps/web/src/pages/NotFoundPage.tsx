import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="rounded-xl border bg-white p-8 text-center shadow-sm">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-600">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-indigo-600">
        Go to the home page
      </Link>
    </section>
  );
}

/** Shown if a page crashes while rendering, instead of a blank screen. */
export function ErrorPage() {
  const error = useRouteError();
  console.error(error);
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  if (notFound) return <NotFoundPage />;
  return (
    <section className="mx-auto mt-16 max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-slate-600">
        Please reload the page. If it keeps happening, contact support from the Help page.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
      >
        Reload
      </button>
    </section>
  );
}
