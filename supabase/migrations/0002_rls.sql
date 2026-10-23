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
