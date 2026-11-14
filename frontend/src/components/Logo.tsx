import { cn } from '@/lib/utils';

export function ShieldMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8', className)}>
      {/* Solid fill on purpose: a shared gradient id breaks when the first copy of the logo is display:none. */}
      <path d="M16 2.5 4.5 6.9v8.4c0 7.2 4.8 12.2 11.5 14.2 6.7-2 11.5-7 11.5-14.2V6.9z" fill="var(--brand)" />
      <path
        d="m10.8 16.2 3.7 3.7 6.9-7.6"
        fill="none"
        stroke="var(--brand-ink)"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <ShieldMark />
      <span className="font-display text-lg font-bold tracking-[0.14em]">AGENTGUARD</span>
    </span>
  );
}
