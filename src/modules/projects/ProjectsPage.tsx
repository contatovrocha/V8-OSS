import clsx from 'clsx'
import { Archive, ArchiveRestore, Copy, FolderKanban, LayoutGrid, List, MoreVertical, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '@/app/AppContext'
import { PROJECT_STATUS } from '@/app/labels'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/layout/AppLayout'
import { DataTable } from '@/components/ui/DataTable'
import { Avatar, Badge, Button, Card, Checkbox, EmptyState, Input, Progress, Segmented, Select, Skeleton } from '@/components/ui/primitives'
import { useRows } from '@/data/store'
import type { Project, ProjectStatus } from '@/data/types'
import { date, money, pct, relative } from '@/lib/format'
import { phaseLabel, phaseProgress } from '@/lib/phases'
import { ProjectForm } from './ProjectForm'
import { useProjectActions } from './useProjectActions'

export function StatusSelect({ project, disabled }: { project: Project; disabled?: boolean }) {
  const { setStatus } = useProjectActions()
  const st = PROJECT_STATUS[project.status]
  if (disabled) return <Badge tone={st.tone} dot>{st.label}</Badge>
  return (
    <Select
      aria-label="Status do projeto"
      className={clsx('!h-7 !w-auto !text-xs !rounded-full font-semibold !pr-7', st.tone === 'success' && '!text-success !border-success/30', st.tone === 'accent' && '!text-accent !border-accent/30')}
      value={project.status}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setStatus(project, e.target.value as ProjectStatus)}
    >
      {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
    </Select>
  )
}

export function ProjectMenu({ project, onEdit }: { project: Project; onEdit: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const a = useProjectActions()
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const item = 'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-3 text-left'
  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button className="size-8 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-surface-3" onClick={() => setOpen((o) => !o)} aria-label="Ações do projeto"><MoreVertical className="size-4" /></button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-48 card !bg-surface-2 py-1 overflow-hidden animate-fade-up" onClick={() => setOpen(false)}>
          <button className={item} onClick={onEdit}><Pencil className="size-4" />Editar</button>
          <button className={item} onClick={() => a.duplicate(project)}><Copy className="size-4" />Duplicar</button>
          {project.archived ? (
            <button className={item} onClick={() => a.archive(project, false)}><ArchiveRestore className="size-4" />Restaurar</button>
          ) : (
            <button className={item} onClick={() => a.archive(project, true)}><Archive className="size-4" />Arquivar</button>
          )}
          <button className={clsx(item, 'text-danger')} onClick={() => a.remove(project)}><Trash2 className="size-4" />Excluir</button>
        </div>
      )}
    </div>
  )
}

