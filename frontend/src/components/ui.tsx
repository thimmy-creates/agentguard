import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, Check, ChevronDown, Copy, Loader2, X } from 'lucide-react';
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { useCopy } from '@/lib/hooks';
import { cn } from '@/lib/utils';

/* ---------------------------------- Button --------------------------------- */

const variants = {
  primary: 'bg-brand text-brand-ink hover:brightness-110',
  secondary: 'border border-line-strong bg-surface-2 text-foreground hover:border-brand/60',
  ghost: 'text-muted hover:bg-surface-2 hover:text-foreground',
  danger: 'border border-deny/50 bg-deny-soft text-deny hover:bg-deny/20',
  success: 'bg-allow text-allow-ink hover:brightness-110',
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: 'md' | 'sm';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-[filter,background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        size === 'md' ? 'min-h-11 px-4 text-sm' : 'min-h-11 px-3 text-sm md:min-h-9',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 aria-hidden className="size-4 animate-[spin_0.8s_linear_infinite]" />}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'grid size-11 shrink-0 place-items-center rounded-xl text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-foreground',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const { copied, copy } = useCopy();
  const done = copied === value;
  return (
    <IconButton label={done ? 'Copied' : label} onClick={() => copy(value)} className="size-9 rounded-lg">
      {done ? <Check aria-hidden className="size-4 text-allow" /> : <Copy aria-hidden className="size-4" />}
    </IconButton>
  );
}

/* ----------------------------------- Card ---------------------------------- */

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-line bg-surface shadow-card', className)} {...rest} />;
}

export function SectionTitle({
  title,
  description,
  action,
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div className="min-w-0 max-w-2xl">
        {eyebrow}
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-base text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/* ---------------------------------- Forms ---------------------------------- */

const control =
  'w-full min-h-11 rounded-xl border border-line-strong bg-surface-2 px-3.5 text-base text-foreground placeholder:text-subtle transition-colors duration-150 hover:border-brand/50 focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50 aria-[invalid=true]:border-deny';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(control, className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cn(control, 'min-h-24 py-2.5', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, 'appearance-none pr-10', className)} {...rest}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
});

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: (p: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
}) {
  const id = useId();
  const descId = `${id}-d`;
  const has = Boolean(error || hint);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-deny">
            *
          </span>
        )}
      </label>
      {children({ id, 'aria-describedby': has ? descId : undefined, 'aria-invalid': error ? true : undefined })}
      {has && (
        <p id={descId} role={error ? 'alert' : undefined} className={cn('text-sm', error ? 'text-deny' : 'text-muted')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/* ---------------------------------- Modal ---------------------------------- */

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: 'md' | 'lg';
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-overlay fixed inset-0 z-50 bg-[var(--scrim)]" />
        <Dialog.Content
          className={cn(
            'animate-dialog fixed z-50 flex max-h-[92dvh] flex-col border border-line-strong bg-surface shadow-card outline-none',
            'inset-x-0 bottom-0 rounded-t-3xl pb-[env(safe-area-inset-bottom)]',
            'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:pb-0',
            size === 'md' ? 'sm:max-w-lg' : 'sm:max-w-2xl',
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-xl font-semibold tracking-tight">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close dialog" className="-mr-2 -mt-1">
                <X aria-hidden className="size-5" />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ------------------------------ States & misc ------------------------------ */

export const Skeleton = ({ className }: { className?: string }) => (
  <div aria-hidden className={cn('skeleton rounded-xl', className)} />
);

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Check;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Icon aria-hidden className="size-6" />
      </span>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-deny/40 bg-deny-soft p-4">
      <AlertTriangle aria-hidden className="size-5 shrink-0 text-deny" />
      <p className="min-w-0 flex-1 text-sm">{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export const Mono = ({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn('font-mono text-[0.8125rem] tracking-tight', className)} {...rest} />
);
