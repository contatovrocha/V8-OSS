import { useMemo } from 'react'
import { useRows } from '@/data/store'
import { consolidate, type FinanceSummary } from '@/lib/finance'
import { kpis, sumMetrics, type AdPerformance } from '@/lib/metrics'
import { inPeriod, type Period } from '@/lib/period'
import { useApp } from './AppContext'

/** Dados financeiros consolidados para um período e conjunto de projetos (mesma regra em todos os módulos). */
export function useFinance(period: Period, projectIds: Set<string> | null) {
  const sales = useRows('sales')
  const expenses = useRows('expenses')
  const metrics = useRows('ad_metrics_daily')
  const ads = useRows('ads')
  const accounts = useRows('ad_accounts')
  const categories = useRows('expense_categories')
  const summary: FinanceSummary = useMemo(
    () => consolidate({ sales: sales.rows, expenses: expenses.rows, metrics: metrics.rows, ads: ads.rows, accounts: accounts.rows, categories: categories.rows, projectIds, period }),
    [sales.rows, expenses.rows, metrics.rows, ads.rows, accounts.rows, categories.rows, projectIds, period],
  )
  return {
    summary,
    loading: sales.loading || expenses.loading || metrics.loading || ads.loading,
    error: sales.error || expenses.error || metrics.error,
    sales: sales.rows,
    expenses: expenses.rows,
    metrics: metrics.rows,
    ads: ads.rows,
    categories: categories.rows,
  }
}

export interface AdFilters {
  accountId?: string | 'all'
  campaignId?: string | 'all'
  adSetId?: string | 'all'
  status?: string | 'all'
  objective?: string | 'all'
  adId?: string | 'all'
}

/** Desempenho por anúncio no período, já filtrado. Base para galeria, tabela e totais. */
export function useAdPerformance(period: Period, projectIds: Set<string> | null, f: AdFilters = {}) {
  const ads = useRows('ads')
  const metrics = useRows('ad_metrics_daily')
  const campaigns = useRows('campaigns')
  const adSets = useRows('ad_sets')
  const accounts = useRows('ad_accounts')

  return useMemo(() => {
    const campById = new Map(campaigns.rows.map((c) => [c.id, c]))
    const filteredAds = ads.rows.filter((a) => {
      const camp = campById.get(a.campaign_id)
      if (projectIds && (!a.project_id || !projectIds.has(a.project_id))) return false
      if (f.accountId && f.accountId !== 'all' && a.ad_account_id !== f.accountId) return false
      if (f.campaignId && f.campaignId !== 'all' && a.campaign_id !== f.campaignId) return false
      if (f.adSetId && f.adSetId !== 'all' && a.ad_set_id !== f.adSetId) return false
      if (f.status && f.status !== 'all' && a.status !== f.status) return false
      if (f.objective && f.objective !== 'all' && camp?.objective !== f.objective) return false
      if (f.adId && f.adId !== 'all' && a.id !== f.adId) return false
      return true
    })
    const ids = new Set(filteredAds.map((a) => a.id))
    const rows = metrics.rows.filter((m) => ids.has(m.ad_id) && inPeriod(m.date, period))
    const byAd = new Map<string, typeof rows>()
    rows.forEach((m) => byAd.set(m.ad_id, [...(byAd.get(m.ad_id) ?? []), m]))
    const perf: AdPerformance[] = filteredAds.map((ad) => ({ ad, ...kpis(sumMetrics(byAd.get(ad.id) ?? [])) }))
    return {
      perf,
      withSpend: perf.filter((p) => p.rows > 0),
      totals: kpis(sumMetrics(rows)),
      rows,
      campaigns: campaigns.rows,
      adSets: adSets.rows,
      accounts: accounts.rows,
      allAds: ads.rows,
      loading: ads.loading || metrics.loading || campaigns.loading,
      lastSync: rows.reduce<string | null>((a, m) => (!a || m.synced_at > a ? m.synced_at : a), null),
      isDemo: filteredAds.length > 0 && filteredAds.every((a) => a.is_demo),
    }
  }, [ads.rows, metrics.rows, campaigns.rows, adSets.rows, accounts.rows, period, projectIds, f.accountId, f.campaignId, f.adSetId, f.status, f.objective, f.adId, ads.loading, metrics.loading, campaigns.loading])
}

export function useScope() {
  const app = useApp()
  return { period: app.period, projectIds: app.scopeProjectIds }
}
