begin;
alter table private.frota_veiculos_10a
 add column categoria text references private.frota_categorias_10g(codigo),
 add column categoria_revisao integer not null default 0 check(categoria_revisao>=0);
create index frota_veiculo_categoria_10h on private.frota_veiculos_10a(categoria);

create function public.admin_categoria_veiculo_10h(p_veiculo bigint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v private.frota_veiculos_10a%rowtype;
begin
 if auth.uid() is null or private.pode_atender_3t() is not true then raise exception 'gestao_required' using errcode='42501'; end if;
 select * into v from private.frota_veiculos_10a where id=p_veiculo;
 if not found then raise exception 'veiculo_not_found' using errcode='22023'; end if;
 return jsonb_build_object('categoria',v.categoria,'revisao',v.categoria_revisao,
 'categorias',(select jsonb_agg(jsonb_build_object('codigo',codigo,'nome',nome) order by nome) from private.frota_categorias_10g));
end $$;

create function public.admin_definir_categoria_10h(p_veiculo bigint,p_categoria text,p_base integer) returns void
language plpgsql security definer set search_path='' as $$
declare v private.frota_veiculos_10a%rowtype; v_nome text;
begin
 if auth.uid() is null or private.frota_pode_cadastrar_10a() is not true then raise exception 'gestao_required' using errcode='42501'; end if;
 if p_base is null or p_base<0 then raise exception 'modelo_invalido' using errcode='22023'; end if;
 select * into v from private.frota_veiculos_10a where id=p_veiculo for update;
 if not found then raise exception 'veiculo_not_found' using errcode='22023'; end if;
 if p_categoria is not null then
  select nome into v_nome from private.frota_categorias_10g where codigo=p_categoria;
  if not found then raise exception 'modelo_invalido' using errcode='22023'; end if;
 end if;
 if v.categoria is not distinct from p_categoria then return; end if;
 if p_base<>v.categoria_revisao then raise exception 'categoria_revisao_conflito' using errcode='22023'; end if;
 if v.situacao='em_uso' then raise exception 'categoria_veiculo_em_uso' using errcode='22023'; end if;
 update private.frota_veiculos_10a set categoria=p_categoria,categoria_revisao=categoria_revisao+1 where id=p_veiculo;
 perform private.frota_evento_10a(p_veiculo,'categoria','Categoria: '||coalesce(v_nome,'Sem categoria definida')||'. Classificação cadastral; não ativa modelo de checklist.',null,auth.uid());
end $$;
revoke all on function public.admin_categoria_veiculo_10h(bigint),public.admin_definir_categoria_10h(bigint,text,integer) from public,anon;
grant execute on function public.admin_categoria_veiculo_10h(bigint),public.admin_definir_categoria_10h(bigint,text,integer) to authenticated;
commit;
