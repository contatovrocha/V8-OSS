-- Launch OS — instalação completa do banco (cole no SQL Editor do Supabase e clique em Run).
-- Gerado a partir de supabase/migrations/0001..0004. Execute uma única vez em um projeto novo.

-- ===================== supabase/migrations/0001_schema.sql
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

-- ===================== supabase/migrations/0002_rls.sql
-- Launch OS — políticas de acesso (RLS). A interface apenas reflete estas regras.

-- ---------------------------------------------------------------- funções auxiliares (SECURITY DEFINER evita recursão de RLS)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.my_expert_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select expert_id from public.user_experts where user_id = auth.uid()
$$;

create or replace function public.can_access_expert(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or e in (select public.my_expert_ids())
$$;

create or replace function public.can_access_project(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.projects pr where pr.id = p and pr.expert_id in (select public.my_expert_ids()))
$$;

create or replace function public.expert_perm(e uuid, key text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (permissions ->> key)::boolean from public.experts where id = e), false)
$$;

create or replace function public.module_visible(e uuid, module text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select permissions -> 'visible_modules' ? module from public.experts where id = e), false)
$$;

/** Expert do projeto pode ver o módulo (admin sempre pode). */
create or replace function public.project_module(p uuid, module text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.projects pr
    where pr.id = p and pr.expert_id in (select public.my_expert_ids()) and public.module_visible(pr.expert_id, module)
  )
$$;

create or replace function public.project_perm(p uuid, key text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = p and pr.expert_id in (select public.my_expert_ids()) and public.expert_perm(pr.expert_id, key)
  )
$$;

-- ---------------------------------------------------------------- habilitar RLS em todas as tabelas públicas
do $$
declare t text;
begin
  foreach t in array array['app_settings','profiles','experts','user_experts','ad_accounts','projects','project_phases','phase_history','movements',
    'page_types','pages','campaigns','ad_sets','ads','ad_metrics_daily','products','sales','expense_categories','expenses','tasks','task_comments',
    'task_templates','files','activity_log','section_configs','section_records'] loop
    execute format('alter table public.%I enable row level security', t);
    -- Administrador: acesso total.
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Schema privado inacessível a clientes.
revoke all on schema private from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;

-- ---------------------------------------------------------------- leitura geral de configuração
create policy read_settings on public.app_settings for select to authenticated using (true);
create policy read_page_types on public.page_types for select to authenticated using (true);
create policy read_categories on public.expense_categories for select to authenticated using (true);
create policy read_templates on public.task_templates for select to authenticated using (true);

-- ---------------------------------------------------------------- perfis e vínculos
create policy own_profile_read on public.profiles for select to authenticated using (id = auth.uid());
create policy own_profile_update on public.profiles for update to authenticated using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy own_links on public.user_experts for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------- experts
create policy expert_read on public.experts for select to authenticated using (id in (select public.my_expert_ids()));
-- A atualização é permitida pela RLS; o trigger guard_expert_update restringe colunas (permissões, foto, dados pessoais).
create policy expert_update on public.experts for update to authenticated using (id in (select public.my_expert_ids())) with check (id in (select public.my_expert_ids()));

-- ---------------------------------------------------------------- projetos e fases (somente leitura para expert)
create policy project_read on public.projects for select to authenticated using (expert_id in (select public.my_expert_ids()));
create policy phases_read on public.project_phases for select to authenticated using (public.can_access_project(project_id));
create policy phase_history_read on public.phase_history for select to authenticated using (public.can_access_project(project_id));

-- ---------------------------------------------------------------- movimentos
create policy movements_read on public.movements for select to authenticated
  using (expert_id in (select public.my_expert_ids()) and public.module_visible(expert_id, 'posicionamento') and (status = 'publicado' or expert_editable));
create policy movements_update on public.movements for update to authenticated
  using (expert_id in (select public.my_expert_ids()) and expert_editable and public.expert_perm(expert_id, 'can_edit_movements'))
  with check (expert_id in (select public.my_expert_ids()) and expert_editable);

-- ---------------------------------------------------------------- páginas
create policy pages_read on public.pages for select to authenticated using (public.project_module(project_id, 'paginas'));

