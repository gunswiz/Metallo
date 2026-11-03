-- 10G: propostas por categoria. Não altera veículos, inspeções ou regras operacionais.
begin;
create table private.frota_categorias_10g (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]{1,29}$'),
  nome text not null check (char_length(trim(nome)) between 2 and 60)
);
create table private.frota_modelos_10g (
  categoria text not null references private.frota_categorias_10g(codigo),
  revisao integer not null check (revisao > 0),
  itens jsonb not null check (jsonb_typeof(itens)='array' and jsonb_array_length(itens) between 1 and 60),
  motivo text not null check (char_length(trim(motivo)) between 5 and 300),
  autor uuid references auth.users(id),
  em timestamptz not null default now(),
  chave uuid unique,
  request_payload jsonb,
  primary key(categoria,revisao)
);
create index frota_modelos_autor_10g on private.frota_modelos_10g(autor);
alter table private.frota_categorias_10g enable row level security;
alter table private.frota_modelos_10g enable row level security;
revoke all on private.frota_categorias_10g,private.frota_modelos_10g from public,anon,authenticated,service_role;

create function private.frota_modelo_imutavel_10g() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'modelo_historico_imutavel' using errcode='22023'; end $$;
create trigger frota_modelo_imutavel_10g before update or delete on private.frota_modelos_10g
for each row execute function private.frota_modelo_imutavel_10g();
revoke all on function private.frota_modelo_imutavel_10g() from public,anon,authenticated,service_role;

create function public.admin_salvar_modelo_frota_10g(p_categoria text,p_nome text,p_base integer,p_itens jsonb,p_motivo text,p_key uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_atual integer; v_antigo private.frota_modelos_10g%rowtype;
 v_request jsonb:=jsonb_build_object('categoria',p_categoria,'nome',p_nome,'base',p_base,'itens',p_itens,'motivo',p_motivo);
begin
 if not private.frota_pode_cadastrar_10a() or auth.uid() is null then raise exception 'gestao_required' using errcode='42501'; end if;
 if p_key is null then raise exception 'chave_obrigatoria' using errcode='22023'; end if;
 if p_categoria is null or p_categoria !~ '^[a-z][a-z0-9_]{1,29}$' or p_base is null or p_base<0
  or p_nome is null or char_length(trim(p_nome)) not between 2 and 60
  or p_motivo is null or char_length(trim(p_motivo)) not between 5 and 300 then raise exception 'modelo_invalido' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('frota_modelo_10g:'||p_categoria,0));
 select * into v_antigo from private.frota_modelos_10g where chave=p_key;
 if found then
  if v_antigo.autor is distinct from auth.uid() or v_antigo.request_payload is distinct from v_request then raise exception 'idempotency_conflict' using errcode='22023'; end if;
  return v_antigo.revisao;
 end if;
 if jsonb_typeof(p_itens) is distinct from 'array' or octet_length(p_itens::text)>24000 then raise exception 'modelo_invalido' using errcode='22023'; end if;
 if jsonb_array_length(p_itens) not between 1 and 60 then raise exception 'modelo_invalido' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_itens) i where
  jsonb_typeof(i) is distinct from 'object' or jsonb_typeof(i->'codigo') is distinct from 'number'
  or (i->>'codigo') !~ '^[1-9][0-9]?$' or jsonb_typeof(i->'nome') is distinct from 'string'
  or char_length(trim(i->>'nome')) not between 2 and 80
  or coalesce(i->>'etapa','') not in ('Cabine','Segurança','Rodagem','Carroceria','Hidráulica','Estabilizadores','Içamento')
  or jsonb_typeof(i->'critico') is distinct from 'boolean'
  or jsonb_typeof(i->'permite_na') is distinct from 'boolean'
  or jsonb_typeof(i->'exige_foto') is distinct from 'boolean')
  or (select count(distinct i->>'codigo') from jsonb_array_elements(p_itens) i) <> jsonb_array_length(p_itens)
 then raise exception 'modelo_invalido' using errcode='22023'; end if;
 select coalesce(max(revisao),0) into v_atual from private.frota_modelos_10g where categoria=p_categoria;
 if p_base<>v_atual then raise exception 'modelo_revisao_conflito' using errcode='22023'; end if;
 if v_atual=0 then
  insert into private.frota_categorias_10g(codigo,nome) values(p_categoria,trim(p_nome));
 elsif not exists(select 1 from private.frota_categorias_10g where codigo=p_categoria and nome=trim(p_nome)) then
  raise exception 'modelo_revisao_conflito' using errcode='22023';
 end if;
 insert into private.frota_modelos_10g(categoria,revisao,itens,motivo,autor,chave,request_payload)
 values(p_categoria,v_atual+1,p_itens,trim(p_motivo),auth.uid(),p_key,v_request);
 return v_atual+1;
