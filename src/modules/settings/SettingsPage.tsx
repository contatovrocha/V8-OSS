import { AlertCircle, CheckCircle2, Link2, Plus, RefreshCw, RotateCcw, Save, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '@/app/AppContext'
import { NATIVE_NAV } from '@/app/nav'
import { TASK_PRIORITY } from '@/app/labels'
import { PageHeader } from '@/components/layout/AppLayout'
import { DataTable } from '@/components/ui/DataTable'
import { ImageUpload } from '@/components/ui/inputs'
import { Modal, useAction, useConfirm } from '@/components/ui/overlay'
import { Avatar, Badge, Button, Card, Checkbox, Field, IconButton, Input, Select, Tabs, Textarea } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import { invalidate, useRows } from '@/data/store'
import { ALL_MODULES, defaultPermissions, demoData, DEMO_INSERT_ORDER } from '@/data/seed'
import type { AppSettings, Expert, ExpertPermissions, Role, TaskTemplate } from '@/data/types'
import { dateTime, relative } from '@/lib/format'
import { PHASES } from '@/lib/phases'
import { SectionBuilder } from '../sections/SectionBuilder'

type Tab = 'geral' | 'experts' | 'permissoes' | 'secoes' | 'categorias' | 'modelos' | 'integracoes' | 'demo' | 'auditoria'

export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('aba') as Tab) ?? 'geral'
  return (
    <div>
      <PageHeader eyebrow="Administração" title="Configurações" subtitle="Identidade, acessos, seções e integrações da plataforma" />
      <div className="mb-5">
        <Tabs value={tab} onChange={(t) => setParams({ aba: t })} tabs={[
          { value: 'geral', label: 'Geral e marca' }, { value: 'experts', label: 'Experts e usuários' }, { value: 'permissoes', label: 'Permissões' },
          { value: 'secoes', label: 'Construtor de Seções' }, { value: 'categorias', label: 'Categorias' }, { value: 'modelos', label: 'Modelos de tarefas' },
          { value: 'integracoes', label: 'Integrações' }, { value: 'demo', label: 'Demonstração' }, { value: 'auditoria', label: 'Auditoria' },
        ]} />
      </div>
      {tab === 'geral' && <General />}
      {tab === 'experts' && <ExpertsUsers />}
      {tab === 'permissoes' && <Permissions />}
      {tab === 'secoes' && <SectionBuilder />}
      {tab === 'categorias' && <Categories />}
      {tab === 'modelos' && <Templates />}
      {tab === 'integracoes' && <Integrations />}
      {tab === 'demo' && <Demo />}
      {tab === 'auditoria' && <Audit />}
    </div>
  )
}

const MODULE_LABEL = Object.fromEntries(NATIVE_NAV.map((n) => [n.key, n.label]))

