-- Marcos 5C e 5D (TESTE ONLINE, dados fictícios): alertas da Gestão no celular.
-- 5C: material ou EPI abaixo do estoque mínimo (mesma regra do quadro "Precisa de você").
-- 5D: vencimentos — ASO, treinamentos (NR), validade do CA do EPI (campo novo) e lote de EPI com validade.
-- Um aviso de manhã (seg–sex, 07:05), só quando aparece algo NOVO; às segundas vai o resumo completo da semana.

-- Validade do Certificado de Aprovação (CA) do EPI — NR-6: só pode ser usado/comprado EPI com CA válido.
create table if not exists private.epi_ca_validade_5d (
  item_id uuid primary key references public.epi_items(id) on delete cascade,
  validade date,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table private.epi_ca_validade_5d enable row level security;
revoke all on private.epi_ca_validade_5d from public, anon, authenticated, service_role;

create or replace function public.admin_set_ca_validade_5d(p_item_id uuid, p_validade date)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_operate('epi:write') then raise exception 'forbidden_role' using errcode = '42501'; end if;
  if not exists (select 1 from public.epi_items i where i.id = p_item_id) then raise exception 'item_nao_encontrado' using errcode = '22023'; end if;
  if p_validade is not null and (p_validade < date '2000-01-01' or p_validade > date '2100-01-01') then raise exception 'data_invalida' using errcode = '22023'; end if;
  insert into private.epi_ca_validade_5d(item_id, validade, updated_by) values (p_item_id, p_validade, (select auth.uid()))
  on conflict (item_id) do update set validade = excluded.validade, updated_at = now(), updated_by = excluded.updated_by;
end $$;
create or replace function public.ca_validades_5d()
returns table(item_id uuid, validade date) language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active) then raise exception 'gestao_required' using errcode = '42501'; end if;
  return query select v.item_id, v.validade from private.epi_ca_validade_5d v where v.validade is not null;
end $$;
revoke all on function public.admin_set_ca_validade_5d(uuid, date), public.ca_validades_5d() from public, anon;
grant execute on function public.admin_set_ca_validade_5d(uuid, date), public.ca_validades_5d() to authenticated;

-- Todos os alertas de hoje, cada um com uma chave estável (para saber o que é novo).
create or replace function private.alertas_hoje_5c(p_dias integer default 30)
returns table(chave text, grupo text, texto text, vence_em date)
language sql stable security definer set search_path = '' as $$
  with hoje as (select (now() at time zone 'America/Fortaleza')::date d)
  select 'estoque:' || s.id, 'REPOR', i.name || ' (' || s.quantity || ' ' || i.unit || ' em ' || t.name || '; mínimo ' || i.minimum_stock || ')', null::date
    from public.inventory s join public.items i on i.id = s.item_id join public.teams t on t.id = s.team_id
    where i.active and s.quantity < i.minimum_stock
  union all
  select 'epi:' || i.id, 'REPOR', i.name || ' (' || coalesce((select sum(b.quantity) from public.epi_stock_batches b where b.item_id = i.id), 0) || ' ' || i.unit || '; mínimo ' || i.minimum_stock || ')', null
    from public.epi_items i where i.active and coalesce((select sum(b.quantity) from public.epi_stock_batches b where b.item_id = i.id), 0) < i.minimum_stock
  union all
  select 'aso:' || e.id || ':' || e.aso_expiry_date, 'ASO', e.full_name, e.aso_expiry_date
    from public.epi_employees e, hoje where e.active and e.aso_expiry_date <= hoje.d + p_dias
  union all
  select 'treino:' || x.employee_id || ':' || x.type_code || ':' || x.expires_on, 'TREINAMENTO', x.full_name || ' — ' || coalesce(tt.nr || ' ', '') || tt.name, x.expires_on
    from (select distinct on (t.employee_id, t.type_code) t.employee_id, t.type_code, t.expires_on, e.full_name
          from private.employee_trainings_5a t join public.epi_employees e on e.id = t.employee_id and e.active
          where t.status = 'ATIVO' order by t.employee_id, t.type_code, t.completed_on desc, t.created_at desc) x
    join private.training_types_5a tt on tt.code = x.type_code, hoje
    where x.expires_on is not null and x.expires_on <= hoje.d + p_dias
  union all
  select 'ca:' || i.id || ':' || v.validade, 'CA', i.name || coalesce(' (CA ' || i.ca_number || ')', ''), v.validade
    from private.epi_ca_validade_5d v join public.epi_items i on i.id = v.item_id and i.active, hoje
    where v.validade is not null and v.validade <= hoje.d + p_dias
  union all
  select 'lote:' || b.id || ':' || b.expires_on, 'LOTE', i.name || coalesce(' — lote ' || b.lot_number, '') || ' (' || b.quantity || ' ' || i.unit || ')', b.expires_on
    from public.epi_stock_batches b join public.epi_items i on i.id = b.item_id and i.active, hoje
    where b.quantity > 0 and b.expires_on is not null and b.expires_on <= hoje.d + p_dias;
