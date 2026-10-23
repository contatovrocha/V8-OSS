-- Launch OS — regras de negócio no servidor (triggers e RPCs)

-- ---------------------------------------------------------------- perfil automático para novos usuários
-- O primeiro usuário do sistema torna-se administrador; os demais são criados como expert
-- (ou com o papel definido pela função admin-create-user em raw_user_meta_data).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r text := coalesce(new.raw_user_meta_data ->> 'role', 'expert');
begin
  if not exists (select 1 from public.profiles) then r := 'admin'; end if;
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), case when r in ('admin', 'expert') then r else 'expert' end);
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