-- ---------------------------------------------------------------- tráfego
create policy accounts_read on public.ad_accounts for select to authenticated
  using (exists (select 1 from public.projects p where p.ad_account_id = ad_accounts.id and public.project_module(p.id, 'trafego')));
create policy campaigns_read on public.campaigns for select to authenticated using (public.project_module(project_id, 'trafego'));
create policy adsets_read on public.ad_sets for select to authenticated
  using (exists (select 1 from public.campaigns c where c.id = ad_sets.campaign_id and public.project_module(c.project_id, 'trafego')));
create policy ads_read on public.ads for select to authenticated using (public.project_module(project_id, 'trafego'));
create policy metrics_read on public.ad_metrics_daily for select to authenticated
  using (exists (select 1 from public.ads a where a.id = ad_metrics_daily.ad_id and public.project_module(a.project_id, 'trafego')));

-- ---------------------------------------------------------------- financeiro (expert edita apenas com permissão explícita; nunca exclui)
create policy products_read on public.products for select to authenticated using (public.project_module(project_id, 'financeiro'));
create policy sales_read on public.sales for select to authenticated using (public.project_module(project_id, 'financeiro'));
create policy expenses_read on public.expenses for select to authenticated using (public.project_module(project_id, 'financeiro'));
create policy products_write on public.products for insert to authenticated with check (public.project_perm(project_id, 'can_edit_finance'));
create policy products_update on public.products for update to authenticated using (public.project_perm(project_id, 'can_edit_finance')) with check (public.project_perm(project_id, 'can_edit_finance'));
create policy sales_write on public.sales for insert to authenticated with check (public.project_perm(project_id, 'can_edit_finance'));
create policy sales_update on public.sales for update to authenticated using (public.project_perm(project_id, 'can_edit_finance')) with check (public.project_perm(project_id, 'can_edit_finance'));
create policy expenses_write on public.expenses for insert to authenticated with check (public.project_perm(project_id, 'can_edit_finance'));
create policy expenses_update on public.expenses for update to authenticated using (public.project_perm(project_id, 'can_edit_finance')) with check (public.project_perm(project_id, 'can_edit_finance'));

-- ---------------------------------------------------------------- tarefas
create policy tasks_read on public.tasks for select to authenticated using (public.project_module(project_id, 'tarefas'));
create policy tasks_insert on public.tasks for insert to authenticated with check (public.project_perm(project_id, 'can_edit_tasks'));
create policy tasks_update on public.tasks for update to authenticated using (public.project_perm(project_id, 'can_edit_tasks')) with check (public.project_perm(project_id, 'can_edit_tasks'));
create policy comments_read on public.task_comments for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_comments.task_id and public.project_module(t.project_id, 'tarefas')));
create policy comments_insert on public.task_comments for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.tasks t where t.id = task_comments.task_id and public.project_module(t.project_id, 'tarefas')));

-- ---------------------------------------------------------------- arquivos e histórico
create policy files_read on public.files for select to authenticated using (case when project_id is null then uploaded_by = auth.uid() else public.can_access_project(project_id) end);
create policy files_insert on public.files for insert to authenticated with check (uploaded_by = auth.uid() and (project_id is null or public.can_access_project(project_id)));
create policy activity_read on public.activity_log for select to authenticated
  using (not is_audit and ((project_id is not null and public.can_access_project(project_id)) or (expert_id is not null and expert_id in (select public.my_expert_ids()))));

-- ---------------------------------------------------------------- seções dinâmicas
create policy sections_read on public.section_configs for select to authenticated
  using (active and visible_to_expert and 'expert' = any (roles)
    and (expert_id is null or expert_id in (select public.my_expert_ids()))
    and (project_id is null or public.can_access_project(project_id)));
create policy records_read on public.section_records for select to authenticated
  using (exists (select 1 from public.section_configs s where s.id = section_id and s.active and s.visible_to_expert and 'expert' = any (s.roles))
    and ((expert_id is not null and expert_id in (select public.my_expert_ids())) or (expert_id is null and project_id is not null and public.can_access_project(project_id))));
create policy records_insert on public.section_records for insert to authenticated
  with check (exists (select 1 from public.section_configs s where s.id = section_id and s.expert_can_edit and s.visible_to_expert)
    and ((expert_id is not null and expert_id in (select public.my_expert_ids())) or (project_id is not null and public.can_access_project(project_id))));
