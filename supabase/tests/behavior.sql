-- Testes de comportamento das regras de servidor (executar após stubs + migrações).
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(u::text, ''), false) $$;
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FALHOU: %', msg; end if; raise notice 'OK: %', msg; end $$;

-- usuários: o primeiro vira admin
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@x.com', '{"full_name":"Admin"}'),
  ('00000000-0000-0000-0000-00000000000b', 'rafa@x.com', '{"full_name":"Rafael"}'),
  ('00000000-0000-0000-0000-00000000000c', 'cami@x.com', '{"full_name":"Camila"}');
select pg_temp.assert((select role from profiles where email = 'admin@x.com') = 'admin', 'primeiro usuário é admin');
select pg_temp.assert((select role from profiles where email = 'rafa@x.com') = 'expert', 'demais usuários são expert');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
insert into experts (id, full_name) values ('10000000-0000-0000-0000-000000000001', 'Rafael'), ('10000000-0000-0000-0000-000000000002', 'Camila');
insert into user_experts (user_id, expert_id) values ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000002');
insert into projects (id, expert_id, name, status) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Jantar', 'ativo'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Imersão', 'ativo');
select pg_temp.assert((select count(*) from project_phases where project_id = '20000000-0000-0000-0000-000000000001') = 8, '8 fases criadas com o projeto');

-- escada: conclui V1, V2, inicia V3 → 25%
select set_phase_status('20000000-0000-0000-0000-000000000001', 1, 'complete');
select set_phase_status('20000000-0000-0000-0000-000000000001', 2, 'complete');
select pg_temp.assert((select count(*) from project_phases where project_id = '20000000-0000-0000-0000-000000000001' and status = 'concluida') * 100.0 / 8 = 25, 'progresso 25%');
select pg_temp.assert((select current_phase from projects where id = '20000000-0000-0000-0000-000000000001') = 3, 'V3 é a fase atual (regra next_available)');
select pg_temp.assert((select status from project_phases where project_id = '20000000-0000-0000-0000-000000000001' and phase_number = 4) = 'disponivel', 'V4 disponível');
select pg_temp.assert((select status from project_phases where project_id = '20000000-0000-0000-0000-000000000001' and phase_number = 5) = 'bloqueada', 'V5 bloqueada');
select set_phase_status('20000000-0000-0000-0000-000000000001', 3, 'complete');
select pg_temp.assert((select count(*) from project_phases where project_id = '20000000-0000-0000-0000-000000000001' and status = 'concluida') * 100.0 / 8 = 37.5, 'progresso 37,5% após concluir V3');
select pg_temp.assert((select completed_by from project_phases where project_id = '20000000-0000-0000-0000-000000000001' and phase_number = 3) = '00000000-0000-0000-0000-00000000000a', 'registra quem concluiu');
select pg_temp.assert((select count(*) from phase_history where project_id = '20000000-0000-0000-0000-000000000001') >= 5, 'histórico de fases registrado');
select pg_temp.assert((select count(*) from activity_log where action = 'phase_complete' and is_audit) = 3, 'auditoria de conclusão de fases');
-- conclusão fora de ordem não conclui anteriores
select set_phase_status('20000000-0000-0000-0000-000000000001', 7, 'complete');
select pg_temp.assert((select status from project_phases where project_id = '20000000-0000-0000-0000-000000000001' and phase_number = 5) <> 'concluida', 'V5 não concluída automaticamente');
select pg_temp.assert((select note from phase_history where phase_number = 7 and to_status = 'concluida') like '%Exceção administrativa%', 'exceção registrada');
select set_phase_status('20000000-0000-0000-0000-000000000001', 7, 'reopen');
select pg_temp.assert((select count(*) from project_phases where project_id = '20000000-0000-0000-0000-000000000001' and status = 'concluida') = 3, 'reabrir recalcula');

-- financeiro
insert into products (id, project_id, name, price) values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Ingresso', 497),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Ingresso B', 597);
insert into sales (project_id, product_id, sale_date, gross_amount, status, external_source, external_id) values
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', current_date, 497, 'aprovada', 'csv', 'P1'),
  ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', current_date, 597, 'aprovada', null, null);
