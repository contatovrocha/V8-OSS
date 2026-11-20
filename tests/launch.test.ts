import { describe, expect, it } from 'vitest'
import { LAUNCH_STAGES, processProgress, stageOf } from '@/lib/launchStages'
import { answeredCount, BRAND_QUESTIONS, BRAND_SECTIONS } from '@/lib/brandDoc'
import { buildCtx, canRead, writeDenied, type DB } from '@/data/local/policies'
import type { LaunchStage, Profile } from '@/data/types'

describe('Processo de lançamento', () => {
  it('tem 9 etapas numeradas em ordem, cada uma com checklist', () => {
    expect(LAUNCH_STAGES.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    for (const s of LAUNCH_STAGES) expect(s.checklist.length).toBeGreaterThan(0)
  })

  it('etapa ainda não gravada nasce do modelo padrão', () => {
    const s = stageOf([], 'p1', 4)
    expect(s.persisted).toBe(false)
    expect(s.status).toBe('a_fazer')
    expect(s.checklist.map((c) => c.label)).toEqual(LAUNCH_STAGES[3].checklist)
    expect(s.checklist.every((c) => !c.done)).toBe(true)
  })

  it('usa a etapa gravada do projeto certo', () => {
    const row = { id: 'x', project_id: 'p1', stage_number: 2, status: 'concluida', checklist: [], links: [], notes: '', owner: '', completed_at: null, created_at: '', updated_at: '' } as LaunchStage
    expect(stageOf([row], 'p1', 2)).toMatchObject({ id: 'x', persisted: true, status: 'concluida' })
    expect(stageOf([row], 'p2', 2).persisted).toBe(false)
  })

  it('progresso: concluídas inteiras, em andamento pelo checklist', () => {
    const base = LAUNCH_STAGES.map((d) => stageOf([], 'p', d.number))
    expect(processProgress(base)).toBe(0)
    const nine = base.map((s) => ({ ...s, status: 'concluida' as const }))
    expect(processProgress(nine)).toBe(100)
    const mixed = base.map((s, i) => (i < 3 ? { ...s, status: 'concluida' as const } : s))
    expect(processProgress(mixed)).toBe(33)
    const half = base.map((s, i) => (i === 0 ? { ...s, status: 'andamento' as const, checklist: s.checklist.map((c, k) => ({ ...c, done: k % 2 === 0 })) } : s))
    expect(processProgress(half)).toBeGreaterThan(0)
    expect(processProgress(half)).toBeLessThan(12)
  })
})

describe('Documento de Marca do Expert', () => {
  it('cobre as perguntas do documento V1 sem chaves repetidas', () => {
    const keys = BRAND_QUESTIONS.map((q) => q.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.every((k) => /^[a-z0-9_]{1,40}$/.test(k))).toBe(true)
    expect(BRAND_SECTIONS.map((s) => s.title)).toContain('Big Idea')
  })

  it('conta só respostas preenchidas', () => {
    expect(answeredCount({ principios: 'Verdade', gosta: '   ', nicho: 'Saúde', inexistente: 'x' })).toBe(2)
  })
})

describe('Permissões locais das novas tabelas', () => {
  const user = (id: string, role: Profile['role'] = 'expert') => ({ id, email: `${id}@x`, full_name: id, role, created_at: '' }) as Profile
  const db = {
    profiles: [], projects: [{ id: 'p1', expert_id: 'e1' }], experts: [{ id: 'e1', permissions: { visible_modules: [] } }],
    user_experts: [{ id: 'l1', user_id: 'gestor', expert_id: 'e1', can_manage_team: true }, { id: 'l2', user_id: 'membro', expert_id: 'e1', can_manage_team: false }],
    launch_stages: [], brand_docs: [],
  } as unknown as DB
  const stage = { project_id: 'p1', stage_number: 1 } as LaunchStage
  const doc = { expert_id: 'e1' } as never

  it('gestor da equipe edita etapas e o documento; membro só lê', () => {
    const g = buildCtx(db, user('gestor'))
    const m = buildCtx(db, user('membro'))
    expect(writeDenied(db, g, 'launch_stages', 'insert', stage)).toBeNull()
    expect(writeDenied(db, g, 'brand_docs', 'insert', doc)).toBeNull()
    expect(canRead(db, m, 'launch_stages', stage)).toBe(true)
    expect(canRead(db, m, 'brand_docs', doc)).toBe(true)
    expect(writeDenied(db, m, 'launch_stages', 'update', stage)).not.toBeNull()
    expect(writeDenied(db, m, 'brand_docs', 'update', doc)).not.toBeNull()
  })

  it('quem não é da equipe não vê', () => {
    const o = buildCtx(db, user('outro'))
    expect(canRead(db, o, 'launch_stages', stage)).toBe(false)
    expect(canRead(db, o, 'brand_docs', doc)).toBe(false)
  })
})
