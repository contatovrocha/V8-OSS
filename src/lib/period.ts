import { addDays, daysBetween, todayISO } from './format'

export type PeriodPreset = 'hoje' | '7d' | '30d' | 'mes_atual' | 'mes_anterior' | 'tudo' | 'custom'

export interface Period {
  preset: PeriodPreset
  from: string
  to: string
}

export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  hoje: 'Hoje',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  mes_atual: 'Mês atual',
  mes_anterior: 'Mês anterior',
  tudo: 'Todo o período',
  custom: 'Personalizado',
}

export function resolvePeriod(preset: PeriodPreset, custom?: { from: string; to: string }): Period {
  const today = todayISO()
  switch (preset) {
    case 'hoje':
      return { preset, from: today, to: today }
    case '7d':
      return { preset, from: addDays(today, -6), to: today }
    case '30d':
      return { preset, from: addDays(today, -29), to: today }
    case 'mes_atual':
      return { preset, from: today.slice(0, 8) + '01', to: today }
    case 'mes_anterior': {
      const firstThis = today.slice(0, 8) + '01'
      const lastPrev = addDays(firstThis, -1)
      return { preset, from: lastPrev.slice(0, 8) + '01', to: lastPrev }
    }
    case 'tudo':
      return { preset, from: '2000-01-01', to: '2100-12-31' }
    case 'custom':
      return { preset, from: custom?.from ?? addDays(today, -29), to: custom?.to ?? today }
  }
}

/** Período imediatamente anterior, com a mesma duração. Nulo para "todo o período". */
export function previousPeriod(p: Period): Period | null {
  if (p.preset === 'tudo') return null
  const len = daysBetween(p.from, p.to) + 1
  return { preset: 'custom', from: addDays(p.from, -len), to: addDays(p.from, -1) }
}

export function inPeriod(dateISO: string | null | undefined, p: Period): boolean {
  if (!dateISO) return false
  const d = dateISO.slice(0, 10)
  return d >= p.from && d <= p.to
}

export function daysOf(p: Period): string[] {
  const out: string[] = []
  const end = p.preset === 'tudo' ? todayISO() : p.to
  let d = p.preset === 'tudo' ? addDays(end, -59) : p.from
  while (d <= end && out.length < 400) {
    out.push(d)
    d = addDays(d, 1)
  }
  return out
}
