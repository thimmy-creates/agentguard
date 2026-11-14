import { ArrowRight, Check, Inbox, ScrollText, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ActionBadge, AgentGlyph, Chip, OutcomeChip, RiskChip } from '@/components/badges';
import { Button, Card, EmptyState, ErrorState, Mono, PageHeader, Skeleton } from '@/components/ui';
import { api, ApiError, type ApprovalItem } from '@/lib/api';
import { formatDateTime, shortHash, timeAgo } from '@/lib/format';
import { useApi, useTick } from '@/lib/hooks';
import { useLiveStatus } from '@/lib/live';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

function ParamChips({ params }: { params: Record<string, unknown> }) {
  const entries = Object.entries(params);
  if (!entries.length) return <span className="text-sm text-muted">No parameters</span>;
  return (
    <details className="group">
      <summary className="flex min-h-11 list-none items-center gap-2 text-sm font-medium text-muted marker:hidden hover:text-foreground">
        <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-xs group-open:bg-brand-soft group-open:text-brand">{entries.length}</span>
        Request parameters
      </summary>
      <pre className="mt-1 overflow-x-auto rounded-xl border border-line bg-background p-3 font-mono text-xs leading-relaxed">{JSON.stringify(params, null, 2)}</pre>
    </details>
  );
}

function PendingCard({
  item,
  now,
  busy,
  onResolve,
}: {
  item: ApprovalItem;
  now: number;
  busy: 'approve' | 'reject' | null;
  onResolve: (v: 'approve' | 'reject') => void;
}) {
  const escalated = item.rule_decision === 'allow';
  return (
    <Card className={cn('animate-rise overflow-hidden', item.risk === 'high' && 'border-deny/40')}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-3">
          <AgentGlyph name={item.agent_name} />
          <div>
            <p className="font-semibold leading-tight">{item.agent_name}</p>
            <p className="text-xs text-muted">
              requested <time dateTime={item.created_at} title={formatDateTime(item.created_at)}>{timeAgo(item.created_at, now)}</time>
              {item.source !== 'gateway' && ` · ${item.source}`}
            </p>
          </div>
        </div>
        <RiskChip risk={item.risk} />
      </div>

      <div className="space-y-4 px-5 py-5">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-subtle">Requested action</p>
          <ActionBadge action={item.action} className="text-lg" />
        </div>

        <div className="rounded-xl bg-surface-2 p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-subtle">Why it stopped here</p>
          <p className="text-sm">{item.reason}</p>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Applicable policy</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <Chip tone="brand">v{item.policy_version}</Chip>
              <span className="text-muted">{escalated ? 'Allowed, escalated by scope' : 'Approval required'}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Policy hash</dt>
            <dd className="mt-1">
              <Mono className="text-muted">{shortHash(item.policy_hash, 10)}</Mono>
            </dd>
          </div>
        </dl>

        <ParamChips params={item.params} />
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-line bg-surface-2/40 px-5 py-4">
        <Button variant="danger" loading={busy === 'reject'} disabled={busy === 'approve'} onClick={() => onResolve('reject')}>
          <X aria-hidden className="size-4" />
          Reject
        </Button>
        <Button variant="success" loading={busy === 'approve'} disabled={busy === 'reject'} onClick={() => onResolve('approve')}>
          <Check aria-hidden className="size-4" />
          Approve
        </Button>
      </div>
    </Card>
  );
}

