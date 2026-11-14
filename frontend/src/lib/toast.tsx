import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from './utils';

type Tone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: Tone;
}

const Ctx = createContext<(t: Omit<ToastItem, 'id' | 'tone'> & { tone?: Tone }) => void>(() => {});

const toneStyle: Record<Tone, { icon: typeof Info; cls: string }> = {
  success: { icon: CheckCircle2, cls: 'text-allow' },
  error: { icon: AlertTriangle, cls: 'text-deny' },
  info: { icon: Info, cls: 'text-brand' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (t: Omit<ToastItem, 'id' | 'tone'> & { tone?: Tone }) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-3), { id, tone: t.tone ?? 'success', title: t.title, description: t.description }]);
      window.setTimeout(() => dismiss(id), t.tone === 'error' ? 6000 : 4000);
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* aria-live region: announces toasts without stealing focus */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:px-6"
      >
        {items.map((t) => {
          const { icon: Icon, cls } = toneStyle[t.tone];
          return (
            <div
              key={t.id}
              className="animate-rise pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line-strong bg-surface p-3.5 pr-2 shadow-card"
            >
              <Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', cls)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.description && <p className="mt-0.5 text-sm text-muted">{t.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
