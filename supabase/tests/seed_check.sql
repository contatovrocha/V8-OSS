-- Insere o seed demonstrativo exportado (JSON) tabela a tabela, como o cliente faria com o perfil admin.
\set ON_ERROR_STOP 1
create temp table seed (doc jsonb);
insert into seed select pg_read_file(:'seedfile')::jsonb;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$
declare e jsonb; cols text; n int;
begin
  for e in select jsonb_array_elements(doc) from seed loop
    if jsonb_array_length(e -> 'rows') = 0 then continue; end if;
    -- somente colunas existentes no destino; chaves desconhecidas geram erro (detecta divergência de schema)
    select string_agg(quote_ident(k), ',') into cols from (select distinct jsonb_object_keys(r) k from jsonb_array_elements(e -> 'rows') r) x;
    execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1)', e ->> 'table', cols, cols, e ->> 'table') using e -> 'rows';
    get diagnostics n = row_count;
    raise notice 'seed % → % linha(s)', e ->> 'table', n;
  end loop;
end $$;
select count(*) as fases_jantar_concluidas from project_phases where project_id = 'd0000000-0000-4000-8000-000000000010' and status = 'concluida';
