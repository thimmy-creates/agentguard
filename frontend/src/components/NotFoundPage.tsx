import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-lg rounded-3xl border border-line bg-surface p-8 text-center shadow-card">
        <div className="mx-auto mb-5 inline-flex size-16 items-center justify-center rounded-2xl border border-brand/40 bg-brand/10 font-display text-2xl font-bold text-brand">
          404
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          The route you tried to open does not exist in AGENTGUARD. It may have moved, or the link may be stale.
        </p>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90"
          >
            Back to overview
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-brand/60 hover:text-brand"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
