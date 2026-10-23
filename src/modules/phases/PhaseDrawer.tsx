import { CheckCircle2, History, Play, RotateCcw, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { useApp } from '@/app/AppContext'
import { Drawer, useAction, useConfirm } from '@/components/ui/overlay'
import { ChecklistEditor, LinkListInput } from '@/components/ui/inputs'
import { Badge, Button, Field, Input, Textarea } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import { invalidate, useRows } from '@/data/store'
import type { ProjectPhase } from '@/data/types'
import { dateTime, date } from '@/lib/format'
import { phaseDef, PHASE_STATUS_LABEL, type PhaseAction } from '@/lib/phases'

const STATUS_TONE = { concluida: 'success', andamento: 'accent', disponivel: 'primary', bloqueada: 'neutral' } as const

export function PhaseDrawer({ projectId, phaseNumber, onClose }: { projectId: string; phaseNumber: number | null; onClose: () => void }) {
  const { isAdmin } = useAuth()
  const app = useApp()
  const phases = useRows('project_phases')
  const history = useRows('phase_history')
  const confirm = useConfirm()
  const { run, busy } = useAction()
  const phase = phases.rows.find((p) => p.project_id === projectId && p.phase_number === phaseNumber)
  const project = app.projects.find((p) => p.id === projectId)
  const expert = app.experts.find((e) => e.id === project?.expert_id)
  const canManage = isAdmin || Boolean(expert?.permissions.can_manage_phases)
  const [draft, setDraft] = useState<Pick<ProjectPhase, 'owner' | 'notes' | 'checklist' | 'links' | 'started_at'> | null>(null)

  useEffect(() => {
    if (phase) setDraft({ owner: phase.owner, notes: phase.notes, checklist: phase.checklist, links: phase.links, started_at: phase.started_at })
  }, [phase?.id, phase?.updated_at])

  const def = phaseDef(phaseNumber)
  if (!phaseNumber || !def) return null
  const log = history.rows.filter((h) => h.project_id === projectId && h.phase_number === phaseNumber).sort((a, b) => b.created_at.localeCompare(a.created_at))

  const act = async (action: PhaseAction) => {
    if (!phase) return
    const pending = phases.rows.filter((p) => p.project_id === projectId && p.phase_number < phaseNumber && p.status !== 'concluida')
    const outOfOrder = pending.length > 0 && action !== 'reopen'
    const msgs: Record<PhaseAction, { title: string; body: string; label: string; tone: 'success' | 'primary' | 'danger' }> = {
      complete: { title: `Concluir ${def.code} — ${def.name}?`, body: 'A fase será marcada como concluída, o progresso será recalculado e a ação ficará registrada no histórico com seu usuário e horário.', label: 'Marcar como concluída', tone: 'success' },
      start: { title: `Iniciar ${def.code} — ${def.name}?`, body: 'Esta fase passará a ser a fase atual do projeto.', label: 'Iniciar fase', tone: 'primary' },
      reopen: { title: `Reabrir ${def.code} — ${def.name}?`, body: 'A fase deixará de contar como concluída e o progresso será recalculado.', label: 'Reabrir fase', tone: 'danger' },
    }
    const m = msgs[action]
    const ok = await confirm({
      title: m.title,
      message: (
        <>
          <p>{m.body}</p>
          {outOfOrder && (
            <p className="mt-2 text-warning">
              Atenção: {pending.map((p) => 'V' + p.phase_number).join(', ')} ainda não está(ão) concluída(s). A ação será registrada como exceção administrativa e as fases anteriores NÃO serão concluídas automaticamente.
            </p>
          )}
        </>
      ),
      confirmLabel: m.label,
      tone: m.tone,
    })
    if (!ok) return
    await run(async () => {
      await backend.rpc('set_phase_status', { project_id: projectId, phase_number: phaseNumber, action, note: '' })
      await invalidate('project_phases', 'phase_history', 'projects', 'activity_log')
    }, action === 'complete' ? `${def.code} concluída!` : action === 'start' ? `${def.code} iniciada.` : `${def.code} reaberta.`)
  }

  const save = () =>
    phase && draft &&
    run(async () => {
      await backend.update('project_phases', phase.id, draft)
      await invalidate('project_phases')
    }, 'Fase atualizada.')

  return (
    <Drawer
      open
      onClose={onClose}
      title={<span className="flex items-center gap-2"><span className="text-accent">{def.code}</span> {def.name}</span>}
      subtitle={project?.name}
      footer={
        canManage && phase ? (
          <>
            {phase.status !== 'concluida' && phase.status !== 'andamento' && <Button icon={Play} onClick={() => act('start')} loading={busy}>Iniciar fase</Button>}
            {phase.status === 'concluida' ? (
              <Button variant="danger" icon={RotateCcw} onClick={() => act('reopen')} loading={busy}>Reabrir fase</Button>
            ) : (
              <Button variant="success" icon={CheckCircle2} onClick={() => act('complete')} loading={busy}>Marcar como concluída</Button>
            )}
            <Button variant="primary" icon={Save} onClick={save} loading={busy}>Salvar detalhes</Button>
          </>
        ) : undefined
      }
    >
      {!phase || !draft ? (
        <p className="text-sm text-muted">Fase não encontrada para este projeto.</p>
      ) : (
        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge tone={STATUS_TONE[phase.status]} dot>{PHASE_STATUS_LABEL[phase.status]}</Badge>
              {project?.current_phase === phaseNumber && <Badge tone="accent">Fase atual</Badge>}
            </div>
            <p className="text-sm text-muted">{def.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-surface-2 border border-line p-3"><div className="text-xs text-muted">Início</div><div className="font-semibold">{date(phase.started_at)}</div></div>
            <div className="rounded-xl bg-surface-2 border border-line p-3"><div className="text-xs text-muted">Conclusão</div><div className="font-semibold">{date(phase.completed_at)}</div></div>
          </div>
          <Field label="Responsável">
            <Input value={draft.owner} disabled={!canManage} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} placeholder="Quem conduz esta fase" />
          </Field>
          <Field label="Checklist de entregas" hint="O checklist orienta a execução, mas a conclusão da fase é sempre uma ação explícita.">
            <ChecklistEditor value={draft.checklist} disabled={!canManage} onChange={(v) => setDraft({ ...draft, checklist: v })} />
          </Field>
          <Field label="Observações">
            <Textarea value={draft.notes} disabled={!canManage} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </Field>
          <Field label="Arquivos e links de referência">
            <LinkListInput value={draft.links} disabled={!canManage} onChange={(v) => setDraft({ ...draft, links: v })} />
          </Field>
          {!canManage && draft.links.length > 0 && (
            <ul className="text-sm space-y-1">{draft.links.map((l, i) => <li key={i}><a className="text-primary hover:underline" href={l.url} target="_blank" rel="noreferrer">{l.label || l.url}</a></li>)}</ul>
          )}
          <div>
            <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><History className="size-4 text-muted" />Histórico de alterações</h4>
            {log.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma alteração registrada.</p>
            ) : (
              <ol className="space-y-3 border-l border-line pl-4">
                {log.map((h) => (
                  <li key={h.id} className="text-sm relative">
                    <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" />
                    <div className="font-semibold">
                      {h.from_status ? PHASE_STATUS_LABEL[h.from_status] : '—'} → {h.to_status ? PHASE_STATUS_LABEL[h.to_status] : '—'}
                    </div>
                    <div className="text-xs text-muted">{h.user_name} · {dateTime(h.created_at)}</div>
                    {h.note && <div className="text-xs text-faint mt-0.5">{h.note}</div>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}
