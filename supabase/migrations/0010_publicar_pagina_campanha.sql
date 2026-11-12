-- Publica a página do evento: endereço (criado uma vez), data do evento e registro em Páginas.
-- Executa com privilégio, mas só para quem pode gerenciar o projeto (admin ou gestor da equipe).
create or replace function public.publish_campaign_page(project_id uuid, slug text, event_date date, url text, note text)
returns text language plpgsql security definer set search_path = public as $$
declare
  p public.projects;
  final_slug text;
  n int := 2;
  page_id uuid;
begin
  if not public.can_manage_project(publish_campaign_page.project_id) then
    raise exception 'Somente administradores ou o gestor da equipe publicam a campanha.' using errcode = '42501';
  end if;
  select * into p from public.projects where id = publish_campaign_page.project_id;
  final_slug := coalesce(p.public_slug, slug);
  if p.public_slug is null then
    while exists (select 1 from public.projects where public_slug = final_slug and id <> p.id) loop
      final_slug := slug || '-' || n; n := n + 1;
    end loop;
  end if;
  update public.projects set public_slug = final_slug, event_date = coalesce(publish_campaign_page.event_date, projects.event_date) where id = p.id;

  select id into page_id from public.pages where pages.project_id = p.id and pages.tool = 'V8 OS' and pages.name = 'Página do evento (automática)' limit 1;
  if page_id is null then
    insert into public.pages (project_id, name, page_type_id, published_url, preview_url, edit_url, tool, owner, status, published_at, notes)
    values (p.id, 'Página do evento (automática)', 'c0000000-0000-4000-8000-000000000002', replace(url, '{slug}', final_slug), replace(url, '{slug}', final_slug),
            '', 'V8 OS', coalesce((select full_name from public.profiles where id = auth.uid()), ''), 'publicada', now(), note);
  else
    update public.pages set published_url = replace(url, '{slug}', final_slug), preview_url = replace(url, '{slug}', final_slug), status = 'publicada', notes = note where id = page_id;
  end if;
  return final_slug;
end $$;
revoke execute on function public.publish_campaign_page(uuid, text, date, text, text) from public, anon;
grant execute on function public.publish_campaign_page(uuid, text, date, text, text) to authenticated;
