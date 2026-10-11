-- Marco 4L (TESTE ONLINE): fechamento do mês do ponto com confirmação do funcionário.
-- A Gestão "fecha" o mês de cada pessoa: guarda uma FOTO do espelho (dias e totais). O funcionário confere no app e
-- responde "Está certo" ou "Tem algo errado". Depois de fechado, ocorrências e feriados daquele mês ficam travados até
-- a Gestão reabrir (com motivo; nada é apagado). As marcações originais nunca são alteradas.

-- Parte 1 (migração separada): novo tipo de aviso no celular.
alter table private.avisos_funcionario_3u drop constraint if exists avisos_funcionario_3u_tipo_check,
  add constraint avisos_funcionario_3u_tipo_check check (tipo in ('PONTO', 'COMUNICADO', 'TROCA_EPI', 'PEDIDO_MATERIAL', 'ENTREGA_EPI', 'ITEM_PESSOAL', 'FECHAMENTO'));

-- Parte 2.
create table if not exists private.fechamento_mes_4l (
  id bigint generated always as identity primary key,
  employee_id uuid not null references public.epi_employees(id) on delete cascade,
  mes text not null check (mes ~ '^20\d{2}-(0[1-9]|1[0-2])$'),
  resumo jsonb not null check (jsonb_typeof(resumo) = 'object'),
  dias jsonb not null check (jsonb_typeof(dias) = 'array'),
  marcacoes integer not null check (marcacoes >= 0),
  ultimo_nsr bigint,
  fechado_em timestamptz not null default now(),
  fechado_por uuid not null references auth.users(id),
  resposta text check (resposta in ('confirmado', 'contestado')),
  respondido_em timestamptz,
  comentario text check (comentario is null or char_length(comentario) <= 500),
  reaberto_em timestamptz,
  reaberto_por uuid references auth.users(id),
  motivo_reabertura text check (motivo_reabertura is null or char_length(motivo_reabertura) between 5 and 300),
  check ((resposta is null) = (respondido_em is null)),
  check ((reaberto_em is null) = (motivo_reabertura is null))
);
create unique index if not exists fechamento_mes_4l_ativo on private.fechamento_mes_4l(employee_id, mes) where reaberto_em is null;
create index if not exists fechamento_mes_4l_mes on private.fechamento_mes_4l(mes) where reaberto_em is null;
alter table private.fechamento_mes_4l enable row level security;
revoke all on private.fechamento_mes_4l from public, anon, authenticated, service_role;

create or replace function private.inicio_mes_4l(p_mes text) returns timestamptz language sql immutable set search_path = '' as $$
  select ((p_mes || '-01')::date)::timestamp at time zone 'America/Fortaleza'
$$;
create or replace function private.nome_mes_4l(p_mes text) returns text language sql immutable set search_path = '' as $$
  select (array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'])[substr(p_mes, 6, 2)::int]
    || ' de ' || substr(p_mes, 1, 4)
$$;
-- "Impressão digital" das marcações da pessoa no mês: quantas e a última (NSR). Se mudar depois do fechamento, a Gestão é avisada.
create or replace function private.digital_mes_4l(p_employee uuid, p_mes text, out marcacoes integer, out ultimo_nsr bigint)
language sql stable security definer set search_path = '' as $$
  select count(*)::integer, max(m.nsr) from ponto.marcacao m
  where m.employee_id = p_employee and m.marking_at >= private.inicio_mes_4l(p_mes) and m.marking_at < private.inicio_mes_4l(p_mes) + interval '1 month'
$$;

-- Trava: mês fechado não aceita ocorrência nova/alterada nem feriado novo/alterado.
create or replace function private.trava_mes_fechado_4l() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'ocorrencias_ponto_4h' then
    if exists (select 1 from private.fechamento_mes_4l f where f.reaberto_em is null and f.employee_id = new.employee_id and f.mes = to_char(new.data, 'YYYY-MM'))
      or (tg_op = 'UPDATE' and exists (select 1 from private.fechamento_mes_4l f where f.reaberto_em is null and f.employee_id = old.employee_id and f.mes = to_char(old.data, 'YYYY-MM')))
    then raise exception 'mes_fechado' using errcode = 'P0001'; end if;
  else
    if exists (select 1 from private.fechamento_mes_4l f where f.reaberto_em is null and f.mes = to_char(new.data, 'YYYY-MM'))
    then raise exception 'mes_fechado' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;
create or replace trigger trava_mes_fechado_4l before insert or update on private.ocorrencias_ponto_4h for each row execute function private.trava_mes_fechado_4l();
create or replace trigger trava_mes_fechado_4l before insert or update on private.feriados_4h for each row execute function private.trava_mes_fechado_4l();

-- Gestão: fechar o mês de uma pessoa (a foto do espelho é montada pela tela da Gestão, com as mesmas regras do espelho).
create or replace function public.admin_fechar_mes_4l(p_employee_id uuid, p_mes text, p_resumo jsonb, p_dias jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_dig record; v_atual text := to_char((now() at time zone 'America/Fortaleza')::date, 'YYYY-MM');
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_mes is null or p_mes !~ '^20\d{2}-(0[1-9]|1[0-2])$' then raise exception 'mes_invalido' using errcode = '22023'; end if;
  if p_mes >= v_atual then raise exception 'mes_nao_terminou' using errcode = '22023'; end if;
  if not exists (select 1 from public.epi_employees where id = p_employee_id) then raise exception 'employee_not_found' using errcode = '22023'; end if;
  if jsonb_typeof(p_resumo) is distinct from 'object' or jsonb_typeof(p_dias) is distinct from 'array'
    or jsonb_array_length(p_dias) not between 28 and 31 or pg_column_size(p_dias) > 60000 or pg_column_size(p_resumo) > 4000
    or jsonb_typeof(p_resumo -> 'marcacoes') is distinct from 'number' then raise exception 'pedido_invalido' using errcode = '22023'; end if;
  select * into v_dig from private.digital_mes_4l(p_employee_id, p_mes);
  -- A tela precisa estar com as marcações de agora (se chegou marcação nova, recarregar antes de fechar).
  if (p_resumo ->> 'marcacoes')::integer <> v_dig.marcacoes then raise exception 'resumo_desatualizado' using errcode = '22023'; end if;
  insert into private.fechamento_mes_4l(employee_id, mes, resumo, dias, marcacoes, ultimo_nsr, fechado_por)
    values (p_employee_id, p_mes, p_resumo, p_dias, v_dig.marcacoes, v_dig.ultimo_nsr, (select auth.uid())) returning id into v_id;
  -- Aviso no celular (só para quem ligou os avisos e aceita "outros avisos"; o envio respeita o horário de trabalho).
  insert into private.avisos_funcionario_3u(employee_id, chave, tipo, titulo, corpo, url, expira_em)
  select p_employee_id, 'FECH:' || v_id, 'FECHAMENTO', 'Espelho do mês fechado',
    'Seu espelho de ' || private.nome_mes_4l(p_mes) || ' foi fechado. Confira no app e diga se está certo.', '/colaborador/espelho', now() + interval '10 days'
  where exists (select 1 from private.quem_recebe_3u() q where q.employee_id = p_employee_id)
  on conflict (chave) do nothing;
  return v_id;
exception when unique_violation then raise exception 'mes_ja_fechado' using errcode = '23505';
end $$;

create or replace function public.admin_reabrir_mes_4l(p_id bigint, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_motivo, ''))) not between 5 and 300 then raise exception 'motivo_obrigatorio' using errcode = '22023'; end if;
  update private.fechamento_mes_4l set reaberto_em = now(), reaberto_por = (select auth.uid()), motivo_reabertura = trim(p_motivo)
    where id = p_id and reaberto_em is null;
  if not found then raise exception 'fechamento_nao_encontrado' using errcode = '22023'; end if;
