import { ArrowUpRight, Ban, Bot, CheckCircle2, Hourglass, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AgentGlyph, AgentStatusChip } from '@/components/badges';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import type { Agent } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useApi, useTick } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { RegisterAgentDialog } from './RegisterAgentDialog';

function PermissionSummary({ counts }: { counts: Agent['permission_counts'] }) {
  const items = [
    { icon: CheckCircle2, n: counts.allow, label: 'allowed', cls: 'text-allow' },
    { icon: Hourglass, n: counts.review, label: 'need approval', cls: 'text-review' },
    { icon: Ban, n: counts.deny, label: 'blocked', cls: 'text-deny' },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
      {items.map(({ icon: Icon, n, label, cls }) => (
        <li key={label} className="flex items-center gap-1.5">
          <Icon aria-hidden className={cn('size-4', cls)} />
          <span className="font-semibold tabular-nums">{n}</span>
          <span className="text-muted">{label}</span>
        </li>
      ))}
    </ul>
  );
}

export function AgentsPage() {
  const { data, error, loading, reload } = useApi<Agent[]>('/agents');
  const [registering, setRegistering] = useState(false);
  const now = useTick();

  return (
    <>
      <PageHeader
        title="Agents"
        description="Each agent gets its own policy. Register one, set what it may do, and watch its activity."
        actions={
          <Button variant="primary" onClick={() => setRegistering(true)}>
            <Plus aria-hidden className="size-4" />
            Register agent
          </Button>
        }
      />

      {error && !data && <ErrorState message={error} onRetry={reload} />}

      {loading && !data && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading agents">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      )}

      {data && data.length === 0 && (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          description="Register your first agent to give it a policy and start routing its actions through the gateway."
          action={
            <Button variant="primary" onClick={() => setRegistering(true)}>
              <Plus aria-hidden className="size-4" />
              Register agent
            </Button>
          }
        />
      )}

      {data && data.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((a, i) => (
            <li key={a.id} className="animate-rise" style={{ animationDelay: `${i * 45}ms` }}>
              <Link
                to={`/agents/${a.id}`}
                className="group flex h-full flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-brand/60"
              >
                <div className="flex items-start gap-3.5">
                  <AgentGlyph name={a.name} size="lg" dim={a.status === 'suspended'} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="truncate text-lg font-semibold">{a.name}</h2>
                      <ArrowUpRight aria-hidden className="size-5 shrink-0 text-subtle transition-colors group-hover:text-brand" />
                    </div>
                    <div className="mt-1.5">
                      <AgentStatusChip status={a.status} />
                    </div>
                  </div>
                </div>
                <p className="line-clamp-2 min-h-10 text-sm text-muted">{a.description || 'No description.'}</p>
                <PermissionSummary counts={a.permission_counts} />
                <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-4 text-sm">
                  <div>
                    <dt className="text-xs text-muted">Requests</dt>
                    <dd className="font-semibold tabular-nums">{a.stats.total}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Policy</dt>
                    <dd className="font-semibold tabular-nums">v{a.policy_version}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Last active</dt>
                    <dd className="font-semibold">{a.stats.last_active ? timeAgo(a.stats.last_active, now) : 'Never'}</dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <RegisterAgentDialog open={registering} onOpenChange={setRegistering} />
    </>
  );
}
