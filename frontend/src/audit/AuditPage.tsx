import { Hash, Search, ScrollText, ShieldCheck, ShieldX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ActionBadge, Chip, NearRef, OutcomeChip, RiskChip } from '@/components/badges';
import { Button, Card, CopyButton, EmptyState, ErrorState, Input, Modal, Mono, PageHeader, Select, Skeleton } from '@/components/ui';
import { api, ApiError, type AuditItem, type ChainInfo, type VerifyResult } from '@/lib/api';
import { formatDateTime, shortHash } from '@/lib/format';
import { useApi } from '@/lib/hooks';

const FILTERS = [
  { value: '', label: 'All decisions' },
  { value: 'allowed', label: 'Allowed or approved' },
  { value: 'blocked', label: 'Blocked or rejected' },
  { value: 'review_approved', label: 'Approved by owner' },
  { value: 'review_rejected', label: 'Rejected by owner' },
];

function ReceiptDialog({ item, chain, onClose }: { item: AuditItem | null; chain: ChainInfo | null; onClose: () => void }) {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setResult(null);
    setErr(null);
  }, [item?.id]);

  async function verify() {
    if (!item) return;
    setBusy(true);
    setErr(null);
    try {
      setResult(await api.get<VerifyResult>(`/audit/${item.id}/verify`));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!item} onOpenChange={(o) => !o && onClose()} title="Decision receipt" description="Only hashes go to NEAR. Names, policies and raw requests stay in SQLite." size="lg">
      {item && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <OutcomeChip kind={item.decision_type} />
            <RiskChip risk={item.risk} />
            <Chip tone="brand">Policy v{item.policy_version}</Chip>
          </div>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Agent</dt>
              <dd className="mt-1 font-medium">{item.agent_name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Timestamp</dt>
              <dd className="mt-1 font-medium tabular-nums">{formatDateTime(item.created_at)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">Action requested</dt>
              <dd className="mt-1">
                <ActionBadge action={item.action} />
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">Decision receipt hash</dt>
              <dd className="mt-1 flex items-center gap-1">
                <Mono className="min-w-0 flex-1 break-all">{item.decision_hash}</Mono>
                <CopyButton value={item.decision_hash} label="Copy receipt hash" />
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">Policy hash (v{item.policy_version})</dt>
              <dd className="mt-1 flex items-center gap-1">
                <Mono className="min-w-0 flex-1 break-all text-muted">{item.policy_hash}</Mono>
                <CopyButton value={item.policy_hash} label="Copy policy hash" />
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">NEAR transaction reference</dt>
              <dd className="mt-1 flex items-center gap-1">
                <NearRef tx={item.near_tx} status={item.near_status} mode={item.near_mode} chain={chain} full />
                {item.near_tx && <CopyButton value={item.near_tx} label="Copy transaction reference" />}
              </dd>
              {item.near_error && <dd className="mt-1 text-sm text-deny">{item.near_error}</dd>}
            </div>
          </dl>

          <div className="rounded-2xl border border-line-strong bg-surface-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Verify this receipt</p>
                <p className="text-sm text-muted">Recompute the hash from stored data and compare.</p>
              </div>
              <Button variant="primary" size="sm" loading={busy} onClick={verify}>
                <Hash aria-hidden className="size-4" />
                Verify
              </Button>
            </div>
            <div aria-live="polite">
              {err && <p role="alert" className="mt-3 text-sm text-deny">{err}</p>}
              {result && (
                <div className="animate-rise mt-4 space-y-2">
                  {result.valid ? (
                    <Chip tone="allow" icon={ShieldCheck}>Hash matches stored data</Chip>
                  ) : (
                    <Chip tone="deny" icon={ShieldX}>Mismatch: stored data was altered</Chip>
                  )}
                  <p className="text-sm text-muted">{result.note}</p>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted">A stored hash is evidence that a decision was recorded. It is not proof that an action was safe.</p>
        </div>
      )}
    </Modal>
  );
}

export function AuditPage() {
  const [params, setParams] = useSearchParams();
  const decision = params.get('decision') ?? '';
  const q = params.get('q') ?? '';
  const [text, setText] = useState(q);
  const [open, setOpen] = useState<AuditItem | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (text !== q) {
        const next = new URLSearchParams(params);
        text ? next.set('q', text) : next.delete('q');
        setParams(next, { replace: true });
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const qs = new URLSearchParams();
  if (decision) qs.set('decision', decision);
  if (q) qs.set('q', q);
  const { data, error, loading, reload } = useApi<AuditItem[]>(`/audit?${qs.toString()}`);
  const chain = useApi<ChainInfo>('/chain', { live: false });

  const filterValue = FILTERS.some((f) => f.value === decision) ? decision : '';

  return (
    <>
      <PageHeader title="Audit explorer" description="Every decision, its policy version and its NEAR reference." />

      <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input aria-label="Search audit records" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search agent, action, hash or transaction" className="pl-10" />
        </div>
        <Select
          aria-label="Filter by decision"
          value={filterValue}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            e.target.value ? next.set('decision', e.target.value) : next.delete('decision');
            setParams(next, { replace: true });
          }}
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </Select>
      </div>

      {error && !data && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <Skeleton className="h-96" />}
      {data && data.length === 0 && (
        <EmptyState icon={ScrollText} title="No matching records" description="Try clearing the filter or searching for something else." action={<Button onClick={() => { setText(''); setParams({}); }}>Clear filters</Button>} />
      )}

      {data && data.length > 0 && (
        <>
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Audit records, newest first</caption>
              <thead className="border-b border-line bg-surface-2/60 text-xs uppercase tracking-wider text-muted">
                <tr>
                  {['Action requested', 'Decision', 'Timestamp', 'Policy', 'NEAR reference'].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-surface-2/50">
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setOpen(a)} className="group flex min-h-11 flex-col items-start justify-center rounded-lg text-left">
                        <span className="font-medium group-hover:text-brand">{a.action.replaceAll('_', ' ')}</span>
                        <span className="text-xs text-muted">{a.agent_name}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3"><OutcomeChip kind={a.decision_type} /></td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">{formatDateTime(a.created_at)}</td>
                    <td className="px-4 py-3 tabular-nums">v{a.policy_version}</td>
                    <td className="px-4 py-3"><NearRef tx={a.near_tx} status={a.near_status} mode={a.near_mode} chain={chain.data} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <ul className="space-y-3 md:hidden">
            {data.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => setOpen(a)} className="w-full rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition-colors hover:border-brand/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{a.action.replaceAll('_', ' ')}</p>
                      <p className="text-xs text-muted">{a.agent_name} · policy v{a.policy_version}</p>
                    </div>
                    <OutcomeChip kind={a.decision_type} />
                  </div>
                  <p className="mt-3 text-xs tabular-nums text-muted">{formatDateTime(a.created_at)}</p>
                  <p className="mt-1 font-mono text-xs text-muted">{shortHash(a.near_tx, 10)}</p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <ReceiptDialog item={open} chain={chain.data} onClose={() => setOpen(null)} />
    </>
  );
}
