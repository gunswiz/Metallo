begin;
-- Dados documentais somente: não concedem autorização de condução.
create table private.frota_cnh_10k (
 id bigint generated always as identity primary key,
 employee_id uuid not null references public.epi_employees(id),
 revisao integer not null check(revisao>0),
 categoria text not null check(categoria in ('A','B','C','D','E','AB','AC','AD','AE')),
 validade date not null,
 situacao text not null check(situacao in ('informado','conferido','invalidado')),
 referencia text not null check(length(trim(referencia)) between 3 and 160),
 motivo text not null check(length(trim(motivo)) between 10 and 600),
 autor uuid not null references auth.users(id), em timestamptz not null default now(),
 chave uuid not null, unique(employee_id,revisao), unique(autor,chave)
);
create index frota_cnh_autor_10k on private.frota_cnh_10k(autor);
alter table private.frota_cnh_10k enable row level security;
revoke all on private.frota_cnh_10k from public,anon,authenticated,service_role;
create trigger frota_cnh_imutavel_10k before update or delete on private.frota_cnh_10k
 for each row execute function private.frota_modelo_imutavel_10g();

create function public.admin_salvar_cnh_10k(p_employee uuid,p_base integer,p_categoria text,p_validade date,p_situacao text,p_referencia text,p_motivo text,p_key uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare v_team uuid; v_ativo boolean; v private.frota_cnh_10k%rowtype; v_revisao integer; v_id bigint;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and active and role in ('admin','engineer')) then raise exception 'gestao_required' using errcode='42501'; end if;
 select team_id,active into v_team,v_ativo from public.epi_employees where id=p_employee for share;
 if not found or private.gestao_pode_5a(v_team) is not true then raise exception 'employee_forbidden' using errcode='42501'; end if;
 if v_ativo is not true then raise exception 'funcionario_inativo' using errcode='22023'; end if;
 if p_situacao='conferido' and not exists(select 1 from public.profiles where id=auth.uid() and active and role='engineer') then raise exception 'engenheiro_required' using errcode='42501'; end if;
 if p_key is null then raise exception 'chave_obrigatoria' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('frota_cnh_chave:'||auth.uid()::text||p_key::text,0));
 perform pg_advisory_xact_lock(hashtextextended('frota_cnh:'||p_employee::text,0));
 select * into v from private.frota_cnh_10k where autor=auth.uid() and chave=p_key;
 if found then
  if v.employee_id is distinct from p_employee or v.revisao-1 is distinct from p_base or v.categoria is distinct from p_categoria or v.validade is distinct from p_validade or v.situacao is distinct from p_situacao or v.referencia is distinct from trim(p_referencia) or v.motivo is distinct from trim(p_motivo) then raise exception 'idempotency_conflict' using errcode='22023'; end if;
  return v.id;
 end if;
 select coalesce(max(revisao),0) into v_revisao from private.frota_cnh_10k where employee_id=p_employee;
 if p_base is distinct from v_revisao then raise exception 'documento_revisao_conflito' using errcode='22023'; end if;
 if p_categoria is null or p_categoria not in ('A','B','C','D','E','AB','AC','AD','AE') or p_validade is null or not isfinite(p_validade) or p_validade not between date '1900-01-01' and date '2200-12-31' or p_situacao is null or p_situacao not in ('informado','conferido','invalidado') or p_referencia is null or length(trim(p_referencia)) not between 3 and 160 or p_motivo is null or length(trim(p_motivo)) not between 10 and 600 then raise exception 'documento_condutor_invalido' using errcode='22023'; end if;
 insert into private.frota_cnh_10k(employee_id,revisao,categoria,validade,situacao,referencia,motivo,autor,chave)
 values(p_employee,v_revisao+1,p_categoria,p_validade,p_situacao,trim(p_referencia),trim(p_motivo),auth.uid(),p_key) returning id into v_id;
 return v_id;
end $$;

create function public.admin_condutores_10k(p_employee uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_team uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and active and role in ('admin','engineer')) then raise exception 'gestao_required' using errcode='42501'; end if;
 if p_employee is not null then
  select team_id into v_team from public.epi_employees where id=p_employee;
  if not found or private.gestao_pode_5a(v_team) is not true then raise exception 'employee_forbidden' using errcode='42501'; end if;
 end if;
 return jsonb_build_object('hoje',private.frota_hoje_10a(),'funcionarios',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nome',e.full_name,'ativo',e.active) order by e.full_name) from public.epi_employees e where private.gestao_pode_5a(e.team_id) is true),'[]'::jsonb),
 'historico',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'revisao',c.revisao,'categoria',c.categoria,'validade',c.validade,'situacao',c.situacao,'referencia',c.referencia,'motivo',c.motivo,'em',c.em,'autor',coalesce(p.full_name,'Responsável registrado')) order by c.revisao desc) from private.frota_cnh_10k c left join public.profiles p on p.id=c.autor where c.employee_id=p_employee),'[]'::jsonb));
end $$;
revoke all on function public.admin_salvar_cnh_10k(uuid,integer,text,date,text,text,text,uuid),public.admin_condutores_10k(uuid) from public,anon;
grant execute on function public.admin_salvar_cnh_10k(uuid,integer,text,date,text,text,text,uuid),public.admin_condutores_10k(uuid) to authenticated;
commit;