do $$ begin
  insert into sales (project_id, product_id, sale_date, gross_amount, status, external_source, external_id) values
    ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', current_date, 497, 'aprovada', 'csv', 'P1');
  raise exception 'FALHOU: venda duplicada aceita';
exception when unique_violation then raise notice 'OK: importação duplicada bloqueada'; end $$;
do $$ begin
  perform delete_project('20000000-0000-0000-0000-000000000001');
  raise exception 'FALHOU: projeto com vendas excluído';
exception when foreign_key_violation then raise notice 'OK: exclusão bloqueada por dependência financeira'; end $$;
select pg_temp.assert((select count(*) from activity_log where entity_type = 'sales' and is_audit) = 2, 'auditoria de alterações financeiras');

-- seções dinâmicas validadas no servidor
insert into section_configs (id, name, slug, roles, visible_to_expert, fields) values ('40000000-0000-0000-0000-000000000001', 'Parceiros', 'parceiros', '{admin,expert}', true,
  '[{"key":"nome","label":"Nome","type":"text","required":true,"options":[]},{"key":"tipo","label":"Tipo","type":"select","required":false,"options":["A","B"]}]');
do $$ begin
  insert into section_records (section_id, data) values ('40000000-0000-0000-0000-000000000001', '{"tipo":"A"}');
  raise exception 'FALHOU: obrigatório ignorado';
exception when check_violation then raise notice 'OK: campo obrigatório validado no servidor'; end $$;
do $$ begin
  insert into section_records (section_id, data) values ('40000000-0000-0000-0000-000000000001', '{"nome":"x","tipo":"Z"}');
  raise exception 'FALHOU: opção inválida aceita';
exception when check_violation then raise notice 'OK: opção inválida rejeitada'; end $$;
insert into section_records (section_id, expert_id, data) values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '{"nome":"Parceiro","tipo":"A"}');

-- duplicar projeto sem copiar vendas
select pg_temp.assert((select (duplicate_project('20000000-0000-0000-0000-000000000001')).name) = 'Jantar (cópia)', 'duplicação');
select pg_temp.assert((select count(*) from sales s join projects p on p.id = s.project_id where p.name = 'Jantar (cópia)') = 0, 'duplicação não copia vendas');

-- ======== perfil expert (RLS)
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.assert((select count(*) from projects) = 2, 'expert vê apenas os próprios projetos (original + cópia)');
select pg_temp.assert((select count(*) from projects where name = 'Imersão') = 0, 'expert não vê projeto de outro expert');
select pg_temp.assert((select count(*) from experts) = 1, 'expert não vê outro expert');
select pg_temp.assert((select count(*) from sales) = 1, 'expert não vê vendas de outro expert');
select pg_temp.assert((select count(*) from activity_log where is_audit) = 0, 'expert não lê auditoria');
select pg_temp.assert((select count(*) from section_records) = 1, 'expert vê registro dinâmico próprio');
with u as (update project_phases set status = 'concluida' where phase_number = 4 returning 1) select pg_temp.assert((select count(*) from u) = 0, 'expert não altera fases diretamente');
do $$ begin
  perform set_phase_status('20000000-0000-0000-0000-000000000001', 4, 'complete');
  raise exception 'FALHOU: expert concluiu fase';
exception when insufficient_privilege then raise notice 'OK: expert não conclui fase via RPC'; end $$;
with u as (update sales set gross_amount = 1 returning 1) select pg_temp.assert((select count(*) from u) = 0, 'expert não edita valores financeiros');
with u as (delete from projects returning 1) select pg_temp.assert((select count(*) from u) = 0, 'expert não exclui projetos');
do $$ begin
  update experts set permissions = permissions || '{"can_edit_finance":true}';
  raise exception 'FALHOU: expert alterou permissões';
exception when insufficient_privilege then raise notice 'OK: expert não altera as próprias permissões'; end $$;
update experts set bio = 'Nova bio';
select pg_temp.assert((select bio from experts) = 'Nova bio', 'expert edita dados pessoais autorizados');
-- permissão de módulo: oculta financeiro
reset role;
select pg_temp.as_user(null);
update experts set permissions = jsonb_set(permissions, '{visible_modules}', '["visao_geral","projetos"]') where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.assert((select count(*) from sales) = 0, 'módulo financeiro oculto bloqueia leitura de vendas');
reset role;
\echo TODOS OS TESTES SQL PASSARAM
