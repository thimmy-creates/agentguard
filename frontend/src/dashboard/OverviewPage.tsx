import { ArrowRight, Ban, Bot, CheckCircle2, FlaskConical, Hourglass, Link2, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ActivityFeed } from '@/components/ActivityFeed';
import { AgentGlyph, Chip, type Tone } from '@/components/badges';
import { Card, ErrorState, PageHeader, SectionTitle, Skeleton } from '@/components/ui';
import type { Overview } from '@/lib/api';
import { formatHour } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { AuthorizationFlow } from './AuthorizationFlow';

const toneBubble: Record<Tone, string> = {
  allow: 'bg-allow-soft text-allow',
  review: 'bg-review-soft text-review',
  deny: 'bg-deny-soft text-deny',
  brand: 'bg-brand-soft text-brand',
  neutral: 'bg-surface-2 text-muted',
};

function Stat({
  icon: Icon,
  label,
  value,
  note,
  tone,
  to,
  index,
  attention,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  note: string;
  tone: Tone;
  to: string;
  index: number;
  attention?: boolean;
}) {
  return (
    <Link
      to={to}
      style={{ animationDelay: `${index * 45}ms` }}
      className={cn(
        'animate-rise group relative block rounded-2xl border bg-surface p-5 shadow-card transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-brand/60',
        attention ? 'border-review/50' : 'border-line',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-muted">{label}</span>
        <span className={cn('grid size-10 place-items-center rounded-xl', toneBubble[tone])}>
          <Icon aria-hidden className="size-5" />
        </span>
      </div>
      <p className="mt-3 font-display text-5xl font-bold leading-none tracking-tight tabular-nums">{value}</p>
      <p className="mt-3 text-sm text-muted">{note}</p>
    </Link>
  );
}

function ActivityChart({ timeline }: { timeline: Overview['timeline'] }) {
  const totals = timeline.map((b) => b.allow + b.review + b.deny);
  const max = Math.max(1, ...totals);
  const empty = totals.every((t) => t === 0);

  return (
    <div>
      <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted" aria-label="Chart legend">
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm bg-allow" />
          Allowed
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="stripe-review size-3 rounded-sm" />
          Approval required
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm bg-deny" />
          Blocked
        </li>
      </ul>

      <div role="img" aria-label={`Requests per hour over the last 12 hours. ${empty ? 'No requests yet.' : `Peak of ${max} requests in one hour.`}`}>
        <div className="relative h-44">
          {[0, 50, 100].map((p) => (
            <span key={p} aria-hidden className="absolute inset-x-0 border-t border-line" style={{ bottom: `${p}%` }} />
          ))}
          <div className="relative flex h-full items-end gap-1.5 sm:gap-2.5">
            {timeline.map((b, i) => {
              const total = totals[i];
              return (
                <div
                  key={b.hour}
                  title={`${formatHour(b.hour)}: ${b.allow} allowed, ${b.review} approval required, ${b.deny} blocked`}
                  className="flex h-full min-w-0 flex-1 flex-col-reverse justify-start"
                >
                  <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-md" style={{ height: `${(total / max) * 100}%` }}>
                    <span className="bg-allow" style={{ height: `${total ? (b.allow / total) * 100 : 0}%` }} />
                    <span className="stripe-review" style={{ height: `${total ? (b.review / total) * 100 : 0}%` }} />
                    <span className="bg-deny" style={{ height: `${total ? (b.deny / total) * 100 : 0}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div aria-hidden className="mt-2 flex gap-1.5 sm:gap-2.5">
          {timeline.map((b, i) => (
            <span key={b.hour} className="min-w-0 flex-1 text-center text-xs text-subtle tabular-nums">
              {i % 3 === 0 ? formatHour(b.hour).slice(0, 2) : ''}
            </span>
          ))}
        </div>
      </div>

      {/* Accessible alternative to the chart */}
      <table className="sr-only">
        <caption>Requests per hour</caption>
        <thead>
          <tr>
            <th>Hour</th>
            <th>Allowed</th>
            <th>Approval required</th>
            <th>Blocked</th>
          </tr>
        </thead>
        <tbody>
          {timeline.map((b) => (
            <tr key={b.hour}>
              <td>{formatHour(b.hour)}</td>
              <td>{b.allow}</td>
              <td>{b.review}</td>
              <td>{b.deny}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {empty && <p className="mt-3 text-sm text-muted">No requests in the last 12 hours.</p>}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading overview">
      <Skeleton className="mb-8 h-24 max-w-md" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

export function OverviewPage() {
  const { data, error, loading, reload } = useApi<Overview>('/overview');

  if (loading && !data) return <PageSkeleton />;
  if (!data) return <ErrorState message={error ?? 'Could not load the overview'} onRetry={reload} />;

  const { totals, chain } = data;
  const liveChain = chain.mode === 'testnet';

  return (
    <>
      <PageHeader
        title="Security overview"
        description="Every agent action is decided before it runs. Here is what the gateway saw."
      />
      {error && <div className="mb-4"><ErrorState message={error} onRetry={reload} /></div>}

      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat index={0} icon={Bot} tone="brand" label="Registered agents" value={totals.agents} note={`${totals.active_agents} active`} to="/agents" />
        <Stat index={1} icon={CheckCircle2} tone="allow" label="Allowed actions" value={totals.allowed} note={`of ${totals.requests} requests`} to="/audit?decision=allowed" />
        <Stat index={2} icon={Ban} tone="deny" label="Blocked actions" value={totals.blocked} note="Denied or rejected" to="/audit?decision=blocked" />
        <Stat
          index={3}
          icon={Hourglass}
          tone="review"
          label="Pending approvals"
          value={totals.pending}
          note={totals.pending ? 'Agents are waiting on you' : 'Nothing waiting'}
          to="/approvals"
          attention={totals.pending > 0}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle title="Requests, last 12 hours" description="How the policy engine decided, hour by hour." />
          <div className="mt-5">
            <ActivityChart timeline={data.timeline} />
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Agent status" />
          <ul className="mt-3 divide-y divide-line">
            {data.agents.length === 0 && <li className="py-6 text-center text-sm text-muted">No agents registered.</li>}
            {data.agents.map((a) => (
              <li key={a.id}>
                <Link to={`/agents/${a.id}`} className="-mx-2 flex min-h-14 items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-surface-2">
                  <AgentGlyph name={a.name} dim={a.status === 'suspended'} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{a.name}</span>
                    <span className="block text-xs text-muted tabular-nums">
                      {a.stats.total} request{a.stats.total === 1 ? '' : 's'}
                    </span>
                  </span>
                  {a.stats.pending > 0 && (
                    <Chip tone="review" icon={Hourglass}>
                      {a.stats.pending}
                    </Chip>
                  )}
                  {a.status === 'suspended' ? (
                    <Chip tone="deny" icon={Ban}>
                      Suspended
                    </Chip>
                  ) : (
                    <Chip tone="allow" icon={CheckCircle2}>
                      Active
                    </Chip>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle
            title="Live security feed"
            description="New events appear here as the gateway makes decisions."
            action={
              <Link to="/audit" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand underline-offset-4 hover:underline">
                Audit explorer
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            }
          />
          <div className="mt-2">
            <ActivityFeed events={data.events} limit={8} />
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="NEAR receipts" description="Hashes only. Private data stays in SQLite." />
          <div className="mt-4 flex items-end gap-2">
            <span className="font-display text-5xl font-bold leading-none tabular-nums">{chain.receipts}</span>
            <span className="pb-1 text-sm text-muted">decision receipts</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {liveChain ? (
              <Chip tone="allow" icon={Link2}>
                {chain.anchored} anchored on {chain.network}
              </Chip>
            ) : (
              <Chip tone="neutral" icon={FlaskConical}>
                Simulated mode
              </Chip>
            )}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {liveChain
              ? `Writer ${chain.writer} records to ${chain.contract}.`
              : 'No NEAR credentials are configured, so references are labelled sim_ and nothing leaves this machine.'}
          </p>
          <p className="mt-3 rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-muted">
            A stored hash is evidence that a decision was recorded. It is not proof that an action was safe.
          </p>
        </Card>
      </div>

      <Card className="mt-6 p-5 md:p-6">
        <SectionTitle title="How every action is decided" description="No action reaches a tool without passing the policy engine. The engine is deterministic. No AI model makes the call." />
        <div className="mt-6">
          <AuthorizationFlow allowed={totals.allowed} pending={totals.pending} blocked={totals.blocked} receipts={chain.receipts} />
        </div>
      </Card>
    </>
  );
}
