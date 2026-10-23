-- Launch OS — schema principal
-- Convenções: UUIDs, timestamps com fuso, valores monetários em numeric(14,2), flag is_demo para dados demonstrativos.

create extension if not exists pgcrypto;
create schema if not exists private;

-- ---------------------------------------------------------------- utilitários
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- configurações
create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null default 'Launch OS',
  operation_name text not null default 'Operação de Lançamentos',
  primary_color text not null default '#3b82f6' check (primary_color ~* '^#[0-9a-f]{6}$'),
  success_color text not null default '#22c55e' check (success_color ~* '^#[0-9a-f]{6}$'),
  accent_color text not null default '#f97316' check (accent_color ~* '^#[0-9a-f]{6}$'),
  danger_color text not null default '#ef4444' check (danger_color ~* '^#[0-9a-f]{6}$'),
  logo_url text,
  timezone text not null default 'America/Sao_Paulo',
  phase_transition_rule text not null default 'next_available' check (phase_transition_rule in ('next_available', 'manual')),
  top_product_metric text not null default 'quantidade' check (top_product_metric in ('quantidade', 'faturamento')),
  disabled_modules text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- usuários e experts
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'expert' check (role in ('admin', 'expert')),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.experts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) > 0),
  professional_name text not null default '',
  title text not null default '',
  bio text not null default '',
  career_story text not null default '',
  value_proposition text not null default '',
  positioning text not null default '',
  target_audience text not null default '',
  differentiators text[] not null default '{}',
  authority_topics text[] not null default '{}',
  social_links jsonb not null default '[]',
  website text not null default '',
  videos jsonb not null default '[]',
  media jsonb not null default '[]',
  photo_url text,
  draft jsonb,
  published_at timestamptz,
  permissions jsonb not null default '{"can_edit_profile":true,"can_upload_photo":true,"can_edit_movements":false,"can_edit_tasks":false,"can_manage_phases":false,"can_edit_finance":false,"visible_modules":["visao_geral","posicionamento","projetos","paginas","trafego","financeiro","tarefas","relatorios"]}',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_experts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expert_id uuid not null references public.experts (id) on delete cascade,
  unique (user_id, expert_id)
);

-- ---------------------------------------------------------------- integrações (antes de projects por causa da FK)
create table public.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text not null default 'meta' check (platform = 'meta'),
  external_id text not null,
  status text not null default 'pendente' check (status in ('demo', 'pendente', 'conectada', 'erro', 'expirada')),
  currency text not null default 'BRL',
  last_sync_at timestamptz,
  last_sync_status text check (last_sync_status in ('ok', 'erro')),
  last_error text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (platform, external_id)
);

-- Tokens NUNCA ficam em tabelas públicas: schema private, sem grants para anon/authenticated.
create table private.integration_tokens (
  ad_account_id uuid primary key references public.ad_accounts (id) on delete cascade,
  access_token text not null,
  expires_at timestamptz,
  meta_user_id text,
  updated_at timestamptz not null default now()
);
create table private.oauth_states (
  state text primary key,
  user_id uuid not null,
  redirect_to text not null,
  created_at timestamptz not null default now()
);
create table private.demo_links (user_id uuid not null, expert_id uuid not null, primary key (user_id, expert_id));

-- ---------------------------------------------------------------- projetos e fases
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  expert_id uuid not null references public.experts (id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  category text not null default '',
  launch_type text not null default '',
  start_date date,
  end_date date,
  event_date date,
  revenue_goal numeric(14, 2) not null default 0 check (revenue_goal >= 0),
  sales_goal integer not null default 0 check (sales_goal >= 0),
  traffic_budget numeric(14, 2) not null default 0 check (traffic_budget >= 0),
  status text not null default 'estruturacao' check (status in ('ativo', 'inativo', 'estruturacao')),
  archived boolean not null default false,
  current_phase smallint check (current_phase between 1 and 8),
  cover_url text,
  links jsonb not null default '[]',
  internal_notes text not null default '',
  team text[] not null default '{}',
  ad_account_id uuid references public.ad_accounts (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index on public.projects (expert_id);

create table public.project_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_number smallint not null check (phase_number between 1 and 8),
  status text not null default 'bloqueada' check (status in ('bloqueada', 'disponivel', 'andamento', 'concluida')),
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles (id) on delete set null,
  owner text not null default '',
  checklist jsonb not null default '[]',
  notes text not null default '',
  links jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  unique (project_id, phase_number)
);

create table public.phase_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_number smallint not null,
  action text not null,
  from_status text,
  to_status text,
  user_id uuid references public.profiles (id) on delete set null,
  user_name text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);
create index on public.phase_history (project_id, created_at desc);

