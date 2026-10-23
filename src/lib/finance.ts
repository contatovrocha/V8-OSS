import type { AdAccount, AdMetricDaily, Ad, Expense, ExpenseCategory, Product, Project, Sale } from '@/data/types'
import { inPeriod, type Period } from './period'
import { safeDiv } from './metrics'

export const TRAFFIC_CATEGORY = 'Tráfego pago'

export function saleNet(s: Pick<Sale, 'gross_amount' | 'discount' | 'fees' | 'refund_amount'>): number {
  return round(s.gross_amount - s.discount - s.fees - s.refund_amount)
}

const round = (n: number) => Math.round(n * 100) / 100

/** Venda que gerou faturamento (aprovada, ou aprovada e depois reembolsada). */
const billed = (s: Sale) => s.status === 'aprovada' || s.status === 'reembolsada'

export interface FinanceInput {
  sales: Sale[]
  expenses: Expense[]
  metrics: AdMetricDaily[]
  ads: Ad[]
  accounts: AdAccount[]
  categories: ExpenseCategory[]
  projectIds: Set<string> | null // null = todos os projetos visíveis
  period: Period
}

export interface FinanceSummary {
  grossRevenue: number
  approvedCount: number
  approvedGross: number
  refunds: number
  refundedCount: number
  discounts: number
  fees: number
  netRevenue: number
  adSpendSynced: number
  adSpendManual: number
  trafficInvestment: number
  reconciledTrafficExpenses: number
  otherExpenses: number
  totalCost: number
  result: number
  margin: number | null
  avgTicket: number | null
  attributedRevenue: number
  roas: number | null
  hasData: boolean
}

/**
 * Consolidação financeira única, usada por Visão Geral, Financeiro e Relatórios.
 *
 * Investimento em tráfego = gasto sincronizado/registrado no nível de anúncio (ad_metrics_daily)
 *                          + despesas manuais da categoria "Tráfego pago" que NÃO estejam
 *                            vinculadas a uma conta de anúncios cujo gasto já é sincronizado.
 * Despesas de tráfego vinculadas a uma conta sincronizada são apenas conciliadas (não somadas).
 * Resultado = receita líquida (bruto − descontos − taxas − reembolsos) − tráfego − outras despesas.
 */
export function consolidate(i: FinanceInput): FinanceSummary {
  const inScope = (pid: string | null) => i.projectIds === null || (pid !== null && i.projectIds.has(pid))
  const trafficCats = new Set(i.categories.filter((c) => c.is_traffic).map((c) => c.name))
  trafficCats.add(TRAFFIC_CATEGORY)

  const sales = i.sales.filter((s) => inScope(s.project_id) && inPeriod(s.sale_date, i.period))
  const billedSales = sales.filter(billed)
  const approved = sales.filter((s) => s.status === 'aprovada')
  const grossRevenue = round(billedSales.reduce((a, s) => a + s.gross_amount, 0))
  const discounts = round(billedSales.reduce((a, s) => a + s.discount, 0))
  const fees = round(billedSales.reduce((a, s) => a + s.fees, 0))
  const refunds = round(billedSales.reduce((a, s) => a + s.refund_amount, 0))
  const netRevenue = round(billedSales.reduce((a, s) => a + saleNet(s), 0))

  const adProject = new Map(i.ads.map((a) => [a.id, a.project_id]))
  const metrics = i.metrics.filter((m) => inScope(adProject.get(m.ad_id) ?? null) && inPeriod(m.date, i.period))
  const adSpendSynced = round(metrics.reduce((a, m) => a + m.spend, 0))
  const attributedRevenue = round(metrics.reduce((a, m) => a + m.purchase_value, 0))
  const syncedAccounts = new Set(i.metrics.map((m) => m.ad_account_id))

  const expenses = i.expenses.filter((e) => e.status !== 'cancelada' && inScope(e.project_id) && inPeriod(e.expense_date, i.period))
  let adSpendManual = 0
  let reconciled = 0
  let other = 0
  for (const e of expenses) {
    if (trafficCats.has(e.category)) {
      if (e.ad_account_id && syncedAccounts.has(e.ad_account_id)) reconciled += e.amount
      else adSpendManual += e.amount
    } else other += e.amount
  }
  const trafficInvestment = round(adSpendSynced + adSpendManual)
  const otherExpenses = round(other)
  const totalCost = round(trafficInvestment + otherExpenses)
  const result = round(netRevenue - totalCost)

  return {
    grossRevenue,
    approvedCount: approved.length,
    approvedGross: round(approved.reduce((a, s) => a + s.gross_amount, 0)),
    refunds,
    refundedCount: sales.filter((s) => s.status === 'reembolsada').length,
    discounts,
    fees,
    netRevenue,
    adSpendSynced,
    adSpendManual: round(adSpendManual),
    trafficInvestment,
    reconciledTrafficExpenses: round(reconciled),
    otherExpenses,
    totalCost,
    result,
    margin: netRevenue > 0 ? (safeDiv(result, netRevenue) ?? 0) * 100 : null,
    avgTicket: safeDiv(grossRevenue, billedSales.length),
    attributedRevenue,
    roas: attributedRevenue > 0 ? safeDiv(attributedRevenue, adSpendSynced) : null,
    hasData: sales.length > 0 || expenses.length > 0 || metrics.length > 0,
  }
}

export interface ProductRank {
  product: Product
  count: number
  revenue: number
  avgTicket: number | null
  share: number | null
}

/** Ranking por quantidade de vendas aprovadas (padrão) ou por faturamento. */
export function productRanking(products: Product[], sales: Sale[], period: Period, projectIds: Set<string> | null, by: 'quantidade' | 'faturamento' = 'quantidade'): ProductRank[] {
  const approved = sales.filter((s) => s.status === 'aprovada' && inPeriod(s.sale_date, period) && (projectIds === null || projectIds.has(s.project_id)))
  const total = approved.reduce((a, s) => a + s.gross_amount, 0)
  const rows = products
    .filter((p) => projectIds === null || projectIds.has(p.project_id))
    .map((p) => {
      const ps = approved.filter((s) => s.product_id === p.id)
      const revenue = round(ps.reduce((a, s) => a + s.gross_amount, 0))
      return { product: p, count: ps.length, revenue, avgTicket: safeDiv(revenue, ps.length), share: total > 0 ? (revenue / total) * 100 : null }
    })
  return rows.sort((a, b) => (by === 'quantidade' ? b.count - a.count || b.revenue - a.revenue : b.revenue - a.revenue || b.count - a.count))
}

export function projectGoalProgress(p: Project, s: FinanceSummary) {
  return {
    revenue: p.revenue_goal > 0 ? (s.grossRevenue / p.revenue_goal) * 100 : null,
    sales: p.sales_goal > 0 ? (s.approvedCount / p.sales_goal) * 100 : null,
    budget: p.traffic_budget > 0 ? (s.trafficInvestment / p.traffic_budget) * 100 : null,
  }
}
