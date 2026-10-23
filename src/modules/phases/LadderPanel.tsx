import { Flag, MousePointerClick, Trophy } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { EvolutionLadder } from '@/components/ladder/EvolutionLadder'
import { Card, Progress, Skeleton } from '@/components/ui/primitives'
import { useRows } from '@/data/store'
import type { Project } from '@/data/types'
import { pct } from '@/lib/format'
import { phaseDef, phaseProgress, PHASES } from '@/lib/phases'
import { PhaseDrawer } from './PhaseDrawer'

/** Escada V1–V8 + painel de progresso. Elemento central da Visão Geral e da aba Fases. */
export function LadderPanel({ project }: { project: Project }) {
  const { isAdmin } = useAuth()
  const phasesRows = useRows('project_phases')
  const [open, setOpen] = useState<number | null>(null)
  const phases = phasesRows.rows.filter((p) => p.project_id === project.id)
  const progress = phaseProgress(phases)
  const done = phases.filter((p) => p.status === 'concluida').length
  const current = phaseDef(project.current_phase)
  const next = PHASES.find((d) => d.number > (project.current_phase ?? 0) && phases.find((p) => p.phase_number === d.number)?.status !== 'concluida')

  return (
    <Card className="p-5 md:p-6 overflow-hidden relative">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">Escada de evolução</div>
          <h2 className="text-xl font-extrabold tracking-tight">Jornada V1 → V8</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted"><MousePointerClick className="size-3.5" />{isAdmin ? 'Clique em uma fase para gerenciar' : 'Clique em uma fase para ver detalhes'}</span>
      </div>
      <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-center">
        <div className="min-w-0">
          {phasesRows.loading ? <Skeleton className="h-80" /> : <EvolutionLadder phases={phases} currentPhase={project.current_phase} onSelect={setOpen} />}
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface-2/70 p-4">
            <div className="flex items-end justify-between">
              <span className="text-xs font-semibold text-muted">Progresso da jornada</span>
              <span className="text-xs text-faint">{done} de 8 fases</span>
            </div>
            <div className="text-4xl font-extrabold tabular-nums mt-1 text-accent" key={progress}>
              <span className="animate-fade-up inline-block">{pct(progress)}</span>
            </div>
            <Progress value={progress} tone="accent" className="mt-3 h-2.5" />
            <div className="grid grid-cols-8 gap-1 mt-2">
              {PHASES.map((d) => {
                const st = phases.find((p) => p.phase_number === d.number)?.status
                return <div key={d.number} title={`${d.code}`} className={`h-1 rounded-full ${st === 'concluida' ? 'bg-success' : st === 'andamento' ? 'bg-accent animate-pulse' : 'bg-surface-3'}`} />
              })}
            </div>
          </div>
          <button onClick={() => current && setOpen(current.number)} className="w-full text-left rounded-2xl border border-accent/30 bg-accent/5 p-4 hover:bg-accent/10 transition">
            <div className="flex items-center gap-2 text-xs font-semibold text-accent"><Flag className="size-3.5" />Fase atual</div>
            {current ? (
              <>
                <div className="font-extrabold mt-1">{current.code} — {current.name}</div>
                <p className="text-xs text-muted mt-1 line-clamp-3">{current.description}</p>
              </>
            ) : done === 8 ? (
              <div className="font-extrabold mt-1 flex items-center gap-2 text-success"><Trophy className="size-4" />Jornada concluída</div>
            ) : (
              <div className="text-sm text-muted mt-1">Nenhuma fase em andamento. {isAdmin ? 'Selecione a próxima fase para iniciar.' : 'Aguardando a administração iniciar a próxima fase.'}</div>
            )}
          </button>
          {next && next.number !== current?.number && (
            <div className="text-xs text-muted px-1">Próxima etapa: <span className="text-ink font-semibold">{next.code} — {next.name}</span></div>
          )}
        </div>
      </div>
      {open !== null && <PhaseDrawer projectId={project.id} phaseNumber={open} onClose={() => setOpen(null)} />}
    </Card>
  )
}