-- ---------------------------------------------------------------- posicionamento
create table public.movements (
  id uuid primary key default gen_random_uuid(),
  expert_id uuid not null references public.experts (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  name text not null,
  cover_url text,
  description text not null default '',
  category text not null default '',
  status text not null default 'rascunho' check (status in ('publicado', 'rascunho', 'desativado')),
  sort_order integer not null default 0,
  external_url text not null default '',
  expert_editable boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- páginas
create table public.page_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_custom boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  page_type_id uuid not null references public.page_types (id) on delete restrict,
  published_url text not null default '' check (published_url = '' or published_url ~* '^https?://'),
  edit_url text not null default '' check (edit_url = '' or edit_url ~* '^https?://'),
  tool text not null default '',
  owner text not null default '',
  status text not null default 'planejada' check (status in ('planejada', 'producao', 'revisao', 'publicada', 'pausada')),
  published_at date,
  conversion_goal numeric(6, 2) check (conversion_goal between 0 and 100),
  conversion_current numeric(6, 2) check (conversion_current between 0 and 100),
  notes text not null default '',
  preview_url text,
  archived boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- tráfego
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  ad_account_id uuid not null references public.ad_accounts (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  external_id text not null,
  name text not null,
  objective text not null default '',
  status text not null default '',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (ad_account_id, external_id)
);

create table public.ad_sets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  external_id text not null,
  name text not null,
  status text not null default '',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (campaign_id, external_id)
);

create table public.ads (
  id uuid primary key default gen_random_uuid(),
  ad_set_id uuid not null references public.ad_sets (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  external_id text not null,
  name text not null,
  status text not null default '',
  platform text not null default '',
  placement text not null default '',
  creative_type text not null default 'imagem' check (creative_type in ('imagem', 'video', 'carrossel')),
  thumbnail_url text,
  video_url text,
  primary_text text not null default '',
  headline text not null default '',
  description text not null default '',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (ad_account_id, external_id)
);
create index on public.ads (project_id);

-- Métricas no nível de anúncio, por dia. A unicidade impede duplicidade em sincronizações repetidas.
create table public.ad_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.ads (id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts (id) on delete cascade,
  date date not null,
  spend numeric(14, 2) not null default 0 check (spend >= 0),
  impressions bigint not null default 0,
  reach bigint not null default 0,
  link_clicks bigint not null default 0,
  leads integer not null default 0,
  purchases integer not null default 0,
  purchase_value numeric(14, 2) not null default 0,
  attribution_setting text not null default '',
  source text not null default 'meta' check (source in ('demo', 'meta', 'manual')),
  synced_at timestamptz not null default now(),
  is_demo boolean not null default false,
  unique (ad_id, date, source)
);
create index on public.ad_metrics_daily (date);

-- ---------------------------------------------------------------- financeiro
create table public.products (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  price numeric(14, 2) not null default 0 check (price >= 0),
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  order_ref text not null default '',
  sale_date date not null,
  gross_amount numeric(14, 2) not null check (gross_amount >= 0),
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  fees numeric(14, 2) not null default 0 check (fees >= 0),
  refund_amount numeric(14, 2) not null default 0 check (refund_amount >= 0),
  payment_method text not null default '',
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'reembolsada', 'cancelada')),
  origin text not null default '',
  notes text not null default '',
  external_source text,
  external_id text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- taxas do gateway normalmente não são devolvidas no reembolso: por isso ficam fora desta regra
  check (discount + refund_amount <= gross_amount),
  unique (external_source, external_id)
);
create index on public.sales (project_id, sale_date);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_traffic boolean not null default false
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  description text not null,
  category text not null,
  expense_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  payment_method text not null default '',
  status text not null default 'paga' check (status in ('pendente', 'paga', 'cancelada')),
  owner text not null default '',
  receipt_url text,
  notes text not null default '',
  ad_account_id uuid references public.ad_accounts (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.expenses (project_id, expense_date);

-- ---------------------------------------------------------------- tarefas
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_number smallint check (phase_number between 1 and 8),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  assignee text not null default '',
  priority text not null default 'media' check (priority in ('baixa', 'media', 'alta', 'urgente')),
  start_date date,
  due_date date,
  status text not null default 'a_fazer' check (status in ('a_fazer', 'andamento', 'revisao', 'concluida', 'bloqueada')),
  checklist jsonb not null default '[]',
  sort_order integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_name text not null default '',
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  phase_number smallint not null check (phase_number between 1 and 8),
  title text not null,
  description text not null default '',
  priority text not null default 'media' check (priority in ('baixa', 'media', 'alta', 'urgente')),
  checklist text[] not null default '{}',
  offset_days integer not null default 0 check (offset_days >= 0),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- arquivos, histórico e auditoria
create table public.files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  name text not null,
  url text not null,
  mime text not null default '',
  size bigint not null default 0,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete set null,
  expert_id uuid references public.experts (id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  summary text not null default '',
  user_id uuid references public.profiles (id) on delete set null,
  user_name text not null default '',
  is_audit boolean not null default false,
  data jsonb,
  created_at timestamptz not null default now()
);
create index on public.activity_log (project_id, created_at desc);
create index on public.activity_log (is_audit, created_at desc);

-- ---------------------------------------------------------------- seções dinâmicas
create table public.section_configs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9_]+$'),
  icon text not null default 'LayoutGrid',
  description text not null default '',
  menu_position integer not null default 20,
  roles text[] not null default '{admin}',
  project_id uuid references public.projects (id) on delete set null,
  expert_id uuid references public.experts (id) on delete set null,
  visible_to_expert boolean not null default false,
  expert_can_edit boolean not null default false,
  active boolean not null default true,
  fields jsonb not null default '[]' check (jsonb_typeof(fields) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.section_records (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.section_configs (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  expert_id uuid references public.experts (id) on delete set null,
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- triggers updated_at
do $$
declare t text;
begin
  foreach t in array array['app_settings','experts','projects','project_phases','movements','pages','sales','expenses','tasks','section_configs','section_records'] loop
    execute format('create trigger trg_touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;
