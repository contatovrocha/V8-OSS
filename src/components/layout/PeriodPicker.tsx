import clsx from 'clsx'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { date } from '@/lib/format'
import { PERIOD_LABEL, type Period, type PeriodPreset } from '@/lib/period'
import { Button, Input } from '../ui/primitives'

const PRESETS: PeriodPreset[] = ['hoje', '7d', '30d', 'mes_atual', 'mes_anterior', 'tudo']

export function PeriodPicker({ period, onChange, align = 'right' }: { period: Period; onChange: (p: PeriodPreset, custom?: { from: string; to: string }) => void; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(period.from)
  const [to, setTo] = useState(period.to)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  useEffect(() => {
    setFrom(period.from)
    setTo(period.to)
  }, [period])
  const label = period.preset === 'custom' ? `${date(period.from)} – ${date(period.to)}` : PERIOD_LABEL[period.preset]
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-2 h-9 rounded-full bg-surface-2 border border-line px-3.5 text-sm font-semibold hover:border-line-strong">
        <CalendarDays className="size-4 text-primary" />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown className="size-3.5 text-muted" />
      </button>
      {open && (
        <div className={clsx('absolute z-40 mt-2 w-72 card !bg-surface-2 p-3 animate-fade-up', align === 'right' ? 'right-0' : 'left-0')}>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => { onChange(p); setOpen(false) }}
                className={clsx('rounded-lg px-2.5 py-2 text-xs font-semibold text-left', period.preset === p ? 'bg-primary text-white' : 'bg-surface-3/60 hover:bg-surface-3 text-ink')}
              >
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
          <div className="border-t border-line mt-3 pt-3">
            <p className="text-xs font-semibold text-muted mb-2">Personalizado</p>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="Data inicial" />
              <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="Data final" />
            </div>
            <Button size="sm" variant="primary" className="w-full mt-2" disabled={!from || !to || from > to} onClick={() => { onChange('custom', { from, to }); setOpen(false) }}>
              Aplicar período
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
