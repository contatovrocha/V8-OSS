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
