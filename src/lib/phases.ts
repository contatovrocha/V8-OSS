import type { PhaseStatus, PhaseTransitionRule, ProjectPhase } from '@/data/types'

export interface PhaseDefinition {
  number: number
  code: string
  name: string
  description: string
}

export const PHASES: PhaseDefinition[] = [
  { number: 1, code: 'V1', name: 'Posicionamento', description: 'Definição de posicionamento, proposta de valor, público, diferenciação, autoridade e narrativa do expert.' },
  { number: 2, code: 'V2', name: 'Escada de Ofertas', description: 'Organização dos produtos, ofertas, preços, entregáveis, mecanismos comerciais e jornada de compra.' },
  { number: 3, code: 'V3', name: 'Funis de Aquisição', description: 'Estruturação de páginas, captação de leads, campanhas, eventos de conversão e fluxos de aquisição.' },
  { number: 4, code: 'V4', name: 'Geração de Receitas', description: 'Implementação e validação das ações comerciais, vendas, monetização e geração de receita.' },
  { number: 5, code: 'V5', name: 'ICP Avançado', description: 'Refinamento do perfil de cliente ideal, segmentação, qualificação e análise dos compradores.' },
  { number: 6, code: 'V6', name: 'Demanda Qualificada', description: 'Geração de demanda com maior aderência ao público, otimização da aquisição e qualificação dos leads.' },
  { number: 7, code: 'V7', name: 'Funil da Escala 7D', description: 'Estruturação e acompanhamento do funil de escala de sete dias, conforme a estratégia definida para o projeto.' },
  { number: 8, code: 'V8', name: 'Otimizações e Conversão', description: 'Otimização de campanhas, páginas, criativos, ofertas, taxas de conversão e eficiência operacional.' },
]

export const PHASE_STATUS_LABEL: Record<PhaseStatus, string> = {
  bloqueada: 'Bloqueada',
  disponivel: 'Disponível',
  andamento: 'Em andamento',
  concluida: 'Concluída',
}

export function phaseDef(n: number | null | undefined): PhaseDefinition | undefined {
  return PHASES.find((p) => p.number === n)
}

export function phaseLabel(n: number | null | undefined): string {
  const d = phaseDef(n)
  return d ? `${d.code} — ${d.name}` : 'Nenhuma fase em andamento'
}

/** Progresso = fases concluídas / 8 × 100. Baseado no status individual de cada fase. */
export function phaseProgress(phases: Pick<ProjectPhase, 'status'>[]): number {
  const done = phases.filter((p) => p.status === 'concluida').length
  return (done / PHASES.length) * 100
}

export type PhaseAction = 'start' | 'complete' | 'reopen'

type PhaseState = Pick<ProjectPhase, 'phase_number' | 'status' | 'started_at' | 'completed_at' | 'completed_by'>

export interface PhaseTransitionResult<P extends PhaseState> {
  phases: P[]
  currentPhase: number | null
  changed: { phase_number: number; from: PhaseStatus; to: PhaseStatus }[]
  exception: string | null
}

/**
 * Recalcula apenas bloqueada/disponível. Uma fase pendente fica disponível quando é
 * a seguinte à fase mais avançada já iniciada/concluída, ou quando todas as anteriores
 * estão concluídas. Nunca altera fases concluídas ou em andamento.
 */
function relock<P extends PhaseState>(phases: P[]): P[] {
  const touched = phases.filter((p) => p.status === 'concluida' || p.status === 'andamento').map((p) => p.phase_number)
  const frontier = touched.length ? Math.max(...touched) : 0
  return phases.map((p) => {
    if (p.status === 'concluida' || p.status === 'andamento') return p
    const allPrevDone = phases.filter((q) => q.phase_number < p.phase_number).every((q) => q.status === 'concluida')
    const status: PhaseStatus = p.phase_number === frontier + 1 || allPrevDone ? 'disponivel' : 'bloqueada'
    return { ...p, status }
  })
}

/**
 * Regra de transição oficial. Mesma lógica da função SQL public.set_phase_status.
 * - start: a fase passa a "em andamento" e vira a fase atual (a anterior em andamento volta a disponível).
 * - complete: conclui somente a fase indicada. Fases anteriores NÃO são concluídas automaticamente.
 *   Com a regra "next_available", a próxima fase pendente é iniciada automaticamente.
 * - reopen: a fase volta a disponível e o progresso é recalculado.
 */
export function applyPhaseAction<P extends PhaseState>(
  input: P[],
  phaseNumber: number,
  action: PhaseAction,
  opts: { rule: PhaseTransitionRule; userId: string; now: string; currentPhase: number | null },
): PhaseTransitionResult<P> {
  const before = new Map(input.map((p) => [p.phase_number, p.status]))
  let phases = [...input].sort((a, b) => a.phase_number - b.phase_number).map((p) => ({ ...p }))
  const target = phases.find((p) => p.phase_number === phaseNumber)
  if (!target) throw new Error(`Fase V${phaseNumber} não encontrada`)
  let currentPhase = opts.currentPhase
  let exception: string | null = null
  const pendingEarlier = phases.filter((p) => p.phase_number < phaseNumber && p.status !== 'concluida')

  if (action === 'start') {
    if (target.status === 'concluida') throw new Error('A fase já está concluída. Reabra-a antes de iniciar novamente.')
    if (pendingEarlier.length) exception = `Fase iniciada com ${pendingEarlier.map((p) => 'V' + p.phase_number).join(', ')} ainda não concluída(s)`
    phases = phases.map((p) =>
      p.phase_number === phaseNumber
        ? { ...p, status: 'andamento' as PhaseStatus, started_at: p.started_at ?? opts.now }
        : p.status === 'andamento'
          ? { ...p, status: 'disponivel' as PhaseStatus }
          : p,
    )
    currentPhase = phaseNumber
  } else if (action === 'complete') {
    if (target.status === 'concluida') throw new Error('A fase já está concluída.')
    if (pendingEarlier.length) exception = `Conclusão fora de ordem: ${pendingEarlier.map((p) => 'V' + p.phase_number).join(', ')} permanece(m) pendente(s)`
    phases = phases.map((p) =>
      p.phase_number === phaseNumber
        ? { ...p, status: 'concluida' as PhaseStatus, started_at: p.started_at ?? opts.now, completed_at: opts.now, completed_by: opts.userId }
        : p,
    )
    if (currentPhase === phaseNumber || currentPhase === null) {
      currentPhase = null
      if (opts.rule === 'next_available') {
        const next = phases.find((p) => p.phase_number > phaseNumber && p.status !== 'concluida' && p.status !== 'andamento')
        const running = phases.find((p) => p.status === 'andamento')
        if (running) currentPhase = running.phase_number
        else if (next) {
          phases = phases.map((p) => (p.phase_number === next.phase_number ? { ...p, status: 'andamento' as PhaseStatus, started_at: p.started_at ?? opts.now } : p))
          currentPhase = next.phase_number
        }
      }
    }
  } else if (action === 'reopen') {
    if (target.status !== 'concluida') throw new Error('Somente fases concluídas podem ser reabertas.')
    phases = phases.map((p) => (p.phase_number === phaseNumber ? { ...p, status: 'disponivel' as PhaseStatus, completed_at: null, completed_by: null } : p))
  }

  phases = relock(phases)
  const changed = phases
    .filter((p) => before.get(p.phase_number) !== p.status)
    .map((p) => ({ phase_number: p.phase_number, from: before.get(p.phase_number) as PhaseStatus, to: p.status }))
  return { phases, currentPhase, changed, exception }
}
