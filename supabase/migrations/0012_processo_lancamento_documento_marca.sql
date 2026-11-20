-- Processo de lançamento em 9 etapas (kanban por projeto) e Documento de Marca do Expert (V1)
-- respondido pelo próprio expert por um link estilo formulário, sem login.

-- ---------------------------------------------------------------- etapas do processo de lançamento
create table if not exists public.launch_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  stage_number smallint not null check (stage_number between 1 and 9),
  status text not null default 'a_fazer' check (status in ('a_fazer', 'andamento', 'concluida')),
  owner text not null default '',
  checklist jsonb not null default '[]' check (jsonb_typeof(checklist) = 'array'),
  notes text not null default '',
  links jsonb not null default '[]' check (jsonb_typeof(links) = 'array'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, stage_number)
);
alter table public.launch_stages enable row level security;
create policy admin_all on public.launch_stages for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy stages_read on public.launch_stages for select to authenticated using (public.can_access_project(project_id));
create policy stages_write on public.launch_stages for all to authenticated using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));
create trigger trg_touch before update on public.launch_stages for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- documento de marca do expert
create or replace function public.can_manage_expert(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.user_experts where expert_id = e and user_id = auth.uid() and can_manage_team)
$$;
revoke execute on function public.can_manage_expert(uuid) from public, anon;
grant execute on function public.can_manage_expert(uuid) to authenticated;

create table if not exists public.brand_docs (
  id uuid primary key default gen_random_uuid(),
  expert_id uuid not null unique references public.experts (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'pendente' check (status in ('pendente', 'rascunho', 'respondido')),
  answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  respondent_name text not null default '',
  submitted_at timestamptz,
  last_saved_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.brand_docs enable row level security;
create policy admin_all on public.brand_docs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy brand_read on public.brand_docs for select to authenticated using (public.can_access_expert(expert_id));
create policy brand_write on public.brand_docs for all to authenticated using (public.can_manage_expert(expert_id)) with check (public.can_manage_expert(expert_id));
create trigger trg_touch before update on public.brand_docs for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- formulário público (sem login, pelo token do link)
create or replace function public.public_brand_doc(token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'expert', coalesce(nullif(e.professional_name, ''), e.full_name), 'photo', e.photo_url,
    'status', d.status, 'answers', d.answers, 'respondent_name', d.respondent_name, 'submitted_at', d.submitted_at)
  from public.brand_docs d join public.experts e on e.id = d.expert_id
  where token is not null and d.token = public_brand_doc.token
$$;

-- Salva o rascunho (final = false) ou envia (final = true). Só aceita texto, com limite de tamanho.
create or replace function public.submit_brand_doc(token uuid, answers jsonb, respondent text, final boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  d public.brand_docs;
  clean jsonb := '{}';
  k text;
  v jsonb;
begin
  select * into d from public.brand_docs where brand_docs.token = submit_brand_doc.token;
  if d.id is null then raise exception 'Link inválido.' using errcode = '22023'; end if;
  if jsonb_typeof(answers) <> 'object' then raise exception 'Respostas inválidas.' using errcode = '22023'; end if;
  for k, v in select * from jsonb_each(answers) loop
    if k ~ '^[a-z0-9_]{1,40}$' and jsonb_typeof(v) = 'string' then
      clean := clean || jsonb_build_object(k, left(v #>> '{}', 8000));
    end if;
  end loop;
  if length(clean::text) > 200000 then raise exception 'Respostas muito longas.' using errcode = '22023'; end if;
  update public.brand_docs set
    answers = clean,
    respondent_name = left(coalesce(trim(respondent), ''), 120),
    status = case when final or brand_docs.status = 'respondido' then 'respondido' else 'rascunho' end,
    submitted_at = case when final then now() else brand_docs.submitted_at end,
    last_saved_at = now()
  where id = d.id;
  return case when final or d.status = 'respondido' then 'respondido' else 'rascunho' end;
end $$;

revoke all on function public.public_brand_doc(uuid), public.submit_brand_doc(uuid, jsonb, text, boolean) from public;
grant execute on function public.public_brand_doc(uuid), public.submit_brand_doc(uuid, jsonb, text, boolean) to anon, authenticated;

-- Atualização em tempo real do kanban e da chegada das respostas do formulário.
do $$ begin
  alter publication supabase_realtime add table public.launch_stages, public.brand_docs;
exception when others then null;
end $$;
