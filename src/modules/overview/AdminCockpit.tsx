import { ArrowUpRight, CircleDollarSign, Coins, Megaphone, PiggyBank, Receipt, ShoppingBag, TrendingUp, Users } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApp } from '@/app/AppContext'
import { PROJECT_STATUS } from '@/app/labels'
import { useAdPerformance, useFinance } from '@/app/useDomain'
import { PageHeader } from '@/components/layout/AppLayout'
import { DataTable } from '@/components/ui/DataTable'
import { Avatar, Badge, Card } from '@/components/ui/primitives'
import { DemoBanner, KpiTile } from '@/components/ui/stats'
import { useRows } from '@/data/store'
import type { Project } from '@/data/types'
import { consolidate, type FinanceSummary } from '@/lib/finance'
import { date, money, moneyShort, num, pct, ratio, shortDate } from '@/lib/format'
import { delta } from '@/lib/metrics'
import { daysOf, inPeriod, PERIOD_LABEL, previousPeriod } from '@/lib/period'
import { phaseLabel } from '@/lib/phases'

/** Painel do administrador sem expert selecionado: todos os experts e o cockpit de vendas de todos os projetos. */
export function AdminCockpit() {
  const app = useApp()
  const navigate = useNavigate()
  const { period, scopeProjectIds } = app
  const prev = previousPeriod(period)
  const fin = useFinance(period, scopeProjectIds)
  const finPrev = useFinance(prev ?? period, scopeProjectIds)
  const traffic = useAdPerformance(period, scopeProjectIds)
  const accounts = useRows('ad_accounts')
  const s = fin.summary
  const sp = prev ? finPrev.summary : null
  const noTraffic = traffic.totals.rows === 0

  const summaryOf = (ids: Set<string>): FinanceSummary =>
    consolidate({ sales: fin.sales, expenses: fin.expenses, metrics: fin.metrics, ads: fin.ads, accounts: accounts.rows, categories: fin.categories, projectIds: ids, period })

  const active = app.projects.filter((p) => !p.archived)
  const perExpert = useMemo(() => app.experts.map((e) => {
    const ids = new Set(active.filter((p) => p.expert_id === e.id).map((p) => p.id))
    return { expert: e, projects: ids.size, s: summaryOf(ids) }
  }).sort((a, b) => b.s.grossRevenue - a.s.grossRevenue || a.expert.full_name.localeCompare(b.expert.full_name)),
  [app.experts, app.projects, fin.sales, fin.expenses, fin.metrics, fin.ads, accounts.rows, period])

  const perProject = useMemo(() => active.map((p) => ({ id: p.id, project: p, s: summaryOf(new Set([p.id])) })).sort((a, b) => b.s.grossRevenue - a.s.grossRevenue),
  [app.projects, fin.sales, fin.expenses, fin.metrics, fin.ads, accounts.rows, period])

  const daily = useMemo(() => {
    const spend = new Map<string, number>()
    traffic.rows.forEach((m) => spend.set(m.date, (spend.get(m.date) ?? 0) + m.spend))
    const rev = new Map<string, number>()
    fin.sales.filter((x) => (x.status === 'aprovada' || x.status === 'reembolsada') && scopeProjectIds.has(x.project_id) && inPeriod(x.sale_date, period))
      .forEach((x) => rev.set(x.sale_date, (rev.get(x.sale_date) ?? 0) + x.gross_amount))
    return daysOf(period).map((d) => ({ d: shortDate(d), Investimento: Math.round((spend.get(d) ?? 0) * 100) / 100, Faturamento: rev.get(d) ?? 0 }))
  }, [period, traffic.rows, fin.sales, scopeProjectIds])

  const expertOf = (p: Project) => app.experts.find((e) => e.id === p.expert_id)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${app.settings.brand_name} · Cockpit geral`}
        title="Visão Geral"
        subtitle={<>Todos os experts · {active.length} projeto(s) ativos · {PERIOD_LABEL[period.preset] === 'Personalizado' ? `${date(period.from)} a ${date(period.to)}` : PERIOD_LABEL[period.preset]}</>}
        actions={traffic.isDemo && <DemoBanner>Dados demonstrativos</DemoBanner>}
      />

      {/* Experts */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Experts</h3>
          <span className="text-xs text-muted">Clique para abrir o cockpit do expert</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-4">
          {perExpert.map(({ expert: e, projects, s: es }) => (
            <button key={e.id} type="button" onClick={() => app.setExpertId(e.id)}
              className="group rounded-2xl border border-line bg-surface-2/60 p-4 text-center hover:border-primary hover:-translate-y-0.5 transition">
              <div className="mx-auto w-fit rounded-full p-1 bg-gradient-to-br from-primary/60 to-accent/60"><Avatar src={e.photo_url} name={e.full_name} size={96} /></div>
              <div className="mt-3 font-bold leading-tight group-hover:text-primary">{e.full_name}</div>
              <div className="text-xs text-muted">{projects} projeto(s)</div>
              <div className="mt-2 text-sm font-semibold text-success">{es.grossRevenue ? money(es.grossRevenue) : '—'}</div>
              <div className="text-[11px] text-faint">{num(es.approvedCount)} venda(s) no período</div>
            </button>
          ))}
        </div>
      </Card>

      {/* Cockpit de vendas consolidado */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile icon={CircleDollarSign} title="Faturamento total" value={s.grossRevenue || s.approvedCount ? money(s.grossRevenue) : 'Sem dados'} empty={!s.grossRevenue} tone="success" description="todos os projetos" delta={sp ? delta(s.grossRevenue, sp.grossRevenue) : null} />
        <KpiTile icon={ShoppingBag} title="Vendas aprovadas" value={num(s.approvedCount)} description={s.refundedCount ? `${s.refundedCount} reembolso(s)` : 'no período'} delta={sp ? delta(s.approvedCount, sp.approvedCount) : null} />
        <KpiTile icon={Receipt} title="Ticket médio" value={s.avgTicket === null ? 'Sem dados' : money(s.avgTicket)} empty={s.avgTicket === null} description="faturamento ÷ vendas" />
        <KpiTile icon={PiggyBank} title="Resultado estimado" value={s.hasData ? money(s.result) : 'Sem dados'} empty={!s.hasData} tone={s.result >= 0 ? 'success' : 'danger'} description="receita líquida − custos" delta={sp && sp.result !== 0 ? delta(s.result, sp.result) : null} />
        <KpiTile icon={Megaphone} title="Investimento em tráfego" value={noTraffic && !s.adSpendManual ? 'Aguardando integração' : money(s.trafficInvestment)} empty={noTraffic && !s.adSpendManual} description="todos os projetos" delta={sp ? delta(s.trafficInvestment, sp.trafficInvestment) : null} />
        <KpiTile icon={TrendingUp} title="ROAS geral" value={s.roas === null ? 'Sem dados' : ratio(s.roas)} empty={s.roas === null} description="receita ÷ investimento" />
        <KpiTile icon={Users} title="Leads" value={noTraffic ? 'Aguardando integração' : num(traffic.totals.leads)} empty={noTraffic} description="anúncios no período" />
        <KpiTile icon={Coins} title="Custo total" value={money(s.totalCost)} description="tráfego + despesas" />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div><h3 className="font-bold">Faturamento × investimento · todos os projetos</h3><p className="text-xs text-muted">Diário, no período selecionado</p></div>
          <Link to="/relatorios" className="text-xs font-semibold text-primary inline-flex items-center gap-1">Relatórios <ArrowUpRight className="size-3.5" /></Link>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ left: 0, right: 8, top: 4 }}>
              <defs>
                <linearGradient id="agInv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--brand-primary)" stopOpacity={0.35} /><stop offset="1" stopColor="var(--brand-primary)" stopOpacity={0} /></linearGradient>
                <linearGradient id="agRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--brand-success)" stopOpacity={0.3} /><stop offset="1" stopColor="var(--brand-success)" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid stroke="#1d2943" vertical={false} />
              <XAxis dataKey="d" tick={{ fill: '#8b97b1', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
              <YAxis tick={{ fill: '#8b97b1', fontSize: 11 }} axisLine={false} tickLine={false} width={84} tickFormatter={(v) => moneyShort(v)} />
              <Tooltip contentStyle={{ background: '#111a2d', border: '1px solid #2a3a5c', borderRadius: 12 }} formatter={(v) => money(Number(v))} />
              <Area type="monotone" dataKey="Faturamento" stroke="var(--brand-success)" strokeWidth={2} fill="url(#agRev)" />
              <Area type="monotone" dataKey="Investimento" stroke="var(--brand-primary)" strokeWidth={2} fill="url(#agInv)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold mb-3">Vendas por projeto</h3>
        <DataTable
          rows={perProject}
          onRowClick={(r) => navigate(`/projetos/${r.project.id}`)}
          searchText={(r) => `${r.project.name} ${expertOf(r.project)?.full_name ?? ''}`}
          columns={[
            { key: 'p', header: 'Projeto', cell: (r) => <div><div className="font-semibold">{r.project.name}</div><div className="text-xs text-muted">{phaseLabel(r.project.current_phase)}</div></div>, sortValue: (r) => r.project.name },
            { key: 'e', header: 'Expert', cell: (r) => { const e = expertOf(r.project); return e ? <span className="inline-flex items-center gap-2"><Avatar src={e.photo_url} name={e.full_name} size={26} />{e.full_name}</span> : '—' }, sortValue: (r) => expertOf(r.project)?.full_name ?? '' },
            { key: 'st', header: 'Status', cell: (r) => <Badge tone={PROJECT_STATUS[r.project.status]?.tone}>{PROJECT_STATUS[r.project.status]?.label ?? r.project.status}</Badge> },
            { key: 'f', header: 'Faturamento', cell: (r) => money(r.s.grossRevenue), sortValue: (r) => r.s.grossRevenue },
            { key: 'v', header: 'Vendas', cell: (r) => num(r.s.approvedCount), sortValue: (r) => r.s.approvedCount },
            { key: 'i', header: 'Tráfego', cell: (r) => money(r.s.trafficInvestment), sortValue: (r) => r.s.trafficInvestment },
            { key: 'r', header: 'Resultado', cell: (r) => <span className={r.s.result >= 0 ? 'text-success' : 'text-danger'}>{money(r.s.result)}</span>, sortValue: (r) => r.s.result },
            { key: 'm', header: 'Meta', cell: (r) => (r.project.revenue_goal > 0 ? pct((r.s.grossRevenue / r.project.revenue_goal) * 100) : '—'), sortValue: (r) => (r.project.revenue_goal > 0 ? r.s.grossRevenue / r.project.revenue_goal : -1) },
          ]}
        />
      </Card>
    </div>
  )
}
