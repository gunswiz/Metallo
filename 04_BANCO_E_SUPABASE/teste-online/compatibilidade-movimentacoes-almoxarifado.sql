-- Compatibilidade do teste online com a fila de materiais e equipamentos.
-- Preserva os comandos instalados, o recibo de idempotência e as permissões.
do $patch$
declare
  definition text := pg_get_functiondef('public.run_site_operation(text,jsonb,uuid,timestamptz)'::regprocedure);
  anchor constant text := '  elsif p_command=''consume'' then';
begin
  if position('p_command=''material_movement''' in definition) > 0
     and position('p_command=''asset_movement''' in definition) > 0 then
    return;
  end if;
  if position('p_command=''material_movement''' in definition) > 0
     or position('p_command=''asset_movement''' in definition) > 0
     or array_length(string_to_array(definition, anchor), 1) <> 2
     or position('operation_id_conflict' in definition) = 0
     or position('operation_actor_mismatch' in definition) = 0 then
    raise exception 'Versão de run_site_operation inesperada. Revisar antes de aplicar.';
  end if;
  execute replace(definition, anchor, $branches$
  elsif p_command='material_movement' then
    if p_data->>'movement_type' in ('entry','replenishment') then raise exception 'use_receiving_flow'; end if;
    if p_data->>'movement_type'='consumption' then
      perform public.consume_material((p_data->>'item_id')::uuid,(p_data->>'origin_team_id')::uuid,(p_data->>'quantity')::integer,p_data->>'note');
    else
      v_id:=public.register_movement((p_data->>'item_id')::uuid,
        case when p_data->>'movement_type'='return' and nullif(p_data->>'origin_team_id','') is not null then 'transfer' else p_data->>'movement_type' end,
        (p_data->>'quantity')::integer,nullif(p_data->>'origin_team_id','')::uuid,nullif(p_data->>'destination_team_id','')::uuid,p_data->>'note');
    end if;
    v_result:=jsonb_build_object('id',v_id);
  elsif p_command='asset_movement' then
    v_id:=public.register_asset_movement((p_data->>'asset_id')::uuid,p_data->>'movement_type',nullif(p_data->>'destination_team_id','')::uuid,p_data->>'new_status',p_data->>'note');
    v_result:=jsonb_build_object('id',v_id);
$branches$ || anchor);
end;
$patch$;