$$;
revoke all on function private.alertas_hoje_5c(integer) from public, anon, authenticated, service_role;

-- Para a tela da Gestão: os vencimentos que ainda não aparecem no "Precisa de você" (CA e lote de EPI).
create or replace function public.vencimentos_epi_5d()
returns table(grupo text, texto text, vence_em date) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_operate('epi:write') then raise exception 'forbidden_role' using errcode = '42501'; end if;
  return query select a.grupo, a.texto, a.vence_em from private.alertas_hoje_5c(30) a where a.grupo in ('CA', 'LOTE') order by a.vence_em, a.texto;
end $$;
revoke all on function public.vencimentos_epi_5d() from public, anon;
grant execute on function public.vencimentos_epi_5d() to authenticated;

-- O que já foi avisado (para mandar só o que é novo). Uma chave volta a ser "nova" depois de 7 dias.
create table if not exists private.alertas_enviados_5c (chave text primary key, enviado_em timestamptz not null default now());
alter table private.alertas_enviados_5c enable row level security;
revoke all on private.alertas_enviados_5c from public, anon, authenticated, service_role;

-- Monta o aviso da manhã. Devolve null quando não há nada para avisar. Marca as chaves como avisadas.
create or replace function private.aviso_alertas_5c(p_resumo boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_novos int; v_repor text[]; v_total_repor int; partes text[] := '{}'; v_lista jsonb;
  hoje date := (now() at time zone 'America/Fortaleza')::date; r record;
begin
  select coalesce(jsonb_agg(jsonb_build_object('chave', a.chave, 'grupo', a.grupo, 'texto', a.texto, 'vence_em', a.vence_em,
      'novo', not exists (select 1 from private.alertas_enviados_5c x where x.chave = a.chave and x.enviado_em > now() - interval '7 days'))), '[]'::jsonb)
    into v_lista from private.alertas_hoje_5c(30) a;
  -- No resumo da segunda vai tudo; nos outros dias, só o que é novo.
  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_lista from jsonb_array_elements(v_lista) e where p_resumo or (e->>'novo')::boolean;
  if jsonb_array_length(v_lista) = 0 then return null; end if;
  select array_agg(e->>'texto' order by e->>'texto'), count(*) into v_repor, v_total_repor from jsonb_array_elements(v_lista) e where e->>'grupo' = 'REPOR';
  if v_total_repor > 0 then
    partes := array_append(partes, 'Para repor: ' || v_repor[1] || case when v_total_repor > 1 then ' e mais ' || (v_total_repor - 1) else '' end || '.');
  end if;
  for r in select e->>'grupo' grupo, count(*) filter (where (e->>'vence_em')::date < hoje) vencidos, count(*) filter (where (e->>'vence_em')::date >= hoje) vencendo
      from jsonb_array_elements(v_lista) e where e->>'grupo' <> 'REPOR' group by 1 order by 1 loop
    partes := array_append(partes, case r.grupo when 'ASO' then 'ASO' when 'TREINAMENTO' then 'Treinamento' when 'CA' then 'CA de EPI' else 'Lote de EPI' end
      || ': ' || concat_ws(', ', case when r.vencidos > 0 then r.vencidos || ' vencido(s)' end, case when r.vencendo > 0 then r.vencendo || ' vencendo em 30 dias' end) || '.');
  end loop;
  insert into private.alertas_enviados_5c(chave) select e->>'chave' from jsonb_array_elements(v_lista) e
    on conflict (chave) do update set enviado_em = now();
  return jsonb_build_object('title', case when p_resumo then 'Metallo · resumo da semana' else 'Metallo · alertas novos' end,
    'body', left(array_to_string(partes, ' '), 240), 'url', '/dashboard');
end $$;
revoke all on function private.aviso_alertas_5c(boolean) from public, anon, authenticated, service_role;

-- Quem recebe: administrador e engenheiro ativos com o celular ligado nos avisos (3P).
create or replace function private.destinos_alertas_5c()
returns table(id bigint, endpoint text, p256dh text, auth text) language sql stable security definer set search_path = '' as $$
  select s.id, s.endpoint, s.p256dh, s.auth from private.push_subscriptions_3p s
    join public.profiles p on p.id = s.user_id and p.active and p.role in ('admin', 'engineer');
$$;
revoke all on function private.destinos_alertas_5c() from public, anon, authenticated, service_role;

-- Segunda a sexta, 07:05 em Fortaleza (10:05 UTC). Segunda = resumo completo.
select cron.schedule('metallo-alertas-gestao', '5 10 * * 1-5', $job$
  select net.http_post(
    url := 'https://cvimwiqokkujfhwynhmt.supabase.co/functions/v1/lembrete-consumo',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-metallo-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'metallo_cron_lembrete')),
    body := '{"acao":"alertas"}'::jsonb, timeout_milliseconds := 20000);
$job$);

select '5C/5D pronto' as status;
