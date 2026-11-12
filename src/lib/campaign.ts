import type { CreativeContent, CreativeFormat, CreativeLayout, EventFormat, ProjectUpdate } from '@/data/types'

// Textos de campanha gerados por fórmulas (sem IA): a pessoa escolhe e edita.

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s)
const upperFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const clean = (s: string) => s.trim().replace(/[.!\s]+$/, '')

/** "13 de novembro · 19h" */
export function dateLabel(date: string | null, time = ''): string {
  if (!date) return ''
  const [, m, d] = date.split('-').map(Number)
  return `${d} de ${MONTHS[m - 1]}${time.trim() ? ` · ${time.trim()}` : ''}`
}

export const formatLabel = (f: EventFormat) => (f === 'online' ? 'Online e ao vivo' : 'Presencial')

export function locationLabel(u: Pick<ProjectUpdate, 'format' | 'city' | 'venue' | 'platform'>): string {
  if (u.format === 'online') return u.platform.trim() || 'Transmissão ao vivo'
  return [u.venue.trim(), u.city.trim()].filter(Boolean).join(' · ')
}

export const money0 = (v: number | null | undefined) =>
  v === null || v === undefined ? '' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })

/** Três opções de headline + subheadline a partir da promessa (fórmulas fixas). */
export function headlineOptions(input: { promise: string; expert: string; format: EventFormat; date: string; city: string }) {
  const p = clean(input.promise)
  if (!p) return []
  const where = input.format === 'online' ? 'ao vivo e online' : `presencialmente${input.city ? ` em ${input.city}` : ''}`
  const when = input.date ? ` · ${input.date}` : ''
  return [
    { headline: `${upperFirst(p)}.`, subheadline: `Um encontro ${input.format === 'online' ? 'online' : 'presencial'} com ${input.expert}${input.date ? `, em ${input.date}` : ''}. Vagas limitadas.` },
    { headline: `Descubra como ${lowerFirst(p)}.`, subheadline: `${input.expert} mostra, ${where}, o caminho passo a passo para chegar lá.` },
    { headline: `${input.expert}: ${lowerFirst(p)}.`, subheadline: `${formatLabel(input.format)}${input.city && input.format === 'presencial' ? ` · ${input.city}` : ''}${when}. Garanta a sua vaga antes que esgote.` },
  ]
}

export const LAYOUTS: { value: CreativeLayout; label: string; hint: string }[] = [
  { value: 'destaque', label: 'Destaque', hint: 'Foto grande do expert com a headline por cima' },
  { value: 'dividido', label: 'Dividido', hint: 'Texto de um lado, foto do outro' },
  { value: 'convite', label: 'Convite', hint: 'Cartão de convite com a data em destaque' },
  { value: 'grupo', label: 'Grupo', hint: 'Vários experts lado a lado' },
]

export const FORMATS: { value: CreativeFormat; label: string; w: number; h: number }[] = [
  { value: 'feed', label: 'Feed 4:5', w: 1080, h: 1350 },
  { value: 'stories', label: 'Stories 9:16', w: 1080, h: 1920 },
]

export const sizeOf = (f: CreativeFormat) => FORMATS.find((x) => x.value === f)!

/** Ângulos de comunicação: muda a chamada (kicker) de cada criativo. */
export function angles(expert: string, date: string) {
  return [
    { key: 'convite', label: 'Convite', kicker: 'Você está convidado' },
    { key: 'urgencia', label: 'Urgência', kicker: 'Últimas vagas' },
    { key: 'exclusividade', label: 'Exclusividade', kicker: 'Vagas limitadas' },
    { key: 'autoridade', label: 'Autoridade', kicker: `Com ${expert}` },
    ...(date ? [{ key: 'data', label: 'Data', kicker: date }] : []),
  ]
}

export function contentFrom(u: ProjectUpdate, kicker: string, showPrice: boolean, personIds: string[]): CreativeContent {
  return {
    kicker,
    headline: u.headline,
    subheadline: u.subheadline,
    show_price: showPrice && u.with_price && u.price !== null,
    price: u.price,
    full_price: u.full_price,
    date_label: dateLabel(u.event_date, u.event_time),
    format_label: formatLabel(u.format),
    location_label: locationLabel(u),
    cta: u.cta_label || 'Garanta a sua vaga',
    person_ids: personIds,
  }
}

export function slugify(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'evento'
}

/** Endereço público da página do evento (rota pública do V8 OS). */
export const eventUrl = (slug: string) => `${window.location.origin}${window.location.pathname}#/e/${slug}`

/** Endereço público da galeria de criativos aprovados do projeto. */
export const creativesUrl = (token: string) => `${window.location.origin}${window.location.pathname}#/compartilhado/p/${token}`
