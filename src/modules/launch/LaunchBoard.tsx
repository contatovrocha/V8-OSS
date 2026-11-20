import clsx from 'clsx'
import { ArrowRight, Check, Columns3, GitCommitHorizontal, GripVertical, MousePointerClick, Save } from 'lucide-react'
import { useEffect, useState, type DragEvent } from 'react'
import { useApp } from '@/app/AppContext'
import { ChecklistEditor, FileUpload, LinkListInput } from '@/components/ui/inputs'
import { Drawer, useAction } from '@/components/ui/overlay'
import { Badge, Button, Card, Field, Input, Progress, Segmented, Skeleton, Textarea } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import { invalidate, useRows } from '@/data/store'
import type { Expert, LaunchStage, LaunchStageStatus, Project } from '@/data/types'
import { date } from '@/lib/format'
import { LAUNCH_STAGES, processProgress, STAGE_STATUS, stageDef, stageOf, stageStatusLabel } from '@/lib/launchStages'
import { storage } from '@/lib/storage'
import { useCanManageProject } from '../creatives/PhotoBank'
import { assetChips, StageMaterials, useMaterials, type Materials } from './materials'

type View = 'kanban' | 'timeline'
type Stage = ReturnType<typeof stageOf>

/** Grava a etapa: cria na primeira alteração (as 9 etapas nascem do modelo padrão). */
export async function saveStage(stage: Stage, patch: Partial<LaunchStage>) {
  const status = patch.status ?? stage.status
  const completed_at = status === 'concluida' ? (stage.status === 'concluida' ? stage.completed_at : new Date().toISOString()) : null
  if (stage.persisted) await backend.update('launch_stages', stage.id, { ...patch, completed_at })
  else {
    const { id: _id, persisted: _p, created_at: _c, updated_at: _u, ...base } = stage
    await backend.insert('launch_stages', { ...base, ...patch, completed_at })
  }
  await invalidate('launch_stages')
}

/** Processo de lançamento V8 em 9 etapas: kanban por status ou linha do tempo, com os materiais de cada etapa. */
export function LaunchBoard({ project }: { project: Project }) {
  const app = useApp()
  const rows = useRows('launch_stages')
  const canManage = useCanManageProject(project)
  const expert = app.experts.find((e) => e.id === project.expert_id)
  const m = useMaterials(project, expert)
  const [view, setView] = useState<View>(() => (storage.get('launch-view') as View) || 'kanban')
  const [open, setOpen] = useState<number | null>(null)
  const { run } = useAction()
  useEffect(() => { storage.set('launch-view', view) }, [view])

  const stages = LAUNCH_STAGES.map((d) => stageOf(rows.rows, project.id, d.number))
  const progress = processProgress(stages)
  const done = stages.filter((s) => s.status === 'concluida').length
  const current = stages.find((s) => s.status === 'andamento') ?? stages.find((s) => s.status !== 'concluida')

  const move = (n: number, status: LaunchStageStatus) => {
    const st = stages.find((s) => s.stage_number === n)
    if (!st || st.status === status || !canManage) return
    run(() => saveStage(st, { status }), `Etapa ${n} → ${stageStatusLabel(status)}`)
  }

  return (
    <Card className="p-5 md:p-6 overflow-hidden relative">
      <div className="absolute -right-24 -top-24 size-72 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
      <div className="relative flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">Processo de lançamento V8</div>
          <h2 className="text-xl font-extrabold tracking-tight">9 etapas, do briefing à captação</h2>
          <p className="text-xs text-muted mt-0.5 flex items-center gap-1.5"><MousePointerClick className="size-3.5" />{canManage ? 'Clique em uma etapa para preencher. No computador, arraste os cards entre as colunas.' : 'Clique em uma etapa para ver o que já foi entregue.'}</p>
        </div>
        <div className="flex w-full sm:w-auto items-center justify-between gap-3 [&>div:last-child]:shrink-0">
          <div className="sm:text-right">
            <div className="text-2xl font-extrabold tabular-nums text-accent leading-none">{progress}%</div>
            <div className="text-[11px] text-muted">{done} de 9 concluídas</div>
          </div>
          <Segmented size="sm" value={view} onChange={setView} options={[{ value: 'kanban', label: 'Kanban', icon: Columns3 }, { value: 'timeline', label: 'Linha do tempo', icon: GitCommitHorizontal }]} />
        </div>
      </div>
      <Progress value={progress} tone="accent" className="h-1.5 mb-5" />

      {rows.loading ? <Skeleton className="h-96" /> : view === 'kanban'
        ? <Kanban stages={stages} m={m} project={project} canManage={canManage} onOpen={setOpen} onMove={move} />
        : <Timeline stages={stages} m={m} project={project} currentNumber={current?.stage_number} onOpen={setOpen} />}

      <Closing progress={progress} />
      {open !== null && <StageDrawer stage={stages.find((s) => s.stage_number === open)!} project={project} expert={expert} m={m} canManage={canManage} onClose={() => setOpen(null)} />}
    </Card>
  )
}

