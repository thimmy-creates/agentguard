import {
  Bot,
  ClipboardCheck,
  FlaskConical,
  LayoutDashboard,
  Link2,
  Moon,
  ScrollText,
  SlidersHorizontal,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import type { ChainInfo } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useLiveStatus } from '@/lib/live';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { IconButton } from './ui';

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: boolean }[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/policies', label: 'Policies', icon: SlidersHorizontal },
  { to: '/approvals', label: 'Approvals', icon: ClipboardCheck, badge: true },
  { to: '/audit', label: 'Audit', icon: ScrollText },
];

function PendingBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="grid min-w-5 place-items-center rounded-full bg-review px-1.5 text-xs font-bold leading-5 text-background tabular-nums">
      {count > 99 ? '99+' : count}
      <span className="sr-only"> pending</span>
    </span>
  );
}

function LiveDot() {
  const { connected } = useLiveStatus();
  return (
    <span
      role="status"
      className="hidden items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted sm:inline-flex"
    >
      <span className="relative grid size-2 place-items-center">
        {connected && <span className="absolute size-2 animate-[pulse-ring_1.8s_ease-out_infinite] rounded-full bg-allow" />}
        <span className={cn('size-2 rounded-full', connected ? 'bg-allow' : 'bg-review')} />
      </span>
      {connected ? 'Live' : 'Reconnecting'}
    </span>
  );
}

function ChainCard() {
  const { data } = useApi<ChainInfo>('/chain', { live: false });
  const live = data?.mode === 'testnet';
  return (
    <div className="rounded-2xl border border-line bg-surface-2/60 p-3.5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {live ? <Link2 aria-hidden className="size-4 text-allow" /> : <FlaskConical aria-hidden className="size-4 text-review" />}
        NEAR {live ? data?.network : 'simulated'}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        {data
          ? live
            ? `Hashes are written to ${data.contract}.`
            : 'Receipts are hashed and stored locally. Add NEAR credentials to anchor them on testnet.'
          : 'Checking chain connection…'}
      </p>
    </div>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
  const { pending } = useLiveStatus();
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);

  // Move focus to the page content after navigating, so keyboard and screen reader users land in the right place.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [pathname.split('/')[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app-bg min-h-dvh">
      <a
        href="#main"
        className="sr-only z-[200] rounded-lg bg-brand px-4 py-2 font-medium text-brand-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-background/70 px-4 py-6 backdrop-blur lg:flex">
        <Logo className="px-2" />
        <nav aria-label="Primary" className="mt-9 flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-150',
                  isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2 hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span aria-hidden className="absolute -left-4 h-6 w-1 rounded-r-full bg-brand" />}
                  <Icon aria-hidden className="size-5" />
                  <span className="flex-1">{label}</span>
                  {badge && <PendingBadge count={pending} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <ChainCard />
      </aside>

      <div className="lg:pl-64">
        <div className="sticky top-0 z-20 border-b border-line bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
            <Logo className="lg:hidden" />
            <span className="hidden lg:block" />
            <div className="flex items-center gap-2">
              <LiveDot />
              <IconButton label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggle}>
                {theme === 'dark' ? <Sun aria-hidden className="size-5" /> : <Moon aria-hidden className="size-5" />}
              </IconButton>
            </div>
          </div>
        </div>

        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl px-4 pb-32 pt-6 outline-none sm:px-6 lg:pb-14 lg:pt-10"
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation: five top-level destinations, icon + label */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {NAV.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors duration-150',
                isActive ? 'text-brand' : 'text-muted',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-brand" />}
                <span className="relative">
                  <Icon aria-hidden className="size-6" />
                  {badge && pending > 0 && (
                    <span className="absolute -right-3 -top-2">
                      <PendingBadge count={pending} />
                    </span>
                  )}
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
