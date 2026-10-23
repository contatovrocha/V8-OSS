import { ArrowLeft, ExternalLink, FileText, History, Pencil, Trash2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useApp } from '@/app/AppContext'
import { useFinance } from '@/app/useDomain'
import { useAuth } from '@/auth/AuthContext'
import { FileUpload } from '@/components/ui/inputs'
import { useAction, useConfirm } from '@/components/ui/overlay'
import { Avatar, Badge, Button, Card, EmptyState, IconButton, Progress, Skeleton, Spinner, Tabs } from '@/components/ui/primitives'
import { KpiTile } from '@/components/ui/stats'
import { backend } from '@/data/client'
import { invalidate, useRows } from '@/data/store'
import type { Project } from '@/data/types'
import { date, dateTime, money, num, pct } from '@/lib/format'
import { projectGoalProgress } from '@/lib/finance'
import { PHASE_STATUS_LABEL } from '@/lib/phases'
import { LadderPanel } from '../phases/LadderPanel'
import { ProjectForm } from './ProjectForm'
import { ProjectMenu, StatusSelect } from './ProjectsPage'

const PagesView = lazy(() => import('../pages/PagesPage').then((m) => ({ default: m.PagesView })))
const TrafficView = lazy(() => import('../traffic/TrafficPage').then((m) => ({ default: m.TrafficView })))
const FinanceView = lazy(() => import('../finance/FinancePage').then((m) => ({ default: m.FinanceView })))
const TasksView = lazy(() => import('../tasks/TasksPage').then((m) => ({ default: m.TasksView })))

type Tab = 'resumo' | 'fases' | 'paginas' | 'trafego' | 'financeiro' | 'tarefas' | 'arquivos' | 'historico'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const app = useApp()
  const projects = useRows('projects')
  const project = projects.rows.find((p) => p.id === id)
  const [params, setParams] = useSearchParams()
  const tab = (params.get('aba') as Tab) ?? 'resumo'
  const setTab = (t: Tab) => setParams({ aba: t }, { replace: true })
  const [editing, setEditing] = useState(false)
  const { isAdmin } = useAuth()

  // Preserva o contexto: o projeto aberto passa a ser o selecionado no cabeçalho.
  useEffect(() => {
    if (project && !project.archived && app.projectId !== project.id) {
      if (app.expertId !== 'all' && app.expertId !== project.expert_id) app.setExpertId(project.expert_id)
      app.setProjectId(project.id)
    }
  }, [project?.id])

  if (projects.loading) return <Skeleton className="h-96" />
  if (!project)
    return <EmptyState icon={FileText} title="Projeto não encontrado" description="O projeto pode ter sido removido ou você não tem permissão para acessá-lo." action={<Link to="/projetos"><Button>Voltar para projetos</Button></Link>} />

  const expert = app.experts.find((e) => e.id === project.expert_id)
  const visible = (m: string) => app.canSee(m)
  const tabs: { value: Tab; label: string }[] = [
    { value: 'resumo', label: 'Resumo' },
    { value: 'fases', label: 'Fases' },
    ...(visible('paginas') ? [{ value: 'paginas' as Tab, label: 'Páginas' }] : []),
    ...(visible('trafego') ? [{ value: 'trafego' as Tab, label: 'Tráfego' }] : []),
    ...(visible('financeiro') ? [{ value: 'financeiro' as Tab, label: 'Financeiro' }] : []),
    ...(visible('tarefas') ? [{ value: 'tarefas' as Tab, label: 'Tarefas' }] : []),
    { value: 'arquivos', label: 'Arquivos' },
    { value: 'historico', label: 'Histórico' },
  ]

  return (
    <div className="space-y-5">
      <Link to="/projetos" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" />Projetos</Link>
      <Card className="overflow-hidden">
        <div className="relative h-40 md:h-52 bg-surface-3">
          {project.cover_url && <img src={project.cover_url} alt="" className="size-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar src={expert?.photo_url} name={expert?.full_name ?? ''} size={52} className="ring-2 ring-primary/40" />
              <div className="min-w-0">
                <div className="text-xs text-muted">{expert?.full_name} · {project.launch_type}</div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight truncate">{project.name}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {project.is_demo && <Badge tone="warning">Dados demonstrativos</Badge>}
              {project.archived && <Badge>Arquivado</Badge>}
              <StatusSelect project={project} disabled={!isAdmin} />
              {isAdmin && <Button size="sm" icon={Pencil} onClick={() => setEditing(true)}>Editar</Button>}
              {isAdmin && <ProjectMenu project={project} onEdit={() => setEditing(true)} />}
            </div>
          </div>
        </div>
        <div className="px-5"><Tabs value={tab} onChange={setTab} tabs={tabs} /></div>
      </Card>

      <Suspense fallback={<div className="py-10 grid place-items-center"><Spinner /></div>}>
        {tab === 'resumo' && <Summary project={project} />}
        {tab === 'fases' && <LadderPanel project={project} />}
        {tab === 'paginas' && <PagesView fixedProjectId={project.id} />}
        {tab === 'trafego' && <TrafficView fixedProjectId={project.id} />}
        {tab === 'financeiro' && <FinanceView fixedProjectId={project.id} />}
        {tab === 'tarefas' && <TasksView fixedProjectId={project.id} />}
        {tab === 'arquivos' && <Files project={project} />}
        {tab === 'historico' && <ProjectHistory project={project} />}
      </Suspense>
      {editing && <ProjectForm project={project} onClose={() => setEditing(false)} />}
    </div>
  )
}

