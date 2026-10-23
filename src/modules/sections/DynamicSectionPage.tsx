import { Eye, LayoutGrid, List, Pencil, Plus, ShieldOff, Trash2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '@/app/AppContext'
import { iconFor } from '@/app/nav'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/layout/AppLayout'
import { DataTable } from '@/components/ui/DataTable'
import { FileUpload, ImageUpload, MoneyInput } from '@/components/ui/inputs'
import { Modal, useAction, useConfirm } from '@/components/ui/overlay'
import { Badge, Button, Card, Checkbox, EmptyState, Field, IconButton, Input, Segmented, Select, Skeleton, Textarea } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import { invalidate, useRows } from '@/data/store'
import type { FieldConfig, SectionConfig, SectionRecord } from '@/data/types'
import { date, dateTime, money, num } from '@/lib/format'
import { validateRecord } from '@/lib/sections'

export default function DynamicSectionPage() {
  const { slug } = useParams()
  const sections = useRows('section_configs')
  const section = sections.rows.find((s) => s.slug === slug)
  if (sections.loading) return <Skeleton className="h-96" />
  if (!section || !section.active)
    return <EmptyState icon={ShieldOff} title="Seção indisponível" description="A seção não existe, foi desativada ou não está liberada para o seu perfil." />
  return <SectionView key={section.id} section={section} />
}

function useDisplay() {
  const app = useApp()
  return (f: FieldConfig, v: unknown): ReactNode => {
    if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return <span className="text-faint">—</span>
    switch (f.type) {
      case 'currency': return money(Number(v))
      case 'number': return num(Number(v))
      case 'date': return date(String(v))
      case 'datetime': return dateTime(String(v))
      case 'checkbox': return v ? 'Sim' : 'Não'
      case 'multiselect': return <div className="flex flex-wrap gap-1">{(v as string[]).map((x) => <Badge key={x}>{x}</Badge>)}</div>
      case 'status': return <Badge tone="primary" dot>{String(v)}</Badge>
      case 'url': return <a href={String(v)} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate inline-block max-w-56" onClick={(e) => e.stopPropagation()}>{String(v).replace(/^https?:\/\//, '')}</a>
      case 'file': return <a href={String(v)} target="_blank" rel="noreferrer" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>Abrir arquivo</a>
      case 'image': return <img src={String(v)} alt="" className="size-10 rounded-lg object-cover" />
      case 'project': return app.projects.find((p) => p.id === v)?.name ?? '—'
      case 'expert': return app.experts.find((p) => p.id === v)?.full_name ?? '—'
      default: return <span className="line-clamp-2">{String(v)}</span>
    }
  }
}

function SectionView({ section }: { section: SectionConfig }) {
  const app = useApp()
  const { isAdmin } = useAuth()
  const records = useRows('section_records')
  const { run } = useAction()
  const confirm = useConfirm()
  const display = useDisplay()
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<SectionRecord | 'new' | null>(null)
  const [viewing, setViewing] = useState<SectionRecord | null>(null)
  const canEdit = isAdmin || section.expert_can_edit
  const Icon = iconFor(section.icon)
  const fields = section.fields
  const titleField = fields.find((f) => f.type === 'text') ?? fields[0]
  const imageField = fields.find((f) => f.type === 'image' && f.show_in_card)

  const list = useMemo(
    () =>
      records.rows
        .filter((r) => r.section_id === section.id)
        .filter((r) => !r.project_id || app.projects.some((p) => p.id === r.project_id))
        .filter((r) => app.projectId === 'all' || !r.project_id || r.project_id === app.projectId)
        .filter((r) => Object.entries(filters).every(([k, v]) => !v || (Array.isArray(r.data[k]) ? (r.data[k] as string[]).includes(v) : String(r.data[k] ?? '') === v)))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [records.rows, section.id, filters, app.projects, app.projectId],
  )

  const optionsFor = (f: FieldConfig) =>
    f.type === 'project' ? app.projects.map((p) => [p.id, p.name]) : f.type === 'expert' ? app.experts.map((e) => [e.id, e.full_name]) : f.type === 'checkbox' ? [['true', 'Sim'], ['false', 'Não']] : f.options.map((o) => [o, o])

  const remove = async (r: SectionRecord) => {
    if (!(await confirm({ title: 'Excluir registro?', message: 'O registro será excluído permanentemente.', tone: 'danger', confirmLabel: 'Excluir' }))) return
    run(async () => { await backend.remove('section_records', r.id); await invalidate('section_records', 'activity_log') }, 'Registro excluído.')
  }
  const actions = (r: SectionRecord) => (
    <div className="flex" onClick={(e) => e.stopPropagation()}>
      <IconButton icon={Eye} label="Visualizar" onClick={() => setViewing(r)} />
      {canEdit && <IconButton icon={Pencil} label="Editar" onClick={() => setEditing(r)} />}
      {isAdmin && <IconButton icon={Trash2} label="Excluir" onClick={() => remove(r)} />}
    </div>
  )

  return (
    <div>
      <PageHeader
        eyebrow="Seção personalizada"
        title={<span className="inline-flex items-center gap-3"><Icon className="size-8 text-primary" />{section.name}</span>}
        subtitle={section.description}
        actions={canEdit && <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Novo registro</Button>}
      />
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {fields.filter((f) => f.filterable).map((f) => (
          <Select key={f.key} className="!w-auto" value={filters[f.key] ?? ''} onChange={(e) => setFilters((s) => ({ ...s, [f.key]: e.target.value }))} aria-label={f.label}>
            <option value="">{f.label}: todos</option>
            {optionsFor(f).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        ))}
        <div className="ml-auto"><Segmented size="sm" value={view} onChange={setView} options={[{ value: 'cards', label: 'Cards', icon: LayoutGrid }, { value: 'table', label: 'Tabela', icon: List }]} /></div>
      </div>
      {records.loading ? <Skeleton className="h-64" /> : list.length === 0 ? (
        <Card><EmptyState icon={Icon} title="Nenhum registro" description={canEdit ? 'Cadastre o primeiro registro desta seção.' : 'Ainda não há registros publicados.'} action={canEdit && <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Cadastrar</Button>} /></Card>
      ) : view === 'cards' ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {list.map((r) => (
            <Card key={r.id} className="overflow-hidden cursor-pointer hover:border-line-strong transition animate-fade-up" onClick={() => setViewing(r)}>
              {imageField && <div className="aspect-[16/9] bg-surface-3">{typeof r.data[imageField.key] === 'string' && r.data[imageField.key] ? <img src={String(r.data[imageField.key])} alt="" className="size-full object-cover" /> : null}</div>}
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2"><h3 className="font-bold">{String(r.data[titleField?.key] ?? 'Sem título')}</h3>{actions(r)}</div>
                {fields.filter((f) => f.show_in_card && f !== titleField && f !== imageField).map((f) => (
                  <div key={f.key} className="text-sm flex justify-between gap-3"><span className="text-muted text-xs">{f.label}</span><span className="text-right min-w-0">{display(f, r.data[f.key])}</span></div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <DataTable
          rows={list}
          onRowClick={setViewing}
          searchText={(r) => Object.values(r.data).join(' ')}
          columns={[
            ...fields.filter((f) => f.show_in_table).map((f) => ({ key: f.key, header: f.label, cell: (r: SectionRecord) => display(f, r.data[f.key]), sortValue: (r: SectionRecord) => (typeof r.data[f.key] === 'number' ? (r.data[f.key] as number) : String(r.data[f.key] ?? '')) })),
            { key: '_upd', header: 'Atualizado', cell: (r: SectionRecord) => date(r.updated_at), sortValue: (r: SectionRecord) => r.updated_at },
            { key: '_act', header: '', cell: actions },
          ]}
        />
      )}
      {editing && <RecordForm section={section} record={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={String(viewing.data[titleField?.key] ?? section.name)} subtitle={`Atualizado em ${dateTime(viewing.updated_at)}`} footer={canEdit && <Button icon={Pencil} onClick={() => { setEditing(viewing); setViewing(null) }}>Editar</Button>}>
          <dl className="space-y-3">
            {fields.map((f) => <div key={f.key} className="grid grid-cols-[140px_1fr] gap-3 text-sm"><dt className="text-muted">{f.label}</dt><dd>{f.type === 'image' && viewing.data[f.key] ? <img src={String(viewing.data[f.key])} alt="" className="max-h-48 rounded-xl" /> : display(f, viewing.data[f.key])}</dd></div>)}
          </dl>
        </Modal>
      )}
    </div>
  )
}

function RecordForm({ section, record, onClose }: { section: SectionConfig; record: SectionRecord | null; onClose: () => void }) {
  const app = useApp()
  const { user } = useAuth()
  const { run, busy } = useAction()
  const [data, setData] = useState<Record<string, unknown>>(() => {
    if (record) return { ...record.data }
    const init: Record<string, unknown> = {}
    section.fields.forEach((f) => {
      if (f.type === 'project') init[f.key] = section.project_id ?? app.selectedProject?.id ?? null
      if (f.type === 'expert') init[f.key] = section.expert_id ?? app.selectedExpert?.id ?? null
      if (f.type === 'checkbox') init[f.key] = false
      if (f.type === 'multiselect') init[f.key] = []
    })
    return init
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: string, v: unknown) => setData((s) => ({ ...s, [k]: v }))
  const save = () => {
    const { data: clean, errors: e } = validateRecord(section.fields, data)
    setErrors(e)
    if (Object.keys(e).length) return
    const projectField = section.fields.find((f) => f.type === 'project')
    const expertField = section.fields.find((f) => f.type === 'expert')
    const project_id = section.project_id ?? ((projectField && (clean[projectField.key] as string)) || app.selectedProject?.id || null)
    const expert_id = section.expert_id ?? ((expertField && (clean[expertField.key] as string)) || app.projects.find((p) => p.id === project_id)?.expert_id || app.selectedExpert?.id || null)
    run(async () => {
      if (record) await backend.update('section_records', record.id, { data: clean, project_id: record.project_id ?? project_id, expert_id: record.expert_id ?? expert_id })
      else await backend.insert('section_records', { section_id: section.id, data: clean, project_id, expert_id, created_by: user!.id })
      await invalidate('section_records', 'activity_log')
      onClose()
    }, record ? 'Registro atualizado.' : 'Registro criado.')
  }
  const input = (f: FieldConfig) => {
    const v = data[f.key]
    const inv = !!errors[f.key]
    switch (f.type) {
      case 'textarea': return <Textarea value={String(v ?? '')} invalid={inv} onChange={(e) => set(f.key, e.target.value)} />
      case 'number': return <Input type="number" value={v === null || v === undefined ? '' : String(v)} invalid={inv} onChange={(e) => set(f.key, e.target.value === '' ? null : Number(e.target.value))} />
      case 'currency': return <MoneyInput value={v as number | null} invalid={inv} onChange={(x) => set(f.key, x)} />
      case 'date': return <Input type="date" value={String(v ?? '')} invalid={inv} onChange={(e) => set(f.key, e.target.value || null)} />
      case 'datetime': return <Input type="datetime-local" value={String(v ?? '')} invalid={inv} onChange={(e) => set(f.key, e.target.value || null)} />
      case 'checkbox': return <Checkbox checked={Boolean(v)} onChange={(x) => set(f.key, x)} label={f.label} />
      case 'select':
      case 'status':
        return <Select value={String(v ?? '')} invalid={inv} onChange={(e) => set(f.key, e.target.value || null)}><option value="">Selecione...</option>{f.options.map((o) => <option key={o}>{o}</option>)}</Select>
      case 'multiselect': return <div className="flex flex-wrap gap-3">{f.options.map((o) => <Checkbox key={o} checked={((v as string[]) ?? []).includes(o)} onChange={(x) => set(f.key, x ? [...((v as string[]) ?? []), o] : ((v as string[]) ?? []).filter((y) => y !== o))} label={o} />)}</div>
      case 'image': return <ImageUpload value={v as string | null} folder={`sections/${section.slug}`} aspect={16 / 9} onChange={(x) => set(f.key, x)} />
      case 'file': return <div className="flex items-center gap-2"><FileUpload folder={`sections/${section.slug}`} onUploaded={(x) => set(f.key, x.url)} />{typeof v === 'string' && v && <a href={v} target="_blank" rel="noreferrer" className="text-xs text-primary">Arquivo anexado</a>}</div>
      case 'project': return <Select value={String(v ?? '')} invalid={inv} disabled={!!section.project_id} onChange={(e) => set(f.key, e.target.value || null)}><option value="">Selecione...</option>{app.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
      case 'expert': return <Select value={String(v ?? '')} invalid={inv} disabled={!!section.expert_id} onChange={(e) => set(f.key, e.target.value || null)}><option value="">Selecione...</option>{app.experts.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</Select>
      case 'url': return <Input value={String(v ?? '')} placeholder="https://" invalid={inv} onChange={(e) => set(f.key, e.target.value)} />
      default: return <Input value={String(v ?? '')} invalid={inv} onChange={(e) => set(f.key, e.target.value)} />
    }
  }
  return (
    <Modal open onClose={onClose} size="lg" title={record ? `Editar · ${section.name}` : `Novo registro · ${section.name}`} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>Salvar</Button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        {section.fields.map((f) => (
          <Field key={f.key} label={f.type === 'checkbox' ? '' : f.label} required={f.required} error={errors[f.key]} className={['textarea', 'image', 'multiselect'].includes(f.type) ? 'sm:col-span-2' : ''}>
            {input(f)}
          </Field>
        ))}
      </div>
    </Modal>
  )
}
