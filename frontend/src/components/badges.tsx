import {
  Ban,
  Bot,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  Hourglass,
  ListPlus,
  Send,
  ShieldCheck,
  ShieldX,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Trash2,
  CircleHelp,
  FlaskConical,
  type LucideIcon,
} from 'lucide-react';
import type { ChainStatus, ChainInfo, Risk } from '@/lib/api';
import { cn } from '@/lib/utils';

export type Tone = 'allow' | 'review' | 'deny' | 'brand' | 'neutral';

const toneCls: Record<Tone, string> = {
  allow: 'border-allow/30 bg-allow-soft text-allow',
  review: 'border-review/30 bg-review-soft text-review',
  deny: 'border-deny/30 bg-deny-soft text-deny',
  brand: 'border-brand/30 bg-brand-soft text-brand',
  neutral: 'border-line-strong bg-surface-2 text-muted',
};

export function Chip({
  tone = 'neutral',
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium leading-none',
        toneCls[tone],
        className,
      )}
    >
      {Icon && <Icon aria-hidden className="size-3.5 shrink-0" />}
      {children}
    </span>
  );
}

/* Colour is never the only signal: every outcome carries an icon and a word. */
const outcomes: Record<string, { label: string; tone: Tone; icon: LucideIcon }> = {
  allow: { label: 'Allowed', tone: 'allow', icon: CheckCircle2 },
  executed: { label: 'Allowed', tone: 'allow', icon: CheckCircle2 },
  review: { label: 'Approval required', tone: 'review', icon: Hourglass },
  pending: { label: 'Pending', tone: 'review', icon: Hourglass },
  deny: { label: 'Blocked', tone: 'deny', icon: Ban },
  denied: { label: 'Blocked', tone: 'deny', icon: Ban },
  review_approved: { label: 'Approved', tone: 'allow', icon: ShieldCheck },
  approved: { label: 'Approved', tone: 'allow', icon: ShieldCheck },
  review_rejected: { label: 'Rejected', tone: 'deny', icon: ShieldX },
  rejected: { label: 'Rejected', tone: 'deny', icon: ShieldX },
};

export function OutcomeChip({ kind, label }: { kind: string; label?: string }) {
  const o = outcomes[kind] ?? { label: kind, tone: 'neutral' as Tone, icon: CircleHelp };
  return (
    <Chip tone={o.tone} icon={o.icon}>
      {label ?? o.label}
    </Chip>
  );
}

const risks: Record<Risk, { label: string; tone: Tone; icon: LucideIcon }> = {
  low: { label: 'Low risk', tone: 'allow', icon: SignalLow },
  medium: { label: 'Medium risk', tone: 'review', icon: SignalMedium },
  high: { label: 'High risk', tone: 'deny', icon: SignalHigh },
};

export const RiskChip = ({ risk }: { risk: Risk }) => (
  <Chip tone={risks[risk].tone} icon={risks[risk].icon}>
    {risks[risk].label}
  </Chip>
);

export const AgentStatusChip = ({ status }: { status: 'active' | 'suspended' }) =>
  status === 'active' ? (
    <Chip tone="allow" icon={CheckCircle2}>
      Active
    </Chip>
  ) : (
    <Chip tone="deny" icon={Ban}>
      Suspended
    </Chip>
  );

/* NEAR reference: honest about whether a transaction really exists on a network. */
export function NearRef({
  tx,
  status,
  mode,
  chain,
  full,
}: {
  tx: string | null;
  status: ChainStatus;
  mode: 'testnet' | 'simulated' | null;
  chain?: Pick<ChainInfo, 'explorerBase'> | null;
  full?: boolean;
}) {
  if (status === 'pending') return <Chip tone="neutral">Writing to NEAR…</Chip>;
  if (status === 'failed')
    return (
      <Chip tone="deny" icon={Ban}>
        Write failed
      </Chip>
    );
  const text = tx ? (full ? tx : `${tx.slice(0, 10)}…${tx.slice(-4)}`) : '';
  if (mode === 'testnet' && tx) {
    const base = chain?.explorerBase ?? 'https://testnet.nearblocks.io';
    return (
      <a
        href={`${base}/txns/${tx}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg font-mono text-[0.8125rem] text-brand underline-offset-4 hover:underline"
      >
        {text}
        <ExternalLink aria-hidden className="size-3.5" />
        <span className="sr-only">(opens NEAR explorer in a new tab)</span>
      </a>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-mono text-[0.8125rem] text-muted">{text}</span>
      <Chip tone="neutral" icon={FlaskConical}>
        Simulated
      </Chip>
    </span>
  );
}

/* Action icons share one outline set (lucide, 2px stroke). */
const actionIcons: Record<string, LucideIcon> = {
  read_project_data: Eye,
  create_project_tasks: ListPlus,
  export_workspace_data: Download,
  delete_project_records: Trash2,
  send_external_messages: Send,
};
export const actionIcon = (id: string): LucideIcon => actionIcons[id] ?? CircleHelp;

export const ACTION_LABELS: Record<string, string> = {
  read_project_data: 'Read project data',
  create_project_tasks: 'Create project tasks',
  export_workspace_data: 'Export workspace data',
  delete_project_records: 'Delete project records',
  send_external_messages: 'Send external messages',
};
export const actionLabel = (id: string) => ACTION_LABELS[id] ?? id;

export function ActionBadge({ action, className }: { action: string; className?: string }) {
  const Icon = actionIcon(action);
  return (
    <span className={cn('inline-flex items-center gap-2.5 font-medium', className)}>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-brand">
        <Icon aria-hidden className="size-4" />
      </span>
      {actionLabel(action)}
    </span>
  );
}

/* Agent glyph: deterministic hue from the name, kept inside the brand's blue range. */
export function AgentGlyph({ name, size = 'md', dim }: { name: string; size?: 'sm' | 'md' | 'lg'; dim?: boolean }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  const hue = 190 + (h % 70);
  const dims = { sm: 'size-8 text-sm rounded-lg', md: 'size-11 text-lg rounded-xl', lg: 'size-14 text-2xl rounded-2xl' }[size];
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center font-display font-bold text-white', dims, dim && 'opacity-50 grayscale')}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 85% 38%), hsl(${hue + 25} 80% 28%))` }}
    >
      {name.slice(0, 1).toUpperCase() || <Bot className="size-1/2" />}
    </span>
  );
}
