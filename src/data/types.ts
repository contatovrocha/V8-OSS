// Entidades do Launch OS. Os nomes das tabelas e colunas espelham o schema do Supabase
// (supabase/migrations/0001_schema.sql), para que os dois backends sejam intercambiáveis.

export type Role = 'admin' | 'expert'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: Role
  avatar_url?: string | null
  created_at: string
}

export interface ExpertPermissions {
  can_edit_profile: boolean
  can_upload_photo: boolean
  can_edit_movements: boolean
  can_edit_tasks: boolean
  can_manage_phases: boolean
  can_edit_finance: boolean
  visible_modules: string[]
}

export interface SocialLink {
  label: string
  url: string
}

export interface ExpertProfileContent {
  full_name: string
  professional_name: string
  title: string
  bio: string
  career_story: string
  value_proposition: string
  positioning: string
  target_audience: string
  differentiators: string[]
  authority_topics: string[]
  social_links: SocialLink[]
  website: string
  videos: SocialLink[]
  media: SocialLink[]
}

export interface Expert extends ExpertProfileContent {
  id: string
  photo_url: string | null
  draft: Partial<ExpertProfileContent> | null
  published_at: string | null
  permissions: ExpertPermissions
  is_demo: boolean
  created_at: string
  updated_at: string
}

export interface UserExpert {
  id: string
  user_id: string
  expert_id: string
}

export type ProjectStatus = 'ativo' | 'inativo' | 'estruturacao'

export interface LinkItem {
  label: string
  url: string
}

export interface Project {
  id: string
  expert_id: string
  name: string
  description: string
  category: string
  launch_type: string
  start_date: string | null
  end_date: string | null
  event_date: string | null
  revenue_goal: number
  sales_goal: number
  traffic_budget: number
  status: ProjectStatus
  archived: boolean
  current_phase: number | null
  cover_url: string | null
  links: LinkItem[]
  internal_notes: string
  team: string[]
  ad_account_id: string | null
  is_demo: boolean
  created_at: string
  updated_at: string
}

export type PhaseStatus = 'bloqueada' | 'disponivel' | 'andamento' | 'concluida'

export interface ChecklistItem {
  id: string
  label: string
  done: boolean
}

export interface ProjectPhase {
  id: string
  project_id: string
  phase_number: number
  status: PhaseStatus
  started_at: string | null
  completed_at: string | null
  completed_by: string | null
  owner: string
  checklist: ChecklistItem[]
  notes: string
  links: LinkItem[]
  updated_at: string
}

export interface PhaseHistory {
  id: string
  project_id: string
  phase_number: number
  action: string
  from_status: PhaseStatus | null
  to_status: PhaseStatus | null
  user_id: string | null
  user_name: string
  note: string
  created_at: string
}

export type MovementStatus = 'publicado' | 'rascunho' | 'desativado'

export interface Movement {
  id: string
  expert_id: string
  project_id: string | null
  name: string
  cover_url: string | null
  description: string
  category: string
  status: MovementStatus
  sort_order: number
  external_url: string
  expert_editable: boolean
  is_demo: boolean
  created_at: string
  updated_at: string
}

export interface PageType {
  id: string
  name: string
  is_custom: boolean
  created_at: string
}

export type PageStatus = 'planejada' | 'producao' | 'revisao' | 'publicada' | 'pausada'

export interface LaunchPage {
  id: string
  project_id: string
  name: string
  page_type_id: string
  published_url: string
  edit_url: string
  tool: string
  owner: string
  status: PageStatus
  published_at: string | null
  conversion_goal: number | null
  conversion_current: number | null
  notes: string
  preview_url: string | null
  archived: boolean
  is_demo: boolean
  created_at: string
  updated_at: string
}

export type AdAccountStatus = 'demo' | 'pendente' | 'conectada' | 'erro' | 'expirada'

export interface AdAccount {
  id: string
  name: string
  platform: 'meta'
  external_id: string
  status: AdAccountStatus
  currency: string
  last_sync_at: string | null
  last_sync_status: 'ok' | 'erro' | null
  last_error: string | null
  is_demo: boolean
  created_at: string
}

export interface Campaign {
  id: string
  ad_account_id: string
  project_id: string | null
  external_id: string
  name: string
  objective: string
  status: string
  is_demo: boolean
  created_at: string
}

export interface AdSet {
  id: string
  campaign_id: string
  external_id: string
  name: string
  status: string
  is_demo: boolean
  created_at: string
}

export interface Ad {
  id: string
  ad_set_id: string
  campaign_id: string
  ad_account_id: string
  project_id: string | null
  external_id: string
  name: string
  status: string
  platform: string
  placement: string
  creative_type: 'imagem' | 'video' | 'carrossel'
  thumbnail_url: string | null
  video_url: string | null
  primary_text: string
  headline: string
  description: string
  is_demo: boolean
  created_at: string
}

