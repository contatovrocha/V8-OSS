import clsx from 'clsx'
import { BarChart3, Download, Printer } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApp } from '@/app/AppContext'
import { TASK_STATUS } from '@/app/labels'
import { useAdPerformance, useFinance } from '@/app/useDomain'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/layout/AppLayout'
import { PeriodPicker } from '@/components/layout/PeriodPicker'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button, Card, Select } from '@/components/ui/primitives'
import { useRows } from '@/data/store'
import { downloadCSV } from '@/lib/csv'
import { consolidate, productRanking, TRAFFIC_CATEGORY } from '@/lib/finance'
import { date, money, moneyShort, num, pct, ratio, shortDate } from '@/lib/format'
import { kpis, sumMetrics } from '@/lib/metrics'
import { daysOf, inPeriod, resolvePeriod, type Period } from '@/lib/period'
import { PHASES, PHASE_STATUS_LABEL, phaseProgress } from '@/lib/phases'

const REPORTS = [
  { key: 'fases', label: 'Evolução das fases V1–V8' },
  { key: 'investimento', label: 'Evolução do investimento em anúncios' },
  { key: 'criativos', label: 'Desempenho dos criativos' },
  { key: 'leads', label: 'Leads e custos de aquisição' },
  { key: 'produtos', label: 'Vendas por produto' },
  { key: 'faturamento', label: 'Faturamento e despesas' },
  { key: 'resultado', label: 'Resultado por projeto' },
  { key: 'metas', label: 'Evolução das metas' },
  { key: 'entregas', label: 'Entregas concluídas e pendentes' },
] as const
type ReportKey = (typeof REPORTS)[number]['key']

const tooltipStyle = { background: '#111a2d', border: '1px solid #2a3a5c', borderRadius: 12 }
const axis = { tick: { fill: '#8b97b1', fontSize: 11 }, axisLine: false, tickLine: false }