function Summary({ project }: { project: Project }) {
  const lifetime = useMemo(() => ({ preset: 'tudo' as const, from: '2000-01-01', to: '2100-12-31' }), [])
  const ids = useMemo(() => new Set([project.id]), [project.id])
  const { summary: s } = useFinance(lifetime, ids)
  const g = projectGoalProgress(project, s)
  return (
    <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5">
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile title="Faturamento" value={money(s.grossRevenue)} tone="success" description="acumulado" />
          <KpiTile title="Vendas aprovadas" value={num(s.approvedCount)} />
          <KpiTile title="Custo total" value={money(s.totalCost)} description="tráfego + despesas" />
          <KpiTile title="Resultado" value={money(s.result)} tone={s.result >= 0 ? 'success' : 'danger'} />
        </div>
        <Card className="p-5 space-y-4">
          <h3 className="font-bold">Metas</h3>
          {[
            ['Faturamento', g.revenue, `${money(s.grossRevenue)} de ${money(project.revenue_goal)}`],
            ['Vendas', g.sales, `${s.approvedCount} de ${project.sales_goal}`],
            ['Orçamento de tráfego utilizado', g.budget, `${money(s.trafficInvestment)} de ${money(project.traffic_budget)}`],
          ].map(([label, v, text]) => (
            <div key={label as string}>
              <div className="flex justify-between text-sm mb-1"><span className="text-muted">{label}</span><span className="font-semibold">{v === null ? 'Sem meta' : pct(v as number)} <span className="text-xs text-faint font-normal ml-1">{text}</span></span></div>
              <Progress value={v as number | null} tone={(v as number) >= 100 ? 'success' : 'primary'} />
            </div>
          ))}
        </Card>
        <Card className="p-5">
          <h3 className="font-bold mb-2">Descrição</h3>
          <p className="text-sm text-muted whitespace-pre-line">{project.description || 'Sem descrição.'}</p>
          {project.internal_notes && (<><h4 className="font-semibold text-sm mt-4 mb-1">Observações internas</h4><p className="text-sm text-muted whitespace-pre-line">{project.internal_notes}</p></>)}
        </Card>
      </div>
      <div className="space-y-5">
        <Card className="p-5 text-sm space-y-3">
          <h3 className="font-bold">Informações</h3>
          {[
            ['Categoria', project.category || '—'], ['Tipo de lançamento', project.launch_type || '—'], ['Início', date(project.start_date)],
            ['Conclusão prevista', date(project.end_date)], ['Evento presencial', date(project.event_date)], ['Meta de faturamento', money(project.revenue_goal)],
            ['Meta de vendas', num(project.sales_goal)], ['Orçamento de tráfego', money(project.traffic_budget)],
          ].map(([k, v]) => <div key={k} className="flex justify-between gap-3"><span className="text-muted">{k}</span><span className="font-semibold text-right">{v}</span></div>)}
        </Card>
        <Card className="p-5">
          <h3 className="font-bold mb-2">Equipe responsável</h3>
          {project.team.length ? <div className="flex flex-wrap gap-2">{project.team.map((t) => <Badge key={t}>{t}</Badge>)}</div> : <p className="text-sm text-muted">Nenhum membro cadastrado.</p>}
        </Card>
        <Card className="p-5">
          <h3 className="font-bold mb-2">Links importantes</h3>
          {project.links.length ? (
            <ul className="space-y-1.5 text-sm">{project.links.map((l, i) => <li key={i}><a href={l.url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1.5">{l.label || l.url}<ExternalLink className="size-3" /></a></li>)}</ul>
          ) : <p className="text-sm text-muted">Nenhum link cadastrado.</p>}
        </Card>
      </div>
    </div>
  )
}

function Files({ project }: { project: Project }) {
  const files = useRows('files')
  const { user, isAdmin } = useAuth()
  const { run } = useAction()
  const confirm = useConfirm()
  const list = files.rows.filter((f) => f.project_id === project.id).sort((a, b) => b.created_at.localeCompare(a.created_at))
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold">Arquivos do projeto</h3>
        <FileUpload
          folder={`projects/${project.id}`}
          onUploaded={(f) => run(async () => {
            await backend.insert('files', { project_id: project.id, entity_type: 'project', entity_id: project.id, name: f.name, url: f.url, mime: f.mime, size: f.size, uploaded_by: user!.id })
            await invalidate('files', 'activity_log')
          }, 'Arquivo anexado.')}
        />
      </div>
      {list.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhum arquivo" description="Anexe briefings, contratos, roteiros e demais materiais do projeto." />
      ) : (
        <ul className="divide-y divide-line">
          {list.map((f) => (
            <li key={f.id} className="py-3 flex items-center gap-3 text-sm">
              <FileText className="size-4 text-muted shrink-0" />
              <a href={f.url} target="_blank" rel="noreferrer" download={f.name} className="flex-1 min-w-0 truncate font-semibold hover:text-primary">{f.name}</a>
              <span className="text-xs text-faint hidden sm:inline">{(f.size / 1024).toFixed(0)} KB · {dateTime(f.created_at)}</span>
              {isAdmin && <IconButton icon={Trash2} label="Excluir arquivo" onClick={async () => {
                if (await confirm({ title: 'Excluir arquivo?', message: <>O arquivo <strong className="text-ink">{f.name}</strong> será removido.</>, tone: 'danger', confirmLabel: 'Excluir' }))
                  run(async () => { await backend.remove('files', f.id); await invalidate('files', 'activity_log') }, 'Arquivo excluído.')
              }} />}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function ProjectHistory({ project }: { project: Project }) {
  const log = useRows('activity_log')
  const ph = useRows('phase_history')
  const items = [
    ...log.rows.filter((l) => l.project_id === project.id && !l.entity_type.startsWith('project_phases')).map((l) => ({ id: l.id, at: l.created_at, who: l.user_name, text: l.summary, kind: l.entity_type })),
    ...ph.rows.filter((h) => h.project_id === project.id).map((h) => ({ id: h.id, at: h.created_at, who: h.user_name, text: `Fase V${h.phase_number}: ${h.from_status ? PHASE_STATUS_LABEL[h.from_status] : '—'} → ${h.to_status ? PHASE_STATUS_LABEL[h.to_status] : '—'}${h.note ? ` · ${h.note}` : ''}`, kind: 'fase' })),
  ].sort((a, b) => b.at.localeCompare(a.at))
  return (
    <Card className="p-5">
      <h3 className="font-bold mb-4 flex items-center gap-2"><History className="size-4 text-muted" />Histórico do projeto</h3>
      {items.length === 0 ? <p className="text-sm text-muted">Nenhum evento registrado.</p> : (
        <ol className="space-y-4 border-l border-line pl-5">
          {items.slice(0, 200).map((i) => (
            <li key={i.id} className="relative text-sm">
              <span className={`absolute -left-[26px] top-1 size-3 rounded-full border-2 border-surface ${i.kind === 'fase' ? 'bg-accent' : 'bg-primary'}`} />
              <div>{i.text}</div>
              <div className="text-xs text-muted">{i.who} · {dateTime(i.at)}</div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
