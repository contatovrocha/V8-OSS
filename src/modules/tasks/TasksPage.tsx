import clsx from 'clsx'
import { CheckSquare, Columns3, List, MessageSquare, Paperclip, Plus, Send, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useApp } from '@/app/AppContext'
import { TASK_PRIORITY, TASK_STATUS } from '@/app/labels'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/layout/AppLayout'
import { DataTable } from '@/components/ui/DataTable'
import { ChecklistEditor, FileUpload } from '@/components/ui/inputs'
import { Drawer, useAction, useConfirm } from '@/components/ui/overlay'
import { Badge, Button, Card, EmptyState, Field, IconButton, Input, Segmented, Select, Skeleton, Textarea } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import { invalidate, useRows } from '@/data/store'
import type { Task, TaskPriority, TaskStatus } from '@/data/types'
import { date, dateTime, todayISO } from '@/lib/format'
import { PHASES } from '@/lib/phases'

export default function TasksPage() {
  return (
    <div>
      <PageHeader eyebrow="Execução" title="Tarefas e entregas" subtitle="Tudo o que precisa ser feito em cada projeto e fase" />
      <TasksView />
    </div>
  )
}

const COLUMNS: TaskStatus[] = ['a_fazer', 'andamento', 'revisao', 'concluida', 'bloqueada']