function StageCard({ stage, m, project, onOpen, draggable, compact }: { stage: Stage; m: Materials; project: Project; onOpen: () => void; draggable?: boolean; compact?: boolean }) {
  const def = stageDef(stage.stage_number)!
  const Icon = def.icon
  const total = stage.checklist.length
  const ok = stage.checklist.filter((c) => c.done).length
  const chips = assetChips(def.assets, m, project)
  const tone = stage.status === 'concluida' ? 'border-success/40' : stage.status === 'andamento' ? 'border-accent/50 shadow-[0_0_0_1px_var(--brand-accent)_inset]' : 'border-line'
  return (
    <button
      type="button"
      onClick={onOpen}
      draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.setData('text/stage', String(stage.stage_number)); e.dataTransfer.effectAllowed = 'move' }}
      className={clsx('group w-full text-left rounded-2xl border bg-surface-2/70 p-3.5 transition hover:-translate-y-0.5 hover:border-accent/60 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent', tone, draggable && 'cursor-grab active:cursor-grabbing')}
    >
      <div className="flex items-start gap-3">
        <div className={clsx('relative size-10 rounded-xl grid place-items-center shrink-0', stage.status === 'concluida' ? 'bg-success/15 text-success' : 'bg-accent/15 text-accent')}>
          {stage.status === 'concluida' ? <Check className="size-5" /> : <Icon className="size-5" />}
          <span className="absolute -top-1.5 -left-1.5 size-5 rounded-full bg-accent text-[10px] font-extrabold text-[#160a00] grid place-items-center">{stage.stage_number}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm leading-tight">{def.title}</div>
          {!compact && <p className="text-xs text-muted mt-1 line-clamp-2">{def.summary}</p>}
        </div>
        {draggable && <GripVertical className="size-4 text-faint opacity-0 group-hover:opacity-100 hidden md:block" />}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Progress value={total ? (ok / total) * 100 : 0} tone={stage.status === 'concluida' ? 'success' : 'accent'} className="h-1 flex-1" />
        <span className="text-[11px] text-muted tabular-nums">{ok}/{total}</span>
      </div>
      {chips.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {chips.map((c) => <span key={c.label} className={clsx('text-[10.5px] font-semibold rounded-full px-2 py-0.5 border', c.ok ? 'border-success/30 text-success bg-success/10' : 'border-line text-muted bg-surface-3/60')}>{c.label}</span>)}
        </div>
      )}
      {(stage.owner || stage.links.length > 0) && (
        <div className="mt-2 text-[11px] text-faint truncate">{[stage.owner && `Resp.: ${stage.owner}`, stage.links.length && `${stage.links.length} link(s)`].filter(Boolean).join(' · ')}</div>
      )}
    </button>
  )
}

