alter function public.strip_project_links() set search_path = public;

-- Visitantes sem login só executam a galeria pública.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace loop
    if f.proname <> 'public_section_gallery' then
      execute format('revoke execute on function %s from anon, public', f.sig);
    end if;
  end loop;
end $$;

-- Funções de trigger não são chamadas diretamente por usuários (triggers continuam funcionando).
revoke execute on function public.handle_new_user(), public.guard_profile_change(), public.guard_team_link(), public.guard_expert_update(),
  public.guard_movement_update(), public.log_activity(), public.mark_activated(), public.ensure_phases(), public.strip_project_links()
  from authenticated;
