import { Ban, CheckCircle2, Hourglass, ShieldAlert, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { actionIcon, AgentGlyph, Chip, NearRef, RiskChip } from '@/components/badges';
import { Button, Card, CopyButton, EmptyState, ErrorState, Mono, PageHeader, SectionTitle, Skeleton } from '@/components/ui';
import { api, ApiError, type ActionDef, type Agent, type Decision, type PolicyResponse, type Rules } from '@/lib/api';
import { formatDateTime, shortHash } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const OPTIONS: { value: Decision; label: string; icon: LucideIcon; on: string }[] = [
  { value: 'allow', label: 'Allowed', icon: CheckCircle2, on: 'has-[:checked]:border-allow has-[:checked]:bg-allow-soft has-[:checked]:text-allow' },
  { value: 'review', label: 'Approval required', icon: Hourglass, on: 'has-[:checked]:border-review has-[:checked]:bg-review-soft has-[:checked]:text-review' },
  { value: 'deny', label: 'Blocked', icon: Ban, on: 'has-[:checked]:border-deny has-[:checked]:bg-deny-soft has-[:checked]:text-deny' },
];

function RuleRow({
  def,
  value,
  saved,
  onChange,
}: {
  def: ActionDef;
  value: Decision;
  saved: Decision;
  onChange: (d: Decision) => void;
}) {
  const Icon = actionIcon(def.id);
  const changed = value !== saved;
  return (
    <fieldset className={cn('grid gap-4 rounded-2xl border p-4 transition-colors duration-150 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6', changed ? 'border-brand/60 bg-brand-soft/40' : 'border-line')}>
      <legend className="sr-only">{def.label}</legend>
      <div className="flex items-start gap-3.5">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-brand">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 font-semibold" aria-hidden>
            {def.label}
            <RiskChip risk={def.baseRisk} />
            {changed && <Chip tone="brand">Changed</Chip>}
          </p>
          <p className="mt-1 text-sm text-muted" aria-hidden>
            {def.description}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 md:w-[27rem]">
        {OPTIONS.map(({ value: v, label, icon: OptIcon, on }) => (
          <label
            key={v}
            className={cn(
              'relative flex min-h-12 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-line-strong bg-surface-2 px-1.5 py-2 text-center text-xs font-medium leading-tight text-muted transition-colors duration-150 hover:border-brand/50 sm:flex-row sm:gap-2 sm:text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand',
              on,
            )}
          >
            <input type="radio" name={def.id} value={v} checked={value === v} onChange={() => onChange(v)} className="sr-only" />
            <OptIcon aria-hidden className="size-4 shrink-0" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PoliciesPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const agents = useApi<Agent[]>('/agents');
  const catalog = useApi<ActionDef[]>('/actions', { live: false });

  const agentId = params.get('agent') ?? agents.data?.[0]?.id ?? null;
  const policy = useApi<PolicyResponse>(agentId ? `/agents/${agentId}/policy` : null);
  const agent = agents.data?.find((a) => a.id === agentId);

  const [draft, setDraft] = useState<Rules | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset the draft whenever a different agent or a newly published version loads.
  const version = policy.data?.version;
  useEffect(() => {
    if (policy.data) setDraft(policy.data.rules);
  }, [policy.data?.agent_id, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(
    () => Boolean(draft && policy.data && catalog.data?.some((d) => draft[d.id] !== policy.data!.rules[d.id])),
    [draft, policy.data, catalog.data],
  );

  function pick(id: string) {
    if (id === agentId) return;
    if (dirty && !window.confirm('Discard your unpublished changes?')) return;
    setParams({ agent: id });
  }

  async function publish() {
    if (!agentId || !draft) return;
    setSaving(true);
    try {
      const res = await api.put<{ unchanged: boolean; version: number }>(`/agents/${agentId}/policy`, { rules: draft });
      toast({ title: res.unchanged ? 'No changes to publish' : `Policy v${res.version} published`, description: res.unchanged ? undefined : 'The new policy applies to the next request. Its hash is being recorded on NEAR.' });
      policy.reload();
      agents.reload();
    } catch (e) {
      toast({ tone: 'error', title: 'Could not publish the policy', description: e instanceof ApiError ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  const loading = (agents.loading && !agents.data) || (catalog.loading && !catalog.data);

  return (
    <>
      <PageHeader
        title="Policy management"
        description="Decide what each agent may do. Every change publishes a new, hashed policy version."
      />

      {agents.error && !agents.data && <ErrorState message={agents.error} onRetry={agents.reload} />}
      {loading && (
        <div aria-busy="true" aria-label="Loading policies" className="space-y-3">
          <Skeleton className="h-14 max-w-lg" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      {agents.data && agents.data.length === 0 && (
        <EmptyState icon={ShieldAlert} title="No agents to configure" description="Register an agent first. It gets a starting policy automatically." />
      )}

      {agents.data && agents.data.length > 0 && catalog.data && (
        <>
          <nav aria-label="Choose an agent" className="mb-6 flex flex-wrap gap-2">
            {agents.data.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={a.id === agentId}
                onClick={() => pick(a.id)}
                className={cn(
                  'flex min-h-12 items-center gap-2.5 rounded-xl border py-1.5 pl-2 pr-4 text-sm font-medium transition-colors duration-150',
                  a.id === agentId ? 'border-brand bg-brand-soft text-foreground' : 'border-line-strong bg-surface text-muted hover:border-brand/50 hover:text-foreground',
                )}
              >
                <AgentGlyph name={a.name} size="sm" dim={a.status === 'suspended'} />
                {a.name}
              </button>
            ))}
          </nav>

          {policy.error && !policy.data && <ErrorState message={policy.error} onRetry={policy.reload} />}

          {policy.data && draft && (
            <>
              <Card className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
                <div>
                  <p className="text-xs text-muted">Active policy</p>
                  <p className="font-display text-2xl font-bold tabular-nums">
                    v{policy.data.version}
                    {agent && <span className="ml-2 text-base font-medium text-muted">for {agent.name}</span>}
                  </p>
                </div>
                <div className="flex min-w-0 items-center gap-1">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">Policy hash</p>
                    <Mono className="block truncate">{shortHash(policy.data.hash, 14)}</Mono>
                  </div>
                  <CopyButton value={policy.data.hash} label="Copy policy hash" />
                </div>
                <div className="sm:ml-auto">
                  <p className="mb-1 text-xs text-muted">On NEAR</p>
                  <NearRef
                    tx={policy.data.history[0]?.near_tx ?? null}
                    status={policy.data.history[0]?.near_status ?? 'pending'}
                    mode={(policy.data.history[0]?.near_mode as 'testnet' | 'simulated' | null) ?? null}
                  />
                </div>
              </Card>

              <div className="space-y-3">
                {catalog.data.map((def) => (
                  <RuleRow key={def.id} def={def} value={draft[def.id]} saved={policy.data!.rules[def.id]} onChange={(d) => setDraft({ ...draft, [def.id]: d })} />
                ))}
              </div>

              <p className="mt-4 flex items-start gap-2.5 rounded-xl bg-surface-2 p-3.5 text-sm text-muted">
                <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                Guardrail: an allowed action whose scope pushes it to high risk (over 1,000 records) still needs approval. Rules can tighten at runtime, never loosen.
              </p>

              {/* Unpublished-changes bar. Sits above the mobile tab bar. */}
              {dirty && (
                <div
                  role="region"
                  aria-label="Unpublished changes"
                  className="animate-rise sticky bottom-[5.5rem] z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/60 bg-surface p-3.5 shadow-card lg:bottom-6"
                >
                  <p className="pl-1 text-sm font-medium">You have unpublished changes.</p>
                  <div className="flex gap-2">
                    <Button onClick={() => setDraft(policy.data!.rules)}>Discard</Button>
                    <Button variant="primary" loading={saving} onClick={publish}>
                      Publish v{policy.data.version + 1}
                    </Button>
                  </div>
                </div>
              )}

              <Card className="mt-8 p-5">
                <SectionTitle title="Version history" description="Full configurations stay in SQLite. Only each hash goes to NEAR." />
                <ul className="mt-2 divide-y divide-line">
                  {policy.data.history.map((v) => (
                    <li key={v.version} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
                      <Chip tone={v.version === policy.data!.version ? 'brand' : 'neutral'}>v{v.version}</Chip>
                      <Mono className="text-muted">{shortHash(v.policy_hash, 10)}</Mono>
                      <span className="text-xs text-muted">{formatDateTime(v.created_at)}</span>
                      <span className="ml-auto">
                        <NearRef tx={v.near_tx} status={v.near_status} mode={v.near_mode as 'testnet' | 'simulated' | null} />
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </>
      )}
    </>
  );
}
