import { useState } from 'react'
import { Segmented } from '@/components/ui/primitives'
import type { Project } from '@/data/types'
import { storage } from '@/lib/storage'
import { LadderPanel } from '../phases/LadderPanel'
import { LaunchBoard } from './LaunchBoard'

type Mode = 'processo' | 'jornada'

/** Painel do expert: processo de lançamento (kanban das 9 etapas) ou a escada V1–V8. */
export function LaunchProcessPanel({ project }: { project: Project }) {
  const [mode, setMode] = useState<Mode>(() => (storage.get('expert-panel') as Mode) || 'processo')
  const change = (m: Mode) => { setMode(m); storage.set('expert-panel', m) }
  return (
    <div className="space-y-3">
      <Segmented value={mode} onChange={change} options={[{ value: 'processo', label: 'Processo de lançamento' }, { value: 'jornada', label: 'Jornada V1 → V8' }]} />
      {mode === 'processo' ? <LaunchBoard project={project} /> : <LadderPanel project={project} />}
    </div>
  )
}
