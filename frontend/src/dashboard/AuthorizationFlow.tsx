import { ArrowDown, ArrowRight, Ban, Blocks, Bot, CheckCircle2, DoorOpen, Hourglass, ScanSearch, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

function Step({ icon: Icon, title, text, className }: { icon: LucideIcon; title: string; text: string; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-1 items-start gap-3 rounded-2xl border border-line-strong bg-surface-2 p-4 md:flex-col', className)}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
        <Icon aria-hidden className="size-5" />
      </span>
      <div>
        <p className="font-display font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-muted">{text}</p>
      </div>
    </div>
  );
}

const Link = () => (
  <>
    <ArrowRight aria-hidden className="hidden size-5 shrink-0 self-center text-subtle md:block" />
    <ArrowDown aria-hidden className="size-5 shrink-0 self-center text-subtle md:hidden" />
  </>
);

function Branch({
  icon: Icon,
  label,
  text,
  count,
  caption,
  cls,
}: {
  icon: LucideIcon;
  label: string;
  text: string;
  count: number;
  caption: string;
  cls: string;
}) {
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl border p-3.5', cls)}>
      <Icon aria-hidden className="size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold uppercase tracking-wider">{label}</p>
        <p className="text-sm text-foreground/80">{text}</p>
      </div>
      <div className="text-right">
        <p className="font-display text-2xl font-bold leading-none tabular-nums">{count}</p>
        <p className="mt-1 text-xs text-muted">{caption}</p>
      </div>
    </div>
  );
}

export function AuthorizationFlow({
  allowed,
  pending,
  blocked,
  receipts,
}: {
  allowed: number;
  pending: number;
  blocked: number;
  receipts: number;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
      <Step icon={Bot} title="AI agent" text="Requests an action" />
      <Link />
      <Step icon={DoorOpen} title="Gateway" text="Receives and validates the request" />
      <Link />
      <Step icon={ScanSearch} title="Policy engine" text="Checks permissions, scope and risk rules" />
      <Link />
      <div className="flex min-w-0 flex-[1.4] flex-col gap-2">
        <Branch icon={CheckCircle2} label="Allow" text="Execute action" count={allowed} caption="executed" cls="border-allow/40 bg-allow-soft text-allow" />
        <Branch icon={Hourglass} label="Review" text="Await approval" count={pending} caption="waiting" cls="border-review/40 bg-review-soft text-review" />
        <Branch icon={Ban} label="Deny" text="Reject action" count={blocked} caption="blocked" cls="border-deny/40 bg-deny-soft text-deny" />
      </div>
      <Link />
      <Step icon={Blocks} title="NEAR" text={`${receipts} decision hashes recorded`} />
    </div>
  );
}
