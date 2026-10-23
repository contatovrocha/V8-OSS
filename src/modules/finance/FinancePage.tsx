import { FileUp, Package, Pencil, Plus, Receipt, ShoppingBag, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useApp } from '@/app/AppContext'
import { EXPENSE_STATUS, PAYMENT_METHODS, SALE_STATUS } from '@/app/labels'
import { useFinance } from '@/app/useDomain'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/layout/AppLayout'
import { PeriodPicker } from '@/components/layout/PeriodPicker'
import { DataTable } from '@/components/ui/DataTable'
import { FileUpload, MoneyInput } from '@/components/ui/inputs'
import { Modal, useAction, useConfirm, useToast } from '@/components/ui/overlay'
import { Badge, Button, Card, Checkbox, EmptyState, Field, IconButton, Input, Progress, Select, Tabs, Textarea } from '@/components/ui/primitives'
import { KpiTile } from '@/components/ui/stats'
import { backend } from '@/data/client'
import { invalidate, useRows } from '@/data/store'
import type { Expense, Product, Sale, SaleStatus } from '@/data/types'
import { consolidate, productRanking, saleNet, TRAFFIC_CATEGORY } from '@/lib/finance'
import { date, money, num, pct, ratio, todayISO } from '@/lib/format'
import { inPeriod, resolvePeriod, type Period } from '@/lib/period'

export default function FinancePage() {
  return (
    <div>
      <PageHeader eyebrow="Resultado" title="Financeiro" subtitle="Faturamento, custos e resultado por expert e por projeto" />
      <FinanceView />
    </div>
  )
}

type Tab = 'resumo' | 'vendas' | 'despesas' | 'produtos' | 'projetos'

