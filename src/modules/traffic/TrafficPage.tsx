import clsx from 'clsx'
import { AlertCircle, CheckCircle2, ExternalLink, Image as ImageIcon, LayoutGrid, Link2, Megaphone, PlayCircle, RefreshCw, Table2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApp } from '@/app/AppContext'
import { adStatusTone } from '@/app/labels'
import { useAdPerformance, type AdFilters } from '@/app/useDomain'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/layout/AppLayout'
import { PeriodPicker } from '@/components/layout/PeriodPicker'
import { DataTable } from '@/components/ui/DataTable'
import { Modal, useAction } from '@/components/ui/overlay'
import { Badge, Button, Card, EmptyState, Segmented, Select, Skeleton, Tabs } from '@/components/ui/primitives'
import { DemoBanner, KpiTile } from '@/components/ui/stats'
import { backend } from '@/data/client'
import { invalidate } from '@/data/store'
import type { AdAccount } from '@/data/types'
import { date, dateTime, money, num, pct, ratio, relative, shortDate } from '@/lib/format'
import { AD_SORT_LABEL, emptyTotals, kpis, sortAds, sumMetrics, type AdPerformance, type AdSortKey, type TrafficKpis } from '@/lib/metrics'
import { daysOf, resolvePeriod, type Period, type PeriodPreset } from '@/lib/period'

export default function TrafficPage() {
  return (
    <div>
      <PageHeader eyebrow="Mídia paga" title="Tráfego" subtitle="Campanhas, conjuntos, anúncios e criativos" />
      <TrafficView />
    </div>
  )
}

type Tab = 'geral' | 'campanhas' | 'conjuntos' | 'anuncios' | 'historico'
type Metric = 'spend' | 'leads' | 'cpl' | 'link_clicks' | 'ctr' | 'cpc' | 'impressions' | 'purchases' | 'roas'
const METRIC_LABEL: Record<Metric, string> = { spend: 'Investimento', leads: 'Leads', cpl: 'Custo por lead', link_clicks: 'Cliques no link', ctr: 'CTR de link', cpc: 'CPC de link', impressions: 'Impressões', purchases: 'Compras atribuídas', roas: 'ROAS' }
const fmtMetric = (m: Metric, v: number | null) => (m === 'spend' || m === 'cpl' || m === 'cpc' ? money(v) : m === 'ctr' ? pct(v, 2) : m === 'roas' ? ratio(v) : num(v))

