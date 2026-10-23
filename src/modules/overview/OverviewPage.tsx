import clsx from 'clsx'
import { AlertTriangle, ArrowUpRight, CalendarClock, CircleDollarSign, Clock, Coins, Crown, Megaphone, PiggyBank, Plus, ShoppingBag, Target, TrendingUp, Users } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApp } from '@/app/AppContext'
import { PROJECT_STATUS, TASK_STATUS } from '@/app/labels'
import { useAdPerformance, useFinance } from '@/app/useDomain'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/layout/AppLayout'
import { ImageUpload } from '@/components/ui/inputs'
import { useAction } from '@/components/ui/overlay'
import { Avatar, Badge, Button, Card, EmptyState, Skeleton } from '@/components/ui/primitives'
import { DemoBanner, Gauge, KpiTile } from '@/components/ui/stats'
import { backend } from '@/data/client'
import { invalidate, useRows } from '@/data/store'
import type { Project } from '@/data/types'
import { productRanking } from '@/lib/finance'
import { addDays, date, daysBetween, money, moneyShort, num, pct, ratio, relative, shortDate, todayISO } from '@/lib/format'
import { delta } from '@/lib/metrics'
import { daysOf, inPeriod, PERIOD_LABEL, previousPeriod } from '@/lib/period'
import { phaseLabel, phaseProgress } from '@/lib/phases'
import { LadderPanel } from '../phases/LadderPanel'

export default function OverviewPage() {
  const app = useApp()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  // Sem projeto selecionado: foca o projeto ativo com o evento/conclusão mais próximo.
  const today = todayISO()
  const byUpcoming = [...app.projects].filter((p) => !p.archived).sort((a, b) => {
    const da = a.event_date ?? a.end_date ?? '9999'
    const db = b.event_date ?? b.end_date ?? '9999'
    return (da >= today ? da : '9' + da).localeCompare(db >= today ? db : '9' + db)
  })
  const focus: Project | null = app.selectedProject ?? byUpcoming.find((p) => p.status === 'ativo') ?? byUpcoming[0] ?? null

  if (app.loading) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-96" /></div>
  if (!focus)
    return (
      <EmptyState
        icon={Target}
        title="Nenhum projeto por aqui ainda"
        description={isAdmin ? 'Cadastre o primeiro expert e o primeiro projeto para começar a acompanhar a jornada V1–V8.' : 'Nenhum projeto foi liberado para o seu perfil. Fale com a administração da operação.'}
        action={isAdmin && <Button variant="primary" icon={Plus} onClick={() => navigate('/projetos?novo=1')}>Criar projeto</Button>}
      />
    )
  return <Cockpit focus={focus} />
}