create policy records_update on public.section_records for update to authenticated
  using (exists (select 1 from public.section_configs s where s.id = section_id and s.expert_can_edit and s.visible_to_expert)
    and ((expert_id is not null and expert_id in (select public.my_expert_ids())) or (project_id is not null and public.can_access_project(project_id))));

-- ---------------------------------------------------------------- storage (imagens e arquivos)
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
create policy media_read on storage.objects for select to authenticated using (bucket_id = 'media');
create policy media_insert on storage.objects for insert to authenticated with check (bucket_id = 'media');
create policy media_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- ---------------------------------------------------------------- realtime
alter publication supabase_realtime add table public.projects, public.project_phases, public.phase_history, public.tasks, public.pages,
  public.sales, public.expenses, public.movements, public.experts, public.section_configs, public.section_records, public.app_settings;

-- ===================== supabase/migrations/0003_functions.sql
-- Launch OS — regras de negócio no servidor (triggers e RPCs)

-- ---------------------------------------------------------------- perfil automático para novos usuários
-- O primeiro usuário do sistema torna-se administrador; os demais nascem como expert, sem acesso a
-- nenhum expert até o administrador vinculá-los. O papel nunca vem dos metadados do cadastro
-- (que qualquer pessoa pode preencher); só o administrador promove usuários.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r text := 'expert';
begin
  if not exists (select 1 from public.profiles) then r := 'admin'; end if;
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), r);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- restrições de colunas para experts
create or replace function public.guard_expert_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or auth.uid() is null then return new; end if;
  if new.permissions is distinct from old.permissions or new.is_demo is distinct from old.is_demo then
    raise exception 'Somente administradores alteram permissões.' using errcode = '42501';
  end if;
  if new.photo_url is distinct from old.photo_url and not (old.permissions ->> 'can_upload_photo')::boolean then
    raise exception 'Alteração de fotografia não autorizada para o seu perfil.' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'photo_url' - 'updated_at') is distinct from (to_jsonb(old) - 'photo_url' - 'updated_at')
     and not (old.permissions ->> 'can_edit_profile')::boolean then
    raise exception 'Edição de dados pessoais não autorizada para o seu perfil.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_guard_expert before update on public.experts for each row execute function public.guard_expert_update();

-- Movimentos: expert só altera o conteúdo, nunca vínculo, status ou permissão de edição.
create or replace function public.guard_movement_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if new.expert_id <> old.expert_id or new.project_id is distinct from old.project_id or new.status <> old.status
     or new.expert_editable <> old.expert_editable or new.sort_order <> old.sort_order then
    raise exception 'Alteração não autorizada para o seu perfil.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_guard_movement before update on public.movements for each row execute function public.guard_movement_update();

-- ---------------------------------------------------------------- fases criadas junto com o projeto
create or replace function public.ensure_phases() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Projetos demonstrativos recebem as fases do seed (src/data/seed.ts).
  if new.is_demo then return new; end if;
  insert into public.project_phases (project_id, phase_number, status)
  select new.id, n, case when n = 1 then 'disponivel' else 'bloqueada' end from generate_series(1, 8) n
  on conflict (project_id, phase_number) do nothing;
  return new;
end $$;
create trigger trg_project_phases after insert on public.projects for each row execute function public.ensure_phases();

-- ---------------------------------------------------------------- validação de registros dinâmicos (mesma regra de src/lib/sections.ts)
create or replace function public.validate_section_record() returns trigger
language plpgsql as $$
declare
  f jsonb;
  k text;
  t text;
  v jsonb;
  opts jsonb;
