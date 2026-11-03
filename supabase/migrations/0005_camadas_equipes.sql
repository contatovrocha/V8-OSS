-- Camadas de acesso e equipes por expert.
--   owner  (Dono)          : acesso total; único que promove/rebaixa administradores.
--   admin  (Administrador) : acesso a todos os experts e projetos, abaixo do dono.
--   expert (Membro)        : acesso somente aos experts vinculados em user_experts (e a todos os projetos deles).
-- A função de cada pessoa (expert, estrategista, gestor de tráfego...) é informativa e não dá permissão.

-- ---------------------------------------------------------------- colunas
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('owner', 'admin', 'expert'));
alter table public.profiles add column if not exists funcao text
  check (funcao in ('expert', 'estrategista', 'gestor_trafego', 'closer', 'sdr', 'social_seller', 'gerente_projeto'));
alter table public.profiles add column if not exists activated_at timestamptz;

alter table public.user_experts add column if not exists funcao text
  check (funcao in ('expert', 'estrategista', 'gestor_trafego', 'closer', 'sdr', 'social_seller', 'gerente_projeto'));
alter table public.user_experts add column if not exists can_manage_team boolean not null default false;
alter table public.user_experts add column if not exists added_by uuid references public.profiles (id) on delete set null;
alter table public.user_experts add column if not exists created_at timestamptz not null default now();

-- ---------------------------------------------------------------- funções de permissão
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'admin'))
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner')
$$;

-- Pode montar a equipe do expert: administradores ou quem tem can_manage_team no vínculo com ele.
create or replace function public.can_manage_team(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.user_experts where user_id = auth.uid() and expert_id = e and can_manage_team)
$$;

-- Duas pessoas estão na mesma equipe quando compartilham ao menos um expert.
create or replace function public.shares_team(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_experts a join public.user_experts b on a.expert_id = b.expert_id
                 where a.user_id = auth.uid() and b.user_id = other)
$$;

-- ---------------------------------------------------------------- novos usuários
-- O primeiro usuário é o dono; os demais nascem como membro sem acesso. A função vem do cadastro
-- (apenas informativa); o papel nunca vem dos metadados.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r text := 'expert';
  f text := new.raw_user_meta_data ->> 'funcao';
begin
  if not exists (select 1 from public.profiles) then r := 'owner'; end if;
  if f not in ('expert', 'estrategista', 'gestor_trafego', 'closer', 'sdr', 'social_seller', 'gerente_projeto') then f := null; end if;
  insert into public.profiles (id, email, full_name, role, funcao)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
          r, f);
  return new;
end $$;

-- Marca o primeiro acesso (convite aceito) para a tela de equipe mostrar "ativo" x "convite pendente".
create or replace function public.mark_activated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.last_sign_in_at is not null and old.last_sign_in_at is null then
    update public.profiles set activated_at = new.last_sign_in_at where id = new.id and activated_at is null;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_signed_in on auth.users;
create trigger on_auth_user_signed_in after update of last_sign_in_at on auth.users for each row execute function public.mark_activated();

-- ---------------------------------------------------------------- proteções de papel
-- Ninguém (fora o servidor) altera ou remove o dono; só o dono muda papéis; não existe segundo dono.
create or replace function public.guard_profile_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.role = 'owner' then raise exception 'O dono do sistema não pode ser removido.' using errcode = '42501'; end if;
    if old.role = 'admin' and not public.is_owner() then raise exception 'Somente o dono remove administradores.' using errcode = '42501'; end if;
    return old;
  end if;
  if old.role = 'owner' and auth.uid() <> old.id then raise exception 'Somente o próprio dono altera o perfil dele.' using errcode = '42501'; end if;
  if new.role is distinct from old.role then
    if new.role = 'owner' or old.role = 'owner' then raise exception 'O papel de dono não pode ser transferido pelo sistema.' using errcode = '42501'; end if;
    if not public.is_owner() then raise exception 'Somente o dono altera a camada de acesso.' using errcode = '42501'; end if;
  end if;
  if old.role = 'admin' and auth.uid() <> old.id and not public.is_owner() then
    raise exception 'Somente o dono altera outro administrador.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_profile on public.profiles;
create trigger trg_guard_profile before update or delete on public.profiles for each row execute function public.guard_profile_change();

-- Gestor de equipe não concede gestão de equipe e não mexe no próprio vínculo nem no de outros gestores.
create or replace function public.guard_team_link() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return coalesce(new, old); end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if new.can_manage_team then raise exception 'Somente administradores definem quem gerencia a equipe.' using errcode = '42501'; end if;
    if new.user_id = auth.uid() then raise exception 'Você não pode alterar o próprio acesso.' using errcode = '42501'; end if;
    if exists (select 1 from public.profiles where id = new.user_id and role in ('owner', 'admin')) then
      raise exception 'Administradores já têm acesso a todos os experts.' using errcode = '42501';
    end if;
    new.added_by := coalesce(new.added_by, auth.uid());
  end if;
  if tg_op in ('UPDATE', 'DELETE') and (old.can_manage_team or old.user_id = auth.uid()) then
    raise exception 'Somente administradores alteram o vínculo de gestores da equipe.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists trg_guard_team_link on public.user_experts;
create trigger trg_guard_team_link before insert or update or delete on public.user_experts for each row execute function public.guard_team_link();

-- ---------------------------------------------------------------- políticas de equipe
drop policy if exists team_profiles_read on public.profiles;
create policy team_profiles_read on public.profiles for select to authenticated using (public.shares_team(id));

drop policy if exists team_links_read on public.user_experts;
create policy team_links_read on public.user_experts for select to authenticated using (expert_id in (select public.my_expert_ids()));
drop policy if exists team_links_insert on public.user_experts;
create policy team_links_insert on public.user_experts for insert to authenticated with check (public.can_manage_team(expert_id));
drop policy if exists team_links_update on public.user_experts;
create policy team_links_update on public.user_experts for update to authenticated using (public.can_manage_team(expert_id)) with check (public.can_manage_team(expert_id));
drop policy if exists team_links_delete on public.user_experts;
create policy team_links_delete on public.user_experts for delete to authenticated using (public.can_manage_team(expert_id));

grant execute on function public.is_owner(), public.can_manage_team(uuid), public.shares_team(uuid) to authenticated;

-- ---------------------------------------------------------------- dados existentes
-- O primeiro administrador cadastrado vira o dono.
update public.profiles set role = 'owner'
 where id = (select id from public.profiles where role = 'admin' order by created_at limit 1)
   and not exists (select 1 from public.profiles where role = 'owner');
update public.profiles p set activated_at = u.last_sign_in_at from auth.users u where u.id = p.id and p.activated_at is null;