export function TrafficView({ fixedProjectId }: { fixedProjectId?: string }) {
  const app = useApp()
  const [tab, setTab] = useState<Tab>('anuncios')
  const [local, setLocal] = useState<Period | null>(null)
  const period = local ?? app.period
  const [projectF, setProjectF] = useState('all')
  const [f, setF] = useState<AdFilters>({ accountId: 'all', campaignId: 'all', status: 'all', objective: 'all', adId: 'all' })
  const [sort, setSort] = useState<AdSortKey>('leads')
  const [metric, setMetric] = useState<Metric>('spend')
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [open, setOpen] = useState<AdPerformance | null>(null)

  const projectIds = useMemo(() => (fixedProjectId ? new Set([fixedProjectId]) : projectF !== 'all' ? new Set([projectF]) : app.scopeProjectIds), [fixedProjectId, projectF, app.scopeProjectIds])
  const data = useAdPerformance(period, projectIds, f)
  const all = useAdPerformance(period, projectIds) // para popular os filtros
  const sorted = sortAds(data.withSpend, sort)
  const t = data.totals
  const setFilter = (k: keyof AdFilters, v: string) => setF((s) => ({ ...s, [k]: v }))
  const statuses = [...new Set(all.perf.map((p) => p.ad.status))]
  const objectives = [...new Set(all.campaigns.filter((c) => all.perf.some((p) => p.ad.campaign_id === c.id)).map((c) => c.objective))]
  const visibleCampaigns = all.campaigns.filter((c) => all.perf.some((p) => p.ad.campaign_id === c.id))
  const accounts = all.accounts.filter((a) => all.perf.some((p) => p.ad.ad_account_id === a.id) || app.projects.some((p) => projectIds.has(p.id) && p.ad_account_id === a.id))
  const campName = (id: string) => all.campaigns.find((c) => c.id === id)?.name ?? '—'
  const setName = (id: string) => all.adSets.find((c) => c.id === id)?.name ?? '—'

  return (
    <div className="space-y-5">
      <IntegrationBar accounts={accounts} isDemo={data.isDemo || (all.perf.length > 0 && all.perf.every((p) => p.ad.is_demo))} lastSync={data.lastSync} />

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker period={period} onChange={(p: PeriodPreset, c) => setLocal(resolvePeriod(p, c))} align="left" />
          {!fixedProjectId && (
            <Select className="!w-auto" value={projectF} onChange={(e) => setProjectF(e.target.value)} aria-label="Projeto">
              <option value="all">Todos os projetos</option>
              {app.projects.filter((p) => app.scopeProjectIds.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
          <Select className="!w-auto" value={f.accountId} onChange={(e) => setFilter('accountId', e.target.value)} aria-label="Conta de anúncios">
            <option value="all">Todas as contas</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Select className="!w-auto max-w-60" value={f.campaignId} onChange={(e) => setFilter('campaignId', e.target.value)} aria-label="Campanha">
            <option value="all">Todas as campanhas</option>
            {visibleCampaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select className="!w-auto" value={f.objective} onChange={(e) => setFilter('objective', e.target.value)} aria-label="Objetivo">
            <option value="all">Todos os objetivos</option>
            {objectives.map((o) => <option key={o} value={o}>{o}</option>)}
          </Select>
          <Select className="!w-auto" value={f.status} onChange={(e) => setFilter('status', e.target.value)} aria-label="Status">
            <option value="all">Todos os status</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select className="!w-auto max-w-60" value={f.adId} onChange={(e) => setFilter('adId', e.target.value)} aria-label="Criativo">
            <option value="all">Todos os criativos</option>
            {all.perf.map((p) => <option key={p.ad.id} value={p.ad.id}>{p.ad.name}</option>)}
          </Select>
          <Select className="!w-auto" value={metric} onChange={(e) => setMetric(e.target.value as Metric)} aria-label="Indicador de desempenho">
            {Object.entries(METRIC_LABEL).map(([k, v]) => <option key={k} value={k}>Indicador: {v}</option>)}
          </Select>
          {(local || projectF !== 'all' || Object.values(f).some((v) => v !== 'all')) && (
            <Button size="sm" variant="ghost" onClick={() => { setLocal(null); setProjectF('all'); setF({ accountId: 'all', campaignId: 'all', status: 'all', objective: 'all', adId: 'all' }) }}>Limpar filtros</Button>
          )}
        </div>
      </Card>

      {/* Resumo financeiro do tráfego */}
      <div className="card p-5 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-primary/10 to-transparent">
        <div>
          <div className="text-xs font-semibold text-muted">Investimento total no período</div>
          <div className="text-3xl md:text-4xl font-extrabold tabular-nums tracking-tight" key={t.spend}><span className="animate-fade-up inline-block">{money(t.spend)}</span></div>
          <div className="text-xs text-faint mt-1">{date(period.preset === 'tudo' ? null : period.from)}{period.preset !== 'tudo' && ' a '}{date(period.preset === 'tudo' ? null : period.to)} · soma do gasto no nível de anúncio ({data.withSpend.length} anúncio(s) com investimento)</div>
        </div>
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'geral', label: 'Visão geral' }, { value: 'campanhas', label: 'Campanhas' }, { value: 'conjuntos', label: 'Conjuntos' }, { value: 'anuncios', label: 'Anúncios e criativos' }, { value: 'historico', label: 'Histórico' }]} />
      </div>

      {data.loading ? (
        <Skeleton className="h-96" />
      ) : all.perf.length === 0 ? (
        <Card><EmptyState icon={Megaphone} title="Nenhum anúncio para este escopo" description="Conecte uma conta de anúncios em Configurações → Integrações e vincule-a ao projeto para importar campanhas e criativos." /></Card>
      ) : (
        <>
          {(tab === 'geral' || tab === 'anuncios') && <KpiGrid t={t} />}
          {tab === 'geral' && <SpendByCreative perf={data.withSpend} total={t.spend} />}

          {tab === 'anuncios' && (
            <div>
              <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-bold">Criativos</h3>
                  <p className="text-sm text-muted">{data.withSpend.length} anúncio(s) com investimento no período · ordenado por <strong className="text-ink">{AD_SORT_LABEL[sort]}</strong></p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select className="!w-auto !h-9" value={sort} onChange={(e) => setSort(e.target.value as AdSortKey)} aria-label="Ordenar anúncios">
                    {Object.entries(AD_SORT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                  <Segmented size="sm" value={view} onChange={setView} options={[{ value: 'cards', label: 'Cards', icon: LayoutGrid }, { value: 'table', label: 'Tabela', icon: Table2 }]} />
                </div>
              </div>
              {sorted.length === 0 ? (
                <Card><EmptyState icon={ImageIcon} title="Sem investimento no período" description="Nenhum anúncio teve gasto com os filtros atuais. Amplie o período ou limpe os filtros." /></Card>
              ) : view === 'cards' ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                  {sorted.map((p, i) => <AdCard key={p.ad.id} p={p} rank={i + 1} sort={sort} campaign={campName(p.ad.campaign_id)} adSet={setName(p.ad.ad_set_id)} period={period} onOpen={() => setOpen(p)} />)}
                </div>
              ) : (
                <AdTable rows={sorted} campName={campName} onOpen={setOpen} />
              )}
              <div className="mt-5"><SpendByCreative perf={data.withSpend} total={t.spend} /></div>
            </div>
          )}

          {tab === 'campanhas' && (
            <GroupTable
              title="Campanhas"
              groups={visibleCampaigns.map((c) => ({ id: c.id, name: c.name, sub: c.objective, status: c.status, items: data.perf.filter((p) => p.ad.campaign_id === c.id) }))}
              total={t}
            />
          )}
          {tab === 'conjuntos' && (
            <GroupTable
              title="Conjuntos de anúncios"
              groups={all.adSets.filter((s) => data.perf.some((p) => p.ad.ad_set_id === s.id)).map((s) => ({ id: s.id, name: s.name, sub: campName(s.campaign_id), status: s.status, items: data.perf.filter((p) => p.ad.ad_set_id === s.id) }))}
              total={t}
            />
          )}
          {tab === 'historico' && <History rows={data.rows} period={period} metric={metric} />}
          {tab === 'geral' && <History rows={data.rows} period={period} metric={metric} compact />}
        </>
      )}
      {open && <AdDetail p={open} campaign={campName(open.ad.campaign_id)} adSet={setName(open.ad.ad_set_id)} rows={data.rows.filter((r) => r.ad_id === open.ad.id)} period={period} onClose={() => setOpen(null)} />}
    </div>
  )
}

function KpiGrid({ t }: { t: TrafficKpis }) {
  const hasPurch = t.purchases > 0
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7 gap-3">
      <KpiTile title="Investimento" value={money(t.spend)} />
      <KpiTile title="Impressões" value={num(t.impressions)} />
      <KpiTile title="Alcance" value={num(t.reach)} description="soma diária (aprox.)" />
      <KpiTile title="Cliques no link" value={num(t.link_clicks)} />
      <KpiTile title="CTR de link" value={pct(t.ctr, 2)} />
      <KpiTile title="CPC de link" value={money(t.cpc)} />
      <KpiTile title="CPM" value={money(t.cpm)} />
      <KpiTile title="Leads" value={num(t.leads)} tone="primary" />
      <KpiTile title="Custo por lead" value={money(t.cpl)} />
      <KpiTile title="Compras atribuídas" value={hasPurch ? num(t.purchases) : 'Indisponível'} empty={!hasPurch} />
      <KpiTile title="Custo por compra" value={money(t.cpa)} empty={!hasPurch} />
      <KpiTile title="Receita atribuída" value={t.purchase_value > 0 ? money(t.purchase_value) : 'Indisponível'} empty={!t.purchase_value} tone="success" />
      <KpiTile title="ROAS" value={ratio(t.roas)} empty={t.roas === null} tone="success" />
    </div>
  )
}

function IntegrationBar({ accounts, isDemo, lastSync }: { accounts: AdAccount[]; isDemo: boolean; lastSync: string | null }) {
  const { isAdmin } = useAuth()
  const { run, busy } = useAction()
  const real = accounts.filter((a) => !a.is_demo)
  const connected = real.filter((a) => a.status === 'conectada' && a.last_sync_status === 'ok')
  const errored = real.filter((a) => a.status === 'erro' || a.status === 'expirada')
  const stale = connected.some((a) => !a.last_sync_at || Date.now() - new Date(a.last_sync_at).getTime() > 24 * 3600 * 1000)
  if (isDemo && !real.length)
    return (
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <DemoBanner><AlertCircle className="size-3.5" />Dados demonstrativos — conecte sua conta de anúncios para visualizar resultados reais.</DemoBanner>
        {isAdmin && <RouterLink to="/configuracoes?aba=integracoes" className="text-xs font-semibold text-primary inline-flex items-center gap-1"><Link2 className="size-3.5" />Conectar Meta Ads</RouterLink>}
      </div>
    )
  return (
    <div className="flex flex-wrap items-center gap-3 justify-between text-xs">
      <div className="flex flex-wrap items-center gap-2">
        {connected.length > 0 && <Badge tone={stale ? 'warning' : 'success'}><CheckCircle2 className="size-3" />{stale ? 'Dados desatualizados' : 'Dados atualizados'} · última sincronização {relative(connected[0].last_sync_at)}</Badge>}
        {errored.map((a) => <Badge key={a.id} tone="danger"><AlertCircle className="size-3" />{a.name}: {a.status === 'expirada' ? 'autorização expirada — reconecte' : a.last_error ?? 'erro na sincronização'}</Badge>)}
        {real.some((a) => a.status === 'pendente') && <Badge tone="warning">Conexão pendente</Badge>}
        {lastSync && <span className="text-faint">Métricas importadas em {dateTime(lastSync)}</span>}
      </div>
      {isAdmin && real.length > 0 && (
        <Button size="sm" icon={RefreshCw} loading={busy} onClick={() => run(async () => {
          for (const a of real) await backend.rpc('meta_sync', { ad_account_id: a.id })
          await invalidate('ad_accounts', 'campaigns', 'ad_sets', 'ads', 'ad_metrics_daily')
        }, 'Sincronização concluída.')}>Sincronizar novamente</Button>
      )}
    </div>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className={clsx('font-bold tabular-nums text-sm', highlight && 'text-primary')}>{value}</div>
    </div>
  )
}

function managerUrl(p: AdPerformance) {
  if (p.ad.is_demo) return null
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?selected_ad_ids=${encodeURIComponent(p.ad.external_id)}`
}

function AdCard({ p, rank, sort, campaign, adSet, period, onOpen }: { p: AdPerformance; rank: number; sort: AdSortKey; campaign: string; adSet: string; period: Period; onOpen: () => void }) {
  const url = managerUrl(p)
  const hl = (k: AdSortKey) => sort === k
  return (
    <Card className="overflow-hidden flex flex-col animate-fade-up">
      <button onClick={onOpen} className="relative aspect-square bg-surface-3 group overflow-hidden" aria-label={`Ver detalhes de ${p.ad.name}`}>
        {p.ad.thumbnail_url ? <img src={p.ad.thumbnail_url} alt={p.ad.name} className="size-full object-cover group-hover:scale-[1.03] transition duration-500" /> : <ImageIcon className="size-8 text-faint m-auto" />}
        <span className="absolute top-3 left-3 rounded-lg bg-bg/85 px-2 py-0.5 text-xs font-extrabold">#{rank}</span>
        {p.ad.is_demo && <span className="absolute top-3 right-3 rounded-lg bg-warning/90 text-black px-2 py-0.5 text-[10px] font-bold uppercase">Exemplo</span>}
        {p.ad.creative_type === 'video' && <PlayCircle className="absolute bottom-3 right-3 size-9 text-white drop-shadow-lg" />}
      </button>
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="min-w-0">
          <h4 className="font-bold text-sm truncate" title={p.ad.name}>{p.ad.name}</h4>
          <p className="text-xs text-muted truncate" title={campaign}>{campaign}</p>
          <p className="text-[11px] text-faint truncate">{adSet} · {p.ad.placement}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={adStatusTone(p.ad.status)} dot>{p.ad.status}</Badge>
          <Badge>{period.preset === 'tudo' ? 'Todo o período' : `${shortDate(period.from)}–${shortDate(period.to)}`}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-x-2 gap-y-2.5">
          <Metric label="Investido" value={money(p.spend)} highlight={hl('spend')} />
          <Metric label="Leads" value={num(p.leads)} highlight={hl('leads')} />
          <Metric label="Custo/lead" value={money(p.cpl)} highlight={hl('cpl')} />
          <Metric label="Impressões" value={num(p.impressions)} />
          <Metric label="Cliques link" value={num(p.link_clicks)} highlight={hl('clicks')} />
          <Metric label="CTR" value={pct(p.ctr, 2)} highlight={hl('ctr')} />
          <Metric label="CPC" value={money(p.cpc)} highlight={hl('cpc')} />
          <Metric label="Compras" value={p.purchases ? num(p.purchases) : '—'} highlight={hl('purchases')} />
          <Metric label="ROAS" value={ratio(p.roas)} highlight={hl('roas')} />
        </div>
        <div className="mt-auto pt-2 border-t border-line flex items-center justify-between text-xs">
          <span className="text-muted">Custo/compra: <strong className="text-ink">{money(p.cpa)}</strong></span>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary"><ExternalLink className="size-3.5" />Gerenciador</a>
          ) : (
            <span className="text-faint" title="Disponível após conectar a conta Meta">Gerenciador indisponível</span>
          )}
        </div>
      </div>
    </Card>
  )
}

function AdTable({ rows, campName, onOpen }: { rows: AdPerformance[]; campName: (id: string) => string; onOpen: (p: AdPerformance) => void }) {
  return (
    <DataTable
      rows={rows.map((r) => ({ ...r, id: r.ad.id }))}
      onRowClick={onOpen}
      searchText={(r) => `${r.ad.name} ${campName(r.ad.campaign_id)}`}
      columns={[
        { key: 'ad', header: 'Anúncio', cell: (r) => <div className="flex items-center gap-2.5 min-w-56">{r.ad.thumbnail_url && <img src={r.ad.thumbnail_url} alt="" className="size-10 rounded-lg object-cover" />}<div className="min-w-0"><div className="font-semibold truncate">{r.ad.name}</div><div className="text-xs text-muted truncate">{campName(r.ad.campaign_id)}</div></div></div>, sortValue: (r) => r.ad.name },
        { key: 'st', header: 'Status', cell: (r) => <Badge tone={adStatusTone(r.ad.status)}>{r.ad.status}</Badge> },
        { key: 'spend', header: 'Investido', align: 'right', cell: (r) => money(r.spend), sortValue: (r) => r.spend },
        { key: 'imp', header: 'Impressões', align: 'right', cell: (r) => num(r.impressions), sortValue: (r) => r.impressions },
        { key: 'clk', header: 'Cliques', align: 'right', cell: (r) => num(r.link_clicks), sortValue: (r) => r.link_clicks },
        { key: 'ctr', header: 'CTR', align: 'right', cell: (r) => pct(r.ctr, 2), sortValue: (r) => r.ctr },
        { key: 'cpc', header: 'CPC', align: 'right', cell: (r) => money(r.cpc), sortValue: (r) => r.cpc },
        { key: 'cpm', header: 'CPM', align: 'right', cell: (r) => money(r.cpm), sortValue: (r) => r.cpm },
        { key: 'leads', header: 'Leads', align: 'right', cell: (r) => num(r.leads), sortValue: (r) => r.leads },
        { key: 'cpl', header: 'CPL', align: 'right', cell: (r) => money(r.cpl), sortValue: (r) => r.cpl },
        { key: 'pur', header: 'Compras', align: 'right', cell: (r) => num(r.purchases), sortValue: (r) => r.purchases },
        { key: 'cpa', header: 'Custo/compra', align: 'right', cell: (r) => money(r.cpa), sortValue: (r) => r.cpa },
        { key: 'roas', header: 'ROAS', align: 'right', cell: (r) => ratio(r.roas), sortValue: (r) => r.roas },
      ]}
    />
  )
}

function SpendByCreative({ perf, total }: { perf: AdPerformance[]; total: number }) {
  const rows = [...perf].sort((a, b) => b.spend - a.spend).map((p) => ({ ...p, id: p.ad.id }))
  return (
    <Card className="p-5">
      <h3 className="font-bold mb-1">Investimento por criativo</h3>
      <p className="text-xs text-muted mb-4">Quanto foi gasto em cada anúncio no período. A soma corresponde ao investimento total.</p>
      <DataTable
        rows={rows}
        pageSize={10}
        columns={[
          { key: 'n', header: 'Criativo', cell: (r) => <span className="font-semibold">{r.ad.name}</span>, sortValue: (r) => r.ad.name },
          { key: 's', header: 'Investimento', align: 'right', cell: (r) => money(r.spend), sortValue: (r) => r.spend },
          { key: 'p', header: 'Participação', align: 'right', cell: (r) => <div className="flex items-center justify-end gap-2"><div className="w-24 h-1.5 rounded-full bg-surface-3 overflow-hidden"><div className="h-full bg-primary" style={{ width: `${total ? (r.spend / total) * 100 : 0}%` }} /></div><span className="w-12">{pct(total ? (r.spend / total) * 100 : null)}</span></div>, sortValue: (r) => r.spend },
          { key: 'l', header: 'Leads', align: 'right', cell: (r) => num(r.leads), sortValue: (r) => r.leads },
          { key: 'c', header: 'CPL', align: 'right', cell: (r) => money(r.cpl), sortValue: (r) => r.cpl },
        ]}
        footer={<tr><td className="px-3 py-2.5">Total</td><td className="px-3 py-2.5 text-right tabular-nums">{money(total)}</td><td className="px-3 py-2.5 text-right">100%</td><td className="px-3 py-2.5 text-right tabular-nums">{num(perf.reduce((a, p) => a + p.leads, 0))}</td><td /></tr>}
      />
    </Card>
  )
}

function GroupTable({ title, groups, total }: { title: string; groups: { id: string; name: string; sub: string; status: string; items: AdPerformance[] }[]; total: TrafficKpis }) {
  // Totais de grupo derivados da soma dos anúncios — nunca somados de forma independente.
  const rows = groups.map((g) => {
    const t = kpis(g.items.reduce((acc, i) => ({ spend: acc.spend + i.spend, impressions: acc.impressions + i.impressions, reach: acc.reach + i.reach, link_clicks: acc.link_clicks + i.link_clicks, leads: acc.leads + i.leads, purchases: acc.purchases + i.purchases, purchase_value: acc.purchase_value + i.purchase_value, rows: acc.rows + i.rows }), emptyTotals()))
    return { ...g, ...t, ads: g.items.length }
  })
  return (
    <Card className="p-5">
      <h3 className="font-bold mb-4">{title}</h3>
      <DataTable
        rows={rows}
        searchText={(r) => `${r.name} ${r.sub}`}
        initialSort={{ key: 'spend', dir: 'desc' }}
        columns={[
          { key: 'name', header: 'Nome', cell: (r) => <div><div className="font-semibold">{r.name}</div><div className="text-xs text-muted">{r.sub} · {r.ads} anúncio(s)</div></div>, sortValue: (r) => r.name },
          { key: 'st', header: 'Status', cell: (r) => <Badge tone={adStatusTone(r.status)}>{r.status}</Badge> },
          { key: 'spend', header: 'Investimento', align: 'right', cell: (r) => money(r.spend), sortValue: (r) => r.spend },
          { key: 'imp', header: 'Impressões', align: 'right', cell: (r) => num(r.impressions), sortValue: (r) => r.impressions },
          { key: 'clk', header: 'Cliques', align: 'right', cell: (r) => num(r.link_clicks), sortValue: (r) => r.link_clicks },
          { key: 'ctr', header: 'CTR', align: 'right', cell: (r) => pct(r.ctr, 2), sortValue: (r) => r.ctr },
          { key: 'cpc', header: 'CPC', align: 'right', cell: (r) => money(r.cpc), sortValue: (r) => r.cpc },
          { key: 'leads', header: 'Leads', align: 'right', cell: (r) => num(r.leads), sortValue: (r) => r.leads },
          { key: 'cpl', header: 'CPL', align: 'right', cell: (r) => money(r.cpl), sortValue: (r) => r.cpl },
          { key: 'roas', header: 'ROAS', align: 'right', cell: (r) => ratio(r.roas), sortValue: (r) => r.roas },
        ]}
        footer={<tr><td className="px-3 py-2.5" colSpan={2}>Total do filtro</td><td className="px-3 py-2.5 text-right">{money(total.spend)}</td><td className="px-3 py-2.5 text-right">{num(total.impressions)}</td><td className="px-3 py-2.5 text-right">{num(total.link_clicks)}</td><td className="px-3 py-2.5 text-right">{pct(total.ctr, 2)}</td><td className="px-3 py-2.5 text-right">{money(total.cpc)}</td><td className="px-3 py-2.5 text-right">{num(total.leads)}</td><td className="px-3 py-2.5 text-right">{money(total.cpl)}</td><td className="px-3 py-2.5 text-right">{ratio(total.roas)}</td></tr>}
      />
    </Card>
  )
}

function useDaily(rows: { date: string; spend: number; impressions: number; reach: number; link_clicks: number; leads: number; purchases: number; purchase_value: number }[], period: Period) {
  return useMemo(() => {
    const by = new Map<string, typeof rows>()
    rows.forEach((r) => by.set(r.date, [...(by.get(r.date) ?? []), r]))
    return daysOf(period).map((d) => ({ date: d, ...kpis(sumMetrics((by.get(d) ?? []) as never)) }))
  }, [rows, period])
}

function History({ rows, period, metric, compact }: { rows: Parameters<typeof useDaily>[0]; period: Period; metric: Metric; compact?: boolean }) {
  const daily = useDaily(rows, period)
  const chart = daily.map((d) => ({ d: shortDate(d.date), v: d[metric] === null ? null : Math.round((d[metric] as number) * 100) / 100 }))
  return (
    <Card className="p-5">
      <h3 className="font-bold">Histórico de desempenho · {METRIC_LABEL[metric]}</h3>
      <p className="text-xs text-muted mb-4">Valores diários no período. Altere o indicador nos filtros.</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chart} margin={{ left: 0, right: 8, top: 4 }}>
            <CartesianGrid stroke="#1d2943" vertical={false} />
            <XAxis dataKey="d" tick={{ fill: '#8b97b1', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
            <YAxis tick={{ fill: '#8b97b1', fontSize: 11 }} axisLine={false} tickLine={false} width={84} tickFormatter={(v) => fmtMetric(metric, v)} />
            <Tooltip contentStyle={{ background: '#111a2d', border: '1px solid #2a3a5c', borderRadius: 12 }} formatter={(v) => [fmtMetric(metric, v as number), METRIC_LABEL[metric]]} />
            <Line type="monotone" dataKey="v" stroke="var(--brand-primary)" strokeWidth={2.5} dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {!compact && (
        <div className="mt-5">
          <DataTable
            rows={[...daily].reverse().filter((d) => d.rows > 0).map((d) => ({ ...d, id: d.date }))}
            pageSize={10}
            columns={[
              { key: 'd', header: 'Data', cell: (r) => date(r.date), sortValue: (r) => r.date },
              { key: 's', header: 'Investimento', align: 'right', cell: (r) => money(r.spend), sortValue: (r) => r.spend },
              { key: 'i', header: 'Impressões', align: 'right', cell: (r) => num(r.impressions), sortValue: (r) => r.impressions },
              { key: 'c', header: 'Cliques', align: 'right', cell: (r) => num(r.link_clicks), sortValue: (r) => r.link_clicks },
              { key: 'ctr', header: 'CTR', align: 'right', cell: (r) => pct(r.ctr, 2), sortValue: (r) => r.ctr },
              { key: 'l', header: 'Leads', align: 'right', cell: (r) => num(r.leads), sortValue: (r) => r.leads },
              { key: 'cpl', header: 'CPL', align: 'right', cell: (r) => money(r.cpl), sortValue: (r) => r.cpl },
            ]}
          />
        </div>
      )}
    </Card>
  )
}

function AdDetail({ p, campaign, adSet, rows, period, onClose }: { p: AdPerformance; campaign: string; adSet: string; rows: Parameters<typeof useDaily>[0]; period: Period; onClose: () => void }) {
  const daily = useDaily(rows, period).map((d) => ({ d: shortDate(d.date), Investimento: d.spend, Leads: d.leads }))
  const url = managerUrl(p)
  return (
    <Modal open onClose={onClose} size="xl" title={p.ad.name} subtitle={`${campaign} · ${adSet}`}>
      <div className="grid md:grid-cols-[minmax(0,1fr)_1.2fr] gap-6">
        <div>
          <div className="rounded-2xl overflow-hidden bg-surface-3 border border-line relative">
            {p.ad.video_url ? <video src={p.ad.video_url} controls poster={p.ad.thumbnail_url ?? undefined} className="w-full" /> : p.ad.thumbnail_url ? <img src={p.ad.thumbnail_url} alt={p.ad.name} className="w-full" /> : <div className="aspect-square" />}
            {p.ad.creative_type === 'video' && !p.ad.video_url && <div className="absolute bottom-3 left-3 right-3 text-xs bg-bg/85 rounded-lg px-3 py-2">Prévia do vídeo indisponível {p.ad.is_demo ? 'nos dados demonstrativos' : 'para esta conta'}; exibindo a miniatura.</div>}
          </div>
          {p.ad.is_demo && <p className="text-xs text-warning mt-2">Criativo ilustrativo de exemplo — não é um anúncio real em veiculação.</p>}
        </div>
        <div className="space-y-4 min-w-0">
          <div className="flex flex-wrap gap-2"><Badge tone={adStatusTone(p.ad.status)} dot>{p.ad.status}</Badge><Badge>{p.ad.platform}</Badge><Badge>{p.ad.placement}</Badge></div>
          {(p.ad.primary_text || p.ad.headline) && (
            <div className="rounded-xl border border-line bg-surface-2 p-4 space-y-2 text-sm">
              {p.ad.primary_text && <div><div className="text-xs text-muted">Texto principal</div><p>{p.ad.primary_text}</p></div>}
              {p.ad.headline && <div><div className="text-xs text-muted">Título</div><p className="font-semibold">{p.ad.headline}</p></div>}
              {p.ad.description && <div><div className="text-xs text-muted">Descrição</div><p>{p.ad.description}</p></div>}
            </div>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 rounded-xl border border-line p-4">
            <Metric label="Investido" value={money(p.spend)} />
            <Metric label="Impressões" value={num(p.impressions)} />
            <Metric label="Cliques no link" value={num(p.link_clicks)} />
            <Metric label="CTR" value={pct(p.ctr, 2)} />
            <Metric label="CPC" value={money(p.cpc)} />
            <Metric label="CPM" value={money(p.cpm)} />
            <Metric label="Leads" value={num(p.leads)} />
            <Metric label="CPL" value={money(p.cpl)} />
            <Metric label="Compras" value={num(p.purchases)} />
            <Metric label="Custo/compra" value={money(p.cpa)} />
            <Metric label="Receita atrib." value={p.purchase_value ? money(p.purchase_value) : '—'} />
            <Metric label="ROAS" value={ratio(p.roas)} />
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <CartesianGrid stroke="#1d2943" vertical={false} />
                <XAxis dataKey="d" tick={{ fill: '#8b97b1', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis tick={{ fill: '#8b97b1', fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => money(v).replace(',00', '')} />
                <Tooltip contentStyle={{ background: '#111a2d', border: '1px solid #2a3a5c', borderRadius: 12 }} formatter={(v, n) => (n === 'Investimento' ? money(Number(v)) : num(Number(v)))} />
                <Bar dataKey="Investimento" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {url && <a href={url} target="_blank" rel="noreferrer"><Button icon={ExternalLink}>Abrir no Gerenciador de Anúncios</Button></a>}
        </div>
      </div>
    </Modal>
  )
}
