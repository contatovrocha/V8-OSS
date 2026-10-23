import { describe, expect, it } from 'vitest'
import { applyPhaseAction, phaseProgress } from '@/lib/phases'
import { kpis, sortAds, sumMetrics, type AdPerformance } from '@/lib/metrics'
import { consolidate } from '@/lib/finance'
import { validateRecord } from '@/lib/sections'
import { demoData, baseConfig, DEMO } from '@/data/seed'
import { buildCtx, canRead, writeDenied, type DB } from '@/data/local/policies'
import type { ProjectPhase, Profile } from '@/data/types'

const all = { preset: 'tudo' as const, from: '2000-01-01', to: '2100-12-31' }
const opts = (current: number | null, rule: 'next_available' | 'manual' = 'next_available') => ({ rule, userId: 'admin', now: '2026-10-23T12:00:00Z', currentPhase: current })

describe('Escada V1–V8', () => {
  const demo = demoData('admin').project_phases.filter((p) => p.project_id === DEMO.projectJantar)

  it('demo inicia com 25% e V3 em andamento', () => {
    expect(phaseProgress(demo)).toBe(25)
    expect(demo.find((p) => p.phase_number === 3)!.status).toBe('andamento')
    expect(demo.find((p) => p.phase_number === 4)!.status).toBe('disponivel')
    expect(demo.find((p) => p.phase_number === 5)!.status).toBe('bloqueada')
  })

  it('concluir V3 leva a 37,5% e inicia V4 (regra padrão)', () => {
    const r = applyPhaseAction(demo, 3, 'complete', opts(3))
    expect(phaseProgress(r.phases)).toBe(37.5)
    expect(r.currentPhase).toBe(4)
    expect(r.phases.find((p) => p.phase_number === 4)!.status).toBe('andamento')
    expect(r.phases.find((p) => p.phase_number === 5)!.status).toBe('disponivel')
    expect(r.phases.find((p) => p.phase_number === 3)!.completed_by).toBe('admin')
  })

  it('regra manual não inicia a próxima fase', () => {
    const r = applyPhaseAction(demo, 3, 'complete', opts(3, 'manual'))
    expect(r.currentPhase).toBeNull()
    expect(r.phases.find((p) => p.phase_number === 4)!.status).toBe('disponivel')
  })

  it('concluir fase posterior não conclui as anteriores e registra exceção', () => {
    const r = applyPhaseAction(demo, 6, 'complete', opts(3))
    expect(r.phases.find((p) => p.phase_number === 4)!.status).not.toBe('concluida')
    expect(r.phases.find((p) => p.phase_number === 3)!.status).toBe('andamento')
    expect(r.exception).toMatch(/V3/)
    expect(phaseProgress(r.phases)).toBe(37.5)
  })

  it('reabrir recalcula o progresso', () => {
    const r = applyPhaseAction(demo, 2, 'reopen', opts(3))
    expect(phaseProgress(r.phases)).toBe(12.5)
    expect(r.phases.find((p) => p.phase_number === 2)!.status).toBe('disponivel')
  })

  it('não conclui duas vezes', () => {
    expect(() => applyPhaseAction(demo, 1, 'complete', opts(3))).toThrow()
  })
})

describe('Métricas de tráfego', () => {
  it('calcula CTR, CPC, CPL, ROAS e trata denominador zero', () => {
    const k = kpis({ spend: 100, impressions: 10000, reach: 8000, link_clicks: 200, leads: 10, purchases: 2, purchase_value: 994, rows: 1 })
    expect(k.ctr).toBeCloseTo(2)
    expect(k.cpc).toBeCloseTo(0.5)
    expect(k.cpl).toBeCloseTo(10)
    expect(k.cpa).toBeCloseTo(50)
    expect(k.roas).toBeCloseTo(9.94)
    expect(k.cpm).toBeCloseTo(10)
    const z = kpis({ spend: 0, impressions: 0, reach: 0, link_clicks: 0, leads: 0, purchases: 0, purchase_value: 0, rows: 0 })
    expect([z.ctr, z.cpc, z.cpl, z.cpa, z.roas]).toEqual([null, null, null, null, null])
  })

  it('ordenação por leads, CTR e cliques gera resultados diferentes nos dados demo', () => {
    const d = demoData('admin')
    const perf: AdPerformance[] = d.ads.map((ad) => ({ ad, ...kpis(sumMetrics(d.ad_metrics_daily.filter((m) => m.ad_id === ad.id))) }))
    const first = (k: Parameters<typeof sortAds>[1]) => sortAds(perf, k)[0].ad.name
    const set = new Set([first('leads'), first('ctr'), first('clicks')])
    expect(set.size).toBeGreaterThanOrEqual(2)
    const cpl = sortAds(perf, 'cpl')
    expect(cpl[0].cpl! <= cpl[1].cpl!).toBe(true)
  })
})