end $$;

create or replace function public.admin_fechamentos_4l(p_mes text)
returns table(id bigint, employee_id uuid, fechado_em timestamptz, resposta text, respondido_em timestamptz, comentario text, resumo jsonb,
  mudou boolean, reaberturas integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_mes is null or p_mes !~ '^20\d{2}-(0[1-9]|1[0-2])$' then raise exception 'mes_invalido' using errcode = '22023'; end if;
  return query select f.id, f.employee_id, f.fechado_em, f.resposta, f.respondido_em, f.comentario, f.resumo,
    (d.marcacoes <> f.marcacoes or d.ultimo_nsr is distinct from f.ultimo_nsr),
    (select count(*)::integer from private.fechamento_mes_4l r where r.employee_id = f.employee_id and r.mes = f.mes and r.reaberto_em is not null)
  from private.fechamento_mes_4l f cross join lateral private.digital_mes_4l(f.employee_id, f.mes) d
  where f.mes = p_mes and f.reaberto_em is null;
end $$;

-- App: a própria pessoa vê os meses fechados dela (últimos 13) e responde uma vez.
create or replace function public.my_fechamentos_4l()
returns table(id bigint, mes text, resumo jsonb, dias jsonb, fechado_em timestamptz, resposta text, respondido_em timestamptz, comentario text)
language plpgsql stable security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t();
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  return query select f.id, f.mes, f.resumo, f.dias, f.fechado_em, f.resposta, f.respondido_em, f.comentario
  from private.fechamento_mes_4l f where f.employee_id = v_emp and f.reaberto_em is null order by f.mes desc limit 13;
end $$;

create or replace function public.responder_fechamento_4l(p_id bigint, p_resposta text, p_comentario text) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t(); v_em timestamptz := now(); v_txt text := nullif(trim(coalesce(p_comentario, '')), '');
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  if p_resposta not in ('confirmado', 'contestado') then raise exception 'pedido_invalido' using errcode = '22023'; end if;
  if p_resposta = 'contestado' and char_length(coalesce(v_txt, '')) < 5 then raise exception 'comentario_obrigatorio' using errcode = '22023'; end if;
  if char_length(coalesce(v_txt, '')) > 500 then raise exception 'pedido_invalido' using errcode = '22023'; end if;
  update private.fechamento_mes_4l set resposta = p_resposta, respondido_em = v_em, comentario = v_txt
    where id = p_id and employee_id = v_emp and reaberto_em is null and resposta is null;
  if not found then raise exception 'fechamento_indisponivel' using errcode = '22023'; end if;
  return v_em;
end $$;

revoke all on function public.admin_fechar_mes_4l(uuid, text, jsonb, jsonb), public.admin_reabrir_mes_4l(bigint, text), public.admin_fechamentos_4l(text),
  public.my_fechamentos_4l(), public.responder_fechamento_4l(bigint, text, text) from public, anon;
grant execute on function public.admin_fechar_mes_4l(uuid, text, jsonb, jsonb), public.admin_reabrir_mes_4l(bigint, text), public.admin_fechamentos_4l(text),
  public.my_fechamentos_4l(), public.responder_fechamento_4l(bigint, text, text) to authenticated;
revoke all on function private.inicio_mes_4l(text), private.nome_mes_4l(text), private.digital_mes_4l(uuid, text), private.trava_mes_fechado_4l() from public, anon, authenticated;
select '4L pronto' as status;
