import { Ban, Bot, CheckCircle2, Hourglass, Power, ShieldCheck, ShieldX, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import type { EventItem } from '@/lib/api';
import { useTick } from '@/lib/hooks';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { RiskChip, type Tone } from './badges';

const kinds: Record<string, { icon: LucideIcon; tone: Tone; label: string }> = {
  'request.allowed': { icon: CheckCircle2, tone: 'allow', label: 'Allowed' },
  'request.pending': { icon: Hourglass, tone: 'review', label: 'Approval required' },
  'request.denied': { icon: Ban, tone: 'deny', label: 'Blocked' },
  'request.approved': { icon: ShieldCheck, tone: 'allow', label: 'Approved' },
  'request.rejected': { icon: ShieldX, tone: 'deny', label: 'Rejected' },
  'policy.updated': { icon: SlidersHorizontal, tone: 'brand', label: 'Policy' },
  'agent.registered': { icon: Bot, tone: 'brand', label: 'Agent' },
  'agent.status': { icon: Power, tone: 'neutral', label: 'Agent' },
};

const bubble: Record<Tone, string> = {
  allow: 'bg-allow-soft text-allow',
  review: 'bg-review-soft text-review',
  deny: 'bg-deny-soft text-deny',
  brand: 'bg-brand-soft text-brand',
  neutral: 'bg-surface-2 text-muted',
};

export function ActivityFeed({ events, limit = 10 }: { events: EventItem[]; limit?: number }) {
  const now = useTick();
  const items = events.filter((e) => e.id !== 0).slice(0, limit);

  if (!items.length) return <p className="py-8 text-center text-sm text-muted">No activity yet. Send a request from the simulator.</p>;

  return (
    <ol aria-label="Recent security activity" className="divide-y divide-line">
      {items.map((e, i) => {
        const k = kinds[e.kind] ?? kinds['agent.status'];
        const Icon = k.icon;
        return (
          <li key={e.id} className="animate-rise flex items-start gap-3 py-3.5" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
            <span className={cn('mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl', bubble[k.tone])}>
              <Icon aria-hidden className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug">
                <span className="sr-only">{k.label}: </span>
                {e.message}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <time dateTime={e.ts}>{timeAgo(e.ts, now)}</time>
                {e.risk && <RiskChip risk={e.risk} />}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
