import type { Expert, Profile, Row, TableMap, TableName } from '../types'

/**
 * Emulação das políticas RLS do Supabase para o modo local.
 * Fonte da verdade em produção: supabase/migrations/0002_rls.sql.
 */

export type DB = { [K in TableName]: TableMap[K][] }

export interface Ctx {
  user: Profile
  isAdmin: boolean
  expertIds: Set<string>
  projectIds: Set<string>
  experts: Map<string, Expert>
}

export function buildCtx(db: DB, user: Profile): Ctx {
  const isAdmin = user.role === 'admin'
  const expertIds = new Set(db.user_experts.filter((u) => u.user_id === user.id).map((u) => u.expert_id))
  const projectIds = new Set(db.projects.filter((p) => isAdmin || expertIds.has(p.expert_id)).map((p) => p.id))
  return { user, isAdmin, expertIds, projectIds, experts: new Map(db.experts.map((e) => [e.id, e])) }
}

const MODULE_OF: Partial<Record<TableName, string>> = {
  pages: 'paginas',
  ad_accounts: 'trafego',
  campaigns: 'trafego',
  ad_sets: 'trafego',
  ads: 'trafego',
  ad_metrics_daily: 'trafego',
  products: 'financeiro',
  sales: 'financeiro',
  expenses: 'financeiro',
  tasks: 'tarefas',
  task_comments: 'tarefas',
  movements: 'posicionamento',
}

function expertOfProject(db: DB, projectId: string | null | undefined): Expert | undefined {
  const p = db.projects.find((x) => x.id === projectId)
  return p ? db.experts.find((e) => e.id === p.expert_id) : undefined
}

function moduleVisible(_ctx: Ctx, expert: Expert | undefined, table: TableName): boolean {
  const mod = MODULE_OF[table]
  if (!mod || !expert) return true
  return expert.permissions.visible_modules.includes(mod)
}

/** project_id do registro, resolvendo relações indiretas. */
function projectOf(db: DB, table: TableName, row: Record<string, unknown>): string | null {
  switch (table) {
    case 'ad_sets': {
      const c = db.campaigns.find((x) => x.id === row.campaign_id)
      return c?.project_id ?? null
    }
    case 'ad_metrics_daily': {
      const a = db.ads.find((x) => x.id === row.ad_id)
      return a?.project_id ?? null
    }
    case 'task_comments': {
      const t = db.tasks.find((x) => x.id === row.task_id)
      return t?.project_id ?? null
    }
    default:
      return (row.project_id as string | null | undefined) ?? null
  }
}

export function canRead<T extends TableName>(db: DB, ctx: Ctx, table: T, row: Row<T>): boolean {
  if (ctx.isAdmin) return true
  const r = row as unknown as Record<string, unknown>
  switch (table) {
    case 'app_settings':
    case 'page_types':
    case 'expense_categories':
    case 'task_templates':
      return true
    case 'profiles':
      return r.id === ctx.user.id
    case 'user_experts':
      return r.user_id === ctx.user.id
    case 'experts':
      return ctx.expertIds.has(r.id as string)
    case 'projects':
      return ctx.projectIds.has(r.id as string)
    case 'movements': {
      if (!ctx.expertIds.has(r.expert_id as string)) return false
      return moduleVisible(ctx, ctx.experts.get(r.expert_id as string), table) && (r.status === 'publicado' || Boolean(r.expert_editable))
    }
    case 'ad_accounts':
      return db.projects.some((p) => ctx.projectIds.has(p.id) && p.ad_account_id === r.id) &&
        moduleVisible(ctx, expertOfProject(db, db.projects.find((p) => p.ad_account_id === r.id && ctx.projectIds.has(p.id))?.id), table)
    case 'section_configs':
      return Boolean(r.active) && Boolean(r.visible_to_expert) && (r.roles as string[]).includes('expert') &&
        (!r.expert_id || ctx.expertIds.has(r.expert_id as string)) && (!r.project_id || ctx.projectIds.has(r.project_id as string))
    case 'section_records': {
      const sec = db.section_configs.find((s) => s.id === r.section_id)
      if (!sec || !canRead(db, ctx, 'section_configs', sec)) return false
      if (r.expert_id) return ctx.expertIds.has(r.expert_id as string)
      if (r.project_id) return ctx.projectIds.has(r.project_id as string)
      return false
    }
    case 'activity_log':
      if (r.is_audit) return false
      return (r.project_id ? ctx.projectIds.has(r.project_id as string) : false) || (r.expert_id ? ctx.expertIds.has(r.expert_id as string) : false)
    case 'files':
      return r.project_id ? ctx.projectIds.has(r.project_id as string) : r.uploaded_by === ctx.user.id
    default: {
      const pid = projectOf(db, table, r)
      if (!pid || !ctx.projectIds.has(pid)) return false
      return moduleVisible(ctx, expertOfProject(db, pid), table)
    }
  }
}

export type Op = 'insert' | 'update' | 'delete'

/** Retorna null quando permitido, ou a mensagem de recusa. */
export function writeDenied<T extends TableName>(db: DB, ctx: Ctx, table: T, op: Op, row: Row<T>, old?: Row<T>): string | null {
  if (ctx.isAdmin) return null
  const r = row as unknown as Record<string, unknown>
  const deny = 'Seu perfil não tem permissão para esta ação.'
  if (!canRead(db, ctx, table, (old ?? row) as Row<T>)) return deny
  switch (table) {
    case 'experts': {
      if (op !== 'update' || !old) return deny
      const e = old as unknown as Expert
      const n = row as unknown as Expert
      if (JSON.stringify(e.permissions) !== JSON.stringify(n.permissions) || e.is_demo !== n.is_demo) return 'Somente administradores alteram permissões.'
      if (e.photo_url !== n.photo_url && !e.permissions.can_upload_photo) return 'Alteração de fotografia não autorizada para o seu perfil.'
      const keys = Object.keys(n).filter((k) => !['photo_url', 'updated_at'].includes(k) && JSON.stringify((n as unknown as Record<string, unknown>)[k]) !== JSON.stringify((e as unknown as Record<string, unknown>)[k]))
      if (keys.length && !e.permissions.can_edit_profile) return 'Edição de dados pessoais não autorizada para o seu perfil.'
      return null
    }
    case 'profiles':
      if (op === 'update' && r.id === ctx.user.id && (old as unknown as Profile).role === (row as unknown as Profile).role) return null
      return deny
    case 'movements': {
      const e = ctx.experts.get(r.expert_id as string)
      if (op === 'update' && old && (old as unknown as Record<string, unknown>).expert_editable && e?.permissions.can_edit_movements && r.expert_editable) return null
      return deny
    }
    case 'tasks': {
      const e = expertOfProject(db, r.project_id as string)
      if (op !== 'delete' && e?.permissions.can_edit_tasks) return null
      return deny
    }
    case 'task_comments':
      if (op === 'insert' && r.user_id === ctx.user.id) return null
      return deny
    case 'sales':
    case 'expenses':
    case 'products': {
      const e = expertOfProject(db, r.project_id as string)
      if (op !== 'delete' && e?.permissions.can_edit_finance) return null
      return 'Valores financeiros são editados apenas pela administração.'
    }
    case 'files':
      if (op === 'insert' && r.uploaded_by === ctx.user.id) return null
      return deny
    case 'section_records': {
      const sec = db.section_configs.find((s) => s.id === r.section_id)
      if (sec?.expert_can_edit && op !== 'delete') return null
      return deny
    }
    case 'activity_log':
    case 'phase_history':
      return op === 'insert' ? null : deny
    default:
      return deny
  }
}