describe('Consolidação financeira', () => {
  it('não duplica investimento em anúncios e considera reembolsos e despesas', () => {
    const d = demoData('admin')
    const { categories } = baseConfig()
    const s = consolidate({ sales: d.sales, expenses: d.expenses, metrics: d.ad_metrics_daily, ads: d.ads, accounts: d.ad_accounts, categories, projectIds: new Set([DEMO.projectJantar]), period: all })
    const synced = d.ad_metrics_daily.reduce((a, m) => a + m.spend, 0)
    expect(s.adSpendSynced).toBeCloseTo(synced, 1)
    expect(s.adSpendManual).toBe(150) // impulsionamento manual
    expect(s.reconciledTrafficExpenses).toBe(3000) // recarga vinculada à conta sincronizada: não somada
    expect(s.trafficInvestment).toBeCloseTo(synced + 150, 1)
    expect(s.otherExpenses).toBe(2500 + 1200 + 900 + 197 + 6000 + 3500 + 800)
    expect(s.result).toBeCloseTo(s.netRevenue - s.trafficInvestment - s.otherExpenses, 1)
    expect(s.refunds).toBeGreaterThan(0)
    expect(s.netRevenue).toBeLessThan(s.grossRevenue)
  })
})

describe('Seções dinâmicas', () => {
  const fields = [
    { key: 'nome', label: 'Nome', type: 'text' as const, required: true, options: [], show_in_card: true, show_in_table: true, filterable: false },
    { key: 'tipo', label: 'Tipo', type: 'select' as const, required: false, options: ['A', 'B'], show_in_card: true, show_in_table: true, filterable: true },
    { key: 'valor', label: 'Valor', type: 'currency' as const, required: false, options: [], show_in_card: true, show_in_table: true, filterable: false },
  ]
  it('valida obrigatórios, opções e números, preservando chaves antigas', () => {
    expect(validateRecord(fields, {}).errors.nome).toBeDefined()
    expect(validateRecord(fields, { nome: 'x', tipo: 'C' }).errors.tipo).toBeDefined()
    const ok = validateRecord(fields, { nome: 'x', valor: '10,5', antigo: 1 })
    expect(ok.errors).toEqual({})
    expect(ok.data.valor).toBe(10.5)
    expect(ok.data.antigo).toBe(1)
  })
})

describe('Isolamento entre experts (políticas)', () => {
  const d = demoData('admin')
  const base = baseConfig()
  const rafael: Profile = { id: 'u-rafael', email: 'r', full_name: 'Rafael', role: 'expert', created_at: '' }
  const db = {
    profiles: [rafael], experts: d.experts, user_experts: [{ id: 'l1', user_id: 'u-rafael', expert_id: DEMO.expertRafael }], projects: d.projects,
    project_phases: d.project_phases, phase_history: d.phase_history, movements: d.movements, page_types: base.pageTypes, pages: d.pages, ad_accounts: d.ad_accounts,
    campaigns: d.campaigns, ad_sets: d.ad_sets, ads: d.ads, ad_metrics_daily: d.ad_metrics_daily, products: d.products, sales: d.sales,
    expense_categories: base.categories, expenses: d.expenses, tasks: d.tasks, task_comments: [], task_templates: base.templates, files: [],
    activity_log: d.activity_log, section_configs: d.section_configs, section_records: d.section_records, app_settings: [base.settings],
  } as DB
  const ctx = buildCtx(db, rafael)

  it('expert não lê dados de outro expert', () => {
    expect(canRead(db, ctx, 'experts', d.experts.find((e) => e.id === DEMO.expertCamila)!)).toBe(false)
    expect(canRead(db, ctx, 'projects', d.projects.find((p) => p.id === DEMO.projectCamila)!)).toBe(false)
    expect(d.sales.filter((s) => s.project_id === DEMO.projectCamila).some((s) => canRead(db, ctx, 'sales', s))).toBe(false)
    expect(canRead(db, ctx, 'projects', d.projects.find((p) => p.id === DEMO.projectJantar)!)).toBe(true)
  })

  it('expert não altera fases, finanças nem permissões por padrão', () => {
    const phase = d.project_phases[0] as ProjectPhase
    expect(writeDenied(db, ctx, 'project_phases', 'update', { ...phase, status: 'concluida' }, phase)).not.toBeNull()
    const sale = d.sales[0]
    expect(writeDenied(db, ctx, 'sales', 'update', { ...sale, gross_amount: 1 }, sale)).not.toBeNull()
    const e = d.experts[0]
    expect(writeDenied(db, ctx, 'experts', 'update', { ...e, permissions: { ...e.permissions, can_edit_finance: true } }, e)).not.toBeNull()
    expect(writeDenied(db, ctx, 'experts', 'update', { ...e, bio: 'nova' }, e)).toBeNull()
  })
})