function General() {
  const { settings } = useApp()
  const { run, busy } = useAction()
  const [d, setD] = useState<AppSettings>(settings)
  useEffect(() => setD(settings), [settings])
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => setD((s) => ({ ...s, [k]: v }))
  const zones = ['America/Sao_Paulo', 'America/Manaus', 'America/Fortaleza', 'America/Recife', 'America/Cuiaba', 'America/Rio_Branco', 'America/Noronha', 'Europe/Lisbon', 'UTC']
  return (
    <Card className="p-5 md:p-6 space-y-6 max-w-4xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome da plataforma"><Input value={d.brand_name} onChange={(e) => set('brand_name', e.target.value)} /></Field>
        <Field label="Nome da operação"><Input value={d.operation_name} onChange={(e) => set('operation_name', e.target.value)} /></Field>
        <Field label="Logo" className="sm:col-span-2"><ImageUpload value={d.logo_url} folder="brand" onChange={(v) => set('logo_url', v)} /></Field>
        {([['primary_color', 'Cor principal (ações e navegação)'], ['success_color', 'Cor de resultado positivo'], ['accent_color', 'Cor de fases e progresso'], ['danger_color', 'Cor de alertas']] as const).map(([k, l]) => (
          <Field key={k} label={l}><div className="flex gap-2"><input type="color" value={d[k]} onChange={(e) => set(k, e.target.value)} className="h-10 w-14 rounded-lg bg-transparent border border-line-strong cursor-pointer" /><Input value={d[k]} onChange={(e) => set(k, e.target.value)} /></div></Field>
        ))}
        <Field label="Fuso horário"><Select value={d.timezone} onChange={(e) => set('timezone', e.target.value)}>{zones.map((z) => <option key={z}>{z}</option>)}</Select></Field>
        <Field label="Regra de transição de fase" hint="O que acontece ao concluir a fase atual.">
          <Select value={d.phase_transition_rule} onChange={(e) => set('phase_transition_rule', e.target.value as AppSettings['phase_transition_rule'])}>
            <option value="next_available">Iniciar automaticamente a próxima fase pendente</option>
            <option value="manual">Aguardar o administrador iniciar a próxima fase</option>
          </Select>
        </Field>
        <Field label="Produto mais vendido (Visão Geral)">
          <Select value={d.top_product_metric} onChange={(e) => set('top_product_metric', e.target.value as AppSettings['top_product_metric'])}>
            <option value="quantidade">Por quantidade de vendas aprovadas</option>
            <option value="faturamento">Por faturamento</option>
          </Select>
        </Field>
      </div>
      <Field label="Módulos ativos" hint="Módulos desativados somem do menu para todos os perfis.">
        <div className="flex flex-wrap gap-4 mt-1">
          {ALL_MODULES.map((m) => <Checkbox key={m} checked={!d.disabled_modules.includes(m)} disabled={m === 'visao_geral'} onChange={(v) => set('disabled_modules', v ? d.disabled_modules.filter((x) => x !== m) : [...d.disabled_modules, m])} label={MODULE_LABEL[m]} />)}
        </div>
      </Field>
      <div className="flex gap-2">
        <Button variant="primary" icon={Save} loading={busy} onClick={() => run(async () => {
          if (!d.brand_name.trim()) throw new Error('Informe o nome da plataforma.')
          for (const k of ['primary_color', 'success_color', 'accent_color', 'danger_color'] as const) if (!/^#[0-9a-f]{6}$/i.test(d[k])) throw new Error('Cores devem estar no formato #RRGGBB.')
          await backend.update('app_settings', settings.id, d)
          await invalidate('app_settings')
        }, 'Configurações salvas.')}>Salvar</Button>
        <Button variant="ghost" onClick={() => setD({ ...d, primary_color: '#3b82f6', success_color: '#22c55e', accent_color: '#f97316', danger_color: '#ef4444' })}>Restaurar cores padrão</Button>
      </div>
    </Card>
  )
}

function ExpertsUsers() {
  const app = useApp()
  const profiles = useRows('profiles')
  const links = useRows('user_experts')
  const { run, busy } = useAction()
  const confirm = useConfirm()
  const [expert, setExpert] = useState<Partial<Expert> | null>(null)
  const [user, setUser] = useState<{ email: string; password: string; full_name: string; role: Role; expert_ids: string[] } | null>(null)
  const [linking, setLinking] = useState<string | null>(null)

  return (
    <div className="grid xl:grid-cols-2 gap-5">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Experts</h3>
          <Button size="sm" variant="primary" icon={Plus} onClick={() => setExpert({ full_name: '', professional_name: '', title: '', photo_url: null })}>Novo expert</Button>
        </div>
        <ul className="divide-y divide-line">
          {app.experts.map((e) => (
            <li key={e.id} className="py-3 flex items-center gap-3">
              <Avatar src={e.photo_url} name={e.full_name} size={40} />
              <div className="flex-1 min-w-0"><div className="font-semibold truncate">{e.full_name} {e.is_demo && <Badge tone="warning" className="ml-1">Exemplo</Badge>}</div><div className="text-xs text-muted truncate">{e.title || '—'} · {app.projects.filter((p) => p.expert_id === e.id).length} projeto(s)</div></div>
              <Button size="sm" variant="ghost" onClick={() => setExpert(e)}>Editar</Button>
              <IconButton icon={Trash2} label="Excluir expert" onClick={async () => {
                const n = app.projects.filter((p) => p.expert_id === e.id).length
                if (n) return run(async () => { throw new Error(`${e.full_name} possui ${n} projeto(s). Exclua ou transfira os projetos antes.`) })
                if (await confirm({ title: 'Excluir expert?', message: `${e.full_name} e seus movimentos serão excluídos.`, tone: 'danger', confirmLabel: 'Excluir', typeToConfirm: e.full_name }))
                  run(async () => { await backend.remove('experts', e.id); await invalidate('experts', 'movements', 'user_experts', 'activity_log') }, 'Expert excluído.')
              }} />
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Usuários</h3>
          <Button size="sm" variant="primary" icon={UserPlus} onClick={() => setUser({ email: '', password: '', full_name: '', role: 'expert', expert_ids: [] })}>Novo usuário</Button>
        </div>
        <ul className="divide-y divide-line">
          {profiles.rows.map((p) => {
            const mine = links.rows.filter((l) => l.user_id === p.id).map((l) => app.experts.find((e) => e.id === l.expert_id)?.full_name).filter(Boolean)
            return (
              <li key={p.id} className="py-3 flex items-center gap-3">
                <Avatar name={p.full_name} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{p.full_name} <Badge tone={p.role === 'admin' ? 'primary' : 'neutral'} className="ml-1">{p.role === 'admin' ? 'Admin' : 'Expert'}</Badge></div>
                  <div className="text-xs text-muted truncate">{p.email}{p.role === 'expert' && ` · acesso a: ${mine.join(', ') || 'nenhum expert'}`}</div>
                </div>
                {p.role === 'expert' && <Button size="sm" variant="ghost" onClick={() => setLinking(p.id)}>Acessos</Button>}
              </li>
            )
          })}
        </ul>
      </Card>

      {expert && (
        <Modal open onClose={() => setExpert(null)} title={expert.id ? 'Editar expert' : 'Novo expert'} footer={<><Button variant="ghost" onClick={() => setExpert(null)}>Cancelar</Button><Button variant="primary" loading={busy} onClick={() => run(async () => {
          if (!expert.full_name?.trim()) throw new Error('Informe o nome completo.')
          if (expert.id) await backend.update('experts', expert.id, { full_name: expert.full_name, professional_name: expert.professional_name, title: expert.title, photo_url: expert.photo_url })
          else await backend.insert('experts', { full_name: expert.full_name.trim(), professional_name: expert.professional_name || expert.full_name, title: expert.title ?? '', photo_url: expert.photo_url ?? null, bio: '', career_story: '', value_proposition: '', positioning: '', target_audience: '', differentiators: [], authority_topics: [], social_links: [], website: '', videos: [], media: [], draft: null, published_at: null, permissions: defaultPermissions(), is_demo: false })
          await invalidate('experts', 'activity_log')
          setExpert(null)
        }, 'Expert salvo.')}>Salvar</Button></>}>
          <div className="space-y-4">
            <Field label="Fotografia"><ImageUpload value={expert.photo_url} round folder="experts" onChange={(v) => setExpert({ ...expert, photo_url: v })} /></Field>
            <Field label="Nome completo" required><Input value={expert.full_name} onChange={(e) => setExpert({ ...expert, full_name: e.target.value })} /></Field>
            <Field label="Nome profissional"><Input value={expert.professional_name} onChange={(e) => setExpert({ ...expert, professional_name: e.target.value })} /></Field>
            <Field label="Cargo ou especialidade"><Input value={expert.title} onChange={(e) => setExpert({ ...expert, title: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
      {user && (
        <Modal open onClose={() => setUser(null)} title="Novo usuário" subtitle={backend.mode === 'supabase' ? 'Criado com segurança pela função admin-create-user (service role no servidor).' : undefined} footer={<><Button variant="ghost" onClick={() => setUser(null)}>Cancelar</Button><Button variant="primary" loading={busy} onClick={() => run(async () => {
          if (!user.full_name.trim() || !user.email.includes('@')) throw new Error('Informe nome e e-mail válidos.')
          if (user.password.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.')
          if (user.role === 'expert' && !user.expert_ids.length) throw new Error('Vincule o usuário a pelo menos um expert.')
          await backend.rpc('create_user', user)
          await invalidate('profiles', 'user_experts', 'activity_log')
          setUser(null)
        }, 'Usuário criado.')}>Criar usuário</Button></>}>
          <div className="space-y-4">
            <Field label="Nome" required><Input value={user.full_name} onChange={(e) => setUser({ ...user, full_name: e.target.value })} /></Field>
            <Field label="E-mail" required><Input type="email" value={user.email} onChange={(e) => setUser({ ...user, email: e.target.value })} /></Field>
            <Field label="Senha inicial" required hint="Mínimo de 6 caracteres. Oriente o usuário a trocá-la no primeiro acesso."><Input type="text" value={user.password} onChange={(e) => setUser({ ...user, password: e.target.value })} /></Field>
            <Field label="Perfil"><Select value={user.role} onChange={(e) => setUser({ ...user, role: e.target.value as Role })}><option value="expert">Expert</option><option value="admin">Administrador</option></Select></Field>
            {user.role === 'expert' && <Field label="Experts que este usuário pode acessar"><div className="space-y-2">{app.experts.map((e) => <Checkbox key={e.id} checked={user.expert_ids.includes(e.id)} onChange={(v) => setUser({ ...user, expert_ids: v ? [...user.expert_ids, e.id] : user.expert_ids.filter((x) => x !== e.id) })} label={e.full_name} />)}</div></Field>}
          </div>
        </Modal>
      )}
      {linking && (
        <Modal open onClose={() => setLinking(null)} title="Acessos do usuário" subtitle="Defina quais experts (e seus projetos) este usuário pode visualizar.">
          <div className="space-y-2">
            {app.experts.map((e) => {
              const link = links.rows.find((l) => l.user_id === linking && l.expert_id === e.id)
              return <Checkbox key={e.id} checked={!!link} label={e.full_name} onChange={(v) => run(async () => {
                if (v) await backend.insert('user_experts', { user_id: linking, expert_id: e.id })
                else if (link) await backend.remove('user_experts', link.id)
                await invalidate('user_experts', 'activity_log')
              }, 'Acesso atualizado.')} />
            })}
          </div>
        </Modal>
      )}
    </div>
  )
}

const PERM_LABEL: Record<Exclude<keyof ExpertPermissions, 'visible_modules'>, string> = {
  can_edit_profile: 'Editar dados pessoais e posicionamento',
  can_upload_photo: 'Adicionar ou substituir a fotografia',
  can_edit_movements: 'Editar movimentos liberados',
  can_edit_tasks: 'Criar e editar tarefas',
  can_manage_phases: 'Alterar fases estratégicas (V1–V8)',
  can_edit_finance: 'Registrar e editar vendas, despesas e produtos',
}

function Permissions() {
  const app = useApp()
  const { run, busy } = useAction()
  const [drafts, setDrafts] = useState<Record<string, ExpertPermissions>>({})
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">As permissões são aplicadas no banco de dados (políticas RLS), não apenas na interface. Por padrão, o expert não altera fases, não conclui etapas oficiais, não edita valores financeiros e não exclui projetos.</p>
      {app.experts.map((e) => {
        const p = drafts[e.id] ?? e.permissions
        const set = (patch: Partial<ExpertPermissions>) => setDrafts((s) => ({ ...s, [e.id]: { ...p, ...patch } }))
        const dirty = JSON.stringify(p) !== JSON.stringify(e.permissions)
        return (
          <Card key={e.id} className="p-5">
            <div className="flex items-center gap-3 mb-4"><Avatar src={e.photo_url} name={e.full_name} size={36} /><h3 className="font-bold flex-1">{e.full_name}</h3>
              <Button size="sm" variant="primary" icon={Save} disabled={!dirty} loading={busy} onClick={() => run(async () => { await backend.update('experts', e.id, { permissions: p }); await invalidate('experts', 'activity_log'); setDrafts((s) => { const n = { ...s }; delete n[e.id]; return n }) }, 'Permissões atualizadas e registradas na auditoria.')}>Salvar</Button>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted">Ações permitidas</h4>
                {(Object.keys(PERM_LABEL) as (keyof typeof PERM_LABEL)[]).map((k) => <div key={k}><Checkbox checked={p[k]} onChange={(v) => set({ [k]: v })} label={PERM_LABEL[k]} /></div>)}
              </div>
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted">Informações visíveis</h4>
                {ALL_MODULES.map((m) => <div key={m}><Checkbox checked={p.visible_modules.includes(m)} disabled={m === 'visao_geral'} onChange={(v) => set({ visible_modules: v ? [...p.visible_modules, m] : p.visible_modules.filter((x) => x !== m) })} label={MODULE_LABEL[m]} /></div>)}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function Categories() {
  const cats = useRows('expense_categories')
  const expenses = useRows('expenses')
  const { run } = useAction()
  const [name, setName] = useState('')
  const [traffic, setTraffic] = useState(false)
  return (
    <Card className="p-5 max-w-2xl">
      <h3 className="font-bold mb-1">Categorias de despesa</h3>
      <p className="text-xs text-muted mb-4">Categorias marcadas como tráfego entram no investimento em anúncios (com conciliação para contas sincronizadas).</p>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <Input className="flex-1 min-w-48" placeholder="Nova categoria" value={name} onChange={(e) => setName(e.target.value)} />
        <Checkbox checked={traffic} onChange={setTraffic} label="É tráfego" />
        <Button variant="primary" icon={Plus} disabled={!name.trim()} onClick={() => run(async () => {
          if (cats.rows.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) throw new Error('Categoria já existe.')
          await backend.insert('expense_categories', { name: name.trim(), is_traffic: traffic })
          setName('')
          await invalidate('expense_categories')
        }, 'Categoria criada.')}>Adicionar</Button>
      </div>
      <ul className="divide-y divide-line">
        {cats.rows.map((c) => (
          <li key={c.id} className="py-2 flex items-center justify-between text-sm">
            <span>{c.name} {c.is_traffic && <Badge tone="primary" className="ml-1">Tráfego</Badge>}</span>
            <IconButton icon={Trash2} label="Excluir" onClick={() => run(async () => {
              if (expenses.rows.some((e) => e.category === c.name)) throw new Error('Existem despesas nesta categoria.')
              await backend.remove('expense_categories', c.id)
              await invalidate('expense_categories')
            }, 'Categoria excluída.')} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Templates() {
  const templates = useRows('task_templates')
  const { run, busy } = useAction()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<Partial<TaskTemplate> | null>(null)
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div><h3 className="font-bold">Modelos de tarefas por fase</h3><p className="text-xs text-muted">Aplicados automaticamente ao criar um novo projeto (opcional).</p></div>
        <Button size="sm" variant="primary" icon={Plus} onClick={() => setEditing({ phase_number: 1, title: '', description: '', priority: 'media', checklist: [], offset_days: 3 })}>Novo modelo</Button>
      </div>
      <DataTable
        rows={[...templates.rows].sort((a, b) => a.phase_number - b.phase_number)}
        onRowClick={setEditing}
        columns={[
          { key: 'p', header: 'Fase', cell: (t) => <span className="text-accent font-bold">V{t.phase_number}</span>, sortValue: (t) => t.phase_number },
          { key: 't', header: 'Título', cell: (t) => <span className="font-semibold">{t.title}</span>, sortValue: (t) => t.title },
          { key: 'pr', header: 'Prioridade', cell: (t) => <Badge tone={TASK_PRIORITY[t.priority].tone}>{TASK_PRIORITY[t.priority].label}</Badge> },
          { key: 'c', header: 'Checklist', cell: (t) => `${t.checklist.length} item(ns)` },
          { key: 'o', header: 'Prazo', cell: (t) => `+${t.offset_days} dia(s)` },
          { key: 'x', header: '', cell: (t) => <IconButton icon={Trash2} label="Excluir" onClick={async (e) => { e.stopPropagation(); if (await confirm({ title: 'Excluir modelo?', message: t.title, tone: 'danger', confirmLabel: 'Excluir' })) run(async () => { await backend.remove('task_templates', t.id); await invalidate('task_templates') }, 'Modelo excluído.') }} /> },
        ]}
      />
      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'Editar modelo' : 'Novo modelo'} footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button variant="primary" loading={busy} onClick={() => run(async () => {
          if (!editing.title?.trim()) throw new Error('Informe o título.')
          if (editing.id) await backend.update('task_templates', editing.id, editing)
          else await backend.insert('task_templates', editing)
          await invalidate('task_templates')
          setEditing(null)
        }, 'Modelo salvo.')}>Salvar</Button></>}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Título" required className="sm:col-span-2"><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
            <Field label="Fase"><Select value={editing.phase_number} onChange={(e) => setEditing({ ...editing, phase_number: +e.target.value })}>{PHASES.map((p) => <option key={p.number} value={p.number}>{p.code} — {p.name}</option>)}</Select></Field>
            <Field label="Prioridade"><Select value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: e.target.value as TaskTemplate['priority'] })}>{Object.entries(TASK_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
            <Field label="Prazo (dias após o início da fase)"><Input type="number" min={0} value={editing.offset_days} onChange={(e) => setEditing({ ...editing, offset_days: Math.max(0, +e.target.value) })} /></Field>
            <Field label="Descrição" className="sm:col-span-2"><Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <Field label="Checklist (um item por linha)" className="sm:col-span-2"><Textarea value={(editing.checklist ?? []).join('\n')} onChange={(e) => setEditing({ ...editing, checklist: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} /></Field>
          </div>
        </Modal>
      )}
    </Card>
  )
}

function Integrations() {
  const accounts = useRows('ad_accounts')
  const projects = useRows('projects')
  const { run, busy } = useAction()
  const [params] = useSearchParams()
  const supa = backend.mode === 'supabase'
  const callback = params.get('meta')
  const statusBadge = (s: string, sync: string | null) =>
    s === 'conectada' && sync === 'ok' ? <Badge tone="success"><CheckCircle2 className="size-3" />Conectada</Badge>
      : s === 'demo' ? <Badge tone="warning">Demonstrativa</Badge>
        : s === 'erro' ? <Badge tone="danger">Erro</Badge>
          : s === 'expirada' ? <Badge tone="danger">Autorização expirada</Badge>
            : <Badge tone="warning">Pendente (aguardando 1ª sincronização)</Badge>
  return (
    <div className="space-y-5 max-w-5xl">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h3 className="font-bold text-lg">Meta Ads (Marketing API)</h3>
            <p className="text-sm text-muted mt-1">A autorização é feita via OAuth pela Edge Function <code className="text-ink">meta-oauth</code>. O token de acesso fica apenas no servidor (tabela privada, sem acesso pelo navegador). A conexão só é considerada concluída após uma autorização válida <strong>e</strong> uma sincronização bem-sucedida.</p>
          </div>
          <Button variant="primary" icon={Link2} loading={busy} disabled={!supa} onClick={() => run(async () => {
            const r = await backend.rpc<{ url: string }>('meta_connect_url', { redirect_to: import.meta.env.VITE_ROUTER === 'hash' ? `${window.location.origin}${window.location.pathname}#/configuracoes?aba=integracoes` : `${window.location.origin}/configuracoes?aba=integracoes` })
            window.location.href = r.url
          })}>Conectar conta Meta</Button>
        </div>
        {callback === 'ok' && <p className="mt-3 text-sm text-success">Autorização recebida. Selecione o projeto de cada conta e execute a primeira sincronização.</p>}
        {callback === 'erro' && <p className="mt-3 text-sm text-danger">A autorização falhou ou foi cancelada: {params.get('motivo') ?? 'tente novamente'}.</p>}
        {!supa && (
          <div className="mt-4 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm space-y-2">
            <p className="flex gap-2 text-warning font-semibold"><AlertCircle className="size-4 mt-0.5" />Conexão pendente — o que falta configurar</p>
            <ol className="list-decimal pl-5 text-muted space-y-1">
              <li>Criar o projeto no Supabase e aplicar as migrações de <code>supabase/migrations</code>.</li>
              <li>Definir <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no frontend.</li>
              <li>Criar um app no Meta for Developers com o produto Marketing API (permissões <code>ads_read</code>).</li>
              <li>Publicar as Edge Functions <code>meta-oauth</code> e <code>meta-sync</code> com os segredos <code>META_APP_ID</code>, <code>META_APP_SECRET</code> e <code>META_REDIRECT_URI</code>.</li>
            </ol>
            <p className="text-muted">Enquanto isso, o módulo de Tráfego funciona com dados demonstrativos claramente identificados.</p>
          </div>
        )}
      </Card>
      <Card className="p-5">
        <h3 className="font-bold mb-4">Contas de anúncios</h3>
        <DataTable
          rows={accounts.rows}
          columns={[
            { key: 'n', header: 'Conta', cell: (a) => <div><div className="font-semibold">{a.name}</div><div className="text-xs text-faint">{a.external_id}</div></div> },
            { key: 's', header: 'Status', cell: (a) => statusBadge(a.status, a.last_sync_status) },
            { key: 'l', header: 'Última sincronização', cell: (a) => (a.last_sync_at ? `${relative(a.last_sync_at)} (${dateTime(a.last_sync_at)})` : '—') },
            { key: 'e', header: 'Último erro', cell: (a) => <span className="text-xs text-danger">{a.last_error ?? ''}</span> },
            { key: 'p', header: 'Projetos vinculados', cell: (a) => projects.rows.filter((p) => p.ad_account_id === a.id).map((p) => p.name).join(', ') || '—' },
            { key: 'x', header: '', cell: (a) => !a.is_demo && <Button size="sm" icon={RefreshCw} loading={busy} onClick={() => run(async () => { await backend.rpc('meta_sync', { ad_account_id: a.id }); await invalidate('ad_accounts', 'campaigns', 'ad_sets', 'ads', 'ad_metrics_daily') }, 'Sincronização concluída.')}>Sincronizar</Button> },
          ]}
        />
        <p className="text-xs text-faint mt-3">Vincule cada conta a um projeto na edição do projeto (campo “Conta de anúncios”).</p>
      </Card>
    </div>
  )
}

function Demo() {
  const { run, busy } = useAction()
  const confirm = useConfirm()
  return (
    <Card className="p-5 max-w-2xl space-y-4">
      <h3 className="font-bold">Ambiente demonstrativo</h3>
      <p className="text-sm text-muted">Os dados de exemplo (expert Rafael Martins, projeto Jantar Empresarial, anúncios, vendas e despesas fictícias) são marcados como demonstrativos e identificados na interface. Restaurar remove somente os registros demonstrativos e os recria no estado inicial — registros reais não são afetados.</p>
      <Button variant="danger" icon={RotateCcw} loading={busy} onClick={async () => {
        if (!(await confirm({ title: 'Restaurar dados demonstrativos?', message: 'Todas as alterações feitas nos registros de exemplo serão perdidas. Registros reais não são afetados.', tone: 'danger', confirmLabel: 'Restaurar' }))) return
        run(async () => {
          const me = await backend.currentUser()
          await backend.rpc('purge_demo_data', {})
          if (backend.mode === 'supabase') {
            const data = demoData(me?.id ?? null, me?.full_name)
            for (const k of DEMO_INSERT_ORDER) if (data[k].length) await backend.insertMany(k, data[k] as never)
            await backend.rpc('purge_demo_data', { relink_only: true })
          }
          await invalidate(...DEMO_INSERT_ORDER, 'user_experts', 'task_comments', 'files')
        }, 'Dados demonstrativos restaurados.')
      }}>Restaurar dados iniciais</Button>
    </Card>
  )
}

function Audit() {
  const log = useRows('activity_log')
  const rows = log.rows.filter((l) => l.is_audit).sort((a, b) => b.created_at.localeCompare(a.created_at))
  return (
    <Card className="p-5">
      <h3 className="font-bold mb-1">Trilha de auditoria</h3>
      <p className="text-xs text-muted mb-4">Conclusão de fases, alterações financeiras, exclusões e mudanças de permissões.</p>
      <DataTable
        rows={rows}
        searchText={(l) => `${l.summary} ${l.user_name} ${l.action}`}
        columns={[
          { key: 'd', header: 'Data', cell: (l) => dateTime(l.created_at), sortValue: (l) => l.created_at },
          { key: 'u', header: 'Usuário', cell: (l) => l.user_name, sortValue: (l) => l.user_name },
          { key: 'a', header: 'Ação', cell: (l) => <Badge>{l.action}</Badge>, sortValue: (l) => l.action },
          { key: 's', header: 'Descrição', cell: (l) => l.summary },
        ]}
      />
    </Card>
  )
}
