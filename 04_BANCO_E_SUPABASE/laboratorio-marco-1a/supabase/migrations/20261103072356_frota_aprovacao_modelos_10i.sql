-- Aprovação documental. Nenhuma ativação de checklist operacional nesta migração.
begin;
create table private.frota_aprovacoes_10i (
 categoria text not null,
 revisao integer not null,
 autor uuid not null references auth.users(id),
 em timestamptz not null default now(),
 parecer text not null check(char_length(trim(parecer)) between 10 and 600),
 primary key(categoria,revisao),
 foreign key(categoria,revisao) references private.frota_modelos_10g(categoria,revisao)
);
create index frota_aprovacoes_autor_10i on private.frota_aprovacoes_10i(autor);
alter table private.frota_aprovacoes_10i enable row level security;
revoke all on private.frota_aprovacoes_10i from public,anon,authenticated,service_role;
create trigger frota_aprovacao_imutavel_10i before update or delete on private.frota_aprovacoes_10i
 for each row execute function private.frota_modelo_imutavel_10g();

create function public.admin_aprovar_modelo_10i(p_categoria text,p_revisao integer,p_parecer text,p_ciente boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v private.frota_aprovacoes_10i%rowtype;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role='engineer') then
  raise exception 'engenheiro_required' using errcode='42501'; end if;
 if p_ciente is not true or p_parecer is null or char_length(trim(p_parecer)) not between 10 and 600 then
  raise exception 'parecer_obrigatorio' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('frota_modelo_10g:'||p_categoria,0));
 select * into v from private.frota_aprovacoes_10i where categoria=p_categoria and revisao=p_revisao;
 if found then
  if v.autor is distinct from auth.uid() or v.parecer is distinct from trim(p_parecer) then raise exception 'aprovacao_ja_registrada' using errcode='22023'; end if;
  return;
 end if;
 if p_revisao is null or p_revisao is distinct from (select max(revisao) from private.frota_modelos_10g where categoria=p_categoria) then
  raise exception 'modelo_revisao_conflito' using errcode='22023'; end if;
 insert into private.frota_aprovacoes_10i(categoria,revisao,autor,parecer) values(p_categoria,p_revisao,auth.uid(),trim(p_parecer));
end $$;

create function public.admin_aprovacoes_modelo_10i(p_categoria text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or private.pode_atender_3t() is not true then raise exception 'gestao_required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('revisao',a.revisao,'em',a.em,'parecer',a.parecer,'autor',coalesce(p.full_name,'Responsável registrado')) order by a.revisao desc)
 from private.frota_aprovacoes_10i a left join public.profiles p on p.id=a.autor where a.categoria=p_categoria),'[]'::jsonb);
end $$;
revoke all on function public.admin_aprovar_modelo_10i(text,integer,text,boolean),public.admin_aprovacoes_modelo_10i(text) from public,anon;
grant execute on function public.admin_aprovar_modelo_10i(text,integer,text,boolean),public.admin_aprovacoes_modelo_10i(text) to authenticated;
commit;
