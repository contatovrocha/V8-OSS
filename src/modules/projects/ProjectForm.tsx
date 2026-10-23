import { useState } from 'react'
import { useApp } from '@/app/AppContext'
import { PROJECT_STATUS } from '@/app/labels'
import { ImageUpload, LinkListInput, MoneyInput, TagInput } from '@/components/ui/inputs'
import { Modal, useAction } from '@/components/ui/overlay'
import { Button, Checkbox, Field, Input, Select, Textarea } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import { invalidate, useRows } from '@/data/store'
import type { Project } from '@/data/types'
import { addDays } from '@/lib/format'

type Draft = Omit<Project, 'id' | 'created_at' | 'updated_at' | 'is_demo' | 'archived' | 'current_phase'>

const empty = (expertId: string): Draft => ({
  expert_id: expertId, name: '', description: '', category: '', launch_type: 'Jantar Empresarial', start_date: null, end_date: null, event_date: null,
  revenue_goal: 0, sales_goal: 0, traffic_budget: 0, status: 'estruturacao', cover_url: null, links: [], internal_notes: '', team: [], ad_account_id: null,
})

export function ProjectForm({ project, onClose, onSaved }: { project?: Project | null; onClose: () => void; onSaved?: (p: Project) => void }) {
  const app = useApp()
  const accounts = useRows('ad_accounts')
  const templates = useRows('task_templates')
  const { run, busy } = useAction()
  const [d, setD] = useState<Draft>(() => (project ? { ...project } : empty(app.expertId !== 'all' ? app.expertId : app.experts[0]?.id ?? '')))
  const [applyTemplates, setApplyTemplates] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!d.name.trim()) e.name = 'Informe o nome do projeto.'
    if (!d.expert_id) e.expert_id = 'Selecione o expert responsável.'
    if (d.start_date && d.end_date && d.end_date < d.start_date) e.end_date = 'A conclusão deve ser posterior ao início.'
    if (d.revenue_goal < 0 || d.sales_goal < 0 || d.traffic_budget < 0) e.goals = 'Metas não podem ser negativas.'
    d.links.forEach((l) => { if (l.url && !/^https?:\/\//.test(l.url)) e.links = 'Links devem começar com http:// ou https://' })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const save = () => {
    if (!validate()) return
    run(async () => {
      const payload = { ...d, name: d.name.trim(), links: d.links.filter((l) => l.url) }
      let saved: Project
      if (project) saved = await backend.update('projects', project.id, payload)
      else {
        saved = await backend.insert('projects', { ...payload, archived: false, current_phase: null, is_demo: false })
        if (applyTemplates && templates.rows.length) {
          const base = d.start_date ?? new Date().toISOString().slice(0, 10)
          await backend.insertMany('tasks', templates.rows.map((t, i) => ({
            project_id: saved.id, phase_number: t.phase_number, title: t.title, description: t.description, assignee: '', priority: t.priority,
            start_date: base, due_date: addDays(base, t.offset_days + (t.phase_number - 1) * 7), status: 'a_fazer' as const,
            checklist: t.checklist.map((label) => ({ id: crypto.randomUUID(), label, done: false })), sort_order: i, is_demo: false,
          })))
        }
      }
      await invalidate('projects', 'project_phases', 'tasks', 'activity_log')
      onSaved?.(saved)
      onClose()
    }, project ? 'Projeto atualizado.' : 'Projeto criado.')
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={project ? 'Editar projeto' : 'Novo projeto'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>{project ? 'Salvar alterações' : 'Criar projeto'}</Button></>}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome" required error={errors.name} className="sm:col-span-2"><Input value={d.name} invalid={!!errors.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Jantar Empresarial — Lançamento" /></Field>
        <Field label="Descrição" className="sm:col-span-2"><Textarea value={d.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="Expert responsável" required error={errors.expert_id}>
          <Select value={d.expert_id} invalid={!!errors.expert_id} onChange={(e) => set('expert_id', e.target.value)}>
            <option value="">Selecione...</option>
            {app.experts.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={d.status} onChange={(e) => set('status', e.target.value as Project['status'])}>
            {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </Field>
        <Field label="Categoria"><Input value={d.category} onChange={(e) => set('category', e.target.value)} placeholder="Evento presencial, mentoria..." /></Field>
        <Field label="Tipo de lançamento"><Input value={d.launch_type} onChange={(e) => set('launch_type', e.target.value)} /></Field>
        <Field label="Data de início"><Input type="date" value={d.start_date ?? ''} onChange={(e) => set('start_date', e.target.value || null)} /></Field>
        <Field label="Conclusão prevista" error={errors.end_date}><Input type="date" value={d.end_date ?? ''} onChange={(e) => set('end_date', e.target.value || null)} /></Field>
        <Field label="Data do evento presencial" hint="Se aplicável"><Input type="date" value={d.event_date ?? ''} onChange={(e) => set('event_date', e.target.value || null)} /></Field>
        <Field label="Conta de anúncios">
          <Select value={d.ad_account_id ?? ''} onChange={(e) => set('ad_account_id', e.target.value || null)}>
            <option value="">Nenhuma</option>
            {accounts.rows.map((a) => <option key={a.id} value={a.id}>{a.name}{a.is_demo ? ' (demo)' : ''}</option>)}
          </Select>
        </Field>
        <Field label="Meta de faturamento" error={errors.goals}><MoneyInput value={d.revenue_goal} onChange={(v) => set('revenue_goal', v ?? 0)} /></Field>
        <Field label="Meta de vendas (quantidade)"><Input type="number" min={0} value={d.sales_goal} onChange={(e) => set('sales_goal', Math.max(0, +e.target.value || 0))} /></Field>
        <Field label="Orçamento de tráfego"><MoneyInput value={d.traffic_budget} onChange={(v) => set('traffic_budget', v ?? 0)} /></Field>
        <Field label="Equipe responsável"><TagInput value={d.team} onChange={(v) => set('team', v)} placeholder="Nome e função, Enter para adicionar" /></Field>
        <Field label="Fotografia de capa" className="sm:col-span-2"><ImageUpload value={d.cover_url} aspect={16 / 9} folder="projects" onChange={(v) => set('cover_url', v)} /></Field>
        <Field label="Links importantes" error={errors.links} className="sm:col-span-2"><LinkListInput value={d.links} onChange={(v) => set('links', v)} /></Field>
        <Field label="Observações internas" hint="Visíveis apenas para a administração e para o expert do projeto." className="sm:col-span-2"><Textarea value={d.internal_notes} onChange={(e) => set('internal_notes', e.target.value)} /></Field>
        {!project && templates.rows.length > 0 && (
          <div className="sm:col-span-2"><Checkbox checked={applyTemplates} onChange={setApplyTemplates} label={`Criar tarefas a partir dos ${templates.rows.length} modelos de tarefas por fase`} /></div>
        )}
      </div>
    </Modal>
  )
}