export default function ProjectsPage() {
  const app = useApp()
  const { isAdmin } = useAuth()
  const phases = useRows('project_phases')
  const projectsRows = useRows('projects')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<'cards' | 'list'>('cards')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ProjectStatus | 'all'>('all')
  const [byPeriod, setByPeriod] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [sort, setSort] = useState<'updated' | 'name' | 'start'>('updated')
  const [editing, setEditing] = useState<Project | null | 'new'>(params.get('novo') ? 'new' : null)

  const progressOf = (id: string) => phaseProgress(phases.rows.filter((p) => p.project_id === id))
  const expertName = (id: string) => app.experts.find((e) => e.id === id)?.full_name ?? '—'

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return app.projects
      .filter((p) => (showArchived ? p.archived : !p.archived))
      .filter((p) => status === 'all' || p.status === status)
      .filter((p) => !term || `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(term))
      .filter((p) => !byPeriod || ((p.start_date ?? '0000') <= app.period.to && (p.end_date ?? p.event_date ?? '9999') >= app.period.from))
      .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name, 'pt-BR') : sort === 'start' ? (b.start_date ?? '').localeCompare(a.start_date ?? '') : b.updated_at.localeCompare(a.updated_at)))
  }, [app.projects, q, status, byPeriod, showArchived, sort, app.period])

  const close = () => {
    setEditing(null)
    if (params.get('novo')) setParams({})
  }

  return (
    <div>
      <PageHeader
        eyebrow="Gestão"
        title="Projetos"
        subtitle="Lançamentos acompanhados pela operação"
        actions={isAdmin && <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Novo projeto</Button>}
      />
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input className="pl-9" placeholder="Pesquisar projetos..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {isAdmin && (
          <Select className="!w-auto" value={app.expertId} onChange={(e) => app.setExpertId(e.target.value)} aria-label="Filtrar por expert">
            <option value="all">Todos os experts</option>
            {app.experts.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </Select>
        )}
        <Select className="!w-auto" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus | 'all')} aria-label="Filtrar por status">
          <option value="all">Todos os status</option>
          {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select className="!w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Ordenar">
          <option value="updated">Última atualização</option>
          <option value="name">Nome</option>
          <option value="start">Data de início</option>
        </Select>
        <Checkbox checked={byPeriod} onChange={setByPeriod} label="Somente no período" />
        <Checkbox checked={showArchived} onChange={setShowArchived} label="Arquivados" />
        <div className="ml-auto">
          <Segmented size="sm" value={view} onChange={setView} options={[{ value: 'cards', label: 'Cards', icon: LayoutGrid }, { value: 'list', label: 'Lista', icon: List }]} />
        </div>
      </div>

      {projectsRows.loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}</div>
      ) : list.length === 0 ? (
        <Card><EmptyState icon={FolderKanban} title={showArchived ? 'Nenhum projeto arquivado' : 'Nenhum projeto encontrado'} description={isAdmin ? 'Ajuste os filtros ou crie um novo projeto.' : 'Ajuste os filtros.'} action={isAdmin && !showArchived && <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Criar projeto</Button>} /></Card>
      ) : view === 'cards' ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((p) => {
            const prog = progressOf(p.id)
            const expert = app.experts.find((e) => e.id === p.expert_id)
            return (
              <Card key={p.id} className="overflow-hidden flex flex-col hover:border-line-strong transition group cursor-pointer animate-fade-up" onClick={() => navigate(`/projetos/${p.id}`)}>
                <div className="relative h-36 bg-surface-3">
                  {p.cover_url ? <img src={p.cover_url} alt="" className="size-full object-cover group-hover:scale-[1.02] transition duration-500" /> : <div className="size-full grid place-items-center"><FolderKanban className="size-8 text-faint" /></div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent" />
                  <div className="absolute top-3 left-3 flex gap-1.5">{p.is_demo && <Badge tone="warning">Exemplo</Badge>}{p.archived && <Badge>Arquivado</Badge>}</div>
                  <div className="absolute top-2 right-2">{isAdmin && <ProjectMenu project={p} onEdit={() => setEditing(p)} />}</div>
                </div>
                <div className="p-4 flex-1 flex flex-col gap-3">
                  <div>
                    <h3 className="font-bold leading-snug">{p.name}</h3>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted"><Avatar src={expert?.photo_url} name={expert?.full_name ?? ''} size={20} />{expertName(p.expert_id)}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <StatusSelect project={p} disabled={!isAdmin} />
                    <Badge tone="accent">{phaseLabel(p.current_phase).split(' — ')[0]}</Badge>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted mb-1"><span>Escada V1–V8</span><span className="font-semibold text-ink">{pct(prog)}</span></div>
                    <Progress value={prog} tone="accent" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mt-auto pt-2 border-t border-line">
                    <div><div className="text-faint">Início</div><div className="font-semibold">{date(p.start_date)}</div></div>
                    <div><div className="text-faint">Evento</div><div className="font-semibold">{date(p.event_date)}</div></div>
                    <div><div className="text-faint">Meta</div><div className="font-semibold">{money(p.revenue_goal)}</div></div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <DataTable
          rows={list}
          onRowClick={(p) => navigate(`/projetos/${p.id}`)}
          columns={[
            { key: 'name', header: 'Projeto', cell: (p) => <Link to={`/projetos/${p.id}`} className="font-semibold hover:text-primary">{p.name}</Link>, sortValue: (p) => p.name },
            { key: 'expert', header: 'Expert', cell: (p) => expertName(p.expert_id), sortValue: (p) => expertName(p.expert_id) },
            { key: 'status', header: 'Status', cell: (p) => <StatusSelect project={p} disabled={!isAdmin} /> },
            { key: 'phase', header: 'Fase', cell: (p) => phaseLabel(p.current_phase) },
            { key: 'prog', header: 'Progresso', align: 'right', cell: (p) => pct(progressOf(p.id)), sortValue: (p) => progressOf(p.id) },
            { key: 'start', header: 'Início', cell: (p) => date(p.start_date), sortValue: (p) => p.start_date },
            { key: 'goal', header: 'Meta', align: 'right', cell: (p) => money(p.revenue_goal), sortValue: (p) => p.revenue_goal },
            { key: 'upd', header: 'Atualizado', cell: (p) => relative(p.updated_at), sortValue: (p) => p.updated_at },
            ...(isAdmin ? [{ key: 'act', header: '', cell: (p: Project) => <ProjectMenu project={p} onEdit={() => setEditing(p)} /> }] : []),
          ]}
        />
      )}
      {editing && <ProjectForm project={editing === 'new' ? null : editing} onClose={close} onSaved={(p) => editing === 'new' && navigate(`/projetos/${p.id}`)} />}
    </div>
  )
}
