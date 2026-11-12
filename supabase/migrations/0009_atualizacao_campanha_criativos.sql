-- Atualização de campanha por projeto (sem IA): informações do evento, banco de fotos, criativos gerados
-- no navegador e página pública dinâmica. Quem edita: dono/administradores e o gestor da equipe do expert.

-- ---------------------------------------------------------------- permissão por projeto
create or replace function public.can_manage_project(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.projects pr join public.user_experts ue on ue.expert_id = pr.expert_id
    where pr.id = p and ue.user_id = auth.uid() and ue.can_manage_team)
$$;
revoke execute on function public.can_manage_project(uuid) from public, anon;
grant execute on function public.can_manage_project(uuid) to authenticated;

-- ---------------------------------------------------------------- página pública e link dos criativos
alter table public.projects add column if not exists public_slug text unique check (public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
alter table public.projects add column if not exists creatives_share_token uuid unique;

-- ---------------------------------------------------------------- banco de fotos (qualquer expert ou convidado)
create table if not exists public.creative_people (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  title text not null default '',
  photo_url text not null,
  expert_id uuid references public.experts (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.creative_people enable row level security;
create policy people_read on public.creative_people for select to authenticated using (true);
create policy people_insert on public.creative_people for insert to authenticated
  with check (public.is_admin() or exists (select 1 from public.user_experts where user_id = auth.uid() and can_manage_team));
create policy people_change on public.creative_people for update to authenticated using (public.is_admin() or created_by = auth.uid()) with check (public.is_admin() or created_by = auth.uid());
create policy people_delete on public.creative_people for delete to authenticated using (public.is_admin() or created_by = auth.uid());

-- ---------------------------------------------------------------- atualizações de campanha (cada uma é uma versão)
create table if not exists public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado')),
  event_date date,
  event_time text not null default '',
  format text not null default 'presencial' check (format in ('online', 'presencial')),
  city text not null default '',
  venue text not null default '',
  platform text not null default '',
  with_price boolean not null default false,
  price numeric(12, 2) check (price is null or price >= 0),
  full_price numeric(12, 2) check (full_price is null or full_price >= 0),
  checkout_url text not null default '',
  promise text not null default '',
  headline text not null default '',
  subheadline text not null default '',
  cta_label text not null default 'Quero garantir minha vaga',
  spots integer check (spots is null or spots >= 0),
  extras jsonb not null default '{}',
  hero_person_id uuid references public.creative_people (id) on delete set null,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_updates_project on public.project_updates (project_id, published_at desc);
alter table public.project_updates enable row level security;
create policy admin_all on public.project_updates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy updates_read on public.project_updates for select to authenticated using (public.can_access_project(project_id));
create policy updates_write on public.project_updates for all to authenticated using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));

-- ---------------------------------------------------------------- criativos gerados
create table if not exists public.creatives (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  update_id uuid references public.project_updates (id) on delete set null,
  format text not null check (format in ('feed', 'stories')),
  layout text not null check (layout in ('destaque', 'dividido', 'convite', 'grupo')),
  angle text not null default '',
  content jsonb not null default '{}',
  image_url text,
  status text not null default 'rascunho' check (status in ('rascunho', 'aprovado', 'ajuste')),
  notes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creatives_project on public.creatives (project_id, created_at desc);
alter table public.creatives enable row level security;
create policy admin_all on public.creatives for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy creatives_read on public.creatives for select to authenticated using (public.can_access_project(project_id));
create policy creatives_write on public.creatives for all to authenticated using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));

create trigger trg_touch before update on public.project_updates for each row execute function public.touch_updated_at();
create trigger trg_touch before update on public.creatives for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- leitura pública (sem login)
-- Página do evento: última atualização publicada do projeto.
create or replace function public.public_event_page(slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'project', p.name, 'expert', e.full_name, 'expert_title', e.title,
    'photo', coalesce(cp.photo_url, e.photo_url),
    'update', to_jsonb(u) - 'created_by' - 'hero_person_id')
  from public.projects p
  join public.experts e on e.id = p.expert_id
  join lateral (select * from public.project_updates x where x.project_id = p.id and x.status = 'publicado' order by x.published_at desc limit 1) u on true
  left join public.creative_people cp on cp.id = u.hero_person_id
  where slug is not null and p.public_slug = public_event_page.slug and not p.archived
$$;

-- Galeria pública dos criativos aprovados de um projeto (mesmo formato da galeria de seções).
create or replace function public.public_project_creatives(token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', 'Criativos', 'description', '', 'icon', 'Image', 'project', p.name, 'expert', e.full_name,
    'fields', jsonb_build_array(
      jsonb_build_object('key', 'titulo', 'type', 'text', 'label', 'Criativo', 'options', '[]'::jsonb, 'required', true, 'filterable', false, 'show_in_card', true, 'show_in_table', true),
      jsonb_build_object('key', 'imagem', 'type', 'image', 'label', 'Imagem', 'options', '[]'::jsonb, 'required', true, 'filterable', false, 'show_in_card', true, 'show_in_table', true),
      jsonb_build_object('key', 'headline', 'type', 'textarea', 'label', 'Headline', 'options', '[]'::jsonb, 'required', false, 'filterable', false, 'show_in_card', true, 'show_in_table', true),
      jsonb_build_object('key', 'formato', 'type', 'select', 'label', 'Formato', 'options', '["Feed 4:5","Stories 9:16"]'::jsonb, 'required', false, 'filterable', true, 'show_in_card', true, 'show_in_table', true)),
    'records', coalesce((select jsonb_agg(jsonb_build_object(
        'titulo', initcap(c.layout) || ' · ' || coalesce(nullif(c.angle, ''), 'criativo'),
        'imagem', c.image_url, 'headline', c.content ->> 'headline',
        'formato', case c.format when 'feed' then 'Feed 4:5' else 'Stories 9:16' end) order by c.created_at)
      from public.creatives c where c.project_id = p.id and c.status = 'aprovado' and c.image_url is not null), '[]'))
  from public.projects p join public.experts e on e.id = p.expert_id
  where token is not null and p.creatives_share_token = public_project_creatives.token
$$;
revoke all on function public.public_event_page(text), public.public_project_creatives(uuid) from public;
grant execute on function public.public_event_page(text), public.public_project_creatives(uuid) to anon, authenticated;