begin
  for f in select * from jsonb_array_elements((select fields from public.section_configs where id = new.section_id)) loop
    k := f ->> 'key';
    t := f ->> 'type';
    v := new.data -> k;
    opts := coalesce(f -> 'options', '[]');
    if v is null or v = 'null'::jsonb or v = '""'::jsonb or v = '[]'::jsonb then
      if (f ->> 'required')::boolean then raise exception '% é obrigatório', f ->> 'label' using errcode = '23514'; end if;
      continue;
    end if;
    if t in ('number', 'currency') and jsonb_typeof(v) <> 'number' then raise exception '% deve ser um número', f ->> 'label' using errcode = '23514'; end if;
    if t = 'date' and (v #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception '%: data inválida', f ->> 'label' using errcode = '23514'; end if;
    if t in ('url', 'image', 'file') and (v #>> '{}') !~ '^(https?://|/)' then raise exception '%: endereço inválido', f ->> 'label' using errcode = '23514'; end if;
    if t in ('select', 'status') and jsonb_array_length(opts) > 0 and not opts ? (v #>> '{}') then raise exception '%: opção inválida', f ->> 'label' using errcode = '23514'; end if;
    if t = 'multiselect' and (jsonb_typeof(v) <> 'array' or exists (select 1 from jsonb_array_elements_text(v) x where jsonb_array_length(opts) > 0 and not opts ? x)) then
      raise exception '%: opções inválidas', f ->> 'label' using errcode = '23514';
    end if;
    if t = 'checkbox' and jsonb_typeof(v) <> 'boolean' then raise exception '%: valor inválido', f ->> 'label' using errcode = '23514'; end if;
  end loop;
  return new;
end $$;
create trigger trg_validate_record before insert or update on public.section_records for each row execute function public.validate_section_record();

-- ---------------------------------------------------------------- histórico de atividades e auditoria (espelha src/data/activity.ts)
create or replace function public.log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  prev jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  label text := case tg_table_name when 'projects' then 'Projeto' when 'pages' then 'Página' when 'tasks' then 'Tarefa' when 'sales' then 'Venda'
    when 'expenses' then 'Despesa' when 'products' then 'Produto' when 'movements' then 'Movimento' when 'files' then 'Arquivo' when 'experts' then 'Expert'
    when 'section_records' then 'Registro' when 'section_configs' then 'Seção' when 'user_experts' then 'Vínculo de acesso' when 'ad_accounts' then 'Conta de anúncios' else tg_table_name end;
  op text := lower(tg_op);
  verb text := case tg_op when 'INSERT' then 'criado(a)' when 'UPDATE' then 'atualizado(a)' else 'excluído(a)' end;
  nm text := left(coalesce(rec ->> 'name', rec ->> 'title', rec ->> 'description', rec ->> 'order_ref', rec ->> 'full_name', ''), 80);
  pid uuid := case when tg_table_name = 'projects' then (rec ->> 'id')::uuid else (rec ->> 'project_id')::uuid end;
  eid uuid := coalesce((rec ->> 'expert_id')::uuid, (select expert_id from public.projects where id = pid), case when tg_table_name = 'experts' then (rec ->> 'id')::uuid end);
  summary text := label || ' ' || verb || ': ' || nm;
  audit boolean := tg_table_name in ('sales', 'expenses', 'products', 'user_experts', 'ad_accounts') or tg_op = 'DELETE';
  changed text[];
  uname text := coalesce((select full_name from public.profiles where id = auth.uid()), 'Sistema');
begin
  if tg_op = 'UPDATE' then
    select array_agg(key) into changed from jsonb_each(rec) e where key <> 'updated_at' and e.value is distinct from prev -> key;
    if changed is null then return new; end if;
    if tg_table_name = 'projects' and 'status' = any (changed) then summary := 'Status do projeto alterado: ' || (prev ->> 'status') || ' → ' || (rec ->> 'status'); end if;
    if tg_table_name = 'projects' and 'archived' = any (changed) then summary := case when (rec ->> 'archived')::boolean then 'Projeto arquivado: ' else 'Projeto restaurado: ' end || nm; end if;
    if tg_table_name in ('tasks', 'pages') and 'status' = any (changed) then summary := label || ' "' || nm || '": ' || (prev ->> 'status') || ' → ' || (rec ->> 'status'); end if;
    if tg_table_name = 'experts' and 'permissions' = any (changed) then summary := 'Permissões alteradas: ' || nm; audit := true; end if;
  end if;
  if tg_table_name = 'projects' and tg_op = 'DELETE' then pid := null; end if;
  -- Exclusões em cascata: o projeto/expert pai pode já não existir.
  if pid is not null and not exists (select 1 from public.projects where id = pid) then pid := null; end if;
  if eid is not null and not exists (select 1 from public.experts where id = eid) then eid := null; end if;
  insert into public.activity_log (project_id, expert_id, entity_type, entity_id, action, summary, user_id, user_name, is_audit, data)
  values (pid, eid, tg_table_name, (rec ->> 'id')::uuid, op, summary, auth.uid(), uname, audit,
    jsonb_strip_nulls(jsonb_build_object('changed', changed, 'amount', coalesce(rec -> 'gross_amount', rec -> 'amount'), 'before', case when tg_table_name = 'experts' then prev -> 'permissions' else coalesce(prev -> 'gross_amount', prev -> 'amount') end)));
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['projects','pages','tasks','sales','expenses','products','movements','files','experts','section_records','section_configs','user_experts','ad_accounts'] loop
    execute format('create trigger trg_log after insert or update or delete on public.%I for each row execute function public.log_activity()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- RPC: alterar status de fase (mesma regra de src/lib/phases.ts)
create or replace function public.set_phase_status(project_id uuid, phase_number int, action text, note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.projects;
  target public.project_phases;
  rule text := coalesce((select phase_transition_rule from public.app_settings limit 1), 'next_available');
  cur int;
  pending text;
  exc text;
  nxt int;
  frontier int;
  before jsonb;
  r record;
  uname text := coalesce((select full_name from public.profiles where id = auth.uid()), '');
  verb text;
begin
  select * into p from public.projects where id = set_phase_status.project_id for update;
  if not found or not public.can_access_project(p.id) then raise exception 'Projeto não encontrado.' using errcode = 'P0002'; end if;
  if not public.is_admin() and not public.expert_perm(p.expert_id, 'can_manage_phases') then
    raise exception 'Somente a administração pode alterar fases estratégicas.' using errcode = '42501';
  end if;
  if action not in ('start', 'complete', 'reopen') then raise exception 'Ação inválida.'; end if;
  select * into target from public.project_phases ph where ph.project_id = p.id and ph.phase_number = set_phase_status.phase_number;
  if not found then raise exception 'Fase V% não encontrada.', phase_number; end if;

  select jsonb_object_agg(ph.phase_number, ph.status) into before from public.project_phases ph where ph.project_id = p.id;
  select string_agg('V' || ph.phase_number, ', ' order by ph.phase_number) into pending
    from public.project_phases ph where ph.project_id = p.id and ph.phase_number < set_phase_status.phase_number and ph.status <> 'concluida';
  cur := p.current_phase;

  if action = 'start' then
    if target.status = 'concluida' then raise exception 'A fase já está concluída. Reabra-a antes de iniciar novamente.'; end if;
    if pending is not null then exc := 'Fase iniciada com ' || pending || ' ainda não concluída(s)'; end if;
    update public.project_phases ph set status = 'disponivel' where ph.project_id = p.id and ph.status = 'andamento' and ph.phase_number <> set_phase_status.phase_number;
    update public.project_phases ph set status = 'andamento', started_at = coalesce(ph.started_at, now()) where ph.id = target.id;
    cur := phase_number;
  elsif action = 'complete' then
    if target.status = 'concluida' then raise exception 'A fase já está concluída.'; end if;
    if pending is not null then exc := 'Conclusão fora de ordem: ' || pending || ' permanece(m) pendente(s)'; end if;
    update public.project_phases ph set status = 'concluida', started_at = coalesce(ph.started_at, now()), completed_at = now(), completed_by = auth.uid() where ph.id = target.id;
    if cur = phase_number or cur is null then
      cur := null;
      if rule = 'next_available' then
        select ph.phase_number into cur from public.project_phases ph where ph.project_id = p.id and ph.status = 'andamento' limit 1;
        if cur is null then
          select min(ph.phase_number) into nxt from public.project_phases ph where ph.project_id = p.id and ph.phase_number > set_phase_status.phase_number and ph.status not in ('concluida', 'andamento');
          if nxt is not null then
            update public.project_phases ph set status = 'andamento', started_at = coalesce(ph.started_at, now()) where ph.project_id = p.id and ph.phase_number = nxt;
            cur := nxt;
          end if;
        end if;
      end if;
    end if;
  else
    if target.status <> 'concluida' then raise exception 'Somente fases concluídas podem ser reabertas.'; end if;
    update public.project_phases ph set status = 'disponivel', completed_at = null, completed_by = null where ph.id = target.id;
  end if;

  -- recalcula bloqueada/disponível
  select coalesce(max(ph.phase_number), 0) into frontier from public.project_phases ph where ph.project_id = p.id and ph.status in ('concluida', 'andamento');
  update public.project_phases ph set status = case
      when ph.phase_number = frontier + 1 or not exists (select 1 from public.project_phases q where q.project_id = p.id and q.phase_number < ph.phase_number and q.status <> 'concluida')
      then 'disponivel' else 'bloqueada' end
    where ph.project_id = p.id and ph.status in ('bloqueada', 'disponivel');

  update public.projects set current_phase = cur where id = p.id;

  for r in select ph.phase_number as n, ph.status as s from public.project_phases ph where ph.project_id = p.id and ph.status <> (before ->> ph.phase_number::text) loop
    insert into public.phase_history (project_id, phase_number, action, from_status, to_status, user_id, user_name, note)
    values (p.id, r.n, case when r.n = phase_number then action else 'auto' end, before ->> r.n::text, r.s, auth.uid(), uname,
      case when r.n = phase_number then concat_ws(' · ', nullif(note, ''), 'Exceção administrativa: ' || exc) else 'Transição automática' end);
  end loop;

  verb := case action when 'complete' then 'concluída' when 'start' then 'iniciada' else 'reaberta' end;
  insert into public.activity_log (project_id, expert_id, entity_type, entity_id, action, summary, user_id, user_name, is_audit, data)
  values (p.id, p.expert_id, 'project_phases', p.id, 'phase_' || action, 'Fase V' || phase_number || ' ' || verb || case when exc is not null then ' (exceção administrativa)' else '' end,
    auth.uid(), uname, true, jsonb_build_object('exception', exc));
  return jsonb_build_object('current_phase', cur);
end $$;

-- ---------------------------------------------------------------- RPC: excluir projeto (bloqueia se houver dados financeiros)
create or replace function public.delete_project(project_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  p public.projects;
  ns int; ne int; nc int;
begin
  if not public.is_admin() then raise exception 'Somente administradores podem excluir projetos.' using errcode = '42501'; end if;
  select * into p from public.projects where id = project_id;
  if not found then raise exception 'Projeto não encontrado.'; end if;
  select count(*) into ns from public.sales s where s.project_id = p.id;
  select count(*) into ne from public.expenses e where e.project_id = p.id;
  select count(*) into nc from public.campaigns c where c.project_id = p.id;
  if ns + ne + nc > 0 then
    raise exception 'O projeto possui % venda(s), % despesa(s) e % campanha(s) vinculadas. Arquive-o para preservar a consistência financeira.', ns, ne, nc using errcode = '23503';
  end if;
  delete from public.projects where id = p.id;
end $$;

-- ---------------------------------------------------------------- RPC: duplicar projeto (estrutura, sem vendas/despesas/resultados)
create or replace function public.duplicate_project(project_id uuid, name text default null) returns public.projects
language plpgsql security definer set search_path = public as $$
declare
  src public.projects;
  dst public.projects;
begin
  if not public.is_admin() then raise exception 'Somente administradores podem duplicar projetos.' using errcode = '42501'; end if;
  select * into src from public.projects where id = project_id;
  if not found then raise exception 'Projeto não encontrado.'; end if;
  insert into public.projects (expert_id, name, description, category, launch_type, start_date, end_date, event_date, revenue_goal, sales_goal, traffic_budget,
    status, cover_url, links, internal_notes, team, ad_account_id)
  values (src.expert_id, coalesce(name, src.name || ' (cópia)'), src.description, src.category, src.launch_type, src.start_date, src.end_date, src.event_date,
    src.revenue_goal, src.sales_goal, src.traffic_budget, 'estruturacao', src.cover_url, src.links, src.internal_notes, src.team, src.ad_account_id)
  returning * into dst;
  insert into public.pages (project_id, name, page_type_id, published_url, edit_url, tool, owner, status, conversion_goal, notes, preview_url)
    select dst.id, pg.name, pg.page_type_id, pg.published_url, pg.edit_url, pg.tool, pg.owner, 'planejada', pg.conversion_goal, pg.notes, pg.preview_url from public.pages pg where pg.project_id = src.id;
  insert into public.tasks (project_id, phase_number, title, description, assignee, priority, start_date, due_date, status, checklist, sort_order)
    select dst.id, t.phase_number, t.title, t.description, t.assignee, t.priority, t.start_date, t.due_date, 'a_fazer',
      coalesce((select jsonb_agg(c || '{"done":false}') from jsonb_array_elements(t.checklist) c), '[]'), t.sort_order from public.tasks t where t.project_id = src.id;
  insert into public.products (project_id, name, price, active) select dst.id, pr.name, pr.price, pr.active from public.products pr where pr.project_id = src.id;
  return dst;
end $$;

-- ---------------------------------------------------------------- RPC: restaurar demonstração (remove só registros is_demo)
-- 1ª chamada: guarda os vínculos de usuários com experts demonstrativos e apaga os dados demo.
-- O cliente então reinsere os dados de src/data/seed.ts (IDs estáveis) e chama com relink_only = true.
create or replace function public.purge_demo_data(relink_only boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Somente administradores podem restaurar a demonstração.' using errcode = '42501'; end if;
  if relink_only then
    insert into public.user_experts (user_id, expert_id) select user_id, expert_id from private.demo_links
      where exists (select 1 from public.experts e where e.id = expert_id) on conflict do nothing;
    delete from private.demo_links;
    insert into public.activity_log (entity_type, action, summary, user_id, user_name, is_audit)
      values ('demo', 'reset_demo', 'Dados demonstrativos restaurados', auth.uid(), coalesce((select full_name from public.profiles where id = auth.uid()), ''), true);
    return;
  end if;
  delete from private.demo_links;
  insert into private.demo_links select ue.user_id, ue.expert_id from public.user_experts ue join public.experts e on e.id = ue.expert_id where e.is_demo;
  delete from public.section_configs where id::text like 'd0000000-%';
  delete from public.activity_log where id::text like 'd0000000-%';
  delete from public.sales where is_demo;
  delete from public.expenses where is_demo;
  delete from public.ad_metrics_daily where is_demo;
  delete from public.ads where is_demo;
  delete from public.ad_sets where is_demo;
  delete from public.campaigns where is_demo;
  delete from public.products where is_demo;
  delete from public.tasks where is_demo;
  delete from public.pages where is_demo;
  delete from public.movements where is_demo;
  -- projetos demo: limpa dependências reais que apontem para eles antes de remover
  delete from public.files where project_id in (select id from public.projects where is_demo);
  update public.section_records set project_id = null where project_id in (select id from public.projects where is_demo);
  delete from public.sales where project_id in (select id from public.projects where is_demo);
  delete from public.expenses where project_id in (select id from public.projects where is_demo);
  delete from public.projects where is_demo;
  delete from public.ad_accounts where is_demo;
  delete from public.experts where is_demo;
end $$;

-- ---------------------------------------------------------------- configuração base (IDs iguais aos de src/data/seed.ts)
insert into public.app_settings (id) values ('c2000000-0000-4000-8000-000000000001') on conflict do nothing;

insert into public.page_types (id, name, is_custom) values
  ('c0000000-0000-4000-8000-000000000001', 'Página de captura', false),
  ('c0000000-0000-4000-8000-000000000002', 'Página de vendas', false),
  ('c0000000-0000-4000-8000-000000000003', 'Página de inscrição', false),
  ('c0000000-0000-4000-8000-000000000004', 'Página de checkout', false),
  ('c0000000-0000-4000-8000-000000000005', 'Página de confirmação', false),
  ('c0000000-0000-4000-8000-000000000006', 'Página de obrigado', false),
  ('c0000000-0000-4000-8000-000000000007', 'Página de aplicação', false),
  ('c0000000-0000-4000-8000-000000000008', 'Página de evento', false)
on conflict do nothing;

insert into public.expense_categories (id, name, is_traffic) values
  ('c1000000-0000-4000-8000-000000000001', 'Tráfego pago', true),
  ('c1000000-0000-4000-8000-000000000002', 'Produção', false),
  ('c1000000-0000-4000-8000-000000000003', 'Design', false),
  ('c1000000-0000-4000-8000-000000000004', 'Copywriting', false),
  ('c1000000-0000-4000-8000-000000000005', 'Ferramentas', false),
  ('c1000000-0000-4000-8000-000000000006', 'Equipe', false),
  ('c1000000-0000-4000-8000-000000000007', 'Estrutura do evento', false),
  ('c1000000-0000-4000-8000-000000000008', 'Alimentação e hospedagem', false),
  ('c1000000-0000-4000-8000-000000000009', 'Taxas', false),
  ('c1000000-0000-4000-8000-000000000010', 'Outros', false)
on conflict do nothing;

insert into public.task_templates (phase_number, title, description, priority, checklist, offset_days) values
  (1, 'Entrevista de posicionamento', 'Sessão para mapear história, autoridade e diferenciais do expert.', 'alta', '{"Agendar sessão","Gravar entrevista","Transcrever"}', 1),
  (1, 'Documento de narrativa', 'Consolidar proposta de valor, público e narrativa.', 'media', '{"Proposta de valor","Público-alvo","Diferenciais"}', 5),
  (2, 'Mapa da escada de ofertas', 'Definir produtos, preços e entregáveis.', 'alta', '{"Produto de entrada","Produto principal","Upsell"}', 3),
  (3, 'Página de captura', 'Estruturar e publicar a página de captação.', 'alta', '{"Copy","Design","Pixel e eventos"}', 4),
  (3, 'Campanha de captação', 'Configurar campanha de leads no Meta Ads.', 'media', '{"Públicos","Criativos","Orçamento"}', 6),
  (4, 'Abertura de vendas', 'Abrir checkout e acompanhar primeiras vendas.', 'urgente', '{"Checkout testado","Script comercial"}', 2),
  (5, 'Análise de compradores', 'Levantar perfil dos compradores para refinar o ICP.', 'media', '{"Exportar compradores","Entrevistas"}', 5),
  (6, 'Públicos qualificados', 'Criar públicos semelhantes a compradores.', 'media', '{"Lookalike 1%","Exclusões"}', 3),
  (7, 'Roteiro do funil 7D', 'Planejar os sete dias do funil de escala.', 'media', '{"Dia 1 a 7 roteirizados"}', 4),
  (8, 'Rodada de otimização', 'Revisar criativos, páginas e taxa de conversão.', 'media', '{"Criativos","Páginas","Ofertas"}', 7);

grant execute on function public.set_phase_status, public.delete_project, public.duplicate_project, public.purge_demo_data to authenticated;

-- ===================== supabase/migrations/0004_integration_rpc.sql
-- Acesso ao schema privado somente pelas Edge Functions (service_role). Clientes não executam estas funções.
create or replace function public.meta_put_state(p_state text, p_user uuid, p_redirect text) returns void
language sql security definer set search_path = public, private as $$
  delete from private.oauth_states where created_at < now() - interval '1 hour';
  insert into private.oauth_states (state, user_id, redirect_to) values (p_state, p_user, p_redirect);
$$;

create or replace function public.meta_take_state(p_state text) returns table (user_id uuid, redirect_to text)
language sql security definer set search_path = public, private as $$
  delete from private.oauth_states where state = p_state and created_at > now() - interval '1 hour' returning user_id, redirect_to;
$$;

create or replace function public.meta_save_token(p_account uuid, p_token text, p_expires timestamptz, p_meta_user text) returns void
language sql security definer set search_path = public, private as $$
  insert into private.integration_tokens (ad_account_id, access_token, expires_at, meta_user_id, updated_at)
  values (p_account, p_token, p_expires, p_meta_user, now())
  on conflict (ad_account_id) do update set access_token = excluded.access_token, expires_at = excluded.expires_at, meta_user_id = excluded.meta_user_id, updated_at = now();
$$;

create or replace function public.meta_get_token(p_account uuid) returns table (access_token text, expires_at timestamptz)
language sql security definer set search_path = public, private as $$
  select access_token, expires_at from private.integration_tokens where ad_account_id = p_account;
$$;

revoke execute on function public.meta_put_state, public.meta_take_state, public.meta_save_token, public.meta_get_token from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.meta_put_state, public.meta_take_state, public.meta_save_token, public.meta_get_token to service_role;
  end if;
end $$;