function Kanban({ stages, m, project, canManage, onOpen, onMove }: { stages: Stage[]; m: Materials; project: Project; canManage: boolean; onOpen: (n: number) => void; onMove: (n: number, s: LaunchStageStatus) => void }) {
  const [over, setOver] = useState<LaunchStageStatus | null>(null)
  const drop = (status: LaunchStageStatus) => (e: DragEvent) => {
    e.preventDefault(); setOver(null)
    const n = Number(e.dataTransfer.getData('text/stage'))
    if (n) onMove(n, status)
  }
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {STAGE_STATUS.map((col) => {
        const items = stages.filter((s) => s.status === col.value)
        return (
          <div
            key={col.value}
            onDragOver={(e) => { if (canManage) { e.preventDefault(); setOver(col.value) } }}
            onDragLeave={() => setOver(null)}
            onDrop={drop(col.value)}
            className={clsx('rounded-2xl border bg-surface/60 p-3 transition min-h-40', over === col.value ? 'border-accent bg-accent/5' : 'border-line')}
          >
            <div className="flex items-center justify-between px-1 mb-3">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted flex items-center gap-2">
                <span className={clsx('size-2 rounded-full', col.value === 'concluida' ? 'bg-success' : col.value === 'andamento' ? 'bg-accent animate-pulse' : 'bg-faint')} />{col.label}
              </span>
              <Badge tone={col.tone}>{items.length}</Badge>
            </div>
            <div className="space-y-2.5">
              {items.map((s, i) => (
                <div key={s.stage_number} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                  <StageCard stage={s} m={m} project={project} onOpen={() => onOpen(s.stage_number)} draggable={canManage} compact={col.value !== 'andamento'} />
                </div>
              ))}
              {items.length === 0 && <div className="text-xs text-faint text-center py-6 border border-dashed border-line rounded-xl">{canManage ? 'Arraste uma etapa para cá' : 'Nenhuma etapa'}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Timeline({ stages, m, project, currentNumber, onOpen }: { stages: Stage[]; m: Materials; project: Project; currentNumber?: number; onOpen: (n: number) => void }) {
  return (
    <ol className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-10 gap-y-4 relative">
      {stages.map((s, i) => (
        <li key={s.stage_number} className="relative animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
          {/* conector para a próxima etapa */}
          {i < stages.length - 1 && (
            <>
              <span className={clsx('absolute left-5 top-full h-4 w-0.5 sm:hidden', s.status === 'concluida' ? 'bg-success' : 'bg-line')} />
              {(i + 1) % 2 !== 0 && <ArrowRight className={clsx('absolute -right-8 top-1/2 -translate-y-1/2 size-5 hidden sm:block xl:hidden', s.status === 'concluida' ? 'text-success' : 'text-accent/70')} />}
              {(i + 1) % 3 !== 0 && <ArrowRight className={clsx('absolute -right-8 top-1/2 -translate-y-1/2 size-5 hidden xl:block', s.status === 'concluida' ? 'text-success' : 'text-accent/70')} />}
            </>
          )}
          {s.stage_number === currentNumber && <span className="absolute -top-2 right-3 z-10 text-[10px] font-bold uppercase tracking-wider bg-accent text-[#160a00] rounded-full px-2 py-0.5">Etapa atual</span>}
          <StageCard stage={s} m={m} project={project} onOpen={() => onOpen(s.stage_number)} />
        </li>
      ))}
    </ol>
  )
}

/** Fechamento visual com velocímetro do progresso (identidade V8). */
function Closing({ progress }: { progress: number }) {
  const angle = -120 + (progress / 100) * 240
  return (
    <div className="mt-6 rounded-2xl border border-accent/25 bg-gradient-to-r from-accent/10 via-surface-2/60 to-surface-2/40 p-4 md:p-5 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
      <svg viewBox="0 0 120 80" className="w-36 shrink-0" aria-label={`Progresso do lançamento: ${progress}%`}>
        <defs><linearGradient id="v8g" x1="0" x2="1"><stop offset="0" stopColor="#ff6a00" stopOpacity=".35" /><stop offset="1" stopColor="#ff6a00" /></linearGradient></defs>
        <path d="M14 70 A46 46 0 1 1 106 70" fill="none" stroke="var(--color-surface-3)" strokeWidth="9" strokeLinecap="round" />
        <path d="M14 70 A46 46 0 1 1 106 70" fill="none" stroke="url(#v8g)" strokeWidth="9" strokeLinecap="round" pathLength={100} strokeDasharray={`${progress} 100`} className="transition-all duration-700" />
        {[...Array(9)].map((_, k) => { const a = ((-120 + k * 30) * Math.PI) / 180; return <line key={k} x1={60 + Math.sin(a) * 34} y1={58 - Math.cos(a) * 34} x2={60 + Math.sin(a) * 38} y2={58 - Math.cos(a) * 38} stroke="var(--color-faint)" strokeWidth="1.5" /> })}
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '60px 58px', transition: 'transform .8s cubic-bezier(.2,.9,.3,1.2)' }}>
          <line x1="60" y1="58" x2="60" y2="22" stroke="#ff6a00" strokeWidth="3" strokeLinecap="round" />
        </g>
        <circle cx="60" cy="58" r="6" fill="#ff6a00" />
        <text x="60" y="78" textAnchor="middle" className="fill-ink" style={{ font: '800 11px Manrope, Inter, sans-serif' }}>{progress}%</text>
      </svg>
      <div className="text-center sm:text-left">
        <div className="text-sm md:text-base font-extrabold tracking-tight uppercase">Um lançamento não acontece por acaso.</div>
        <p className="text-xs md:text-sm text-muted mt-1 italic">“Cada etapa é pensada, estruturada e executada para que o lançamento aconteça com estratégia, organização e previsibilidade.”</p>
      </div>
    </div>
  )
}

function StageDrawer({ stage, project, expert, m, canManage, onClose }: { stage: Stage; project: Project; expert: Expert | undefined; m: Materials; canManage: boolean; onClose: () => void }) {
  const def = stageDef(stage.stage_number)!
  const { run, busy } = useAction()
  const [d, setD] = useState({ status: stage.status, owner: stage.owner, checklist: stage.checklist, notes: stage.notes, links: stage.links })
  useEffect(() => { setD({ status: stage.status, owner: stage.owner, checklist: stage.checklist, notes: stage.notes, links: stage.links }) }, [stage.id, stage.updated_at])
  const save = () => run(async () => { await saveStage(stage, d); onClose() }, 'Etapa salva.')
  const Icon = def.icon
  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-2xl"
      title={<span className="flex items-center gap-2"><span className="size-7 rounded-lg bg-accent/15 text-accent grid place-items-center"><Icon className="size-4" /></span><span className="text-accent">Etapa {def.number}</span> {def.title}</span>}
      subtitle={project.name}
      footer={canManage ? <Button variant="primary" icon={Save} loading={busy} onClick={save}>Salvar etapa</Button> : undefined}
    >
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted">{def.summary}</p>
          {stage.completed_at && <p className="text-xs text-success mt-1">Concluída em {date(stage.completed_at)}</p>}
        </div>
        <Field label="Status">
          {canManage ? <Segmented value={d.status} onChange={(v) => setD({ ...d, status: v })} options={STAGE_STATUS.map((s) => ({ value: s.value, label: s.label }))} />
            : <Badge tone={STAGE_STATUS.find((s) => s.value === d.status)!.tone} dot>{stageStatusLabel(d.status)}</Badge>}
        </Field>
        <div>
          <h4 className="text-sm font-bold mb-2">O que já está no sistema</h4>
          <StageMaterials assets={def.assets} m={m} project={project} expert={expert} />
        </div>
        <Field label="Responsável"><Input value={d.owner} disabled={!canManage} onChange={(e) => setD({ ...d, owner: e.target.value })} placeholder="Quem conduz esta etapa" /></Field>
        <Field label="Checklist da etapa"><ChecklistEditor value={d.checklist} disabled={!canManage} onChange={(v) => setD({ ...d, checklist: v })} /></Field>
        <Field label="Observações"><Textarea value={d.notes} disabled={!canManage} onChange={(e) => setD({ ...d, notes: e.target.value })} placeholder="Decisões, feedbacks do cliente, pendências" /></Field>
        <Field label="Links e documentos desta etapa" hint="Gravação da call, pasta de criativos, link do CRM, documentos enviados…">
          <LinkListInput value={d.links} disabled={!canManage} onChange={(v) => setD({ ...d, links: v })} />
        </Field>
        {canManage && <FileUpload folder={`launch/${project.id}`} onUploaded={(f) => setD((s) => ({ ...s, links: [...s.links, { label: f.name, url: f.url }] }))} />}
        {!canManage && d.links.length > 0 && <ul className="text-sm space-y-1">{d.links.map((l, i) => <li key={i}><a className="text-primary hover:underline" href={l.url} target="_blank" rel="noreferrer">{l.label || l.url}</a></li>)}</ul>}
      </div>
    </Drawer>
  )
}
