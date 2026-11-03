-- ---------------------------------------------------------------- links importantes: somente o dono
-- Os links ficam fora de projects (que membros e administradores leem) para que só o dono os veja.
create table if not exists public.project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects (id) on delete cascade,
  links jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
alter table public.project_links enable row level security;
drop policy if exists owner_all on public.project_links;
create policy owner_all on public.project_links for all to authenticated using (public.is_owner()) with check (public.is_owner());

insert into public.project_links (project_id, links)
  select id, links from public.projects where links is not null and jsonb_array_length(links) > 0
  on conflict (project_id) do update set links = excluded.links;
update public.projects set links = '[]' where jsonb_array_length(links) > 0;

-- A coluna antiga fica vazia: links enviados por engano em projects são descartados.
create or replace function public.strip_project_links() returns trigger
language plpgsql as $$
begin
  new.links := '[]';
  return new;
end $$;
drop trigger if exists trg_strip_project_links on public.projects;
create trigger trg_strip_project_links before insert or update on public.projects for each row execute function public.strip_project_links();

-- ---------------------------------------------------------------- galeria pública de uma seção
-- share_token preenchido = a seção tem um link público somente leitura (ex.: Criativos).
alter table public.section_configs add column if not exists share_token uuid unique;

create or replace function public.public_section_gallery(token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', c.name, 'description', c.description, 'icon', c.icon, 'fields', c.fields,
    'records', coalesce((select jsonb_agg(r.data order by r.created_at) from public.section_records r where r.section_id = c.id), '[]'))
  from public.section_configs c
  where token is not null and c.share_token = token and c.active
$$;
revoke all on function public.public_section_gallery(uuid) from public;
grant execute on function public.public_section_gallery(uuid) to anon, authenticated;