export function ApprovalsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'resolved' ? 'resolved' : 'pending';
  const pending = useApi<ApprovalItem[]>('/approvals?status=pending');
  const resolved = useApi<ApprovalItem[]>(tab === 'resolved' ? '/approvals?status=resolved' : null);
  const { refreshPending } = useLiveStatus();
  const toast = useToast();
  const now = useTick();
  const [busy, setBusy] = useState<{ id: string; verdict: 'approve' | 'reject' } | null>(null);

  async function resolve(item: ApprovalItem, verdict: 'approve' | 'reject') {
    setBusy({ id: item.id, verdict });
    try {
      await api.post(`/approvals/${item.id}/${verdict}`);
      toast(
        verdict === 'approve'
          ? { title: `Approved. ${item.agent_name} can proceed.`, description: 'The action ran on the mock tool and a receipt was recorded.' }
          : { title: `Rejected. ${item.agent_name} was stopped.`, description: 'The decision and its receipt were recorded.' },
      );
      pending.reload();
      refreshPending();
    } catch (e) {
      toast({ tone: 'error', title: 'Could not record your decision', description: e instanceof ApiError ? e.message : undefined });
      pending.reload();
    } finally {
      setBusy(null);
    }
  }

  const count = pending.data?.length ?? 0;
  const tabs = [
    { id: 'pending', label: 'Pending', n: count },
    { id: 'resolved', label: 'Resolved', n: null },
  ] as const;

  return (
    <>
      <PageHeader title="Approval centre" description="Sensitive actions wait here. Nothing runs until you decide." />

      <div role="tablist" aria-label="Approval status" className="mb-6 inline-flex rounded-xl border border-line bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="approvals-panel"
            onClick={() => setParams(t.id === 'pending' ? {} : { tab: t.id })}
            className={cn(
              'flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors duration-150',
              tab === t.id ? 'bg-brand-soft text-brand' : 'text-muted hover:text-foreground',
            )}
          >
            {t.label}
            {t.n !== null && t.n > 0 && <span className="rounded-full bg-review px-2 text-xs font-bold leading-5 text-background tabular-nums">{t.n}</span>}
          </button>
        ))}
      </div>

      <div id="approvals-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'pending' && (
          <>
            {pending.error && !pending.data && <ErrorState message={pending.error} onRetry={pending.reload} />}
            {pending.loading && !pending.data && (
              <div className="grid gap-4 lg:grid-cols-2" aria-busy="true" aria-label="Loading approvals">
                <Skeleton className="h-96" />
                <Skeleton className="h-96" />
              </div>
            )}
            {pending.data && pending.data.length === 0 && (
              <EmptyState
                icon={Inbox}
                title="All clear"
                description="No agent is waiting on you. Requests that need approval will land here."
                action={
                  <Link to="/audit" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand underline-offset-4 hover:underline">
                    See past decisions
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                }
              />
            )}
            {pending.data && pending.data.length > 0 && (
              <ul className="grid items-start gap-4 lg:grid-cols-2">
                {pending.data.map((item) => (
                  <li key={item.id}>
                    <PendingCard item={item} now={now} busy={busy?.id === item.id ? busy.verdict : null} onResolve={(v) => resolve(item, v)} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'resolved' && (
          <>
            {resolved.error && !resolved.data && <ErrorState message={resolved.error} onRetry={resolved.reload} />}
            {resolved.loading && !resolved.data && <Skeleton className="h-64" />}
            {resolved.data && resolved.data.length === 0 && (
              <EmptyState icon={ScrollText} title="Nothing resolved yet" description="Approved and rejected requests show up here with a link to their receipt." />
            )}
            {resolved.data && resolved.data.length > 0 && (
              <Card>
                <ul className="divide-y divide-line">
                  {resolved.data.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                      <AgentGlyph name={r.agent_name} size="sm" />
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="text-sm font-medium">
                          {r.agent_name} <span className="font-normal text-muted">· {r.action.replaceAll('_', ' ')}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {r.resolved_at && (
                            <time dateTime={r.resolved_at} title={formatDateTime(r.resolved_at)}>
                              {timeAgo(r.resolved_at, now)}
                            </time>
                          )}{' '}
                          by {r.resolved_by ?? 'owner'}
                        </p>
                      </div>
                      <RiskChip risk={r.risk} />
                      <OutcomeChip kind={r.status} />
                      <Link to={`/audit?q=${r.id}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand underline-offset-4 hover:underline">
                        Receipt
                        <ArrowRight aria-hidden className="size-4" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
