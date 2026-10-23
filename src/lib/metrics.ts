import type { Ad, AdMetricDaily } from '@/data/types'

/** Divisão segura: denominador zero ou ausente → null (exibido como "—"). */
export function safeDiv(n: number, d: number): number | null {
  if (!d || !Number.isFinite(d) || !Number.isFinite(n)) return null
  return n / d
}

export interface TrafficTotals {
  spend: number
  impressions: number
  reach: number
  link_clicks: number
  leads: number
  purchases: number
  purchase_value: number
  rows: number
}

export interface TrafficKpis extends TrafficTotals {
  ctr: number | null
  cpc: number | null
  cpm: number | null
  cpl: number | null
  cpa: number | null
  roas: number | null
}

export const emptyTotals = (): TrafficTotals => ({ spend: 0, impressions: 0, reach: 0, link_clicks: 0, leads: 0, purchases: 0, purchase_value: 0, rows: 0 })

/**
 * Soma apenas métricas no nível de ANÚNCIO (ad_metrics_daily). Totais de campanha e conjunto
 * são derivados dessa soma, nunca somados de forma independente — evita dupla contagem.
 * O alcance diário não é aditivo; a soma é uma aproximação e é rotulada como tal na interface.
 */
export function sumMetrics(rows: AdMetricDaily[]): TrafficTotals {
  const t = emptyTotals()
  for (const r of rows) {
    t.spend += r.spend
    t.impressions += r.impressions
    t.reach += r.reach
    t.link_clicks += r.link_clicks
    t.leads += r.leads
    t.purchases += r.purchases
    t.purchase_value += r.purchase_value
    t.rows++
  }
  t.spend = Math.round(t.spend * 100) / 100
  return t
}

export function kpis(t: TrafficTotals): TrafficKpis {
  const ctr = safeDiv(t.link_clicks, t.impressions)
  const cpm = safeDiv(t.spend, t.impressions)
  return {
    ...t,
    ctr: ctr === null ? null : ctr * 100, // CTR de link = cliques no link / impressões × 100
    cpc: safeDiv(t.spend, t.link_clicks), // CPC de link = investimento / cliques no link
    cpm: cpm === null ? null : cpm * 1000,
    cpl: safeDiv(t.spend, t.leads), // CPL = investimento / leads
    cpa: safeDiv(t.spend, t.purchases), // custo por compra = investimento / compras
    roas: t.purchase_value > 0 ? safeDiv(t.purchase_value, t.spend) : null, // ROAS = receita atribuída / investimento
  }
}

export interface AdPerformance extends TrafficKpis {
  ad: Ad
}

export type AdSortKey = 'leads' | 'cpl' | 'ctr' | 'clicks' | 'cpc' | 'spend' | 'purchases' | 'roas'

export const AD_SORT_LABEL: Record<AdSortKey, string> = {
  leads: 'Mais leads',
  cpl: 'Menor custo por lead',
  ctr: 'Maior CTR',
  clicks: 'Mais cliques',
  cpc: 'Menor CPC',
  spend: 'Maior investimento',
  purchases: 'Mais compras',
  roas: 'Maior ROAS',
}

/** Ordena anúncios pela métrica escolhida. Valores indisponíveis ("—") vão sempre para o fim. */
export function sortAds(list: AdPerformance[], key: AdSortKey): AdPerformance[] {
  const pick = (a: AdPerformance): number | null => {
    switch (key) {
      case 'leads': return a.leads
      case 'cpl': return a.cpl
      case 'ctr': return a.ctr
      case 'clicks': return a.link_clicks
      case 'cpc': return a.cpc
      case 'spend': return a.spend
      case 'purchases': return a.purchases
      case 'roas': return a.roas
    }
  }
  const asc = key === 'cpl' || key === 'cpc'
  return [...list].sort((x, y) => {
    const a = pick(x)
    const b = pick(y)
    if (a === null && b === null) return x.ad.name.localeCompare(y.ad.name)
    if (a === null) return 1
    if (b === null) return -1
    if (a === b) return x.ad.name.localeCompare(y.ad.name)
    return asc ? a - b : b - a
  })
}

/** Variação percentual em relação ao período anterior; null se não houver base. */
export function delta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}
