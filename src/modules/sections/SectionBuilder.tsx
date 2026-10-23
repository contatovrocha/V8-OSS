import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '@/app/AppContext'
import { iconFor, SECTION_ICONS } from '@/app/nav'
import { Modal, useAction, useConfirm } from '@/components/ui/overlay'
import { Badge, Button, Card, Checkbox, EmptyState, Field, IconButton, Input, Select, Textarea } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import { invalidate, useRows } from '@/data/store'
import type { FieldConfig, FieldType, Role, SectionConfig } from '@/data/types'
import { FIELD_TYPE_LABEL, OPTION_TYPES, slugify } from '@/lib/sections'

const newField = (): FieldConfig => ({ key: '', label: '', type: 'text', required: false, options: [], show_in_card: true, show_in_table: true, filterable: false })

export function SectionBuilder() {
  const sections = useRows('section_configs')
  const records = useRows('section_records')
  const { run } = useAction()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<Partial<SectionConfig> | null>(null)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted max-w-2xl">Crie seções sem alterar o código. Cada seção gera automaticamente telas de listagem, cadastro, edição, visualização e exclusão, com os campos configurados aqui. Alterar a configuração nunca apaga registros existentes.</p>
        <Button variant="primary" icon={Plus} onClick={() => setEditing({ name: '', slug: '', icon: 'LayoutGrid', description: '', menu_position: 20, roles: ['admin', 'expert'], project_id: null, expert_id: null, visible_to_expert: true, expert_can_edit: false, active: true, fields: [{ ...newField(), key: 'nome', label: 'Nome', required: true }] })}>Nova seção</Button>
      </div>
      {sections.rows.length === 0 ? (
        <Card><EmptyState icon={Plus} title="Nenhuma seção personalizada" description="Crie a primeira seção — por exemplo, Parceiros, Depoimentos ou Fornecedores." /></Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sections.rows.map((s) => {
            const Icon = iconFor(s.icon)
            const count = records.rows.filter((r) => r.section_id === s.id).length
            return (
              <Card key={s.id} className="p-5 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-xl bg-primary/15 text-primary grid place-items-center"><Icon className="size-5" /></div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold truncate">{s.name}</h3>
                    <p className="text-xs text-muted line-clamp-2">{s.description || 'Sem descrição'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={s.active ? 'success' : 'neutral'}>{s.active ? 'Ativa' : 'Inativa'}</Badge>
                  <Badge>{s.fields.length} campo(s)</Badge>
                  <Badge>{count} registro(s)</Badge>
                  {s.visible_to_expert && <Badge tone="primary">Visível ao expert</Badge>}
                </div>
                <div className="flex gap-2 mt-auto pt-2">
                  <Link to={`/secoes/${s.slug}`}><Button size="sm" icon={ExternalLink}>Abrir</Button></Link>
                  <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(s)}>Configurar</Button>
                  <IconButton icon={Trash2} label="Excluir seção" className="ml-auto" onClick={async () => {
                    if (await confirm({ title: 'Excluir seção?', message: <>A seção <strong className="text-ink">{s.name}</strong> e seus {count} registro(s) serão excluídos permanentemente. Para ocultar sem apagar dados, desative-a.</>, tone: 'danger', confirmLabel: 'Excluir', typeToConfirm: s.name }))
                      run(async () => { await backend.remove('section_configs', s.id); await invalidate('section_configs', 'section_records') }, 'Seção excluída.')
                  }} />
                </div>
              </Card>
            )
          })}
        </div>
      )}
      {editing && <SectionEditor value={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function SectionEditor({ value, onClose }: { value: Partial<SectionConfig>; onClose: () => void }) {
  const app = useApp()
  const { run, busy } = useAction()
  const [d, setD] = useState(value)
  const [optText, setOptText] = useState<Record<number, string>>({})
  const set = <K extends keyof SectionConfig>(k: K, v: SectionConfig[K]) => setD((s) => ({ ...s, [k]: v }))
  const fields = d.fields ?? []
  const setField = (i: number, patch: Partial<FieldConfig>) => set('fields', fields.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  const move = (i: number, dir: -1 | 1) => {
    const n = [...fields]
    const [x] = n.splice(i, 1)
    n.splice(i + dir, 0, x)
    set('fields', n)
  }
  const save = () => run(async () => {
    if (!d.name?.trim()) throw new Error('Informe o nome da seção.')
    if (!fields.length) throw new Error('Adicione ao menos um campo.')
    const keys = new Set<string>()
    const normalized = fields.map((f) => {
      const key = f.key || slugify(f.label)
      if (!f.label.trim() || !key) throw new Error('Todos os campos precisam de um rótulo.')
      if (keys.has(key)) throw new Error(`Identificador de campo duplicado: ${key}`)
      keys.add(key)
      if (OPTION_TYPES.includes(f.type) && !f.options.length) throw new Error(`O campo "${f.label}" precisa de opções.`)
      return { ...f, key }
    })
    const payload = { ...d, slug: d.slug || slugify(d.name), fields: normalized, roles: (d.roles?.length ? d.roles : ['admin']) as Role[] }
    if (d.id) await backend.update('section_configs', d.id, payload)
    else await backend.insert('section_configs', payload)
    await invalidate('section_configs')
    onClose()
  }, 'Seção salva. O menu e os formulários foram atualizados.')

  return (
    <Modal open onClose={onClose} size="xl" title={d.id ? `Configurar seção · ${d.name}` : 'Nova seção'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>Salvar seção</Button></>}>
      <div className="space-y-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Nome" required className="lg:col-span-2"><Input value={d.name} onChange={(e) => setD((s) => ({ ...s, name: e.target.value, slug: s.id ? s.slug : slugify(e.target.value) }))} /></Field>
          <Field label="Ícone">
            <Select value={d.icon} onChange={(e) => set('icon', e.target.value)}>{Object.keys(SECTION_ICONS).map((k) => <option key={k}>{k}</option>)}</Select>
          </Field>
          <Field label="Posição no menu" hint="Módulos nativos: 1 a 8"><Input type="number" value={d.menu_position} onChange={(e) => set('menu_position', +e.target.value)} /></Field>
          <Field label="Descrição" className="sm:col-span-2 lg:col-span-4"><Textarea className="!min-h-16" value={d.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="Vincular a um expert (opcional)">
            <Select value={d.expert_id ?? ''} onChange={(e) => set('expert_id', e.target.value || null)}><option value="">Todos</option>{app.experts.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</Select>
          </Field>
          <Field label="Vincular a um projeto (opcional)">
            <Select value={d.project_id ?? ''} onChange={(e) => set('project_id', e.target.value || null)}><option value="">Todos</option>{app.projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
          </Field>
          <div className="sm:col-span-2 flex flex-wrap gap-x-5 gap-y-2 items-end pb-2">
            <Checkbox checked={!!d.active} onChange={(v) => set('active', v)} label="Seção ativa" />
            <Checkbox checked={!!d.roles?.includes('expert')} onChange={(v) => setD((s) => ({ ...s, roles: v ? ['admin', 'expert'] : ['admin'], visible_to_expert: v }))} label="Perfil expert tem acesso" />
            <Checkbox checked={!!d.expert_can_edit} disabled={!d.roles?.includes('expert')} onChange={(v) => set('expert_can_edit', v)} label="Expert pode cadastrar/editar" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold">Campos</h4>
            <Button size="sm" icon={Plus} onClick={() => set('fields', [...fields, newField()])}>Adicionar campo</Button>
          </div>
          <div className="space-y-3">
            {fields.map((f, i) => (
              <div key={i} data-field-row className="rounded-xl border border-line bg-surface-2/60 p-3">
                <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                  <Field label="Rótulo"><Input value={f.label} onChange={(e) => setField(i, { label: e.target.value, key: f.key && value.fields?.some((o) => o.key === f.key) ? f.key : slugify(e.target.value) })} /></Field>
                  <Field label="Tipo de dado"><Select value={f.type} onChange={(e) => setField(i, { type: e.target.value as FieldType })}>{Object.entries(FIELD_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                  <div className="flex">
                    <IconButton icon={ArrowUp} label="Subir" disabled={i === 0} onClick={() => move(i, -1)} />
                    <IconButton icon={ArrowDown} label="Descer" disabled={i === fields.length - 1} onClick={() => move(i, 1)} />
                    <IconButton icon={Trash2} label="Remover campo" onClick={() => set('fields', fields.filter((_, j) => j !== i))} />
                  </div>
                </div>
                {OPTION_TYPES.includes(f.type) && (
                  <Field label="Opções (separadas por vírgula)" className="mt-3">
                    <Input value={optText[i] ?? f.options.join(', ')} onChange={(e) => { setOptText((s) => ({ ...s, [i]: e.target.value })); setField(i, { options: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }) }} />
                  </Field>
                )}
                <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
                  <Checkbox checked={f.required} onChange={(v) => setField(i, { required: v })} label="Obrigatório" />
                  <Checkbox checked={f.show_in_card} onChange={(v) => setField(i, { show_in_card: v })} label="Exibir no card" />
                  <Checkbox checked={f.show_in_table} onChange={(v) => setField(i, { show_in_table: v })} label="Exibir na tabela" />
                  <Checkbox checked={f.filterable} onChange={(v) => setField(i, { filterable: v })} label="Usar como filtro" />
                  <span className="text-[11px] text-faint ml-auto self-center">id: {f.key || slugify(f.label) || '—'}</span>
                </div>
              </div>
            ))}
          </div>
          {d.id && <p className="text-xs text-faint mt-3">Campos removidos deixam de aparecer nos formulários, mas os valores já cadastrados são preservados nos registros.</p>}
        </div>
      </div>
    </Modal>
  )
}