export function TasksView({ fixedProjectId }: { fixedProjectId?: string }) {
  const app = useApp()
  const { isAdmin } = useAuth()
  const tasks = useRows('tasks')
  const { run } = useAction()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [projectF, setProjectF] = useState('all')
  const [phaseF, setPhaseF] = useState('all')
  const [assigneeF, setAssigneeF] = useState('all')
  const [priorityF, setPriorityF] = useState<TaskPriority | 'all'>('all')
  const [open, setOpen] = useState<Task | 'new' | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const projectIds = fixedProjectId ? new Set([fixedProjectId]) : app.scopeProjectIds
  const canEdit = isAdmin || app.projects.some((p) => projectIds.has(p.id) && app.experts.find((e) => e.id === p.expert_id)?.permissions.can_edit_tasks)
  const today = todayISO()

  const list = useMemo(
    () =>
      tasks.rows
        .filter((t) => projectIds.has(t.project_id))
        .filter((t) => projectF === 'all' || t.project_id === projectF)
        .filter((t) => phaseF === 'all' || String(t.phase_number ?? 'none') === phaseF)
        .filter((t) => assigneeF === 'all' || t.assignee === assigneeF)
        .filter((t) => priorityF === 'all' || t.priority === priorityF)
        .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')),
    [tasks.rows, projectIds, projectF, phaseF, assigneeF, priorityF],
  )
  const assignees = [...new Set(tasks.rows.filter((t) => projectIds.has(t.project_id)).map((t) => t.assignee).filter(Boolean))]
  const projectName = (id: string) => app.projects.find((p) => p.id === id)?.name ?? '—'
  const move = (t: Task, status: TaskStatus) => t.status !== status && run(async () => { await backend.update('tasks', t.id, { status }); await invalidate('tasks', 'activity_log') }, `Tarefa movida para "${TASK_STATUS[status].label}".`)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {!fixedProjectId && (
          <Select className="!w-auto" value={projectF} onChange={(e) => setProjectF(e.target.value)} aria-label="Projeto">
            <option value="all">Todos os projetos</option>
            {app.projects.filter((p) => projectIds.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}
        <Select className="!w-auto" value={phaseF} onChange={(e) => setPhaseF(e.target.value)} aria-label="Fase">
          <option value="all">Todas as fases</option>
          {PHASES.map((p) => <option key={p.number} value={p.number}>{p.code} — {p.name}</option>)}
          <option value="none">Sem fase</option>
        </Select>
        <Select className="!w-auto" value={assigneeF} onChange={(e) => setAssigneeF(e.target.value)} aria-label="Responsável">
          <option value="all">Todos os responsáveis</option>
          {assignees.map((a) => <option key={a}>{a}</option>)}
        </Select>
        <Select className="!w-auto" value={priorityF} onChange={(e) => setPriorityF(e.target.value as TaskPriority | 'all')} aria-label="Prioridade">
          <option value="all">Todas as prioridades</option>
          {Object.entries(TASK_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Segmented size="sm" value={view} onChange={setView} options={[{ value: 'kanban', label: 'Kanban', icon: Columns3 }, { value: 'list', label: 'Lista', icon: List }]} />
          {canEdit && <Button size="sm" variant="primary" icon={Plus} onClick={() => setOpen('new')}>Nova tarefa</Button>}
        </div>
      </div>

      {tasks.loading ? (
        <Skeleton className="h-96" />
      ) : view === 'kanban' ? (
        <div className="grid grid-flow-col auto-cols-[minmax(260px,1fr)] gap-3 overflow-x-auto pb-3">
          {COLUMNS.map((col) => {
            const items = list.filter((t) => t.status === col)
            return (
              <div
                key={col}
                className={clsx('rounded-2xl border border-line bg-surface/60 p-3 min-h-64 transition', dragId && 'border-dashed')}
                onDragOver={(e) => canEdit && e.preventDefault()}
                onDrop={() => { const t = list.find((x) => x.id === dragId); if (t) move(t, col); setDragId(null) }}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <Badge tone={TASK_STATUS[col].tone} dot>{TASK_STATUS[col].label}</Badge>
                  <span className="text-xs text-faint">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((t) => {
                    const late = t.due_date && t.due_date < today && t.status !== 'concluida'
                    const done = t.checklist.filter((c) => c.done).length
                    return (
                      <div
                        key={t.id}
                        draggable={canEdit}
                        onDragStart={() => setDragId(t.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => setOpen(t)}
                        className={clsx('rounded-xl border bg-surface-2 p-3 cursor-pointer hover:border-line-strong transition animate-fade-up', late ? 'border-danger/40' : 'border-line', dragId === t.id && 'opacity-40')}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold leading-snug">{t.title}</span>
                          <Badge tone={TASK_PRIORITY[t.priority].tone} className="!text-[10px] !px-1.5">{TASK_PRIORITY[t.priority].label}</Badge>
                        </div>
                        {!fixedProjectId && <div className="text-[11px] text-faint mt-1 truncate">{projectName(t.project_id)}</div>}
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-muted">
                          {t.phase_number && <span className="text-accent font-bold">V{t.phase_number}</span>}
                          {t.due_date && <span className={clsx(late && 'text-danger font-semibold')}>{late ? 'Atrasada · ' : ''}{date(t.due_date)}</span>}
                          {t.checklist.length > 0 && <span className="inline-flex items-center gap-1"><CheckSquare className="size-3" />{done}/{t.checklist.length}</span>}
                          {t.assignee && <span className="ml-auto truncate max-w-28">{t.assignee}</span>}
                        </div>
                        {canEdit && (
                          <Select className="!h-7 !text-[11px] mt-2 sm:hidden" value={t.status} onClick={(e) => e.stopPropagation()} onChange={(e) => move(t, e.target.value as TaskStatus)} aria-label="Mover tarefa">
                            {COLUMNS.map((c) => <option key={c} value={c}>{TASK_STATUS[c].label}</option>)}
                          </Select>
                        )}
                      </div>
                    )
                  })}
                  {!items.length && <p className="text-xs text-faint text-center py-6">{canEdit ? 'Arraste tarefas para cá' : 'Nenhuma tarefa'}</p>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <DataTable
          rows={list}
          onRowClick={setOpen}
          searchText={(t) => `${t.title} ${t.assignee} ${t.description}`}
          empty={<EmptyState icon={CheckSquare} title="Nenhuma tarefa" description="Crie tarefas para organizar as entregas de cada fase." />}
          columns={[
            { key: 't', header: 'Tarefa', cell: (t) => <span className="font-semibold">{t.title}</span>, sortValue: (t) => t.title },
            ...(fixedProjectId ? [] : [{ key: 'p', header: 'Projeto', cell: (t: Task) => <span className="text-xs text-muted">{projectName(t.project_id)}</span> }]),
            { key: 'ph', header: 'Fase', cell: (t) => (t.phase_number ? `V${t.phase_number}` : '—'), sortValue: (t) => t.phase_number },
            { key: 'a', header: 'Responsável', cell: (t) => t.assignee || '—', sortValue: (t) => t.assignee },
            { key: 'pr', header: 'Prioridade', cell: (t) => <Badge tone={TASK_PRIORITY[t.priority].tone}>{TASK_PRIORITY[t.priority].label}</Badge>, sortValue: (t) => ['baixa', 'media', 'alta', 'urgente'].indexOf(t.priority) },
            { key: 'd', header: 'Prazo', cell: (t) => <span className={clsx(t.due_date && t.due_date < today && t.status !== 'concluida' && 'text-danger font-semibold')}>{date(t.due_date)}</span>, sortValue: (t) => t.due_date },
            { key: 's', header: 'Status', cell: (t) => <Badge tone={TASK_STATUS[t.status].tone} dot>{TASK_STATUS[t.status].label}</Badge>, sortValue: (t) => t.status },
          ]}
        />
      )}
      {open && <TaskDrawer task={open === 'new' ? null : open} canEdit={canEdit} defaultProject={fixedProjectId ?? (projectF !== 'all' ? projectF : app.selectedProject?.id)} onClose={() => setOpen(null)} />}
    </div>
  )
}

function TaskDrawer({ task, canEdit, defaultProject, onClose }: { task: Task | null; canEdit: boolean; defaultProject?: string; onClose: () => void }) {
  const app = useApp()
  const { user, isAdmin } = useAuth()
  const comments = useRows('task_comments')
  const files = useRows('files')
  const log = useRows('activity_log')
  const { run, busy } = useAction()
  const confirm = useConfirm()
  const [d, setD] = useState<Partial<Task>>(task ?? { project_id: defaultProject ?? app.projects[0]?.id ?? '', phase_number: null, title: '', description: '', assignee: '', priority: 'media', start_date: todayISO(), due_date: null, status: 'a_fazer', checklist: [], sort_order: 0, is_demo: false })
  const [comment, setComment] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setD((s) => ({ ...s, [k]: v }))
  const save = () => {
    const e: Record<string, string> = {}
    if (!d.title?.trim()) e.title = 'Informe o título.'
    if (!d.project_id) e.project_id = 'Selecione o projeto.'
    if (d.start_date && d.due_date && d.due_date < d.start_date) e.due_date = 'O prazo deve ser posterior ao início.'
    setErrors(e)
    if (Object.keys(e).length) return
    run(async () => {
      if (task) await backend.update('tasks', task.id, d)
      else await backend.insert('tasks', d)
      await invalidate('tasks', 'activity_log')
      onClose()
    }, task ? 'Tarefa atualizada.' : 'Tarefa criada.')
  }
  const remove = async () => {
    if (!task || !(await confirm({ title: 'Excluir tarefa?', message: <>A tarefa <strong className="text-ink">{task.title}</strong> e seus comentários serão excluídos.</>, tone: 'danger', confirmLabel: 'Excluir' }))) return
    run(async () => { await backend.remove('tasks', task.id); await invalidate('tasks', 'task_comments', 'activity_log'); onClose() }, 'Tarefa excluída.')
  }
  const taskComments = task ? comments.rows.filter((c) => c.task_id === task.id).sort((a, b) => a.created_at.localeCompare(b.created_at)) : []
  const taskFiles = task ? files.rows.filter((f) => f.entity_type === 'task' && f.entity_id === task.id) : []
  const history = task ? log.rows.filter((l) => l.entity_id === task.id).sort((a, b) => b.created_at.localeCompare(a.created_at)) : []
  const ro = !canEdit

  return (
    <Drawer
      open
      onClose={onClose}
      title={task ? task.title : 'Nova tarefa'}
      subtitle={task ? app.projects.find((p) => p.id === task.project_id)?.name : undefined}
      footer={canEdit ? <>{task && isAdmin && <Button variant="danger" icon={Trash2} onClick={remove} className="mr-auto">Excluir</Button>}<Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>Salvar</Button></> : undefined}
    >
      <div className="space-y-4">
        <Field label="Título" required error={errors.title}><Input value={d.title} disabled={ro} invalid={!!errors.title} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Descrição"><Textarea value={d.description} disabled={ro} onChange={(e) => set('description', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Projeto" required error={errors.project_id}><Select value={d.project_id} disabled={ro} onChange={(e) => set('project_id', e.target.value)}>{app.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <Field label="Fase"><Select value={d.phase_number ?? ''} disabled={ro} onChange={(e) => set('phase_number', e.target.value ? +e.target.value : null)}><option value="">Sem fase</option>{PHASES.map((p) => <option key={p.number} value={p.number}>{p.code} — {p.name}</option>)}</Select></Field>
          <Field label="Responsável"><Input value={d.assignee} disabled={ro} onChange={(e) => set('assignee', e.target.value)} /></Field>
          <Field label="Prioridade"><Select value={d.priority} disabled={ro} onChange={(e) => set('priority', e.target.value as TaskPriority)}>{Object.entries(TASK_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
          <Field label="Data de início"><Input type="date" disabled={ro} value={d.start_date ?? ''} onChange={(e) => set('start_date', e.target.value || null)} /></Field>
          <Field label="Prazo" error={errors.due_date}><Input type="date" disabled={ro} value={d.due_date ?? ''} onChange={(e) => set('due_date', e.target.value || null)} /></Field>
          <Field label="Status" className="col-span-2"><Select value={d.status} disabled={ro} onChange={(e) => set('status', e.target.value as TaskStatus)}>{COLUMNS.map((c) => <option key={c} value={c}>{TASK_STATUS[c].label}</option>)}</Select></Field>
        </div>
        <Field label="Checklist"><ChecklistEditor value={d.checklist ?? []} disabled={ro} onChange={(v) => set('checklist', v)} /></Field>

        {task && (
          <>
            <div>
              <div className="flex items-center justify-between mb-2"><h4 className="text-sm font-bold flex items-center gap-2"><Paperclip className="size-4 text-muted" />Arquivos</h4>
                <FileUpload folder={`tasks/${task.id}`} onUploaded={(f) => run(async () => { await backend.insert('files', { project_id: task.project_id, entity_type: 'task', entity_id: task.id, name: f.name, url: f.url, mime: f.mime, size: f.size, uploaded_by: user!.id }); await invalidate('files') }, 'Arquivo anexado.')} />
              </div>
              {taskFiles.length ? <ul className="text-sm space-y-1">{taskFiles.map((f) => <li key={f.id}><a href={f.url} target="_blank" rel="noreferrer" download={f.name} className="text-primary hover:underline">{f.name}</a></li>)}</ul> : <p className="text-xs text-muted">Nenhum arquivo.</p>}
            </div>
            <div>
              <h4 className="text-sm font-bold flex items-center gap-2 mb-2"><MessageSquare className="size-4 text-muted" />Comentários</h4>
              <div className="space-y-3 mb-3">
                {taskComments.map((c) => (
                  <div key={c.id} className="rounded-xl bg-surface-2 border border-line p-3 text-sm">
                    <div className="text-xs text-muted mb-1"><strong className="text-ink">{c.user_name}</strong> · {dateTime(c.created_at)}</div>
                    <p className="whitespace-pre-line">{c.body}</p>
                  </div>
                ))}
                {!taskComments.length && <p className="text-xs text-muted">Nenhum comentário.</p>}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Escreva um comentário..." value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && comment.trim() && (e.currentTarget.nextElementSibling as HTMLButtonElement)?.click()} />
                <IconButton icon={Send} label="Enviar comentário" disabled={!comment.trim()} className="!size-10 bg-primary !text-white hover:!bg-primary" onClick={() => run(async () => {
                  await backend.insert('task_comments', { task_id: task.id, user_id: user!.id, user_name: user!.full_name, body: comment.trim() })
                  setComment('')
                  await invalidate('task_comments')
                })} />
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold mb-2">Histórico</h4>
              {history.length ? (
                <ul className="space-y-1.5 text-xs">{history.map((h) => <li key={h.id}><span className="text-ink">{h.summary}</span> <span className="text-faint">· {h.user_name} · {dateTime(h.created_at)}</span></li>)}</ul>
              ) : <p className="text-xs text-muted">Sem alterações registradas.</p>}
            </div>
          </>
        )}
        {ro && <Card className="p-3 text-xs text-muted">Visualização somente leitura. A edição de tarefas é liberada pela administração.</Card>}
      </div>
    </Drawer>
  )
}
