import { Archive, Copy, ExternalLink, Globe, LayoutGrid, List, Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useApp } from '@/app/AppContext'
import { PAGE_STATUS } from '@/app/labels'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/layout/AppLayout'
import { DataTable } from '@/components/ui/DataTable'
import { ImageUpload } from '@/components/ui/inputs'
import { Modal, useAction, useConfirm } from '@/components/ui/overlay'
import { Badge, Button, Card, Checkbox, EmptyState, Field, IconButton, Input, Segmented, Select, Skeleton, Textarea } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import { invalidate, useRows } from '@/data/store'
import type { LaunchPage, PageStatus } from '@/data/types'
import { date, pct, todayISO } from '@/lib/format'
import { inPeriod } from '@/lib/period'

export default function PagesPage() {
  return (
    <div>
      <PageHeader eyebrow="Ativos digitais" title="Páginas" subtitle="Central de páginas vinculadas aos projetos" />
      <PagesView />
    </div>
  )
}

export function PagesView({ fixedProjectId }: { fixedProjectId?: string }) {
  const app = useApp()
  const { isAdmin } = useAuth()
  const pages = useRows('pages')
  const types = useRows('page_types')
  const { run } = useAction()
  const confirm = useConfirm()
  const [view, setView] = useState<'cards' | 'list'>('cards')
  const [projectF, setProjectF] = useState<string>('all')
  const [typeF, setTypeF] = useState('all')
  const [statusF, setStatusF] = useState<PageStatus | 'all'>('all')
  const [byPeriod, setByPeriod] = useState(false)
  const [archived, setArchived] = useState(false)
  const [editing, setEditing] = useState<LaunchPage | 'new' | null>(null)
  const [managing, setManaging] = useState(false)

  const projectIds = fixedProjectId ? new Set([fixedProjectId]) : app.scopeProjectIds
  const typeName = (id: string) => types.rows.find((t) => t.id === id)?.name ?? '—'
  const projectName = (id: string) => app.projects.find((p) => p.id === id)?.name ?? '—'

  const list = useMemo(
    () =>
      pages.rows
        .filter((p) => projectIds.has(p.project_id) && p.archived === archived)
        .filter((p) => projectF === 'all' || p.project_id === projectF)
        .filter((p) => typeF === 'all' || p.page_type_id === typeF)
        .filter((p) => statusF === 'all' || p.status === statusF)
        .filter((p) => !byPeriod || inPeriod(p.published_at ?? p.updated_at, app.period))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [pages.rows, projectIds, projectF, typeF, statusF, byPeriod, archived, app.period],
  )

  const changeStatus = (p: LaunchPage, status: PageStatus) =>
    run(async () => {
      await backend.update('pages', p.id, { status, published_at: status === 'publicada' && !p.published_at ? todayISO() : p.published_at })
      await invalidate('pages', 'activity_log')
    }, 'Status da página atualizado.')
  const duplicate = (p: LaunchPage) =>
    run(async () => {
      const { id: _id, created_at: _c, updated_at: _u, ...rest } = p
      await backend.insert('pages', { ...rest, name: `${p.name} (cópia)`, status: 'planejada', published_at: null, conversion_current: null, is_demo: false })
      await invalidate('pages', 'activity_log')
    }, 'Página duplicada.')
  const archive = (p: LaunchPage) => run(async () => { await backend.update('pages', p.id, { archived: !p.archived }); await invalidate('pages', 'activity_log') }, p.archived ? 'Página restaurada.' : 'Página arquivada.')
  const remove = async (p: LaunchPage) => {
    if (!(await confirm({ title: 'Excluir página?', message: <>A página <strong className="text-ink">{p.name}</strong> será excluída permanentemente.</>, tone: 'danger', confirmLabel: 'Excluir' }))) return
    run(async () => { await backend.remove('pages', p.id); await invalidate('pages', 'activity_log') }, 'Página excluída.')
  }

  const Actions = ({ p }: { p: LaunchPage }) =>
    isAdmin ? (
      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <IconButton icon={Pencil} label="Editar" onClick={() => setEditing(p)} />
        <IconButton icon={Copy} label="Duplicar" onClick={() => duplicate(p)} />
        <IconButton icon={Archive} label={p.archived ? 'Restaurar' : 'Arquivar'} onClick={() => archive(p)} />
        <IconButton icon={Trash2} label="Excluir" className="hover:!text-danger" onClick={() => remove(p)} />
      </div>
    ) : null

  const StatusControl = ({ p }: { p: LaunchPage }) =>
    isAdmin ? (
      <Select className="!h-7 !w-auto !text-xs !rounded-full font-semibold" value={p.status} onChange={(e) => changeStatus(p, e.target.value as PageStatus)} aria-label="Status">
        {Object.entries(PAGE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </Select>
    ) : (
      <Badge tone={PAGE_STATUS[p.status].tone} dot>{PAGE_STATUS[p.status].label}</Badge>
    )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {!fixedProjectId && (
          <Select className="!w-auto" value={projectF} onChange={(e) => setProjectF(e.target.value)} aria-label="Projeto">
            <option value="all">Todos os projetos</option>
            {app.projects.filter((p) => projectIds.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}
        <Select className="!w-auto" value={typeF} onChange={(e) => setTypeF(e.target.value)} aria-label="Tipo">
          <option value="all">Todos os tipos</option>
          {types.rows.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <Select className="!w-auto" value={statusF} onChange={(e) => setStatusF(e.target.value as PageStatus | 'all')} aria-label="Status">
          <option value="all">Todos os status</option>
          {Object.entries(PAGE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Checkbox checked={byPeriod} onChange={setByPeriod} label="Publicadas/atualizadas no período" />
        <Checkbox checked={archived} onChange={setArchived} label="Arquivadas" />
        <div className="ml-auto flex items-center gap-2">
          <Segmented size="sm" value={view} onChange={setView} options={[{ value: 'cards', label: 'Cards', icon: LayoutGrid }, { value: 'list', label: 'Lista', icon: List }]} />
          {isAdmin && <Button size="sm" icon={Tags} onClick={() => setManaging(true)}>Categorias</Button>}
          {isAdmin && <Button size="sm" variant="primary" icon={Plus} onClick={() => setEditing('new')}>Nova página</Button>}
        </div>
      </div>

      {pages.loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-64" />)}</div>
      ) : list.length === 0 ? (
        <Card><EmptyState icon={Globe} title="Nenhuma página encontrada" description="Cadastre as páginas de captura, vendas, checkout e confirmação do lançamento." action={isAdmin && <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Cadastrar primeira página</Button>} /></Card>
      ) : view === 'cards' ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {list.map((p) => (
            <Card key={p.id} className="overflow-hidden flex flex-col animate-fade-up">
              <div className="relative aspect-[16/10] bg-surface-3 border-b border-line">
                {p.preview_url ? <img src={p.preview_url} alt="" className="size-full object-cover object-top" /> : <div className="size-full grid place-items-center"><Globe className="size-8 text-faint" /></div>}
                <div className="absolute top-2 left-2 flex gap-1.5"><Badge tone="primary" className="!bg-bg/80">{typeName(p.page_type_id)}</Badge>{p.is_demo && <Badge tone="warning" className="!bg-bg/80">Exemplo</Badge>}</div>
              </div>
              <div className="p-4 flex-1 flex flex-col gap-2.5">
                <div>
                  <h3 className="font-bold leading-snug">{p.name}</h3>
                  {!fixedProjectId && <p className="text-xs text-muted truncate">{projectName(p.project_id)}</p>}
                </div>
                <div className="flex items-center justify-between gap-2"><StatusControl p={p} /><Actions p={p} /></div>
                {p.published_url ? (
                  <a href={p.published_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 truncate"><ExternalLink className="size-3 shrink-0" /><span className="truncate">{p.published_url.replace(/^https?:\/\//, '')}</span></a>
                ) : <span className="text-xs text-faint">URL ainda não publicada</span>}
                <div className="grid grid-cols-3 gap-2 text-xs pt-2 mt-auto border-t border-line">
                  <div><div className="text-faint">Conversão</div><div className="font-semibold">{p.conversion_current === null ? '—' : pct(p.conversion_current)}</div></div>
                  <div><div className="text-faint">Meta</div><div className="font-semibold">{p.conversion_goal === null ? '—' : pct(p.conversion_goal)}</div></div>
                  <div><div className="text-faint">Publicada</div><div className="font-semibold">{date(p.published_at)}</div></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <DataTable
          rows={list}
          searchText={(p) => `${p.name} ${p.tool} ${p.owner}`}
          columns={[
            { key: 'name', header: 'Página', cell: (p) => <span className="font-semibold">{p.name}</span>, sortValue: (p) => p.name },
            ...(fixedProjectId ? [] : [{ key: 'proj', header: 'Projeto', cell: (p: LaunchPage) => projectName(p.project_id), sortValue: (p: LaunchPage) => projectName(p.project_id) }]),
            { key: 'type', header: 'Tipo', cell: (p) => typeName(p.page_type_id), sortValue: (p) => typeName(p.page_type_id) },
            { key: 'status', header: 'Status', cell: (p) => <StatusControl p={p} /> },
            { key: 'url', header: 'URL', cell: (p) => (p.published_url ? <a href={p.published_url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Abrir<ExternalLink className="size-3" /></a> : '—') },
            { key: 'tool', header: 'Ferramenta', cell: (p) => p.tool || '—' },
            { key: 'owner', header: 'Responsável', cell: (p) => p.owner || '—' },
            { key: 'conv', header: 'Conversão', align: 'right', cell: (p) => `${p.conversion_current === null ? '—' : pct(p.conversion_current)} / ${p.conversion_goal === null ? '—' : pct(p.conversion_goal)}`, sortValue: (p) => p.conversion_current },
            { key: 'upd', header: 'Atualizada', cell: (p) => date(p.updated_at), sortValue: (p) => p.updated_at },
            { key: 'act', header: '', cell: (p) => <Actions p={p} /> },
          ]}
        />
      )}
      {editing && <PageForm page={editing === 'new' ? null : editing} defaultProject={fixedProjectId ?? (projectF !== 'all' ? projectF : app.selectedProject?.id)} onClose={() => setEditing(null)} />}
      {managing && <PageTypesModal onClose={() => setManaging(false)} />}
    </div>
  )
}

function PageForm({ page, defaultProject, onClose }: { page: LaunchPage | null; defaultProject?: string; onClose: () => void }) {
  const app = useApp()
  const types = useRows('page_types')
  const { run, busy } = useAction()
  const [d, setD] = useState<Partial<LaunchPage>>(
    page ?? { project_id: defaultProject ?? app.projects[0]?.id ?? '', name: '', page_type_id: types.rows[0]?.id ?? '', published_url: '', edit_url: '', tool: '', owner: '', status: 'planejada', published_at: null, conversion_goal: null, conversion_current: null, notes: '', preview_url: null, archived: false, is_demo: false },
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof LaunchPage>(k: K, v: LaunchPage[K]) => setD((s) => ({ ...s, [k]: v }))
  const save = () => {
    const e: Record<string, string> = {}
    if (!d.name?.trim()) e.name = 'Informe o nome da página.'
    if (!d.project_id) e.project_id = 'Selecione o projeto.'
    if (!d.page_type_id) e.page_type_id = 'Selecione o tipo.'
    for (const k of ['published_url', 'edit_url'] as const) if (d[k] && !/^https?:\/\//.test(d[k]!)) e[k] = 'A URL deve começar com http:// ou https://'
    for (const k of ['conversion_goal', 'conversion_current'] as const) if (d[k] !== null && d[k] !== undefined && (d[k]! < 0 || d[k]! > 100)) e[k] = 'Informe um percentual entre 0 e 100.'
    setErrors(e)
    if (Object.keys(e).length) return
    run(async () => {
      if (page) await backend.update('pages', page.id, d)
      else await backend.insert('pages', d)
      await invalidate('pages', 'activity_log')
      onClose()
    }, page ? 'Página atualizada.' : 'Página cadastrada.')
  }
  const pctInput = (k: 'conversion_goal' | 'conversion_current') => (
    <Input type="number" step="0.1" min={0} max={100} value={d[k] ?? ''} invalid={!!errors[k]} onChange={(e) => set(k, e.target.value === '' ? null : +e.target.value)} placeholder="%" />
  )
  return (
    <Modal open onClose={onClose} size="lg" title={page ? 'Editar página' : 'Nova página'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>Salvar</Button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome da página" required error={errors.name} className="sm:col-span-2"><Input value={d.name} invalid={!!errors.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Projeto relacionado" required error={errors.project_id}>
          <Select value={d.project_id} onChange={(e) => set('project_id', e.target.value)}>{app.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        </Field>
        <Field label="Tipo" required error={errors.page_type_id}>
          <Select value={d.page_type_id} onChange={(e) => set('page_type_id', e.target.value)}>{types.rows.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        </Field>
        <Field label="URL publicada" error={errors.published_url}><Input value={d.published_url} invalid={!!errors.published_url} onChange={(e) => set('published_url', e.target.value)} placeholder="https://" /></Field>
        <Field label="URL de edição" error={errors.edit_url}><Input value={d.edit_url} invalid={!!errors.edit_url} onChange={(e) => set('edit_url', e.target.value)} placeholder="https://" /></Field>
        <Field label="Ferramenta utilizada"><Input value={d.tool} onChange={(e) => set('tool', e.target.value)} placeholder="Elementor, Webflow, Framer..." /></Field>
        <Field label="Responsável"><Input value={d.owner} onChange={(e) => set('owner', e.target.value)} /></Field>
        <Field label="Status"><Select value={d.status} onChange={(e) => set('status', e.target.value as PageStatus)}>{Object.entries(PAGE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
        <Field label="Data de publicação"><Input type="date" value={d.published_at ?? ''} onChange={(e) => set('published_at', e.target.value || null)} /></Field>
        <Field label="Meta de conversão (%)" error={errors.conversion_goal}>{pctInput('conversion_goal')}</Field>
        <Field label="Conversão atual (%)" error={errors.conversion_current} hint="Quando disponível">{pctInput('conversion_current')}</Field>
        <Field label="Imagem de prévia" className="sm:col-span-2"><ImageUpload value={d.preview_url} aspect={16 / 10} folder="pages" onChange={(v) => set('preview_url', v)} /></Field>
        <Field label="Observações" className="sm:col-span-2"><Textarea value={d.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        {page && <p className="text-xs text-faint sm:col-span-2">Última atualização: {date(page.updated_at)}</p>}
      </div>
    </Modal>
  )
}

function PageTypesModal({ onClose }: { onClose: () => void }) {
  const types = useRows('page_types')
  const { run } = useAction()
  const confirm = useConfirm()
  const [name, setName] = useState('')
  return (
    <Modal open onClose={onClose} title="Categorias de página" subtitle="Adicione categorias personalizadas sem alterar o código.">
      <div className="flex gap-2 mb-4">
        <Input placeholder="Nova categoria" value={name} onChange={(e) => setName(e.target.value)} />
        <Button variant="primary" icon={Plus} disabled={!name.trim()} onClick={() => run(async () => {
          if (types.rows.some((t) => t.name.toLowerCase() === name.trim().toLowerCase())) throw new Error('Essa categoria já existe.')
          await backend.insert('page_types', { name: name.trim(), is_custom: true })
          setName('')
          await invalidate('page_types')
        }, 'Categoria criada.')}>Adicionar</Button>
      </div>
      <ul className="divide-y divide-line">
        {types.rows.map((t) => (
          <li key={t.id} className="py-2 flex items-center justify-between text-sm">
            <span>{t.name} {!t.is_custom && <span className="text-xs text-faint">· padrão</span>}</span>
            {t.is_custom && <IconButton icon={Trash2} label="Excluir categoria" onClick={async () => {
              if (await confirm({ title: 'Excluir categoria?', message: `A categoria "${t.name}" será removida. Categorias em uso não podem ser excluídas.`, tone: 'danger', confirmLabel: 'Excluir' }))
                run(async () => { await backend.remove('page_types', t.id); await invalidate('page_types') }, 'Categoria excluída.')
            }} />}
          </li>
        ))}
      </ul>
    </Modal>
  )
}