function Cockpit({ focus }: { focus: Project }) {
  const app = useApp()
  const { period, scopeProjectIds } = app
  const prev = previousPeriod(period)
  const fin = useFinance(period, scopeProjectIds)
  const finPrev = useFinance(prev ?? period, scopeProjectIds)
  const traffic = useAdPerformance(period, scopeProjectIds)
  const trafficPrev = useAdPerformance(prev ?? period, scopeProjectIds)
  const products = useRows('products')
  const tasks = useRows('tasks')
  const phases = useRows('project_phases')
  const s = fin.summary
  const sp = prev ? finPrev.summary : null
  const t = traffic.totals
  const tp = prev ? trafficPrev.totals : null
  const scopeLabel = app.selectedProject ? app.selectedProject.name : `${scopeProjectIds.size} projeto(s) ativos`

  const ranking = productRanking(products.rows, fin.sales, period, scopeProjectIds, app.settings.top_product_metric)
  const top = ranking[0] && (app.settings.top_product_metric === 'quantidade' ? ranking[0].count : ranking[0].revenue) > 0 ? ranking[0] : null

  // Metas do projeto em foco (período completo do projeto)
  const lifetime = useMemo(() => ({ preset: 'tudo' as const, from: '2000-01-01', to: '2100-12-31' }), [])
  const focusIds = useMemo(() => new Set([focus.id]), [focus.id])
  const focusFin = useFinance(lifetime, focusIds).summary
  const today = todayISO()
  const elapsed =
    focus.start_date && (focus.event_date ?? focus.end_date)
      ? Math.max(0, Math.min(100, (daysBetween(focus.start_date, today) / Math.max(1, daysBetween(focus.start_date, (focus.event_date ?? focus.end_date)!))) * 100))
      : null
  const focusPhases = phases.rows.filter((p) => p.project_id === focus.id)

  const projectTasks = tasks.rows.filter((tk) => scopeProjectIds.has(tk.project_id) && tk.status !== 'concluida')
  const overdue = projectTasks.filter((tk) => tk.due_date && tk.due_date < today)
  const soon = projectTasks.filter((tk) => tk.due_date && tk.due_date >= today && tk.due_date <= addDays(today, 7)).sort((a, b) => a.due_date!.localeCompare(b.due_date!))

  const alerts: { tone: 'danger' | 'warning' | 'info'; title: string; text: string; to: string }[] = []
  if (overdue.length) alerts.push({ tone: 'danger', title: 'Tarefas atrasadas', text: `${overdue.length} tarefa(s) com prazo vencido: ${overdue.slice(0, 2).map((x) => x.title).join(', ')}`, to: '/tarefas' })
  const revPct = focus.revenue_goal > 0 ? (focusFin.grossRevenue / focus.revenue_goal) * 100 : null
  if (revPct !== null && elapsed !== null && revPct < elapsed * 0.7) alerts.push({ tone: 'warning', title: 'Faturamento abaixo do ritmo', text: `${pct(revPct)} da meta com ${pct(elapsed, 0)} do prazo decorrido.`, to: '/financeiro' })
  const budgetPct = focus.traffic_budget > 0 ? (focusFin.trafficInvestment / focus.traffic_budget) * 100 : null
  if (budgetPct !== null && budgetPct > 90) alerts.push({ tone: budgetPct > 100 ? 'danger' : 'warning', title: 'Orçamento de tráfego', text: `${pct(budgetPct)} do orçamento planejado já foi investido.`, to: '/trafego' })
  if (!fin.loading && !s.hasData) alerts.push({ tone: 'info', title: 'Dados financeiros incompletos', text: 'Nenhuma venda, despesa ou métrica registrada no período.', to: '/financeiro' })
  if (traffic.isDemo) alerts.push({ tone: 'info', title: 'Tráfego em modo demonstrativo', text: 'Conecte a conta de anúncios para ver resultados reais.', to: '/trafego' })

  const daily = useMemo(() => {
    const days = daysOf(period)
    const spend = new Map<string, number>()
    traffic.rows.forEach((m) => spend.set(m.date, (spend.get(m.date) ?? 0) + m.spend))
    const rev = new Map<string, number>()
    fin.sales.filter((x) => (x.status === 'aprovada' || x.status === 'reembolsada') && scopeProjectIds.has(x.project_id) && inPeriod(x.sale_date, period)).forEach((x) => rev.set(x.sale_date, (rev.get(x.sale_date) ?? 0) + x.gross_amount))
    return days.map((d) => ({ d: shortDate(d), Investimento: Math.round((spend.get(d) ?? 0) * 100) / 100, Faturamento: rev.get(d) ?? 0 }))
  }, [period, traffic.rows, fin.sales, scopeProjectIds])

  const noTraffic = t.rows === 0

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${app.settings.brand_name} · Cockpit`}
        title="Visão Geral"
        subtitle={<>Painel de comando · {scopeLabel} · {PERIOD_LABEL[period.preset] === 'Personalizado' ? `${date(period.from)} a ${date(period.to)}` : PERIOD_LABEL[period.preset]}</>}
        actions={traffic.isDemo && <DemoBanner>Dados demonstrativos</DemoBanner>}
      />

      {/* Cabeçalho do expert + medidores */}
      <div className="grid xl:grid-cols-[1.25fr_1fr] gap-5">
        <ExpertHeader project={focus} progress={phaseProgress(focusPhases)} />
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted">Metas do projeto · acumulado</span>
            {elapsed !== null && <span className="text-[11px] text-faint">{pct(elapsed, 0)} do prazo decorrido</span>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Gauge label="Faturamento" value={revPct} expected={elapsed} display={moneyShort(focusFin.grossRevenue)} sub={revPct === null ? 'sem meta' : `${pct(revPct)} da meta`} caption={focus.revenue_goal ? `meta ${moneyShort(focus.revenue_goal)}` : undefined} />
            <Gauge label="Vendas" value={focus.sales_goal > 0 ? (focusFin.approvedCount / focus.sales_goal) * 100 : null} expected={elapsed} display={`${focusFin.approvedCount}/${focus.sales_goal || '—'}`} sub={focus.sales_goal ? `${pct((focusFin.approvedCount / focus.sales_goal) * 100)} da meta` : 'sem meta'} caption={focus.sales_goal ? `faltam ${Math.max(0, focus.sales_goal - focusFin.approvedCount)}` : undefined} />
            <Gauge label="Orçamento tráfego" value={budgetPct} display={moneyShort(focusFin.trafficInvestment)} sub={budgetPct === null ? 'sem orçamento' : `${pct(budgetPct)} usado`} caption={focus.traffic_budget ? `de ${moneyShort(focus.traffic_budget)}` : undefined} />
          </div>
        </Card>
      </div>

      {/* Escada V1–V8 em destaque */}
      <LadderPanel project={focus} />

      {/* Indicadores principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile icon={Megaphone} title="Investimento em anúncios" value={noTraffic && !s.adSpendManual ? 'Aguardando integração' : money(s.trafficInvestment)} empty={noTraffic && !s.adSpendManual} description="no período" delta={sp ? delta(s.trafficInvestment, sp.trafficInvestment) : null} />
        <KpiTile icon={CircleDollarSign} title="Faturamento total" value={s.grossRevenue || s.approvedCount ? money(s.grossRevenue) : 'Sem dados'} empty={!s.grossRevenue} tone="success" description="bruto, vendas aprovadas" delta={sp ? delta(s.grossRevenue, sp.grossRevenue) : null} />
        <KpiTile icon={PiggyBank} title="Resultado estimado" value={s.hasData ? money(s.result) : 'Sem dados'} empty={!s.hasData} tone={s.result >= 0 ? 'success' : 'danger'} description="receita líquida − custos" delta={sp && sp.result !== 0 ? delta(s.result, sp.result) : null} />
        <KpiTile icon={ShoppingBag} title="Total de vendas" value={num(s.approvedCount)} description={`aprovadas${s.refundedCount ? ` · ${s.refundedCount} reemb.` : ''}`} delta={sp ? delta(s.approvedCount, sp.approvedCount) : null} />
        <KpiTile icon={Crown} title="Produto mais vendido" value={top ? top.product.name : 'Sem dados'} empty={!top} description={top ? `${top.count} venda(s) · ${money(top.revenue)}` : app.settings.top_product_metric === 'quantidade' ? 'por quantidade aprovada' : 'por faturamento'} tone="accent" />
        <KpiTile icon={Users} title="Leads gerados" value={noTraffic ? 'Aguardando integração' : num(t.leads)} empty={noTraffic} description="anúncios no período" delta={tp ? delta(t.leads, tp.leads) : null} />
        <KpiTile icon={Coins} title="Custo por lead" value={noTraffic ? 'Sem dados' : money(t.cpl)} empty={noTraffic} description="investimento ÷ leads" invert delta={tp ? delta(t.cpl, tp.cpl) : null} />
        <KpiTile icon={TrendingUp} title="ROAS das campanhas" value={t.roas === null ? 'Sem dados' : ratio(t.roas)} empty={t.roas === null} description="receita atribuída ÷ invest." delta={tp ? delta(t.roas, tp.roas) : null} />
      </div>

      <div className="grid xl:grid-cols-[1.6fr_1fr] gap-5">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold">Investimento × faturamento</h3>
              <p className="text-xs text-muted">Diário, no período selecionado</p>
            </div>
            <Link to="/relatorios" className="text-xs font-semibold text-primary inline-flex items-center gap-1">Relatórios <ArrowUpRight className="size-3.5" /></Link>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ left: 0, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="gInv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--brand-primary)" stopOpacity={0.35} /><stop offset="1" stopColor="var(--brand-primary)" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--brand-success)" stopOpacity={0.3} /><stop offset="1" stopColor="var(--brand-success)" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="#1d2943" vertical={false} />
                <XAxis dataKey="d" tick={{ fill: '#8b97b1', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis tick={{ fill: '#8b97b1', fontSize: 11 }} axisLine={false} tickLine={false} width={84} tickFormatter={(v) => moneyShort(v)} />
                <Tooltip contentStyle={{ background: '#111a2d', border: '1px solid #2a3a5c', borderRadius: 12 }} formatter={(v) => money(Number(v))} />
                <Area type="monotone" dataKey="Faturamento" stroke="var(--brand-success)" strokeWidth={2} fill="url(#gRev)" />
                <Area type="monotone" dataKey="Investimento" stroke="var(--brand-primary)" strokeWidth={2} fill="url(#gInv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 text-xs text-muted mt-2">
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" />Faturamento bruto</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />Investimento em anúncios</span>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold mb-3">Central de alertas</h3>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted">Nenhum ponto de atenção no momento.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <Link key={i} to={a.to} className="flex gap-3 rounded-xl border border-line bg-surface-2/60 p-3 hover:border-line-strong transition">
                  <AlertTriangle className={clsx('size-4 shrink-0 mt-0.5', a.tone === 'danger' ? 'text-danger' : a.tone === 'warning' ? 'text-warning' : 'text-primary')} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{a.title}</div>
                    <div className="text-xs text-muted line-clamp-2">{a.text}</div>
                  </div>
                  <ArrowUpRight className="size-3.5 text-faint ml-auto shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <TaskList title="Tarefas atrasadas" icon={Clock} tasks={overdue} empty="Nenhuma tarefa atrasada." danger />
        <TaskList title="Próximas entregas · 7 dias" icon={CalendarClock} tasks={soon} empty="Nenhuma entrega prevista para os próximos 7 dias." />
      </div>
    </div>
  )
}

function TaskList({ title, icon: Icon, tasks, empty, danger }: { title: string; icon: typeof Clock; tasks: { id: string; title: string; due_date: string | null; assignee: string; status: keyof typeof TASK_STATUS }[]; empty: string; danger?: boolean }) {
  return (
    <Card className="p-5 min-w-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold flex items-center gap-2"><Icon className={clsx('size-4', danger ? 'text-danger' : 'text-primary')} />{title}</h3>
        <Link to="/tarefas" className="text-xs font-semibold text-primary">Ver todas</Link>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {tasks.slice(0, 6).map((t) => (
            <li key={t.id} className="py-2.5 flex items-center gap-3 text-sm">
              <span className={clsx('size-2 rounded-full shrink-0', danger ? 'bg-danger' : 'bg-primary')} />
              <span className="flex-1 min-w-0 truncate">{t.title}</span>
              <span className="text-xs text-muted hidden sm:inline">{t.assignee}</span>
              <span className={clsx('text-xs font-semibold tabular-nums', danger ? 'text-danger' : 'text-muted')}>{date(t.due_date)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function ExpertHeader({ project, progress }: { project: Project; progress: number }) {
  const app = useApp()
  const { isAdmin } = useAuth()
  const { run } = useAction()
  const expert = app.experts.find((e) => e.id === project.expert_id)
  const canPhoto = isAdmin || Boolean(expert?.permissions.can_upload_photo)
  const today = todayISO()
  const toEvent = project.event_date ? daysBetween(today, project.event_date) : null
  const st = PROJECT_STATUS[project.status]
  return (
    <Card className="p-5 relative overflow-hidden">
      <div className="absolute -right-16 -top-16 size-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="flex flex-col sm:flex-row gap-5 relative">
        <div className="shrink-0 flex sm:flex-col items-center gap-3">
          <div className="relative">
            <Avatar src={expert?.photo_url} name={expert?.full_name ?? '?'} size={112} className="ring-4 ring-primary/30" />
            <span className="absolute -bottom-1 -right-1 rounded-full bg-accent text-white text-[11px] font-extrabold px-2 py-0.5 shadow">{pct(progress, 1)}</span>
          </div>
          {expert && canPhoto && (
            <ImageUpload
              preview={false}
              value={expert.photo_url}
              round
              folder={`experts/${expert.id}`}
              label="Enviar foto"
              onChange={(url) => run(async () => { await backend.update('experts', expert.id, { photo_url: url }); await invalidate('experts') })}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Expert</div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight truncate">{expert?.full_name ?? '—'}</h2>
          <Link to={`/projetos/${project.id}`} className="text-sm font-semibold text-muted hover:text-ink inline-flex items-center gap-1">{project.name}<ArrowUpRight className="size-3.5" /></Link>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge tone={st.tone} dot>{st.label}</Badge>
            <Badge tone="primary">{project.launch_type || 'Lançamento'}</Badge>
            <Badge tone="accent">{phaseLabel(project.current_phase)}</Badge>
            {project.is_demo && <Badge tone="warning">Exemplo</Badge>}
          </div>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
            <div><dt className="text-xs text-muted">Início</dt><dd className="font-semibold">{date(project.start_date)}</dd></div>
            <div><dt className="text-xs text-muted">Evento</dt><dd className="font-semibold">{date(project.event_date)}{toEvent !== null && toEvent >= 0 && <span className="block text-xs text-accent font-bold">em {toEvent} dia(s)</span>}</dd></div>
            <div><dt className="text-xs text-muted">Conclusão prevista</dt><dd className="font-semibold">{date(project.end_date)}</dd></div>
            <div><dt className="text-xs text-muted">Última atualização</dt><dd className="font-semibold">{relative(project.updated_at)}</dd></div>
          </dl>
        </div>
      </div>
    </Card>
  )
}
