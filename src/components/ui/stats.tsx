import clsx from 'clsx'
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { pct } from '@/lib/format'

/**
 * Card de indicador: título, valor, descrição e comparação com o período anterior.
 * `invert` indica métricas em que diminuir é bom (ex.: custo por lead).
 */
export function KpiTile({
  title, value, description, delta, invert, tone, icon: Icon, empty, onClick,
}: { title: string; value: ReactNode; description?: ReactNode; delta?: number | null; invert?: boolean; tone?: 'success' | 'danger' | 'accent' | 'primary'; icon?: LucideIcon; empty?: boolean; onClick?: () => void }) {
  const good = delta === null || delta === undefined ? null : invert ? delta < 0 : delta > 0
  return (
    <div
      onClick={onClick}
      className={clsx('card p-4 flex flex-col gap-1 min-w-0 animate-fade-up', onClick && 'cursor-pointer hover:border-line-strong transition')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted truncate">{title}</span>
        {Icon && <Icon className="size-4 text-faint shrink-0" />}
      </div>
      <div
        className={clsx(
          'text-lg sm:text-2xl font-extrabold tracking-tight tabular-nums truncate',
          empty && '!text-lg !font-semibold text-faint',
          !empty && tone === 'success' && 'text-success',
          !empty && tone === 'danger' && 'text-danger',
          !empty && tone === 'accent' && 'text-accent',
          !empty && tone === 'primary' && 'text-primary',
        )}
      >
        {value}
      </div>
      <div className="flex items-center gap-2 text-xs min-h-4">
        {delta !== null && delta !== undefined && Number.isFinite(delta) ? (
          <span className={clsx('inline-flex items-center gap-0.5 font-semibold', good ? 'text-success' : delta === 0 ? 'text-muted' : 'text-danger')}>
            {delta > 0 ? <ArrowUpRight className="size-3.5" /> : delta < 0 ? <ArrowDownRight className="size-3.5" /> : <Minus className="size-3.5" />}
            {pct(Math.abs(delta))}
          </span>
        ) : null}
        {description && <span className="text-faint truncate">{description}</span>}
      </div>
    </div>
  )
}

/**
 * Medidor semicircular de meta (referência visual: cockpit Falume).
 * `value` em %, `expected` marca o ritmo esperado até hoje.
 */
export function Gauge({ value, expected, label, display, sub, caption }: { value: number | null; expected?: number | null; label: string; display: ReactNode; sub?: ReactNode; caption?: ReactNode }) {
  const v = value === null ? 0 : Math.max(0, Math.min(100, value))
  const angle = (p: number) => Math.PI * (1 - p / 100)
  const R = 80
  const cx = 100
  const cy = 95
  const pt = (p: number, r = R) => [cx + r * Math.cos(angle(p)), cy - r * Math.sin(angle(p))]
  const arc = (from: number, to: number) => {
    const [x1, y1] = pt(from)
    const [x2, y2] = pt(to)
    return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`
  }
  const tone = value === null ? 'var(--color-faint)' : expected && v < expected * 0.6 ? 'var(--brand-danger)' : v >= 100 ? 'var(--brand-success)' : expected && v < expected ? 'var(--brand-accent)' : 'var(--brand-primary)'
  const [nx, ny] = pt(v, R - 18)
  return (
    <div className="flex flex-col items-center text-center min-w-0">
      <svg viewBox="0 0 200 110" className="w-full max-w-[200px]" role="img" aria-label={`${label}: ${value === null ? 'sem meta' : pct(value)}`}>
        <path d={arc(0, 100)} stroke="var(--color-surface-3)" strokeWidth="12" fill="none" strokeLinecap="round" />
        {Array.from({ length: 11 }, (_, i) => {
          const [a, b] = pt(i * 10, R - 14)
          const [c, d] = pt(i * 10, R - 9)
          return <line key={i} x1={a} y1={b} x2={c} y2={d} stroke="var(--color-line-strong)" strokeWidth="1.5" />
        })}
        {v > 0 && <path d={arc(0, Math.max(v, 1))} stroke={tone} strokeWidth="12" fill="none" strokeLinecap="round" style={{ transition: 'all .8s ease' }} />}
        {expected !== null && expected !== undefined && expected > 0 && expected <= 100 && (() => {
          const [a, b] = pt(expected, R - 10)
          const [c, d] = pt(expected, R + 12)
          return <line x1={a} y1={b} x2={c} y2={d} stroke="#fff" strokeWidth="3" strokeLinecap="round"><title>Ritmo esperado até hoje</title></line>
        })()}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e8edf7" strokeWidth="3" strokeLinecap="round" style={{ transition: 'all .8s ease' }} />
        <circle cx={cx} cy={cy} r="6" fill="#e8edf7" />
      </svg>
      <div className="text-sm sm:text-xl font-extrabold tabular-nums -mt-1 whitespace-nowrap">{display}</div>
      {sub && <div className="text-[10px] sm:text-xs font-semibold mt-0.5" style={{ color: tone }}>{sub}</div>}
      <div className="text-[10px] sm:text-[11px] tracking-wider uppercase text-muted mt-1">{label}</div>
      {caption && <div className="text-[11px] text-faint mt-0.5">{caption}</div>}
    </div>
  )
}

export function DemoBanner({ children }: { children: ReactNode }) {
  return <div className="inline-flex items-center gap-2 rounded-full border border-warning/25 bg-warning/5 text-warning/90 px-3 py-1 text-xs font-medium">{children}</div>
}
