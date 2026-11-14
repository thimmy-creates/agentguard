import { Activity, ArrowLeft, Pause, Play, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ActionBadge, AgentGlyph, AgentStatusChip, Chip, NearRef, OutcomeChip, RiskChip, actionLabel } from '@/components/badges';
import { Button, Card, CopyButton, EmptyState, ErrorState, Modal, Mono, PageHeader, SectionTitle, Skeleton } from '@/components/ui';
import { ACTION_LABELS } from '@/components/badges';
import { api, ApiError, type ActionId, type AgentDetail } from '@/lib/api';
import { formatDateTime, shortHash, timeAgo } from '@/lib/format';
import { useApi, useTick } from '@/lib/hooks';
import { useToast } from '@/lib/toast';

export function AgentDetailPage() {
  const { id = '' } = useParams();
  const { data, error, loading, reload } = useApi<AgentDetail>(`/agents/${id}`);
  const toast = useToast();
  const now = useTick();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function setStatus(status: 'active' | 'suspended') {
    setBusy(true);
    try {
      await api.patch(`/agents/${id}/status`, { status });
      toast({ title: status === 'suspended' ? 'Agent suspended' : 'Agent reactivated', description: status === 'suspended' ? 'Every request is denied until you reactivate it.' : 'Its policy applies again.' });
      setConfirm(false);
      reload();
    } catch (e) {
      toast({ tone: 'error', title: 'Could not change status', description: e instanceof ApiError ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data)
    return (
      <div aria-busy="true" aria-label="Loading agent" className="space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  if (!data) return <ErrorState message={error ?? 'Agent not found'} onRetry={reload} />;

  const { agent, history, policy_versions } = data;
  const suspended = agent.status === 'suspended';

  return (
    <>
      <Link to="/agents" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" />
        All agents
      </Link>

      <PageHeader
        title={agent.name}
        description={agent.description || undefined}
        eyebrow={
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <AgentGlyph name={agent.name} size="lg" dim={suspended} />
            <AgentStatusChip status={agent.status} />
            <Mono className="text-muted">{agent.id}</Mono>
          </div>
        }
        actions={
          <>
            <Link
              to={`/policies?agent=${agent.id}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line-strong bg-surface-2 px-4 text-sm font-medium transition-colors hover:border-brand/60"
            >
              <SlidersHorizontal aria-hidden className="size-4" />
              Edit policy
            </Link>
            {suspended ? (
              <Button variant="success" loading={busy} onClick={() => setStatus('active')}>
                <Play aria-hidden className="size-4" />
                Reactivate
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setConfirm(true)}>
                <Pause aria-hidden className="size-4" />
                Suspend
              </Button>
            )}
          </>
        }
      />

      <section aria-label="Agent metrics" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { l: 'Requests', v: agent.stats.total },
          { l: 'Allowed', v: agent.stats.allowed },
          { l: 'Blocked', v: agent.stats.blocked },
          { l: 'Pending', v: agent.stats.pending },
        ].map((s) => (
          <Card key={s.l} className="p-4">
            <p className="text-sm text-muted">{s.l}</p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums">{s.v}</p>
          </Card>
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle title="Permissions" description={`Policy v${agent.policy_version}`} />
          <ul className="mt-3 divide-y divide-line">
            {(Object.keys(ACTION_LABELS) as ActionId[]).map((a) => (
              <li key={a} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <ActionBadge action={a} className="text-sm" />
                <OutcomeChip kind={agent.rules[a]} />
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-2 p-2 pl-3 text-xs text-muted">
            <span>Policy hash</span>
            <Mono className="min-w-0 flex-1 truncate">{shortHash(agent.policy_hash, 12)}</Mono>
            <CopyButton value={agent.policy_hash} label="Copy policy hash" />
          </div>
        </Card>

        <Card className="p-5 lg:col-span-3">
          <SectionTitle title="Activity history" description="Latest 50 requests from this agent." />
          {history.length === 0 ? (
            <div className="mt-4">
              <EmptyState icon={Activity} title="No activity yet" description="Requests sent through this agent's gateway will appear here." />
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="text-sm font-medium">{actionLabel(h.action)}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      <time dateTime={h.created_at} title={formatDateTime(h.created_at)}>
                        {timeAgo(h.created_at, now)}
                      </time>
                      {' · '}policy v{h.policy_version}
                      {h.source !== 'gateway' && ` · ${h.source}`}
                    </p>
                  </div>
                  <RiskChip risk={h.risk} />
                  <OutcomeChip kind={h.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <SectionTitle title="Policy versions" description="Each version's hash is anchored on NEAR." />
        <ul className="mt-2 divide-y divide-line">
          {policy_versions.map((v) => (
            <li key={v.version} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
              <Chip tone={v.version === agent.policy_version ? 'brand' : 'neutral'}>v{v.version}{v.version === agent.policy_version ? ' · active' : ''}</Chip>
              <Mono className="text-muted">{shortHash(v.policy_hash, 10)}</Mono>
              <span className="text-xs text-muted">{formatDateTime(v.created_at)}</span>
              <span className="ml-auto">
                <NearRef tx={v.near_tx} status={v.near_status} mode={v.near_mode as 'testnet' | 'simulated' | null} />
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Modal open={confirm} onOpenChange={setConfirm} title={`Suspend ${agent.name}?`} description="Every request from this agent will be denied until you reactivate it. Pending approvals stay in the queue.">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={() => setStatus('suspended')}>
            Suspend agent
          </Button>
        </div>
      </Modal>
    </>
  );
}
