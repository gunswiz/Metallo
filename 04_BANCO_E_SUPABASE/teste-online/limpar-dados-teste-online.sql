-- SOMENTE projeto de TESTE ONLINE (metallo-teste): apaga dados fictícios para semear de novo.
do $$ begin
  if current_database() <> 'postgres' or (select count(*) from pg_namespace where nspname='lab4a') > 0 then raise exception 'ambiente inesperado'; end if;
end $$;
-- O ponto é imutável por gatilho; no TESTE o schema inteiro é recriado depois (ponto-4d.sql).
drop schema if exists ponto cascade;
do $$ declare t text; begin
  select string_agg(format('%I.%I', schemaname, tablename), ', ') into t from pg_tables where schemaname in ('public','private');
  execute 'truncate ' || t || ' restart identity cascade';
end $$;
delete from auth.users;
select 'limpo' as status;
