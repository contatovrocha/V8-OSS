import clsx from 'clsx'
import { Loader2, type LucideIcon } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean; icon?: LucideIcon }>(
  function Button({ variant = 'secondary', size = 'md', loading, icon: Icon, className, children, disabled, ...rest }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition select-none whitespace-nowrap',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed',
          size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
          variant === 'primary' && 'bg-primary text-white hover:brightness-110 shadow-[0_6px_20px_-8px_var(--brand-primary)]',
          variant === 'secondary' && 'bg-surface-3 text-ink border border-line-strong hover:bg-line',
          variant === 'ghost' && 'text-muted hover:text-ink hover:bg-surface-3',
          variant === 'danger' && 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25',
          variant === 'success' && 'bg-success/15 text-success border border-success/30 hover:bg-success/25',
          className,
        )}
        {...rest}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
        {children}
      </button>
    )
  },
)

export function IconButton({ icon: Icon, label, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <button aria-label={label} title={label} className={clsx('inline-grid place-items-center size-8 rounded-full text-muted hover:text-ink hover:bg-surface-3 transition disabled:opacity-40', className)} {...rest}>
      <Icon className="size-4" />
    </button>
  )
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('card', className)} {...rest}>
      {children}
    </div>
  )
}

export function SectionTitle({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export type Tone = 'neutral' | 'primary' | 'success' | 'accent' | 'danger' | 'warning'

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        tone === 'neutral' && 'border-line-strong text-muted bg-surface-3/60',
        tone === 'primary' && 'border-primary/30 text-primary bg-primary/10',
        tone === 'success' && 'border-success/30 text-success bg-success/10',
        tone === 'accent' && 'border-accent/30 text-accent bg-accent/10',
        tone === 'danger' && 'border-danger/30 text-danger bg-danger/10',
        tone === 'warning' && 'border-warning/30 text-warning bg-warning/10',
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

const fieldCls = 'w-full rounded-xl bg-bg/60 border border-line-strong px-3 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition disabled:opacity-60'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} className={clsx(fieldCls, 'h-10', invalid && 'border-danger', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, ...rest }, ref) {
  return <textarea ref={ref} className={clsx(fieldCls, 'py-2 min-h-24', invalid && 'border-danger', className)} {...rest} />
})

export function Select({ className, invalid, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={clsx(fieldCls, 'h-10 pr-8 appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 fill=%27none%27 stroke=%27%238b97b1%27 stroke-width=%272%27%3E%3Cpath d=%27M2 4l4 4 4-4%27/%3E%3C/svg%3E")] bg-no-repeat bg-[right_12px_center]', invalid && 'border-danger', className)} {...rest}>
      {children}
    </select>
  )
}

export function Field({ label, error, hint, children, className, required }: { label: ReactNode; error?: string | null; hint?: ReactNode; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={clsx('block', className)}>
      <span className="block text-xs font-semibold text-muted mb-1.5">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </span>
      {children}
      {error ? <span className="block text-xs text-danger mt-1">{error}</span> : hint ? <span className="block text-xs text-faint mt-1">{hint}</span> : null}
    </label>
  )
}

export function Checkbox({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className={clsx('inline-flex items-center gap-2 text-sm cursor-pointer select-none', disabled && 'opacity-50 cursor-not-allowed')}>
      <input type="checkbox" className="size-4 accent-[var(--brand-primary)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin text-primary', className ?? 'size-5')} />
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('relative overflow-hidden rounded-xl bg-surface-3/70', className)}><div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_1.4s_infinite]" /></div>
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6">
      <div className="size-12 rounded-2xl bg-surface-3 grid place-items-center mb-4 border border-line">
        <Icon className="size-5 text-muted" />
      </div>
      <h3 className="font-bold">{title}</h3>
      {description && <p className="text-sm text-muted mt-1 max-w-md">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4 text-sm flex flex-wrap items-center gap-3 justify-between">
      <span className="text-danger">Não foi possível carregar os dados: {message}</span>
      {onRetry && <Button size="sm" onClick={onRetry}>Tentar novamente</Button>}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: LucideIcon }[]; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-full bg-surface-2 border border-line p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-full font-semibold transition',
            size === 'sm' ? 'px-2.5 h-7 text-xs' : 'px-3.5 h-8 text-sm',
            value === o.value ? 'bg-primary text-white shadow' : 'text-muted hover:text-ink',
          )}
        >
          {o.icon && <o.icon className="size-3.5" />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line -mx-1 px-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={clsx('px-3 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition', value === t.value ? 'border-primary text-ink' : 'border-transparent text-muted hover:text-ink')}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 text-xs text-faint">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Progress({ value, tone = 'primary', className }: { value: number | null; tone?: 'primary' | 'success' | 'accent' | 'danger'; className?: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div className={clsx('h-2 rounded-full bg-surface-3 overflow-hidden', className)}>
      <div
        className={clsx('h-full rounded-full transition-[width] duration-700 ease-out', tone === 'primary' && 'bg-primary', tone === 'success' && 'bg-success', tone === 'accent' && 'bg-accent', tone === 'danger' && 'bg-danger')}
        style={{ width: `${v}%` }}
      />
    </div>
  )
}

export function Avatar({ src, name, size = 40, className }: { src?: string | null; name: string; size?: number; className?: string }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase()
  return src ? (
    <img src={src} alt={name} className={clsx('rounded-full object-cover bg-surface-3', className)} style={{ width: size, height: size }} />
  ) : (
    <div className={clsx('rounded-full bg-primary/20 text-primary grid place-items-center font-bold', className)} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials || '?'}
    </div>
  )
}
