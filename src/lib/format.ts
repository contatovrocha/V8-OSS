let tz = 'America/Sao_Paulo'

export function setTimezone(zone: string) {
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: zone })
    tz = zone
  } catch {
    tz = 'America/Sao_Paulo'
  }
}

export const getTimezone = () => tz

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const int = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

export const EMPTY = '—'

const ok = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)

export function money(v: number | null | undefined): string {
  return ok(v) ? brl.format(v) : EMPTY
}

export function moneyShort(v: number | null | undefined): string {
  if (!ok(v)) return EMPTY
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (Math.abs(v) >= 10_000) return `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return brl.format(v)
}

export function num(v: number | null | undefined): string {
  return ok(v) ? int.format(v) : EMPTY
}

export function pct(v: number | null | undefined, digits = 1): string {
  if (!ok(v)) return EMPTY
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: digits })}%`
}

export function ratio(v: number | null | undefined, digits = 2): string {
  if (!ok(v)) return EMPTY
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}x`
}

/** Data ISO (YYYY-MM-DD) ou timestamp → DD/MM/AAAA */
export function date(v: string | null | undefined): string {
  if (!v) return EMPTY
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-')
    return `${d}/${m}/${y}`
  }
  const dt = new Date(v)
  if (Number.isNaN(dt.getTime())) return EMPTY
  return new Intl.DateTimeFormat('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' }).format(dt)
}

export function dateTime(v: string | null | undefined): string {
  if (!v) return EMPTY
  const dt = new Date(v)
  if (Number.isNaN(dt.getTime())) return EMPTY
  return new Intl.DateTimeFormat('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(dt)
}

export function shortDate(v: string): string {
  const [, m, d] = v.split('-')
  return `${d}/${m}`
}

export function relative(v: string | null | undefined): string {
  if (!v) return EMPTY
  const diff = Date.now() - new Date(v).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  if (d < 30) return `há ${d} dia${d > 1 ? 's' : ''}`
  return date(v)
}

/** Data de hoje (YYYY-MM-DD) no fuso configurado. */
export function todayISO(): string {
  return toISODate(new Date())
}

export function toISODate(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  return parts
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string): number {
  const pa = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))
  const pb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))
  return Math.round((pb - pa) / 86400000)
}

export function parseMoney(s: string): number | null {
  const clean = s.replace(/[R$\s]/g, '')
  if (!clean) return null
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}