export interface AdMetricDaily {
  id: string
  ad_id: string
  ad_account_id: string
  date: string
  spend: number
  impressions: number
  reach: number
  link_clicks: number
  leads: number
  purchases: number
  purchase_value: number
  attribution_setting: string
  source: 'demo' | 'meta' | 'manual'
  synced_at: string
  is_demo: boolean
}

export interface Product {
  id: string
  project_id: string
  name: string
  price: number
  active: boolean
  is_demo: boolean
  created_at: string
}

export type SaleStatus = 'pendente' | 'aprovada' | 'reembolsada' | 'cancelada'

export interface Sale {
  id: string
  project_id: string
  product_id: string
  order_ref: string
  sale_date: string
  gross_amount: number
  discount: number
  fees: number
  refund_amount: number
  payment_method: string
  status: SaleStatus
  origin: string
  notes: string
  external_source: string | null
  external_id: string | null
  is_demo: boolean
  created_at: string
  updated_at: string
}

export interface ExpenseCategory {
  id: string
  name: string
  is_traffic: boolean
}

export interface Expense {
  id: string
  project_id: string
  description: string
  category: string
  expense_date: string
  amount: number
  payment_method: string
  status: 'pendente' | 'paga' | 'cancelada'
  owner: string
  receipt_url: string | null
  notes: string
  // Quando preenchido em uma despesa de tráfego, indica que o gasto já é contabilizado
  // pela sincronização dessa conta de anúncios e não deve ser somado de novo.
  ad_account_id: string | null
  is_demo: boolean
  created_at: string
  updated_at: string
}

export type TaskStatus = 'a_fazer' | 'andamento' | 'revisao' | 'concluida' | 'bloqueada'
export type TaskPriority = 'baixa' | 'media' | 'alta' | 'urgente'

export interface Task {
  id: string
  project_id: string
  phase_number: number | null
  title: string
  description: string
  assignee: string
  priority: TaskPriority
  start_date: string | null
  due_date: string | null
  status: TaskStatus
  checklist: ChecklistItem[]
  sort_order: number
  is_demo: boolean
  created_at: string
  updated_at: string
}

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  user_name: string
  body: string
  created_at: string
}

export interface TaskTemplate {
  id: string
  phase_number: number
  title: string
  description: string
  priority: TaskPriority
  checklist: string[]
  offset_days: number
  created_at: string
}

export interface FileRecord {
  id: string
  project_id: string | null
  entity_type: string
  entity_id: string | null
  name: string
  url: string
  mime: string
  size: number
  uploaded_by: string
  created_at: string
}

export interface ActivityLog {
  id: string
  project_id: string | null
  expert_id: string | null
  entity_type: string
  entity_id: string | null
  action: string
  summary: string
  user_id: string | null
  user_name: string
  is_audit: boolean
  data: Record<string, unknown> | null
  created_at: string
}

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'url'
  | 'image'
  | 'file'
  | 'status'
  | 'project'
  | 'expert'

export interface FieldConfig {
  key: string
  label: string
  type: FieldType
  required: boolean
  options: string[]
  show_in_card: boolean
  show_in_table: boolean
  filterable: boolean
}

export interface SectionConfig {
  id: string
  name: string
  slug: string
  icon: string
  description: string
  menu_position: number
  roles: Role[]
  project_id: string | null
  expert_id: string | null
  visible_to_expert: boolean
  expert_can_edit: boolean
  active: boolean
  fields: FieldConfig[]
  created_at: string
  updated_at: string
}

export interface SectionRecord {
  id: string
  section_id: string
  project_id: string | null
  expert_id: string | null
  data: Record<string, unknown>
  created_by: string
  created_at: string
  updated_at: string
}

export type PhaseTransitionRule = 'next_available' | 'manual'

export interface AppSettings {
  id: string
  brand_name: string
  operation_name: string
  primary_color: string
  success_color: string
  accent_color: string
  danger_color: string
  logo_url: string | null
  timezone: string
  phase_transition_rule: PhaseTransitionRule
  top_product_metric: 'quantidade' | 'faturamento'
  disabled_modules: string[]
  updated_at: string
}

export interface TableMap {
  profiles: Profile
  experts: Expert
  user_experts: UserExpert
  projects: Project
  project_phases: ProjectPhase
  phase_history: PhaseHistory
  movements: Movement
  page_types: PageType
  pages: LaunchPage
  ad_accounts: AdAccount
  campaigns: Campaign
  ad_sets: AdSet
  ads: Ad
  ad_metrics_daily: AdMetricDaily
  products: Product
  sales: Sale
  expense_categories: ExpenseCategory
  expenses: Expense
  tasks: Task
  task_comments: TaskComment
  task_templates: TaskTemplate
  files: FileRecord
  activity_log: ActivityLog
  section_configs: SectionConfig
  section_records: SectionRecord
  app_settings: AppSettings
}

export type TableName = keyof TableMap
export type Row<T extends TableName> = TableMap[T]
