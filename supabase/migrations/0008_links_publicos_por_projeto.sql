-- Cada link público mostra a galeria de UM projeto (project_id) ou, em seções sem projeto, a seção inteira.
create table if not exists public.section_shares (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.section_configs (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create unique index if not exists section_shares_one_per_scope on public.section_shares (section_id, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid));
alter table public.section_shares enable row level security;
drop policy if exists admin_all on public.section_shares;
create policy admin_all on public.section_shares for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Links antigos (seção inteira): mantidos só em seções sem registros de projeto (ex.: Agenda).
insert into public.section_shares (section_id, project_id, token)
select c.id, null, c.share_token from public.section_configs c
where c.share_token is not null
  and not exists (select 1 from public.section_records r where r.section_id = c.id and r.project_id is not null)
on conflict do nothing;
update public.section_configs set share_token = null where share_token is not null;

create or replace function public.public_section_gallery(token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', c.name, 'description', c.description, 'icon', c.icon, 'fields', c.fields,
    'project', p.name, 'expert', e.full_name,
    'records', coalesce((select jsonb_agg(r.data order by r.created_at) from public.section_records r
                         where r.section_id = c.id and (s.project_id is null or r.project_id = s.project_id)), '[]'))
  from public.section_shares s
  join public.section_configs c on c.id = s.section_id and c.active
  left join public.projects p on p.id = s.project_id
  left join public.experts e on e.id = p.expert_id
  where token is not null and s.token = public_section_gallery.token
$$;
revoke all on function public.public_section_gallery(uuid) from public;
grant execute on function public.public_section_gallery(uuid) to anon, authenticated;
