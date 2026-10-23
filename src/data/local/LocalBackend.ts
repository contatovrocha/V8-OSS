import { storage } from '@/lib/storage'
import { applyPhaseAction, phaseDef, type PhaseAction } from '@/lib/phases'
import { validateRecord } from '@/lib/sections'
import { BackendError, type Backend, type ChangeEvent, type Filter, type NewUserInput, type RpcName } from '../backend'
import { baseConfig, demoData, DEMO_INSERT_ORDER, DEMO } from '../seed'
import type { ActivityLog, Profile, Project, Row, TableName, UserExpert } from '../types'
import { buildCtx, canRead, writeDenied, type DB, type Op } from './policies'
import { describeChange } from '../activity'

const DB_KEY = 'launchos:db:v1'
const CRED_KEY = 'launchos:cred:v1'
const SESSION_KEY = 'launchos:session:v1'

const TABLES: TableName[] = [
  'profiles', 'experts', 'user_experts', 'projects', 'project_phases', 'phase_history', 'movements', 'page_types', 'pages',
  'ad_accounts', 'campaigns', 'ad_sets', 'ads', 'ad_metrics_daily', 'products', 'sales', 'expense_categories', 'expenses',
  'tasks', 'task_comments', 'task_templates', 'files', 'activity_log', 'section_configs', 'section_records', 'app_settings',
]

/** Dependências (filhos) usadas para exclusão em cascata, como ON DELETE CASCADE no Postgres. */
const CASCADE: Partial<Record<TableName, [TableName, string][]>> = {
  experts: [['user_experts', 'expert_id'], ['movements', 'expert_id'], ['projects', 'expert_id']],
  projects: [['project_phases', 'project_id'], ['phase_history', 'project_id'], ['pages', 'project_id'], ['tasks', 'project_id'], ['products', 'project_id'], ['files', 'project_id']],
  campaigns: [['ad_sets', 'campaign_id']],
  ad_sets: [['ads', 'ad_set_id']],
  ads: [['ad_metrics_daily', 'ad_id']],
  tasks: [['task_comments', 'task_id']],
  section_configs: [['section_records', 'section_id']],
  profiles: [['user_experts', 'user_id']],
}