export default function ReportsPage() {
  const app = useApp()
  const { isAdmin } = useAuth()
  const [report, setReport] = useState<ReportKey>('fases')
  const [local, setLocal] = useState<Period | null>(null)
  const [projectF, setProjectF] = useState('all')
  const period = local ?? app.period
  const projectIds = useMemo(() => (projectF !== 'all' ? new Set([projectF]) : app.scopeProjectIds), [projectF, app.scopeProjectIds])
  const label = REPORTS.find((r) => r.key === report)!.label

  return (
    <div>
      <PageHeader eyebrow="Análise" title="Relatórios" subtitle="Mesmos critérios de cálculo dos módulos de origem" actions={<Button icon={Printer} onClick={() => window.print()}>Imprimir / PDF</Button>} />
      <div className="grid lg:grid-cols-[260px_1fr] gap-5">
        <Card className="p-2 h-fit no-print">
          {REPORTS.map((r) => (
            <button key={r.key} onClick={() => setReport(r.key)} className={clsx('w-full text-left rounded-xl px-3 py-2.5 text-sm font-semibold transition flex items-center gap-2', report === r.key ? 'bg-primary text-white' : 'text-muted hover:text-ink hover:bg-surface-3')}>
              <BarChart3 className="size-4 shrink-0" />{r.label}
            </button>
          ))}
        </Card>
        <div className="space-y-4 min-w-0">
          <Card className="p-4 flex flex-wrap items-center gap-2 no-print">
            <PeriodPicker period={period} onChange={(p, c) => setLocal(resolvePeriod(p, c))} align="left" />
            {isAdmin && (
              <Select className="!w-auto" value={app.expertId} onChange={(e) => { app.setExpertId(e.target.value); setProjectF('all') }} aria-label="Expert">
                <option value="all">Todos os experts</option>
                {app.experts.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </Select>
            )}
            <Select className="!w-auto" value={projectF} onChange={(e) => setProjectF(e.target.value)} aria-label="Projeto">
              <option value="all">Todos os projetos do escopo</option>
              {app.projects.filter((p) => app.scopeProjectIds.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Card>
          <div>
            <h2 className="text-xl font-extrabold">{label}</h2>
            <p className="text-xs text-muted">{period.preset === 'tudo' ? 'Todo o período' : `${date(period.from)} a ${date(period.to)}`} · {projectIds.size} projeto(s)</p>
          </div>
          <Report kind={report} period={period} projectIds={projectIds} />
        </div>
      </div>
    </div>
  )
}

function Section<T extends { id: string }>({ chart, rows, columns, csv, filename }: { chart?: ReactNode; rows: T[]; columns: Column<T>[]; csv: { headers: string[]; row: (r: T) => (string | number | null)[] }; filename: string }) {
  return (
    <>
      {chart && <Card className="p-5"><div className="h-72">{chart}</div></Card>}
      <Card className="p-5">
        <div className="flex justify-end mb-3 no-print">
          <Button size="sm" icon={Download} disabled={!rows.length} onClick={() => downloadCSV(filename, csv.headers, rows.map(csv.row))}>Exportar CSV</Button>
        </div>
        <DataTable rows={rows} columns={columns} pageSize={25} />
      </Card>
    </>
  )
}

function Report({ kind, period, projectIds }: { kind: ReportKey; period: Period; projectIds: Set<string> }) {
  const app = useApp()
  const phases = useRows('project_phases')
  const history = useRows('phase_history')
  const tasks = useRows('tasks')
  const products = useRows('products')
  const accounts = useRows('ad_accounts')
  const fin = useFinance(period, projectIds)
  const traffic = useAdPerformance(period, projectIds)
  const days = daysOf(period)
  const projects = app.projects.filter((p) => projectIds.has(p.id))

  switch (kind) {
    case 'fases': {
      const rows = projects.map((p) => {
        const ph = phases.rows.filter((x) => x.project_id === p.id)
        return { id: p.id, name: p.name, progress: phaseProgress(ph), current: p.current_phase, ...Object.fromEntries(PHASES.map((d) => [`v${d.number}`, ph.find((x) => x.phase_number === d.number)?.status ?? 'bloqueada'])) } as { id: string; name: string; progress: number; current: number | null } & Record<string, string>
      })
      const completions = history.rows.filter((h) => projectIds.has(h.project_id) && h.to_status === 'concluida').sort((a, b) => a.created_at.localeCompare(b.created_at))
      let acc = 0
      const reopen = history.rows.filter((h) => projectIds.has(h.project_id) && h.from_status === 'concluida')
      const timeline = [...completions.map((c) => ({ at: c.created_at, d: 1 })), ...reopen.map((c) => ({ at: c.created_at, d: -1 }))].sort((a, b) => a.at.localeCompare(b.at)).map((e) => ({ data: date(e.at), 'Fases concluídas': (acc += e.d) }))
      return (
        <Section
          filename="evolucao-fases"
          rows={rows}
          chart={<ResponsiveContainer><LineChart data={timeline}><CartesianGrid stroke="#1d2943" vertical={false} /><XAxis dataKey="data" {...axis} /><YAxis {...axis} allowDecimals={false} /><Tooltip contentStyle={tooltipStyle} /><Line type="stepAfter" dataKey="Fases concluídas" stroke="var(--brand-accent)" strokeWidth={2.5} /></LineChart></ResponsiveContainer>}
          columns={[
            { key: 'n', header: 'Projeto', cell: (r) => <span className="font-semibold">{r.name}</span>, sortValue: (r) => r.name },
            { key: 'p', header: 'Progresso', align: 'right', cell: (r) => pct(r.progress), sortValue: (r) => r.progress },
            ...PHASES.map((d) => ({ key: `v${d.number}`, header: d.code, align: 'center' as const, cell: (r: (typeof rows)[number]) => <span className={clsx('text-xs font-semibold', r[`v${d.number}`] === 'concluida' ? 'text-success' : r[`v${d.number}`] === 'andamento' ? 'text-accent' : 'text-faint')}>{PHASE_STATUS_LABEL[r[`v${d.number}`] as keyof typeof PHASE_STATUS_LABEL]}</span> })),
          ]}
          csv={{ headers: ['Projeto', 'Progresso (%)', ...PHASES.map((d) => d.code)], row: (r) => [r.name, r.progress, ...PHASES.map((d) => PHASE_STATUS_LABEL[r[`v${d.number}`] as keyof typeof PHASE_STATUS_LABEL])] }}
        />
      )
    }
    case 'investimento':
    case 'leads': {
      const by = new Map<string, typeof traffic.rows>()
      traffic.rows.forEach((r) => by.set(r.date, [...(by.get(r.date) ?? []), r]))
      let cum = 0
      const rows = days.map((d) => { const k = kpis(sumMetrics(by.get(d) ?? [])); cum += k.spend; return { id: d, date: d, ...k, cumulative: Math.round(cum * 100) / 100 } })
      return kind === 'investimento' ? (
        <Section
          filename="investimento-anuncios"
          rows={[...rows].reverse()}
          chart={<ResponsiveContainer><ComposedChart data={rows.map((r) => ({ d: shortDate(r.date), Diário: r.spend, Acumulado: r.cumulative }))}><CartesianGrid stroke="#1d2943" vertical={false} /><XAxis dataKey="d" {...axis} minTickGap={20} /><YAxis yAxisId="a" {...axis} width={84} tickFormatter={moneyShort} /><YAxis yAxisId="b" orientation="right" {...axis} width={84} tickFormatter={moneyShort} /><Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v))} /><Legend /><Bar yAxisId="a" dataKey="Diário" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} /><Line yAxisId="b" dataKey="Acumulado" stroke="var(--brand-accent)" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer>}
          columns={[
            { key: 'd', header: 'Data', cell: (r) => date(r.date), sortValue: (r) => r.date },
            { key: 's', header: 'Investimento', align: 'right', cell: (r) => money(r.spend), sortValue: (r) => r.spend },
            { key: 'c', header: 'Acumulado', align: 'right', cell: (r) => money(r.cumulative), sortValue: (r) => r.cumulative },
            { key: 'i', header: 'Impressões', align: 'right', cell: (r) => num(r.impressions), sortValue: (r) => r.impressions },
            { key: 'cpm', header: 'CPM', align: 'right', cell: (r) => money(r.cpm), sortValue: (r) => r.cpm },
          ]}
          csv={{ headers: ['Data', 'Investimento', 'Acumulado', 'Impressões', 'CPM'], row: (r) => [date(r.date), r.spend, r.cumulative, r.impressions, r.cpm] }}
        />
      ) : (
        <Section
          filename="leads-custos"
          rows={[...rows].reverse()}
          chart={<ResponsiveContainer><ComposedChart data={rows.map((r) => ({ d: shortDate(r.date), Leads: r.leads, CPL: r.cpl }))}><CartesianGrid stroke="#1d2943" vertical={false} /><XAxis dataKey="d" {...axis} minTickGap={20} /><YAxis yAxisId="a" {...axis} allowDecimals={false} /><YAxis yAxisId="b" orientation="right" {...axis} width={84} tickFormatter={(v) => money(v)} /><Tooltip contentStyle={tooltipStyle} formatter={(v, n) => (n === 'CPL' ? money(v as number) : num(v as number))} /><Legend /><Bar yAxisId="a" dataKey="Leads" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} /><Line yAxisId="b" dataKey="CPL" stroke="var(--brand-accent)" strokeWidth={2} dot={false} connectNulls /></ComposedChart></ResponsiveContainer>}
          columns={[
            { key: 'd', header: 'Data', cell: (r) => date(r.date), sortValue: (r) => r.date },
            { key: 'l', header: 'Leads', align: 'right', cell: (r) => num(r.leads), sortValue: (r) => r.leads },
            { key: 's', header: 'Investimento', align: 'right', cell: (r) => money(r.spend), sortValue: (r) => r.spend },
            { key: 'cpl', header: 'CPL', align: 'right', cell: (r) => money(r.cpl), sortValue: (r) => r.cpl },
            { key: 'cpc', header: 'CPC', align: 'right', cell: (r) => money(r.cpc), sortValue: (r) => r.cpc },
          ]}
          csv={{ headers: ['Data', 'Leads', 'Investimento', 'CPL', 'CPC'], row: (r) => [date(r.date), r.leads, r.spend, r.cpl, r.cpc] }}
        />
      )
    }
    case 'criativos': {
      const rows = traffic.withSpend.map((p) => ({ ...p, id: p.ad.id })).sort((a, b) => b.leads - a.leads)
      return (
        <Section
          filename="desempenho-criativos"
          rows={rows}
          chart={<ResponsiveContainer><BarChart data={rows.map((r) => ({ n: r.ad.name.split('—')[0].trim(), Leads: r.leads, Cliques: r.link_clicks }))}><CartesianGrid stroke="#1d2943" vertical={false} /><XAxis dataKey="n" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Bar dataKey="Leads" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} /><Bar dataKey="Cliques" fill="var(--brand-accent)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>}
          columns={[
            { key: 'n', header: 'Criativo', cell: (r) => <span className="font-semibold">{r.ad.name}</span>, sortValue: (r) => r.ad.name },
            { key: 's', header: 'Investimento', align: 'right', cell: (r) => money(r.spend), sortValue: (r) => r.spend },
            { key: 'c', header: 'Cliques', align: 'right', cell: (r) => num(r.link_clicks), sortValue: (r) => r.link_clicks },
            { key: 'ctr', header: 'CTR', align: 'right', cell: (r) => pct(r.ctr, 2), sortValue: (r) => r.ctr },
            { key: 'cpc', header: 'CPC', align: 'right', cell: (r) => money(r.cpc), sortValue: (r) => r.cpc },
            { key: 'l', header: 'Leads', align: 'right', cell: (r) => num(r.leads), sortValue: (r) => r.leads },
            { key: 'cpl', header: 'CPL', align: 'right', cell: (r) => money(r.cpl), sortValue: (r) => r.cpl },
            { key: 'roas', header: 'ROAS', align: 'right', cell: (r) => ratio(r.roas), sortValue: (r) => r.roas },
          ]}
          csv={{ headers: ['Criativo', 'Investimento', 'Impressões', 'Cliques no link', 'CTR (%)', 'CPC', 'Leads', 'CPL', 'Compras', 'ROAS'], row: (r) => [r.ad.name, r.spend, r.impressions, r.link_clicks, r.ctr, r.cpc, r.leads, r.cpl, r.purchases, r.roas] }}
        />
      )
    }
    case 'produtos': {
      const rows = productRanking(products.rows, fin.sales, period, projectIds).map((r) => ({ ...r, id: r.product.id }))
      return (
        <Section
          filename="vendas-por-produto"
          rows={rows}
          chart={<ResponsiveContainer><BarChart data={rows.map((r) => ({ n: r.product.name, Vendas: r.count, Faturamento: r.revenue }))}><CartesianGrid stroke="#1d2943" vertical={false} /><XAxis dataKey="n" {...axis} /><YAxis yAxisId="a" {...axis} allowDecimals={false} /><YAxis yAxisId="b" orientation="right" {...axis} width={84} tickFormatter={moneyShort} /><Tooltip contentStyle={tooltipStyle} formatter={(v, n) => (n === 'Faturamento' ? money(v as number) : num(v as number))} /><Legend /><Bar yAxisId="a" dataKey="Vendas" fill="var(--brand-accent)" radius={[4, 4, 0, 0]} /><Bar yAxisId="b" dataKey="Faturamento" fill="var(--brand-success)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>}
          columns={[
            { key: 'n', header: 'Produto', cell: (r) => <span className="font-semibold">{r.product.name}</span>, sortValue: (r) => r.product.name },
            { key: 'q', header: 'Vendas aprovadas', align: 'right', cell: (r) => num(r.count), sortValue: (r) => r.count },
            { key: 'r', header: 'Faturamento', align: 'right', cell: (r) => money(r.revenue), sortValue: (r) => r.revenue },
            { key: 't', header: 'Ticket médio', align: 'right', cell: (r) => money(r.avgTicket), sortValue: (r) => r.avgTicket },
            { key: 's', header: 'Participação', align: 'right', cell: (r) => pct(r.share), sortValue: (r) => r.share },
          ]}
          csv={{ headers: ['Produto', 'Vendas aprovadas', 'Faturamento', 'Ticket médio', 'Participação (%)'], row: (r) => [r.product.name, r.count, r.revenue, r.avgTicket, r.share] }}
        />
      )
    }
    case 'faturamento': {
      const rows = days.map((d) => {
        const p: Period = { preset: 'custom', from: d, to: d }
        const s = consolidate({ sales: fin.sales, expenses: fin.expenses, metrics: fin.metrics, ads: fin.ads, accounts: accounts.rows, categories: fin.categories, projectIds, period: p })
        return { id: d, date: d, revenue: s.grossRevenue, net: s.netRevenue, traffic: s.trafficInvestment, other: s.otherExpenses, result: s.result }
      })
      const byCat = new Map<string, number>()
      fin.expenses.filter((e) => projectIds.has(e.project_id) && inPeriod(e.expense_date, period) && e.status !== 'cancelada' && e.category !== TRAFFIC_CATEGORY).forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount))
      return (
        <>
          <Section
            filename="faturamento-despesas"
            rows={[...rows].reverse().filter((r) => r.revenue || r.traffic || r.other)}
            chart={<ResponsiveContainer><BarChart data={rows.map((r) => ({ d: shortDate(r.date), Faturamento: r.revenue, Tráfego: r.traffic, 'Outras despesas': r.other }))}><CartesianGrid stroke="#1d2943" vertical={false} /><XAxis dataKey="d" {...axis} minTickGap={20} /><YAxis {...axis} width={84} tickFormatter={moneyShort} /><Tooltip contentStyle={tooltipStyle} formatter={(v) => money(v as number)} /><Legend /><Bar dataKey="Faturamento" fill="var(--brand-success)" radius={[4, 4, 0, 0]} /><Bar dataKey="Tráfego" stackId="c" fill="var(--brand-primary)" /><Bar dataKey="Outras despesas" stackId="c" fill="var(--brand-accent)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>}
            columns={[
              { key: 'd', header: 'Data', cell: (r) => date(r.date), sortValue: (r) => r.date },
              { key: 'r', header: 'Faturamento bruto', align: 'right', cell: (r) => money(r.revenue), sortValue: (r) => r.revenue },
              { key: 'n', header: 'Receita líquida', align: 'right', cell: (r) => money(r.net), sortValue: (r) => r.net },
              { key: 't', header: 'Tráfego', align: 'right', cell: (r) => money(r.traffic), sortValue: (r) => r.traffic },
              { key: 'o', header: 'Outras despesas', align: 'right', cell: (r) => money(r.other), sortValue: (r) => r.other },
              { key: 'res', header: 'Resultado', align: 'right', cell: (r) => <span className={r.result >= 0 ? 'text-success' : 'text-danger'}>{money(r.result)}</span>, sortValue: (r) => r.result },
            ]}
            csv={{ headers: ['Data', 'Faturamento bruto', 'Receita líquida', 'Tráfego', 'Outras despesas', 'Resultado'], row: (r) => [date(r.date), r.revenue, r.net, r.traffic, r.other, r.result] }}
          />
          <Card className="p-5">
            <h3 className="font-bold mb-3">Despesas por categoria (exceto tráfego)</h3>
            <div className="space-y-2 text-sm">{[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => <div key={c} className="flex justify-between border-b border-line pb-1.5"><span>{c}</span><span className="font-semibold tabular-nums">{money(v)}</span></div>)}{!byCat.size && <p className="text-muted">Sem despesas no período.</p>}</div>
          </Card>
        </>
      )
    }
    case 'resultado':
    case 'metas': {
      const rows = projects.map((p) => {
        const s = consolidate({ sales: fin.sales, expenses: fin.expenses, metrics: fin.metrics, ads: fin.ads, accounts: accounts.rows, categories: fin.categories, projectIds: new Set([p.id]), period })
        return { id: p.id, name: p.name, s, p }
      })
      if (kind === 'resultado')
        return (
          <Section
            filename="resultado-por-projeto"
            rows={rows}
            chart={<ResponsiveContainer><BarChart data={rows.map((r) => ({ n: r.name.slice(0, 24), Receita: r.s.netRevenue, Custo: r.s.totalCost, Resultado: r.s.result }))}><CartesianGrid stroke="#1d2943" vertical={false} /><XAxis dataKey="n" {...axis} /><YAxis {...axis} width={84} tickFormatter={moneyShort} /><Tooltip contentStyle={tooltipStyle} formatter={(v) => money(v as number)} /><Legend /><Bar dataKey="Receita" fill="var(--brand-success)" radius={[4, 4, 0, 0]} /><Bar dataKey="Custo" fill="var(--brand-danger)" radius={[4, 4, 0, 0]} /><Bar dataKey="Resultado" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>}
            columns={[
              { key: 'n', header: 'Projeto', cell: (r) => <span className="font-semibold">{r.name}</span>, sortValue: (r) => r.name },
              { key: 'rev', header: 'Faturamento', align: 'right', cell: (r) => money(r.s.grossRevenue), sortValue: (r) => r.s.grossRevenue },
              { key: 'net', header: 'Receita líquida', align: 'right', cell: (r) => money(r.s.netRevenue), sortValue: (r) => r.s.netRevenue },
              { key: 'tr', header: 'Tráfego', align: 'right', cell: (r) => money(r.s.trafficInvestment), sortValue: (r) => r.s.trafficInvestment },
              { key: 'ot', header: 'Outras despesas', align: 'right', cell: (r) => money(r.s.otherExpenses), sortValue: (r) => r.s.otherExpenses },
              { key: 'res', header: 'Resultado', align: 'right', cell: (r) => money(r.s.result), sortValue: (r) => r.s.result },
              { key: 'm', header: 'Margem', align: 'right', cell: (r) => pct(r.s.margin), sortValue: (r) => r.s.margin },
            ]}
            csv={{ headers: ['Projeto', 'Faturamento', 'Receita líquida', 'Tráfego', 'Outras despesas', 'Custo total', 'Resultado', 'Margem (%)'], row: (r) => [r.name, r.s.grossRevenue, r.s.netRevenue, r.s.trafficInvestment, r.s.otherExpenses, r.s.totalCost, r.s.result, r.s.margin] }}
          />
        )
      // metas: faturamento acumulado vs meta
      let cum = 0
      const goal = projects.reduce((a, p) => a + p.revenue_goal, 0)
      const salesDays = days.map((d) => {
        cum += fin.sales.filter((s) => projectIds.has(s.project_id) && s.sale_date === d && (s.status === 'aprovada' || s.status === 'reembolsada')).reduce((a, s) => a + s.gross_amount, 0)
        return { d: shortDate(d), 'Faturamento acumulado': cum, Meta: goal }
      })
      return (
        <Section
          filename="evolucao-metas"
          rows={rows}
          chart={<ResponsiveContainer><LineChart data={salesDays}><CartesianGrid stroke="#1d2943" vertical={false} /><XAxis dataKey="d" {...axis} minTickGap={20} /><YAxis {...axis} width={84} tickFormatter={moneyShort} /><Tooltip contentStyle={tooltipStyle} formatter={(v) => money(v as number)} /><Legend /><Line dataKey="Faturamento acumulado" stroke="var(--brand-success)" strokeWidth={2.5} dot={false} /><Line dataKey="Meta" stroke="#8b97b1" strokeDasharray="6 6" dot={false} /></LineChart></ResponsiveContainer>}
          columns={[
            { key: 'n', header: 'Projeto', cell: (r) => <span className="font-semibold">{r.name}</span>, sortValue: (r) => r.name },
            { key: 'rg', header: 'Meta faturamento', align: 'right', cell: (r) => money(r.p.revenue_goal), sortValue: (r) => r.p.revenue_goal },
            { key: 'rr', header: 'Realizado', align: 'right', cell: (r) => `${money(r.s.grossRevenue)} (${r.p.revenue_goal ? pct((r.s.grossRevenue / r.p.revenue_goal) * 100) : '—'})`, sortValue: (r) => r.s.grossRevenue },
            { key: 'sg', header: 'Meta vendas', align: 'right', cell: (r) => num(r.p.sales_goal), sortValue: (r) => r.p.sales_goal },
            { key: 'sr', header: 'Vendas', align: 'right', cell: (r) => `${r.s.approvedCount} (${r.p.sales_goal ? pct((r.s.approvedCount / r.p.sales_goal) * 100) : '—'})`, sortValue: (r) => r.s.approvedCount },
            { key: 'bg', header: 'Orçamento tráfego', align: 'right', cell: (r) => `${money(r.s.trafficInvestment)} / ${money(r.p.traffic_budget)}`, sortValue: (r) => r.s.trafficInvestment },
          ]}
          csv={{ headers: ['Projeto', 'Meta faturamento', 'Faturamento', 'Meta vendas', 'Vendas aprovadas', 'Orçamento tráfego', 'Investido'], row: (r) => [r.name, r.p.revenue_goal, r.s.grossRevenue, r.p.sales_goal, r.s.approvedCount, r.p.traffic_budget, r.s.trafficInvestment] }}
        />
      )
    }
    case 'entregas': {
      const rows = projects.map((p) => {
        const t = tasks.rows.filter((x) => x.project_id === p.id)
        return { id: p.id, name: p.name, total: t.length, ...Object.fromEntries(Object.keys(TASK_STATUS).map((s) => [s, t.filter((x) => x.status === s).length])), late: t.filter((x) => x.status !== 'concluida' && x.due_date && x.due_date < new Date().toISOString().slice(0, 10)).length, doneInPeriod: t.filter((x) => x.status === 'concluida' && inPeriod(x.updated_at, period)).length } as { id: string; name: string; total: number; late: number; doneInPeriod: number } & Record<string, number>
      })
      return (
        <Section
          filename="entregas"
          rows={rows}
          chart={<ResponsiveContainer><BarChart data={rows.map((r) => ({ n: r.name.slice(0, 24), Concluídas: r.concluida, Pendentes: r.total - r.concluida, Atrasadas: r.late }))}><CartesianGrid stroke="#1d2943" vertical={false} /><XAxis dataKey="n" {...axis} /><YAxis {...axis} allowDecimals={false} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Bar dataKey="Concluídas" fill="var(--brand-success)" radius={[4, 4, 0, 0]} /><Bar dataKey="Pendentes" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} /><Bar dataKey="Atrasadas" fill="var(--brand-danger)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>}
          columns={[
            { key: 'n', header: 'Projeto', cell: (r) => <span className="font-semibold">{r.name}</span>, sortValue: (r) => r.name },
            { key: 't', header: 'Total', align: 'right', cell: (r) => num(r.total), sortValue: (r) => r.total },
            ...Object.entries(TASK_STATUS).map(([k, v]) => ({ key: k, header: v.label, align: 'right' as const, cell: (r: (typeof rows)[number]) => num(r[k]), sortValue: (r: (typeof rows)[number]) => r[k] })),
            { key: 'l', header: 'Atrasadas', align: 'right', cell: (r) => <span className={r.late ? 'text-danger font-semibold' : ''}>{num(r.late)}</span>, sortValue: (r) => r.late },
            { key: 'dp', header: 'Concluídas no período', align: 'right', cell: (r) => num(r.doneInPeriod), sortValue: (r) => r.doneInPeriod },
          ]}
          csv={{ headers: ['Projeto', 'Total', ...Object.values(TASK_STATUS).map((v) => v.label), 'Atrasadas', 'Concluídas no período'], row: (r) => [r.name, r.total, ...Object.keys(TASK_STATUS).map((k) => r[k]), r.late, r.doneInPeriod] }}
        />
      )
    }
  }
}