end $$;

create function public.admin_modelos_frota_10g(p_categoria text default 'munck',p_revisao integer default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_modelo jsonb; v_atual integer;
begin
 if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode='42501'; end if;
 select max(revisao) into v_atual from private.frota_modelos_10g where categoria=p_categoria;
 select jsonb_build_object('categoria',m.categoria,'nome',c.nome,'revisao',m.revisao,'itens',m.itens,
   'motivo',m.motivo,'em',m.em,'autor',coalesce(p.full_name,'Proposta inicial para revisão técnica')) into v_modelo
 from private.frota_modelos_10g m join private.frota_categorias_10g c on c.codigo=m.categoria
 left join public.profiles p on p.id=m.autor
 where m.categoria=p_categoria and m.revisao=coalesce(p_revisao,v_atual);
 if v_modelo is null then raise exception 'modelo_not_found' using errcode='22023'; end if;
 return jsonb_build_object('atual',v_atual,'modelo',v_modelo,
 'categorias',(select jsonb_agg(jsonb_build_object('codigo',c.codigo,'nome',c.nome) order by c.nome) from private.frota_categorias_10g c),
 'historico',(select jsonb_agg(jsonb_build_object('revisao',m.revisao,'em',m.em,'motivo',m.motivo) order by m.revisao desc) from private.frota_modelos_10g m where m.categoria=p_categoria));
end $$;
revoke all on function public.admin_salvar_modelo_frota_10g(text,text,integer,jsonb,text,uuid),public.admin_modelos_frota_10g(text,integer) from public,anon;
grant execute on function public.admin_salvar_modelo_frota_10g(text,text,integer,jsonb,text,uuid),public.admin_modelos_frota_10g(text,integer) to authenticated;

insert into private.frota_categorias_10g values('munck','Caminhão Munck'),('saveiro','Saveiro / veículo leve');
-- São propostas, não configurações aprovadas. CNH/capacitação exigem autorização própria.
insert into private.frota_modelos_10g(categoria,revisao,itens,motivo)
select c.codigo,1,jsonb_agg(jsonb_build_object('codigo',i.codigo,'nome',i.nome,
 'etapa',case when i.codigo in (5,6,25) then 'Hidráulica' when i.codigo in (7,24) then 'Içamento'
 when i.codigo in (8,21) then 'Rodagem' when i.codigo in (12,13) then 'Carroceria'
 when i.codigo in (1,2,3,4,9,11,18,23) then 'Cabine' else 'Segurança' end,
 'critico',i.critico,'permite_na',false,'exige_foto',false) order by i.codigo),
 'Proposta inicial baseada na matriz do engenheiro e nos itens existentes; requer revisão técnica.'
from private.frota_categorias_10g c cross join private.frota_itens_10a i
where i.ativo and i.codigo<=26 and i.codigo<>14 and (c.codigo='munck' or i.codigo not in (5,6,7,24,25)) group by c.codigo;
-- Itens adicionais da matriz são acrescentados na semente, antes de qualquer uso operacional.
-- A revisão 2 conserva a revisão 1 integralmente; não há UPDATE de histórico.
insert into private.frota_modelos_10g(categoria,revisao,itens,motivo)
select 'munck',2,m.itens || (select jsonb_agg(jsonb_build_object('codigo',x.codigo,'nome',x.nome,'etapa',x.etapa,
 'critico',true,'permite_na',false,'exige_foto',false) order by x.codigo) from (values
 (27,'Luzes de alerta do painel','Cabine'),(28,'Funcionamento dos instrumentos','Cabine'),
 (29,'Travas da carroceria','Carroceria'),(30,'Porta-volumes','Carroceria'),
 (31,'Patolas: integridade física','Estabilizadores'),(32,'Cilindros: vazamentos, oxidação e danos','Hidráulica'),
 (33,'Movimentação das patolas pelos comandos','Estabilizadores'),(34,'Bases dos estabilizadores','Estabilizadores'),
 (35,'Sistema hidráulico e lubrificação','Hidráulica'),(36,'Pinos de travamento','Içamento'),
 (37,'Integridade do gancho','Içamento'),(38,'Disponibilidade e integridade das cintas','Içamento'),
 (39,'Disponibilidade e integridade das anilhas','Içamento'),(40,'Tacógrafo: validade e discos quando aplicável','Segurança')
 ) as x(codigo,nome,etapa)),
 'Lacunas da matriz incluídas para revisão. Criticidade conservadora provisória; não aprovada pelo engenheiro.'
from private.frota_modelos_10g m where m.categoria='munck' and m.revisao=1;
commit;
