import type { ActivityLog, TableName } from './types'

export const ENTITY_LABEL: Partial<Record<TableName, string>> = {
  projects: 'Projeto',
  pages: 'Página',
  tasks: 'Tarefa',
  sales: 'Venda',
  expenses: 'Despesa',
  products: 'Produto',
  movements: 'Movimento',
  files: 'Arquivo',
  experts: 'Expert',
  section_records: 'Registro',
  section_configs: 'Seção',
  user_experts: 'Vínculo de acesso',
  profiles: 'Usuário',
  task_comments: 'Comentário',
  ad_accounts: 'Conta de anúncios',
}

/** Tabelas cujas alterações entram na trilha de auditoria (ações administrativas sensíveis). */
const AUDIT: Set<TableName> = new Set(['sales', 'expenses', 'products', 'user_experts', 'profiles', 'ad_accounts'])

const OP_LABEL = { insert: 'criado(a)', update: 'atualizado(a)', delete: 'excluído(a)' }

function nameOf(r: Record<string, unknown>): string {
  return String(r.name ?? r.title ?? r.description ?? r.order_ref ?? r.full_name ?? r.email ?? '').slice(0, 80)
}

/**
 * Gera a entrada de histórico para uma alteração. Espelha o trigger SQL public.log_activity.
 * Retorna null para tabelas que não geram histórico.
 */
export function describeChange(
  table: TableName,
  op: 'insert' | 'update' | 'delete',
  row: Record<string, unknown>,
  old: Record<string, unknown> | undefined,
  expertOfProject: (pid: string) => string | null,
): Partial<ActivityLog> | null {
  const label = ENTITY_LABEL[table]
  if (!label || table === 'task_comments') return null
  const projectId = table === 'projects' ? (row.id as string) : ((row.project_id as string | null) ?? null)
  const expertId = (row.expert_id as string | null) ?? (projectId ? expertOfProject(projectId) : null) ?? (table === 'experts' ? (row.id as string) : null)
  let summary = `${label} ${OP_LABEL[op]}: ${nameOf(row)}`
  let audit = AUDIT.has(table) || op === 'delete'
  const data: Record<string, unknown> = {}
  if (op === 'update' && old) {
    const changed = Object.keys(row).filter((k) => !['updated_at'].includes(k) && JSON.stringify(row[k]) !== JSON.stringify(old[k]))
    if (!changed.length) return null
    data.changed = changed
    if (table === 'projects' && changed.includes('status')) summary = `Status do projeto alterado: ${old.status} → ${row.status}`
    if (table === 'projects' && changed.includes('archived')) summary = row.archived ? `Projeto arquivado: ${nameOf(row)}` : `Projeto restaurado: ${nameOf(row)}`
    if (table === 'tasks' && changed.includes('status')) summary = `Tarefa "${nameOf(row)}": ${old.status} → ${row.status}`
    if (table === 'pages' && changed.includes('status')) summary = `Página "${nameOf(row)}": ${old.status} → ${row.status}`
    if (table === 'experts' && changed.includes('permissions')) {
      summary = `Permissões alteradas: ${nameOf(row)}`
      audit = true
      data.before = old.permissions
      data.after = row.permissions
    }
  }
  if (audit && (table === 'sales' || table === 'expenses')) {
    data.amount = row.gross_amount ?? row.amount
    if (old) data.before = old.gross_amount ?? old.amount
  }
  return { project_id: table === 'projects' && op === 'delete' ? null : projectId, expert_id: expertId, entity_type: table, entity_id: (row.id as string) ?? null, action: op, summary, is_audit: audit, data }
}