export function FinanceView({ fixedProjectId }: { fixedProjectId?: string }) {
  const app = useApp()
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>('resumo')
  const [local, setLocal] = useState<Period | null>(null)
  const period = local ?? app.period
  const [projectF, setProjectF] = useState('all')
  const [categoryF, setCategoryF] = useState('all')
  const projectIds = useMemo(() => (fixedProjectId ? new Set([fixedProjectId]) : projectF !== 'all' ? new Set([projectF]) : app.scopeProjectIds), [fixedProjectId, projectF, app.scopeProjectIds])
  const fin = useFinance(period, projectIds)
  const products = useRows('products')
  const s = fin.summary
  const projectsInScope = app.projects.filter((p) => projectIds.has(p.id))
  const planned = {
    revenue: projectsInScope.reduce((a, p) => a + p.revenue_goal, 0),
    sales: projectsInScope.reduce((a, p) => a + p.sales_goal, 0),
    budget: projectsInScope.reduce((a, p) => a + p.traffic_budget, 0),
  }
  const canEdit = isAdmin || projectsInScope.some((p) => app.experts.find((e) => e.id === p.expert_id)?.permissions.can_edit_finance)
  const ranking = productRanking(products.rows, fin.sales, period, projectIds, 'quantidade')

  return (
    <div className="space-y-5">
      <Card className="p-4 flex flex-wrap items-center gap-2">
        <PeriodPicker period={period} onChange={(p, c) => setLocal(resolvePeriod(p, c))} align="left" />
        {!fixedProjectId && (
          <Select className="!w-auto" value={projectF} onChange={(e) => setProjectF(e.target.value)} aria-label="Projeto">
            <option value="all">Todos os projetos</option>
            {app.projects.filter((p) => app.scopeProjectIds.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}
        <Select className="!w-auto" value={categoryF} onChange={(e) => setCategoryF(e.target.value)} aria-label="Categoria de despesa">
          <option value="all">Todas as categorias</option>
          {fin.categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </Select>
        <div className="ml-auto w-full lg:w-auto"><Tabs value={tab} onChange={setTab} tabs={[{ value: 'resumo', label: 'Resumo' }, { value: 'vendas', label: 'Vendas' }, { value: 'despesas', label: 'Despesas' }, { value: 'produtos', label: 'Produtos' }, ...(fixedProjectId ? [] : [{ value: 'projetos' as Tab, label: 'Custo por projeto' }])]} /></div>
      </Card>

      {tab === 'resumo' && (
        <>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-success mb-3">Realizado no período</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
              <KpiTile title="Faturamento bruto" value={money(s.grossRevenue)} tone="success" />
              <KpiTile title="Vendas aprovadas" value={num(s.approvedCount)} description={money(s.approvedGross)} />
              <KpiTile title="Reembolsos" value={money(s.refunds)} description={`${s.refundedCount} venda(s)`} tone={s.refunds ? 'danger' : undefined} />
              <KpiTile title="Receita líquida" value={money(s.netRevenue)} description="− descontos, taxas e reembolsos" />
              <KpiTile title="Investimento em tráfego" value={money(s.trafficInvestment)} description={s.adSpendManual ? `${money(s.adSpendSynced)} sincronizado + ${money(s.adSpendManual)} manual` : 'anúncios sincronizados'} />
              <KpiTile title="Outras despesas" value={money(s.otherExpenses)} />
              <KpiTile title="Custo total do projeto" value={money(s.totalCost)} />
              <KpiTile title="Resultado estimado" value={money(s.result)} tone={s.result >= 0 ? 'success' : 'danger'} />
              <KpiTile title="Margem estimada" value={pct(s.margin)} description="resultado ÷ receita líquida" />
              <KpiTile title="Ticket médio" value={money(s.avgTicket)} />
              <KpiTile title="ROAS (receita atribuída)" value={ratio(s.roas)} empty={s.roas === null} description={s.roas === null ? 'indisponível' : `${money(s.attributedRevenue)} atribuídos`} />
              <KpiTile title="Descontos e taxas" value={money(s.discounts + s.fees)} />
            </div>
            {s.reconciledTrafficExpenses > 0 && (
              <p className="text-xs text-muted mt-3">
                {money(s.reconciledTrafficExpenses)} em despesas de tráfego estão vinculadas a contas de anúncios sincronizadas e foram conciliadas — não são somadas novamente ao custo.
              </p>
            )}
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-muted mb-3">Planejado · metas dos projetos</h3>
            <div className="grid md:grid-cols-3 gap-3">
              {[
                ['Meta de faturamento', s.grossRevenue, planned.revenue, money],
                ['Meta de vendas', s.approvedCount, planned.sales, num],
                ['Orçamento de tráfego', s.trafficInvestment, planned.budget, money],
              ].map(([label, real, plan, f]) => {
                const fmt = f as (v: number) => string
                const v = (plan as number) > 0 ? ((real as number) / (plan as number)) * 100 : null
                return (
                  <Card key={label as string} className="p-4 border-dashed">
                    <div className="text-xs font-semibold text-muted">{label as string}</div>
                    <div className="text-xl font-extrabold mt-1">{fmt(plan as number)}</div>
                    <div className="text-xs text-faint mb-2">realizado {fmt(real as number)} · {v === null ? 'sem meta' : pct(v)}</div>
                    <Progress value={v} tone={(v ?? 0) > 100 && label === 'Orçamento de tráfego' ? 'danger' : 'success'} />
                  </Card>
                )
              })}
            </div>
            <p className="text-xs text-faint mt-2">Metas consideram o total do projeto; o realizado considera o período selecionado.</p>
          </div>
          <ProductRanking ranking={ranking} />
        </>
      )}
      {tab === 'vendas' && <SalesTab projectIds={projectIds} period={period} canEdit={canEdit} defaultProject={fixedProjectId ?? (projectF !== 'all' ? projectF : undefined)} />}
      {tab === 'despesas' && <ExpensesTab projectIds={projectIds} period={period} canEdit={canEdit} category={categoryF} defaultProject={fixedProjectId ?? (projectF !== 'all' ? projectF : undefined)} />}
      {tab === 'produtos' && <ProductsTab projectIds={projectIds} canEdit={canEdit} ranking={ranking} defaultProject={fixedProjectId ?? (projectF !== 'all' ? projectF : undefined)} />}
      {tab === 'projetos' && <ProjectCostTable period={period} projectIds={projectIds} category={categoryF} />}
    </div>
  )
}

function ProductRanking({ ranking }: { ranking: ReturnType<typeof productRanking> }) {
  return (
    <Card className="p-5">
      <h3 className="font-bold mb-1">Produtos mais vendidos</h3>
      <p className="text-xs text-muted mb-4">Ranking por quantidade de vendas aprovadas no período.</p>
      {ranking.every((r) => r.count === 0) ? <p className="text-sm text-muted">Sem vendas aprovadas no período.</p> : (
        <div className="space-y-3">
          {ranking.filter((r) => r.count > 0).map((r, i) => (
            <div key={r.product.id} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3">
              <span className="text-lg font-extrabold text-faint">#{i + 1}</span>
              <div className="min-w-0">
                <div className="flex justify-between text-sm"><span className="font-semibold truncate">{r.product.name}</span><span className="text-muted text-xs">{r.count} venda(s) · ticket {money(r.avgTicket)}</span></div>
                <Progress value={r.share} tone="accent" className="mt-1.5 h-1.5" />
              </div>
              <div className="text-right"><div className="font-bold tabular-nums text-sm">{money(r.revenue)}</div><div className="text-xs text-faint">{pct(r.share)}</div></div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ------------------------------------------------------------------ Vendas

function SalesTab({ projectIds, period, canEdit, defaultProject }: { projectIds: Set<string>; period: Period; canEdit: boolean; defaultProject?: string }) {
  const app = useApp()
  const { isAdmin } = useAuth()
  const sales = useRows('sales')
  const products = useRows('products')
  const { run } = useAction()
  const confirm = useConfirm()
  const [statusF, setStatusF] = useState<SaleStatus | 'all'>('all')
  const [editing, setEditing] = useState<Sale | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const list = sales.rows.filter((s) => projectIds.has(s.project_id) && inPeriod(s.sale_date, period) && (statusF === 'all' || s.status === statusF))
  const prodName = (id: string) => products.rows.find((p) => p.id === id)?.name ?? '—'
  const projName = (id: string) => app.projects.find((p) => p.id === id)?.name ?? '—'
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="font-bold">Vendas</h3>
        <div className="flex flex-wrap gap-2">
          <Select className="!w-auto !h-9" value={statusF} onChange={(e) => setStatusF(e.target.value as SaleStatus | 'all')} aria-label="Status do pagamento">
            <option value="all">Todos os status</option>
            {Object.entries(SALE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          {canEdit && <Button size="sm" icon={FileUp} onClick={() => setImporting(true)}>Importar CSV</Button>}
          {canEdit && <Button size="sm" variant="primary" icon={Plus} onClick={() => setEditing('new')}>Registrar venda</Button>}
        </div>
      </div>
      <DataTable
        rows={list}
        searchText={(s) => `${s.order_ref} ${prodName(s.product_id)} ${s.origin}`}
        initialSort={{ key: 'date', dir: 'desc' }}
        empty={<EmptyState icon={ShoppingBag} title="Nenhuma venda no período" description="Registre vendas manualmente ou importe de uma plataforma." />}
        columns={[
          { key: 'date', header: 'Data', cell: (s) => date(s.sale_date), sortValue: (s) => s.sale_date },
          { key: 'ref', header: 'Pedido', cell: (s) => <span className="font-semibold">{s.order_ref}</span>, sortValue: (s) => s.order_ref },
          { key: 'prod', header: 'Produto', cell: (s) => prodName(s.product_id), sortValue: (s) => prodName(s.product_id) },
          { key: 'proj', header: 'Projeto', cell: (s) => <span className="text-muted text-xs">{projName(s.project_id)}</span> },
          { key: 'gross', header: 'Bruto', align: 'right', cell: (s) => money(s.gross_amount), sortValue: (s) => s.gross_amount },
          { key: 'net', header: 'Líquido', align: 'right', cell: (s) => money(saleNet(s)), sortValue: (s) => saleNet(s) },
          { key: 'pay', header: 'Pagamento', cell: (s) => s.payment_method },
          { key: 'st', header: 'Status', cell: (s) => <Badge tone={SALE_STATUS[s.status].tone}>{SALE_STATUS[s.status].label}</Badge>, sortValue: (s) => s.status },
          { key: 'orig', header: 'Origem', cell: (s) => s.origin || '—' },
          ...(canEdit ? [{ key: 'act', header: '', cell: (s: Sale) => (
            <div className="flex">
              <IconButton icon={Pencil} label="Editar" onClick={() => setEditing(s)} />
              {isAdmin && <IconButton icon={Trash2} label="Excluir" onClick={async () => {
                if (await confirm({ title: 'Excluir venda?', message: `A venda ${s.order_ref} (${money(s.gross_amount)}) será excluída. A ação fica registrada na auditoria.`, tone: 'danger', confirmLabel: 'Excluir' }))
                  run(async () => { await backend.remove('sales', s.id); await invalidate('sales', 'activity_log') }, 'Venda excluída.')
              }} />}
            </div>
          ) }] : []),
        ]}
      />
      {editing && <SaleForm sale={editing === 'new' ? null : editing} defaultProject={defaultProject} onClose={() => setEditing(null)} />}
      {importing && <SalesImport defaultProject={defaultProject} onClose={() => setImporting(false)} />}
    </Card>
  )
}

function SaleForm({ sale, defaultProject, onClose }: { sale: Sale | null; defaultProject?: string; onClose: () => void }) {
  const app = useApp()
  const products = useRows('products')
  const { run, busy } = useAction()
  const firstProject = defaultProject ?? app.selectedProject?.id ?? app.projects[0]?.id ?? ''
  const [d, setD] = useState<Partial<Sale>>(sale ?? { project_id: firstProject, product_id: products.rows.find((p) => p.project_id === firstProject)?.id ?? '', order_ref: '', sale_date: todayISO(), gross_amount: 0, discount: 0, fees: 0, refund_amount: 0, payment_method: 'Pix', status: 'aprovada', origin: '', notes: '', external_source: null, external_id: null, is_demo: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof Sale>(k: K, v: Sale[K]) => setD((s) => ({ ...s, [k]: v }))
  const projProducts = products.rows.filter((p) => p.project_id === d.project_id)
  const net = saleNet({ gross_amount: d.gross_amount ?? 0, discount: d.discount ?? 0, fees: d.fees ?? 0, refund_amount: d.refund_amount ?? 0 })
  const save = () => {
    const e: Record<string, string> = {}
    if (!d.project_id) e.project_id = 'Selecione o projeto.'
    if (!d.product_id) e.product_id = 'Selecione o produto.'
    if (!d.sale_date) e.sale_date = 'Informe a data.'
    if (!d.gross_amount || d.gross_amount <= 0) e.gross_amount = 'Informe o valor bruto.'
    if ((d.discount ?? 0) + (d.refund_amount ?? 0) > (d.gross_amount ?? 0)) e.refund_amount = 'Desconto e reembolso não podem superar o valor bruto.'
    if (d.status === 'reembolsada' && !d.refund_amount) e.refund_amount = 'Informe o valor reembolsado.'
    setErrors(e)
    if (Object.keys(e).length) return
    run(async () => {
      if (sale) await backend.update('sales', sale.id, d)
      else await backend.insert('sales', { ...d, order_ref: d.order_ref || `PED-${Date.now().toString().slice(-6)}` })
      await invalidate('sales', 'activity_log')
      onClose()
    }, sale ? 'Venda atualizada.' : 'Venda registrada.')
  }
  return (
    <Modal open onClose={onClose} size="lg" title={sale ? 'Editar venda' : 'Registrar venda'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>Salvar</Button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Projeto" required error={errors.project_id}><Select value={d.project_id} onChange={(e) => setD((s) => ({ ...s, project_id: e.target.value, product_id: products.rows.find((p) => p.project_id === e.target.value)?.id ?? '' }))}>{app.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Produto" required error={errors.product_id} hint={!projProducts.length ? 'Cadastre produtos na aba Produtos.' : undefined}>
          <Select value={d.product_id} onChange={(e) => { const p = products.rows.find((x) => x.id === e.target.value); setD((s) => ({ ...s, product_id: e.target.value, gross_amount: s.gross_amount || p?.price || 0 })) }}>
            <option value="">Selecione...</option>
            {projProducts.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.price)}</option>)}
          </Select>
        </Field>
        <Field label="Comprador ou identificador do pedido"><Input value={d.order_ref} onChange={(e) => set('order_ref', e.target.value)} placeholder="Gerado automaticamente se vazio" /></Field>
        <Field label="Data da venda" required error={errors.sale_date}><Input type="date" value={d.sale_date} onChange={(e) => set('sale_date', e.target.value)} /></Field>
        <Field label="Valor bruto" required error={errors.gross_amount}><MoneyInput value={d.gross_amount} invalid={!!errors.gross_amount} onChange={(v) => set('gross_amount', v ?? 0)} /></Field>
        <Field label="Desconto"><MoneyInput value={d.discount} onChange={(v) => set('discount', v ?? 0)} /></Field>
        <Field label="Taxas"><MoneyInput value={d.fees} onChange={(v) => set('fees', v ?? 0)} /></Field>
        <Field label="Reembolso" error={errors.refund_amount}><MoneyInput value={d.refund_amount} onChange={(v) => set('refund_amount', v ?? 0)} /></Field>
        <Field label="Valor líquido" hint="Bruto − desconto − taxas − reembolso"><div className="h-10 rounded-xl bg-surface-3/60 border border-line px-3 flex items-center font-bold tabular-nums">{money(net)}</div></Field>
        <Field label="Forma de pagamento"><Select value={d.payment_method} onChange={(e) => set('payment_method', e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</Select></Field>
        <Field label="Status do pagamento"><Select value={d.status} onChange={(e) => set('status', e.target.value as SaleStatus)}>{Object.entries(SALE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
        <Field label="Origem da venda"><Input value={d.origin} onChange={(e) => set('origin', e.target.value)} placeholder="Meta Ads, indicação, orgânico..." /></Field>
        <Field label="Observações" className="sm:col-span-2"><Textarea value={d.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

/**
 * Importação de vendas via CSV — estrutura pronta para plataformas externas.
 * Colunas: pedido;data;produto;valor_bruto;desconto;taxas;reembolso;status;forma_pagamento;origem
 * Pedidos já importados (mesma origem + pedido) são ignorados, evitando duplicidade.
 */
function SalesImport({ defaultProject, onClose }: { defaultProject?: string; onClose: () => void }) {
  const app = useApp()
  const products = useRows('products')
  const sales = useRows('sales')
  const toast = useToast()
  const { run, busy } = useAction()
  const [projectId, setProjectId] = useState(defaultProject ?? app.projects[0]?.id ?? '')
  const [source, setSource] = useState('csv')
  const [rows, setRows] = useState<Partial<Sale>[]>([])
  const [problems, setProblems] = useState<string[]>([])
  const ref = useRef<HTMLInputElement>(null)
  const num = (v: string) => Number((v ?? '0').replace(/\./g, '').replace(',', '.')) || 0
  const parse = async (f: File) => {
    const text = await f.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    const sep = lines[0]?.includes(';') ? ';' : ','
    const header = lines[0].split(sep).map((h) => h.trim().toLowerCase())
    const idx = (k: string) => header.indexOf(k)
    const errs: string[] = []
    const out: Partial<Sale>[] = []
    const statusMap: Record<string, SaleStatus> = { aprovada: 'aprovada', aprovado: 'aprovada', paid: 'aprovada', pendente: 'pendente', reembolsada: 'reembolsada', refunded: 'reembolsada', cancelada: 'cancelada', cancelado: 'cancelada' }
    lines.slice(1).forEach((l, i) => {
      const c = l.split(sep).map((x) => x.trim())
      const prod = products.rows.find((p) => p.project_id === projectId && p.name.toLowerCase() === (c[idx('produto')] ?? '').toLowerCase())
      const dt = c[idx('data')] ?? ''
      const iso = /^\d{2}\/\d{2}\/\d{4}$/.test(dt) ? `${dt.slice(6)}-${dt.slice(3, 5)}-${dt.slice(0, 2)}` : dt
      if (!prod) return errs.push(`Linha ${i + 2}: produto "${c[idx('produto')]}" não encontrado no projeto.`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return errs.push(`Linha ${i + 2}: data inválida.`)
      const ref = c[idx('pedido')]
      if (!ref) return errs.push(`Linha ${i + 2}: pedido sem identificador.`)
      out.push({
        project_id: projectId, product_id: prod.id, order_ref: ref, sale_date: iso, gross_amount: num(c[idx('valor_bruto')]), discount: num(c[idx('desconto')]),
        fees: num(c[idx('taxas')]), refund_amount: num(c[idx('reembolso')]), status: statusMap[(c[idx('status')] ?? 'aprovada').toLowerCase()] ?? 'pendente',
        payment_method: c[idx('forma_pagamento')] || 'Outro', origin: c[idx('origem')] || source, notes: 'Importado via CSV', external_source: source, external_id: ref, is_demo: false,
      })
    })
    setRows(out)
    setProblems(errs)
  }
  const existing = new Set(sales.rows.filter((s) => s.external_source === source).map((s) => s.external_id))
  const fresh = rows.filter((r) => !existing.has(r.external_id!))
  return (
    <Modal open onClose={onClose} size="lg" title="Importar vendas (CSV)" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} disabled={!fresh.length} onClick={() => run(async () => {
      await backend.insertMany('sales', fresh)
      await invalidate('sales', 'activity_log')
      onClose()
    }, `${fresh.length} venda(s) importada(s).`)}>Importar {fresh.length || ''}</Button></>}>
      <div className="space-y-4 text-sm">
        <p className="text-muted">Colunas esperadas (separador ; ou ,): <code className="text-ink">pedido;data;produto;valor_bruto;desconto;taxas;reembolso;status;forma_pagamento;origem</code>. Datas em DD/MM/AAAA ou AAAA-MM-DD.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Projeto"><Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>{app.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <Field label="Plataforma de origem" hint="Usada para evitar duplicidade"><Input value={source} onChange={(e) => setSource(e.target.value.trim() || 'csv')} /></Field>
        </div>
        <Button icon={FileUp} onClick={() => ref.current?.click()}>Selecionar arquivo CSV</Button>
        <input ref={ref} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) parse(f).catch(() => toast('error', 'Não foi possível ler o arquivo.')) }} />
        {rows.length > 0 && <p><strong>{fresh.length}</strong> venda(s) nova(s) · {rows.length - fresh.length} já importada(s) e ignorada(s).</p>}
        {problems.length > 0 && <ul className="text-danger text-xs space-y-1 max-h-32 overflow-auto">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
      </div>
    </Modal>
  )
}

// ------------------------------------------------------------------ Despesas

function ExpensesTab({ projectIds, period, canEdit, category, defaultProject }: { projectIds: Set<string>; period: Period; canEdit: boolean; category: string; defaultProject?: string }) {
  const app = useApp()
  const { isAdmin } = useAuth()
  const expenses = useRows('expenses')
  const metrics = useRows('ad_metrics_daily')
  const { run } = useAction()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)
  const synced = new Set(metrics.rows.map((m) => m.ad_account_id))
  const list = expenses.rows.filter((e) => projectIds.has(e.project_id) && inPeriod(e.expense_date, period) && (category === 'all' || e.category === category))
  const total = list.filter((e) => e.status !== 'cancelada' && !(e.ad_account_id && synced.has(e.ad_account_id))).reduce((a, e) => a + e.amount, 0)
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-bold">Despesas</h3>
          <p className="text-xs text-muted">Total considerado no custo: <strong className="text-ink">{money(total)}</strong></p>
        </div>
        {canEdit && <Button size="sm" variant="primary" icon={Plus} onClick={() => setEditing('new')}>Registrar despesa</Button>}
      </div>
      <DataTable
        rows={list}
        searchText={(e) => `${e.description} ${e.category} ${e.owner}`}
        initialSort={{ key: 'date', dir: 'desc' }}
        empty={<EmptyState icon={Receipt} title="Nenhuma despesa no período" description="Registre os custos de produção, equipe, estrutura do evento e ferramentas." />}
        columns={[
          { key: 'date', header: 'Data', cell: (e) => date(e.expense_date), sortValue: (e) => e.expense_date },
          { key: 'desc', header: 'Descrição', cell: (e) => <div><div className="font-semibold">{e.description}</div>{e.ad_account_id && synced.has(e.ad_account_id) && <div className="text-xs text-primary">Conciliada com a sincronização de anúncios — não somada</div>}</div>, sortValue: (e) => e.description },
          { key: 'cat', header: 'Categoria', cell: (e) => <Badge tone={e.category === TRAFFIC_CATEGORY ? 'primary' : 'neutral'}>{e.category}</Badge>, sortValue: (e) => e.category },
          { key: 'amt', header: 'Valor', align: 'right', cell: (e) => money(e.amount), sortValue: (e) => e.amount },
          { key: 'pay', header: 'Pagamento', cell: (e) => e.payment_method },
          { key: 'st', header: 'Status', cell: (e) => <Badge tone={e.status === 'paga' ? 'success' : e.status === 'pendente' ? 'warning' : 'danger'}>{EXPENSE_STATUS[e.status]}</Badge> },
          { key: 'own', header: 'Responsável', cell: (e) => e.owner || '—' },
          { key: 'rec', header: 'Comprovante', cell: (e) => (e.receipt_url ? <a href={e.receipt_url} target="_blank" rel="noreferrer" className="text-primary text-xs">Ver</a> : '—') },
          ...(canEdit ? [{ key: 'act', header: '', cell: (e: Expense) => (
            <div className="flex">
              <IconButton icon={Pencil} label="Editar" onClick={() => setEditing(e)} />
              {isAdmin && <IconButton icon={Trash2} label="Excluir" onClick={async () => {
                if (await confirm({ title: 'Excluir despesa?', message: `"${e.description}" (${money(e.amount)}) será excluída. A ação fica registrada na auditoria.`, tone: 'danger', confirmLabel: 'Excluir' }))
                  run(async () => { await backend.remove('expenses', e.id); await invalidate('expenses', 'activity_log') }, 'Despesa excluída.')
              }} />}
            </div>
          ) }] : []),
        ]}
      />
      {editing && <ExpenseForm expense={editing === 'new' ? null : editing} defaultProject={defaultProject ?? app.selectedProject?.id} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function ExpenseForm({ expense, defaultProject, onClose }: { expense: Expense | null; defaultProject?: string; onClose: () => void }) {
  const app = useApp()
  const cats = useRows('expense_categories')
  const accounts = useRows('ad_accounts')
  const { run, busy } = useAction()
  const [d, setD] = useState<Partial<Expense>>(expense ?? { project_id: defaultProject ?? app.projects[0]?.id ?? '', description: '', category: 'Produção', expense_date: todayISO(), amount: 0, payment_method: 'Pix', status: 'paga', owner: '', receipt_url: null, notes: '', ad_account_id: null, is_demo: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof Expense>(k: K, v: Expense[K]) => setD((s) => ({ ...s, [k]: v }))
  const isTraffic = cats.rows.find((c) => c.name === d.category)?.is_traffic || d.category === TRAFFIC_CATEGORY
  const save = () => {
    const e: Record<string, string> = {}
    if (!d.description?.trim()) e.description = 'Informe a descrição.'
    if (!d.amount || d.amount <= 0) e.amount = 'Informe um valor maior que zero.'
    if (!d.expense_date) e.expense_date = 'Informe a data.'
    if (!d.project_id) e.project_id = 'Selecione o projeto.'
    setErrors(e)
    if (Object.keys(e).length) return
    run(async () => {
      const payload = { ...d, ad_account_id: isTraffic ? d.ad_account_id ?? null : null }
      if (expense) await backend.update('expenses', expense.id, payload)
      else await backend.insert('expenses', payload)
      await invalidate('expenses', 'activity_log')
      onClose()
    }, expense ? 'Despesa atualizada.' : 'Despesa registrada.')
  }
  return (
    <Modal open onClose={onClose} size="lg" title={expense ? 'Editar despesa' : 'Registrar despesa'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>Salvar</Button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Descrição" required error={errors.description} className="sm:col-span-2"><Input value={d.description} invalid={!!errors.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="Projeto" required error={errors.project_id}><Select value={d.project_id} onChange={(e) => set('project_id', e.target.value)}>{app.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Categoria"><Select value={d.category} onChange={(e) => set('category', e.target.value)}>{cats.rows.map((c) => <option key={c.id}>{c.name}</option>)}</Select></Field>
        {isTraffic && (
          <Field label="Conta de anúncios (opcional)" className="sm:col-span-2" hint="Se o gasto desta despesa já é importado pela sincronização da conta, vincule-a: ela será conciliada e não somada duas vezes.">
            <Select value={d.ad_account_id ?? ''} onChange={(e) => set('ad_account_id', e.target.value || null)}>
              <option value="">Gasto fora de contas sincronizadas (somar ao custo)</option>
              {accounts.rows.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Data" required error={errors.expense_date}><Input type="date" value={d.expense_date} onChange={(e) => set('expense_date', e.target.value)} /></Field>
        <Field label="Valor" required error={errors.amount}><MoneyInput value={d.amount} invalid={!!errors.amount} onChange={(v) => set('amount', v ?? 0)} /></Field>
        <Field label="Forma de pagamento"><Select value={d.payment_method} onChange={(e) => set('payment_method', e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</Select></Field>
        <Field label="Status"><Select value={d.status} onChange={(e) => set('status', e.target.value as Expense['status'])}>{Object.entries(EXPENSE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Responsável"><Input value={d.owner} onChange={(e) => set('owner', e.target.value)} /></Field>
        <Field label="Comprovante">
          <div className="flex items-center gap-2">
            <FileUpload folder="receipts" onUploaded={(f) => set('receipt_url', f.url)} />
            {d.receipt_url && <><a href={d.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-primary">Ver anexo</a><IconButton icon={Trash2} label="Remover comprovante" onClick={() => set('receipt_url', null)} /></>}
          </div>
        </Field>
        <Field label="Observações" className="sm:col-span-2"><Textarea value={d.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

// ------------------------------------------------------------------ Produtos

function ProductsTab({ projectIds, canEdit, ranking, defaultProject }: { projectIds: Set<string>; canEdit: boolean; ranking: ReturnType<typeof productRanking>; defaultProject?: string }) {
  const app = useApp()
  const products = useRows('products')
  const { run, busy } = useAction()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<Partial<Product> | null>(null)
  const list = products.rows.filter((p) => projectIds.has(p.project_id))
  const rank = new Map(ranking.map((r) => [r.product.id, r]))
  return (
    <div className="grid xl:grid-cols-[1.4fr_1fr] gap-5">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Produtos</h3>
          {canEdit && <Button size="sm" variant="primary" icon={Plus} onClick={() => setEditing({ project_id: defaultProject ?? app.selectedProject?.id ?? app.projects[0]?.id, name: '', price: 0, active: true, is_demo: false })}>Novo produto</Button>}
        </div>
        <DataTable
          rows={list}
          empty={<EmptyState icon={Package} title="Nenhum produto" description="Cadastre ingressos, mentorias e demais ofertas do projeto." />}
          columns={[
            { key: 'n', header: 'Produto', cell: (p) => <span className="font-semibold">{p.name}</span>, sortValue: (p) => p.name },
            { key: 'proj', header: 'Projeto', cell: (p) => <span className="text-xs text-muted">{app.projects.find((x) => x.id === p.project_id)?.name}</span> },
            { key: 'pr', header: 'Preço', align: 'right', cell: (p) => money(p.price), sortValue: (p) => p.price },
            { key: 'q', header: 'Vendas', align: 'right', cell: (p) => num(rank.get(p.id)?.count ?? 0), sortValue: (p) => rank.get(p.id)?.count ?? 0 },
            { key: 'r', header: 'Faturamento', align: 'right', cell: (p) => money(rank.get(p.id)?.revenue ?? 0), sortValue: (p) => rank.get(p.id)?.revenue ?? 0 },
            { key: 'a', header: 'Ativo', cell: (p) => <Badge tone={p.active ? 'success' : 'neutral'}>{p.active ? 'Ativo' : 'Inativo'}</Badge> },
            ...(canEdit ? [{ key: 'act', header: '', cell: (p: Product) => (
              <div className="flex">
                <IconButton icon={Pencil} label="Editar" onClick={() => setEditing(p)} />
                <IconButton icon={Trash2} label="Excluir" onClick={async () => {
                  if (await confirm({ title: 'Excluir produto?', message: `"${p.name}" será excluído. Produtos com vendas não podem ser excluídos — desative-os.`, tone: 'danger', confirmLabel: 'Excluir' }))
                    run(async () => { await backend.remove('products', p.id); await invalidate('products', 'activity_log') }, 'Produto excluído.')
                }} />
              </div>
            ) }] : []),
          ]}
        />
      </Card>
      <ProductRanking ranking={ranking} />
      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'Editar produto' : 'Novo produto'} footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button variant="primary" loading={busy} onClick={() => run(async () => {
          if (!editing.name?.trim()) throw new Error('Informe o nome do produto.')
          if (!editing.project_id) throw new Error('Selecione o projeto.')
          if (editing.id) await backend.update('products', editing.id, editing)
          else await backend.insert('products', editing)
          await invalidate('products', 'activity_log')
          setEditing(null)
        }, 'Produto salvo.')}>Salvar</Button></>}>
          <div className="space-y-4">
            <Field label="Nome" required><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Projeto" required><Select value={editing.project_id} onChange={(e) => setEditing({ ...editing, project_id: e.target.value })}>{app.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
            <Field label="Preço"><MoneyInput value={editing.price} onChange={(v) => setEditing({ ...editing, price: v ?? 0 })} /></Field>
            <Checkbox checked={!!editing.active} onChange={(v) => setEditing({ ...editing, active: v })} label="Produto ativo" />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ Custo por projeto

function ProjectCostTable({ period, projectIds, category }: { period: Period; projectIds: Set<string>; category: string }) {
  const app = useApp()
  const fin = useFinance(period, null)
  const accounts = useRows('ad_accounts')
  const rows = app.projects.filter((p) => projectIds.has(p.id)).map((p) => {
    const ids = new Set([p.id])
    const expenses = category === 'all' ? fin.expenses : fin.expenses.filter((e) => e.category === category)
    const s = consolidate({ sales: fin.sales, expenses, metrics: fin.metrics, ads: fin.ads, accounts: accounts.rows, categories: fin.categories, projectIds: ids, period })
    return { id: p.id, name: p.name, s, goal: p.revenue_goal }
  })
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0)
  return (
    <Card className="p-5">
      <h3 className="font-bold mb-1">Custo por projeto</h3>
      <p className="text-xs text-muted mb-4">Comparativo no período selecionado{category !== 'all' ? ` · despesas da categoria "${category}"` : ''}.</p>
      <DataTable
        rows={rows}
        initialSort={{ key: 'rev', dir: 'desc' }}
        columns={[
          { key: 'n', header: 'Projeto', cell: (r) => <span className="font-semibold">{r.name}</span>, sortValue: (r) => r.name },
          { key: 'ads', header: 'Anúncios', align: 'right', cell: (r) => money(r.s.trafficInvestment), sortValue: (r) => r.s.trafficInvestment },
          { key: 'oth', header: 'Outras despesas', align: 'right', cell: (r) => money(r.s.otherExpenses), sortValue: (r) => r.s.otherExpenses },
          { key: 'tot', header: 'Custo total', align: 'right', cell: (r) => money(r.s.totalCost), sortValue: (r) => r.s.totalCost },
          { key: 'sal', header: 'Vendas', align: 'right', cell: (r) => num(r.s.approvedCount), sortValue: (r) => r.s.approvedCount },
          { key: 'rev', header: 'Faturamento', align: 'right', cell: (r) => money(r.s.grossRevenue), sortValue: (r) => r.s.grossRevenue },
          { key: 'res', header: 'Resultado', align: 'right', cell: (r) => <span className={r.s.result >= 0 ? 'text-success' : 'text-danger'}>{money(r.s.result)}</span>, sortValue: (r) => r.s.result },
          { key: 'mar', header: 'Margem', align: 'right', cell: (r) => pct(r.s.margin), sortValue: (r) => r.s.margin },
          { key: 'goal', header: 'Meta financeira', align: 'right', cell: (r) => <span>{money(r.goal)} <span className="text-xs text-faint">({r.goal ? pct((r.s.grossRevenue / r.goal) * 100) : '—'})</span></span>, sortValue: (r) => r.goal },
        ]}
        footer={<tr><td className="px-3 py-2.5">Total</td><td className="px-3 py-2.5 text-right">{money(sum((r) => r.s.trafficInvestment))}</td><td className="px-3 py-2.5 text-right">{money(sum((r) => r.s.otherExpenses))}</td><td className="px-3 py-2.5 text-right">{money(sum((r) => r.s.totalCost))}</td><td className="px-3 py-2.5 text-right">{num(sum((r) => r.s.approvedCount))}</td><td className="px-3 py-2.5 text-right">{money(sum((r) => r.s.grossRevenue))}</td><td className="px-3 py-2.5 text-right">{money(sum((r) => r.s.result))}</td><td /><td className="px-3 py-2.5 text-right">{money(sum((r) => r.goal))}</td></tr>}
      />
    </Card>
  )
}