async function hash(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('launchos:' + s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const uuid = () => crypto.randomUUID()
const nowIso = () => new Date().toISOString()
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

type Creds = Record<string, { user_id: string; hash: string }>

export const LOCAL_DEMO_USERS = [
  { email: 'admin@launchos.demo', password: 'admin123', name: 'Ana Operações', role: 'admin' as const, expert: null },
  { email: 'rafael@launchos.demo', password: 'expert123', name: 'Rafael Martins', role: 'expert' as const, expert: DEMO.expertRafael },
  { email: 'camila@launchos.demo', password: 'expert123', name: 'Camila Duarte', role: 'expert' as const, expert: DEMO.expertCamila },
]

export class LocalBackend implements Backend {
  readonly mode = 'local' as const
  private db!: DB
  private listeners = new Set<(e: ChangeEvent) => void>()
  private authListeners = new Set<(p: Profile | null) => void>()
  private channel: BroadcastChannel | null = null
  private ready: Promise<void>

  constructor() {
    this.ready = this.init()
    try {
      this.channel = new BroadcastChannel('launchos')
      this.channel.onmessage = (ev) => {
        this.reload()
        for (const t of ev.data.tables as TableName[]) this.listeners.forEach((l) => l({ table: t }))
      }
    } catch {
      this.channel = null
    }
    // Fallback entre abas: o evento "storage" dispara nas outras abas quando o banco local muda.
    window.addEventListener('storage', (ev) => {
      if (ev.key !== DB_KEY || !ev.newValue) return
      this.db = JSON.parse(ev.newValue)
      TABLES.forEach((t) => this.listeners.forEach((l) => l({ table: t })))
    })
  }

  private async init() {
    const raw = storage.get(DB_KEY)
    if (raw) {
      this.db = JSON.parse(raw)
      for (const t of TABLES) this.db[t] ??= [] as never
      return
    }
    await this.bootstrap()
  }

  private reload() {
    const raw = storage.get(DB_KEY)
    if (raw) this.db = JSON.parse(raw)
  }

  /** Primeiro acesso: configuração base, usuários demonstrativos e dados de exemplo. */
  private async bootstrap() {
    const db = Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as DB
    const base = baseConfig()
    db.page_types = base.pageTypes
    db.expense_categories = base.categories
    db.app_settings = [base.settings]
    db.task_templates = base.templates
    const creds: Creds = {}
    let adminId = ''
    for (const u of LOCAL_DEMO_USERS) {
      const pid = uuid()
      if (u.role === 'admin') adminId = pid
      db.profiles.push({ id: pid, email: u.email, full_name: u.name, role: u.role, avatar_url: null, created_at: nowIso() })
      creds[u.email] = { user_id: pid, hash: await hash(u.password) }
    }
    const demo = demoData(adminId, 'Ana Operações')
    for (const k of DEMO_INSERT_ORDER) (db[k] as unknown[]) = clone(demo[k]) as unknown[]
    for (const u of LOCAL_DEMO_USERS) {
      const prof = db.profiles.find((p) => p.email === u.email)!
      if (u.expert) db.user_experts.push({ id: uuid(), user_id: prof.id, expert_id: u.expert })
    }
    this.db = db
    storage.set(CRED_KEY, JSON.stringify(creds))
    this.persist([])
  }

  private persist(tables: TableName[]) {
    try {
      storage.set(DB_KEY, JSON.stringify(this.db))
    } catch {
      throw new BackendError('Armazenamento local cheio. Remova imagens grandes ou use o backend Supabase.', 'quota')
    }
    if (tables.length) {
      this.channel?.postMessage({ tables })
      tables.forEach((t) => this.listeners.forEach((l) => l({ table: t })))
    }
  }

  // ---------------------------------------------------------------- auth
  private async me(): Promise<Profile> {
    await this.ready
    const id = storage.get(SESSION_KEY)
    const p = this.db.profiles.find((x) => x.id === id)
    if (!p) throw new BackendError('Sessão expirada. Entre novamente.', 'auth')
    return p
  }

  async currentUser() {
    await this.ready
    const id = storage.get(SESSION_KEY)
    return this.db.profiles.find((x) => x.id === id) ?? null
  }

  async signIn(email: string, password: string) {
    await this.ready
    const creds: Creds = JSON.parse(storage.get(CRED_KEY) ?? '{}')
    const c = creds[email.trim().toLowerCase()]
    if (!c || c.hash !== (await hash(password))) throw new BackendError('E-mail ou senha incorretos.', 'auth')
    const p = this.db.profiles.find((x) => x.id === c.user_id)
    if (!p) throw new BackendError('Usuário desativado.', 'auth')
    storage.set(SESSION_KEY, p.id)
    this.authListeners.forEach((l) => l(p))
    return p
  }

  async signOut() {
    storage.remove(SESSION_KEY)
    this.authListeners.forEach((l) => l(null))
  }

  onAuthChange(cb: (p: Profile | null) => void) {
    this.authListeners.add(cb)
    return () => this.authListeners.delete(cb)
  }

  // ---------------------------------------------------------------- data
  async list<T extends TableName>(table: T, filter?: Filter<T>): Promise<Row<T>[]> {
    const user = await this.me()
    const ctx = buildCtx(this.db, user)
    let rows = (this.db[table] as Row<T>[]).filter((r) => canRead(this.db, ctx, table, r))
    if (filter) rows = rows.filter((r) => Object.entries(filter).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v))
    return clone(rows)
  }

  private log(user: Profile, entry: Partial<ActivityLog>) {
    this.db.activity_log.push({
      id: uuid(), project_id: null, expert_id: null, entity_type: '', entity_id: null, action: '', summary: '', user_id: user.id,
      user_name: user.full_name, is_audit: false, data: null, created_at: nowIso(), ...entry,
    })
  }

  private track<T extends TableName>(user: Profile, table: T, op: Op, row: Row<T>, old?: Row<T>) {
    const entry = describeChange(table, op, row as unknown as Record<string, unknown>, old as unknown as Record<string, unknown> | undefined, (pid) => this.db.projects.find((p) => p.id === pid)?.expert_id ?? null)
    if (entry) this.log(user, entry)
  }

  private validate<T extends TableName>(table: T, row: Row<T>) {
    const r = row as unknown as Record<string, unknown>
    const required: Partial<Record<TableName, string[]>> = {
      projects: ['name', 'expert_id'], experts: ['full_name'], pages: ['name', 'project_id', 'page_type_id'], tasks: ['title', 'project_id'],
      sales: ['project_id', 'product_id', 'sale_date'], expenses: ['description', 'project_id', 'category', 'expense_date'], products: ['name', 'project_id'],
      movements: ['name', 'expert_id'], section_configs: ['name', 'slug'], page_types: ['name'],
    }
    for (const k of required[table] ?? []) if (r[k] === undefined || r[k] === null || r[k] === '') throw new BackendError(`Campo obrigatório ausente: ${k}`, 'validation')
    for (const k of ['amount', 'gross_amount', 'discount', 'fees', 'refund_amount', 'revenue_goal', 'sales_goal', 'traffic_budget', 'price'])
      if (k in r && (typeof r[k] !== 'number' || (r[k] as number) < 0)) throw new BackendError(`Valor inválido em ${k}: deve ser um número maior ou igual a zero.`, 'validation')
    if (table === 'sales') {
      const s = r as unknown as Row<'sales'>
      if (s.discount + s.refund_amount > s.gross_amount + 0.001) throw new BackendError('Desconto e reembolso não podem superar o valor bruto.', 'validation')
      if (s.external_source && s.external_id && this.db.sales.some((x) => x.id !== s.id && x.external_source === s.external_source && x.external_id === s.external_id))
        throw new BackendError('Venda já importada (pedido duplicado).', 'duplicate')
    }
    if (table === 'section_records') {
      const sec = this.db.section_configs.find((s) => s.id === r.section_id)
      if (!sec) throw new BackendError('Seção inexistente.', 'validation')
      const { data, errors } = validateRecord(sec.fields, r.data as Record<string, unknown>)
      const first = Object.values(errors)[0]
      if (first) throw new BackendError(first, 'validation')
      r.data = data
    }
    if (table === 'section_configs' && this.db.section_configs.some((s) => s.slug === r.slug && s.id !== r.id)) throw new BackendError('Já existe uma seção com esse identificador.', 'duplicate')
  }

  async insert<T extends TableName>(table: T, values: Partial<Row<T>>): Promise<Row<T>> {
    const [row] = await this.insertMany(table, [values])
    return row
  }

  async insertMany<T extends TableName>(table: T, values: Partial<Row<T>>[]): Promise<Row<T>[]> {
    const user = await this.me()
    const ctx = buildCtx(this.db, user)
    const out: Row<T>[] = []
    for (const v of values) {
      const row = { id: uuid(), created_at: nowIso(), updated_at: nowIso(), ...v } as Row<T>
      this.validate(table, row)
      const denied = writeDenied(this.db, ctx, table, 'insert', row)
      if (denied) throw new BackendError(denied, 'forbidden')
      ;(this.db[table] as Row<T>[]).push(row)
      if (table === 'projects') this.ensurePhases((row as unknown as Project).id)
      this.track(user, table, 'insert', row)
      out.push(row)
    }
    this.persist([table, 'activity_log', ...(table === 'projects' ? (['project_phases'] as TableName[]) : [])])
    return clone(out)
  }

  private ensurePhases(projectId: string) {
    if (this.db.project_phases.some((p) => p.project_id === projectId)) return
    for (let n = 1; n <= 8; n++)
      this.db.project_phases.push({
        id: uuid(), project_id: projectId, phase_number: n, status: n === 1 ? 'disponivel' : 'bloqueada', started_at: null, completed_at: null,
        completed_by: null, owner: '', checklist: [], notes: '', links: [], updated_at: nowIso(),
      })
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>> {
    const user = await this.me()
    const ctx = buildCtx(this.db, user)
    const list = this.db[table] as Row<T>[]
    const idx = list.findIndex((r) => (r as { id: string }).id === id)
    if (idx < 0) throw new BackendError('Registro não encontrado.', 'not_found')
    const old = list[idx]
    const row = { ...old, ...patch, id } as Row<T>
    if ('updated_at' in (old as object)) (row as unknown as Record<string, unknown>).updated_at = nowIso()
    this.validate(table, row)
    if (table === 'project_phases' && !ctx.isAdmin) throw new BackendError('Fases estratégicas são alteradas apenas pela administração.', 'forbidden')
    const denied = writeDenied(this.db, ctx, table, 'update', row, old)
    if (denied) throw new BackendError(denied, 'forbidden')
    list[idx] = row
    this.track(user, table, 'update', row, old)
    this.persist([table, 'activity_log'])
    return clone(row)
  }

  async remove(table: TableName, id: string): Promise<void> {
    const user = await this.me()
    const ctx = buildCtx(this.db, user)
    const list = this.db[table] as { id: string }[]
    const row = list.find((r) => r.id === id)
    if (!row) return
    if (table === 'projects') {
      await this.rpc('delete_project', { project_id: id })
      return
    }
    const denied = writeDenied(this.db, ctx, table, 'delete', row as never)
    if (denied) throw new BackendError(denied, 'forbidden')
    if (table === 'page_types' && this.db.pages.some((p) => p.page_type_id === id)) throw new BackendError('Existem páginas usando esta categoria.', 'conflict')
    if (table === 'products' && this.db.sales.some((s) => s.product_id === id)) throw new BackendError('Produto possui vendas registradas. Desative-o em vez de excluir.', 'conflict')
    const touched = new Set<TableName>([table, 'activity_log'])
    this.cascade(table, id, touched)
    this.track(user, table, 'delete', row as never)
    this.persist([...touched])
  }

  private cascade(table: TableName, id: string, touched: Set<TableName>) {
    for (const [child, fk] of CASCADE[table] ?? []) {
      const rows = (this.db[child] as unknown as Record<string, unknown>[]).filter((r) => r[fk] === id)
      rows.forEach((r) => this.cascade(child, r.id as string, touched))
      if (rows.length) touched.add(child)
    }
    ;(this.db[table] as unknown as { id: string }[]) = (this.db[table] as unknown as { id: string }[]).filter((r) => r.id !== id)
  }

  // ---------------------------------------------------------------- rpc (mesma semântica das funções SQL)
  async rpc<R = unknown>(name: RpcName, args: Record<string, unknown>): Promise<R> {
    const user = await this.me()
    const ctx = buildCtx(this.db, user)
    switch (name) {
      case 'set_phase_status': {
        const projectId = args.project_id as string
        const project = this.db.projects.find((p) => p.id === projectId)
        if (!project || !ctx.projectIds.has(projectId)) throw new BackendError('Projeto não encontrado.', 'not_found')
        const perms = ctx.experts.get(project.expert_id)?.permissions
        if (!ctx.isAdmin && !perms?.can_manage_phases) throw new BackendError('Somente a administração pode alterar fases estratégicas.', 'forbidden')
        const settings = this.db.app_settings[0]
        const phases = this.db.project_phases.filter((p) => p.project_id === projectId)
        const n = args.phase_number as number
        const action = args.action as PhaseAction
        let res
        try {
          res = applyPhaseAction(phases, n, action, { rule: settings.phase_transition_rule, userId: user.id, now: nowIso(), currentPhase: project.current_phase })
        } catch (e) {
          throw new BackendError((e as Error).message, 'validation')
        }
        const byNum = new Map(res.phases.map((p) => [p.phase_number, p]))
        this.db.project_phases = this.db.project_phases.map((p) => (p.project_id === projectId ? { ...byNum.get(p.phase_number)!, updated_at: nowIso() } : p))
        project.current_phase = res.currentPhase
        project.updated_at = nowIso()
        const note = [args.note as string, res.exception ? `Exceção administrativa: ${res.exception}` : ''].filter(Boolean).join(' · ')
        for (const c of res.changed) {
          const explicit = c.phase_number === n
          this.db.phase_history.push({
            id: uuid(), project_id: projectId, phase_number: c.phase_number, action: explicit ? action : 'auto', from_status: c.from, to_status: c.to,
            user_id: user.id, user_name: user.full_name, note: explicit ? note : 'Transição automática', created_at: nowIso(),
          })
        }
        const verb = action === 'complete' ? 'concluída' : action === 'start' ? 'iniciada' : 'reaberta'
        this.log(user, {
          project_id: projectId, expert_id: project.expert_id, entity_type: 'project_phases', entity_id: projectId, action: `phase_${action}`,
          summary: `Fase V${n} — ${phaseDef(n)?.name} ${verb}${res.exception ? ' (exceção administrativa)' : ''}`, is_audit: true, data: { changed: res.changed, exception: res.exception },
        })
        this.persist(['project_phases', 'phase_history', 'projects', 'activity_log'])
        return { current_phase: res.currentPhase } as R
      }
      case 'delete_project': {
        if (!ctx.isAdmin) throw new BackendError('Somente administradores podem excluir projetos.', 'forbidden')
        const id = args.project_id as string
        const p = this.db.projects.find((x) => x.id === id)
        if (!p) throw new BackendError('Projeto não encontrado.', 'not_found')
        const deps = this.financialDeps(id)
        if (deps.total > 0)
          throw new BackendError(`O projeto possui ${deps.sales} venda(s), ${deps.expenses} despesa(s) e ${deps.campaigns} campanha(s) vinculadas. Arquive-o para preservar a consistência financeira.`, 'conflict')
        const touched = new Set<TableName>(['projects', 'activity_log', 'movements', 'section_records'])
        this.db.movements = this.db.movements.map((m) => (m.project_id === id ? { ...m, project_id: null } : m))
        this.cascade('projects', id, touched)
        this.log(user, { project_id: null, expert_id: p.expert_id, entity_type: 'projects', entity_id: id, action: 'delete', summary: `Projeto excluído: ${p.name}`, is_audit: true, data: { name: p.name } })
        this.persist([...touched])
        return undefined as R
      }
      case 'duplicate_project': {
        if (!ctx.isAdmin) throw new BackendError('Somente administradores podem duplicar projetos.', 'forbidden')
        const src = this.db.projects.find((x) => x.id === args.project_id)
        if (!src) throw new BackendError('Projeto não encontrado.', 'not_found')
        const ts = nowIso()
        const copy: Project = { ...clone(src), id: uuid(), name: (args.name as string) || `${src.name} (cópia)`, status: 'estruturacao', archived: false, current_phase: null, is_demo: false, created_at: ts, updated_at: ts }
        this.db.projects.push(copy)
        this.ensurePhases(copy.id)
        for (const pg of this.db.pages.filter((x) => x.project_id === src.id))
          this.db.pages.push({ ...clone(pg), id: uuid(), project_id: copy.id, status: 'planejada', published_at: null, conversion_current: null, is_demo: false, created_at: ts, updated_at: ts })
        for (const t of this.db.tasks.filter((x) => x.project_id === src.id))
          this.db.tasks.push({ ...clone(t), id: uuid(), project_id: copy.id, status: 'a_fazer', checklist: t.checklist.map((c) => ({ ...c, done: false })), is_demo: false, created_at: ts, updated_at: ts })
        for (const pr of this.db.products.filter((x) => x.project_id === src.id))
          this.db.products.push({ ...clone(pr), id: uuid(), project_id: copy.id, is_demo: false, created_at: ts })
        this.log(user, { project_id: copy.id, expert_id: copy.expert_id, entity_type: 'projects', entity_id: copy.id, action: 'duplicate', summary: `Projeto duplicado a partir de "${src.name}" (sem vendas, despesas ou resultados)` })
        this.persist(['projects', 'project_phases', 'pages', 'tasks', 'products', 'activity_log'])
        return copy as R
      }
      case 'purge_demo_data': {
        if (!ctx.isAdmin) throw new BackendError('Somente administradores podem restaurar a demonstração.', 'forbidden')
        const links = this.db.user_experts.filter((u) => u.expert_id === DEMO.expertRafael || u.expert_id === DEMO.expertCamila)
        const demoProjects = new Set(this.db.projects.filter((p) => p.is_demo).map((p) => p.id))
        const demoTasks = new Set(this.db.tasks.filter((t) => t.is_demo).map((t) => t.id))
        this.db.task_comments = this.db.task_comments.filter((c) => !demoTasks.has(c.task_id))
        for (const t of TABLES) {
          const rows = this.db[t] as unknown as Record<string, unknown>[]
          ;(this.db[t] as unknown) = rows.filter((r) => !r.is_demo && !(r.project_id && demoProjects.has(r.project_id as string) && ['phase_history', 'project_phases', 'activity_log', 'files'].includes(t)))
        }
        const sec = demoData(null).section_configs.map((s) => s.id)
        this.db.section_configs = this.db.section_configs.filter((s) => !sec.includes(s.id))
        this.db.section_records = this.db.section_records.filter((r) => !sec.includes(r.section_id))
        const demo = demoData(user.id, user.full_name)
        for (const k of DEMO_INSERT_ORDER) (this.db[k] as unknown[]).push(...(clone(demo[k]) as unknown[]))
        this.db.user_experts = this.db.user_experts.filter((u) => !links.some((l) => l.id === u.id))
        this.db.user_experts.push(...(links as UserExpert[]))
        this.log(user, { entity_type: 'demo', action: 'reset_demo', summary: 'Dados demonstrativos restaurados', is_audit: true })
        this.persist([...TABLES])
        return undefined as R
      }
      case 'create_user': {
        if (!ctx.isAdmin) throw new BackendError('Somente administradores criam usuários.', 'forbidden')
        const input = args as unknown as NewUserInput
        const email = input.email.trim().toLowerCase()
        const creds: Creds = JSON.parse(storage.get(CRED_KEY) ?? '{}')
        if (creds[email]) throw new BackendError('Já existe um usuário com este e-mail.', 'duplicate')
        if (input.password.length < 6) throw new BackendError('A senha deve ter pelo menos 6 caracteres.', 'validation')
        const p: Profile = { id: uuid(), email, full_name: input.full_name, role: input.role, avatar_url: null, created_at: nowIso() }
        this.db.profiles.push(p)
        for (const eid of input.expert_ids) this.db.user_experts.push({ id: uuid(), user_id: p.id, expert_id: eid })
        creds[email] = { user_id: p.id, hash: await hash(input.password) }
        storage.set(CRED_KEY, JSON.stringify(creds))
        this.log(user, { entity_type: 'profiles', entity_id: p.id, action: 'create_user', summary: `Usuário criado: ${email} (${input.role})`, is_audit: true })
        this.persist(['profiles', 'user_experts', 'activity_log'])
        return p as R
      }
      case 'meta_connect_url':
      case 'meta_sync':
        throw new BackendError('A integração com o Meta Ads exige o backend Supabase com as Edge Functions publicadas e as credenciais do app Meta configuradas. No modo local, o tráfego usa dados demonstrativos.', 'integration_pending')
    }
  }

  financialDeps(projectId: string) {
    const sales = this.db.sales.filter((s) => s.project_id === projectId).length
    const expenses = this.db.expenses.filter((s) => s.project_id === projectId).length
    const campaigns = this.db.campaigns.filter((s) => s.project_id === projectId).length
    return { sales, expenses, campaigns, total: sales + expenses + campaigns }
  }

  // ---------------------------------------------------------------- arquivos
  async upload(file: Blob, _folder: string): Promise<string> {
    await this.me()
    if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') return compressImage(file, 1000, 0.82)
    if (file.size > 1_500_000) throw new BackendError('No modo local, arquivos devem ter até 1,5 MB. Configure o Supabase Storage para arquivos maiores.', 'too_large')
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(new BackendError('Falha ao ler o arquivo.'))
      r.readAsDataURL(file)
    })
  }

  subscribe(cb: (e: ChangeEvent) => void) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
}

export function compressImage(file: Blob, max: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new BackendError('Imagem inválida.'))
    img.src = url
  })
}
