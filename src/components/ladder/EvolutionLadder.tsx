import clsx from 'clsx'
import { Check, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { PhaseStatus, ProjectPhase } from '@/data/types'
import { date } from '@/lib/format'
import { PHASES, PHASE_STATUS_LABEL } from '@/lib/phases'

const STATUS_COLOR: Record<PhaseStatus, string> = {
  concluida: 'var(--brand-success)',
  andamento: 'var(--brand-accent)',
  disponivel: '#c7d2fe',
  bloqueada: '#3b4a6b',
}

interface Props {
  phases: ProjectPhase[]
  currentPhase: number | null
  onSelect?: (phaseNumber: number) => void
}

/**
 * Escada de evolução V1–V8: trajetória ascendente com marcadores conectados.
 * Desktop/tablet: diagonal em SVG (como a referência). Celular: trilha vertical.
 */
export function EvolutionLadder(props: Props) {
  return (
    <>
      <div className="hidden sm:block">
        <DiagonalLadder {...props} />
      </div>
      <div className="sm:hidden">
        <VerticalLadder {...props} />
      </div>
    </>
  )
}

function useStatusMap(phases: ProjectPhase[]) {
  const map = new Map(phases.map((p) => [p.phase_number, p]))
  return (n: number) => map.get(n)
}

// Geometria (viewBox 1000 × 580)
const START = { x: 352, y: 560 }
const END = { x: 648, y: 26 }
const at = (t: number) => ({ x: START.x + (END.x - START.x) * t, y: START.y + (END.y - START.y) * t })
const nodeT = (i: number) => (i + 1) / 9.2

function DiagonalLadder({ phases, currentPhase, onSelect }: Props) {
  const get = useStatusMap(phases)
  const done = phases.filter((p) => p.status === 'concluida').length
  // Comprimento da trilha preenchida acompanha o progresso (fases concluídas / 8).
  const [fill, setFill] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setFill(done === 0 ? 0 : nodeT(done - 1)))
    return () => cancelAnimationFrame(id)
  }, [done])
  const total = Math.hypot(END.x - START.x, END.y - START.y)
  const cur = currentPhase ? at(nodeT(currentPhase - 1)) : null
  const fillEnd = at(fill)

  return (
    <svg viewBox="0 0 1000 580" className="w-full h-auto select-none" role="img" aria-label={`Escada de evolução: ${done} de 8 fases concluídas`}>
      <defs>
        <linearGradient id="ladder-grad" x1={START.x} y1={START.y} x2={END.x} y2={END.y} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fb923c" />
          <stop offset="0.55" stopColor="#f97316" />
          <stop offset="1" stopColor="#ef4444" />
        </linearGradient>
        <filter id="ladder-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* trilha completa (futuro) */}
      <line x1={START.x} y1={START.y} x2={END.x} y2={END.y} stroke="#24324f" strokeWidth="7" strokeLinecap="round" />
      {/* trilha conquistada */}
      <line
        x1={START.x} y1={START.y} x2={END.x} y2={END.y}
        stroke="url(#ladder-grad)" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={total} strokeDashoffset={total - Math.hypot(fillEnd.x - START.x, fillEnd.y - START.y)}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }}
        filter="url(#ladder-glow)"
      />
      {/* trecho em andamento */}
      {cur && (
        <line x1={fillEnd.x} y1={fillEnd.y} x2={cur.x} y2={cur.y} stroke="#f97316" strokeWidth="4" strokeDasharray="8 8" className="dash-flow" opacity="0.8" />
      )}
      {/* seta de direção */}
      <path d={`M ${END.x} ${END.y - 18} L ${END.x - 15} ${END.y + 12} L ${END.x + 12} ${END.y + 4} Z`} fill={done === 8 ? '#ef4444' : '#24324f'} style={{ transition: 'fill .6s' }} />

      {PHASES.map((def, i) => {
        const p = get(def.number)
        const status: PhaseStatus = p?.status ?? 'bloqueada'
        const { x, y } = at(nodeT(i))
        const left = i < 4 // V1–V4: nome à esquerda; V5–V8: nome à direita (como a referência)
        const isCurrent = currentPhase === def.number
        const color = STATUS_COLOR[status]
        const tick = 46
        const codeX = left ? x + tick + 10 : x - tick - 10
        const nameX = left ? x - 30 : x + 30
        const sub =
          status === 'concluida' ? `Concluída · ${date(p?.completed_at)}` : status === 'andamento' ? `Em andamento${p?.started_at ? ' desde ' + date(p.started_at) : ''}` : PHASE_STATUS_LABEL[status]
        return (
          <g
            key={def.number}
            className={clsx('group', onSelect && 'cursor-pointer')}
            onClick={() => onSelect?.(def.number)}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect?.(def.number)}
            aria-label={`${def.code} ${def.name}: ${PHASE_STATUS_LABEL[status]}`}
          >
            <rect x={left ? nameX - 330 : x - 120} y={y - 34} width={450} height={68} fill="transparent" />
            <line x1={x} y1={y} x2={left ? x + tick : x - tick} y2={y} stroke={status === 'bloqueada' ? '#2a3a5c' : '#c7d2fe'} strokeWidth="3" opacity={status === 'bloqueada' ? 0.6 : 0.9} />
            <text x={codeX} y={y + 13} textAnchor={left ? 'start' : 'end'} fontSize="38" fontWeight="800" fill={status === 'bloqueada' ? '#3b4a6b' : isCurrent ? '#fb923c' : '#e8edf7'} style={{ transition: 'fill .4s' }}>
              {def.code}
            </text>

            {isCurrent && <circle cx={x} cy={y} r="17" fill="none" stroke="#f97316" strokeWidth="3" className="pulse-ring" />}
            <circle
              cx={x} cy={y} r={isCurrent ? 17 : 14}
              fill={status === 'concluida' ? 'url(#ladder-grad)' : status === 'andamento' ? '#f97316' : status === 'disponivel' ? '#0c1322' : '#141d31'}
              stroke={color} strokeWidth={status === 'disponivel' ? 4 : 3}
              className="transition-all duration-300 group-hover:brightness-125"
              key={status}
              style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: status === 'concluida' ? 'pop .5s ease-out both' : undefined }}
            />
            {status === 'concluida' && (
              <foreignObject x={x - 9} y={y - 9} width="18" height="18" pointerEvents="none"><Check className="size-[18px] text-white" strokeWidth={3.5} /></foreignObject>
            )}
            {status === 'bloqueada' && (
              <foreignObject x={x - 7} y={y - 7} width="14" height="14" pointerEvents="none"><Lock className="size-[14px] text-[#5d6a86]" strokeWidth={2.5} /></foreignObject>
            )}

            <text x={nameX} y={y - 2} textAnchor={left ? 'end' : 'start'} fontSize="23" fontWeight="800" letterSpacing="1"
              fill={status === 'bloqueada' ? '#4a5875' : status === 'concluida' ? '#fdba74' : isCurrent ? '#fb923c' : '#f97316'}
              className="uppercase transition-all group-hover:brightness-125">
              {def.name.toUpperCase()}
            </text>
            <text x={nameX} y={y + 22} textAnchor={left ? 'end' : 'start'} fontSize="15" fontWeight="600" fill={status === 'concluida' ? 'var(--brand-success)' : status === 'andamento' ? '#e8edf7' : '#5d6a86'}>
              {sub}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function VerticalLadder({ phases, currentPhase, onSelect }: Props) {
  const get = useStatusMap(phases)
  const ordered = [...PHASES].reverse()
  return (
    <ol className="relative pl-2">
      {ordered.map((def, idx) => {
        const p = get(def.number)
        const status: PhaseStatus = p?.status ?? 'bloqueada'
        const isCurrent = currentPhase === def.number
        const below = ordered[idx + 1] ? get(ordered[idx + 1].number)?.status : null
        const segmentDone = status === 'concluida' || (below === 'concluida' && status !== 'bloqueada')
        return (
          <li key={def.number} className="relative flex gap-3 pb-4 last:pb-0">
            {idx < ordered.length - 1 && (
              <span className={clsx('absolute left-[15px] top-8 bottom-0 w-1 rounded-full', segmentDone ? 'bg-gradient-to-b from-[#ef4444] to-[#f97316]' : 'bg-line-strong')} />
            )}
            <button
              type="button"
              onClick={() => onSelect?.(def.number)}
              className={clsx(
                'relative z-10 size-8 shrink-0 rounded-full grid place-items-center border-[3px] transition',
                status === 'concluida' && 'bg-accent border-success',
                status === 'andamento' && 'bg-accent border-accent ring-4 ring-accent/25',
                status === 'disponivel' && 'bg-surface border-[#c7d2fe]',
                status === 'bloqueada' && 'bg-surface-2 border-line-strong',
              )}
              aria-label={`${def.code} ${def.name}`}
            >
              {status === 'concluida' && <Check className="size-4 text-white" strokeWidth={3.5} />}
              {status === 'bloqueada' && <Lock className="size-3 text-faint" />}
            </button>
            <button type="button" onClick={() => onSelect?.(def.number)} className="text-left min-w-0">
              <div className="flex items-baseline gap-2">
                <span className={clsx('text-lg font-extrabold', status === 'bloqueada' ? 'text-faint' : isCurrent ? 'text-accent' : 'text-ink')}>{def.code}</span>
                <span className={clsx('text-sm font-bold uppercase tracking-wide', status === 'bloqueada' ? 'text-faint' : 'text-accent')}>{def.name}</span>
              </div>
              <div className={clsx('text-xs', status === 'concluida' ? 'text-success' : 'text-muted')}>
                {status === 'concluida' ? `Concluída · ${date(p?.completed_at)}` : PHASE_STATUS_LABEL[status]}
                {isCurrent && ' · fase atual'}
              </div>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
