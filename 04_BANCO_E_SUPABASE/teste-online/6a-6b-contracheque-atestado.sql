-- Marcos 6A (contracheque no app) e 6B (atestado pelo app) — TESTE ONLINE, dados fictícios.
-- Arquivos ficam num "balde" PRIVADO do Storage (`documentos-6`): ninguém acessa direto. Quem envia e quem abre passa pela
-- Edge Function `arquivos-6`, que confere no banco (como a própria pessoa) se pode, e só então grava ou gera um link de 2 minutos.
-- Atestado é dado de saúde (LGPD art. 11): só a própria pessoa e o administrador ativo veem; não pedimos CID.

-- Parte 1 (migração separada): tipos novos de aviso no celular do funcionário.
alter table private.avisos_funcionario_3u drop constraint if exists avisos_funcionario_3u_tipo_check,
  add constraint avisos_funcionario_3u_tipo_check check (tipo in ('PONTO', 'COMUNICADO', 'TROCA_EPI', 'PEDIDO_MATERIAL', 'ENTREGA_EPI', 'ITEM_PESSOAL',
    'FECHAMENTO', 'CONTRACHEQUE', 'ATESTADO'));

-- Parte 2.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos-6', 'documentos-6', false, 6291456, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Pedido de envio: a pessoa (ou a Gestão) pede para enviar; o banco confere a permissão e devolve um "bilhete" de uso único (15 min).
create table if not exists private.envios_6 (
  ticket uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('CONTRACHEQUE', 'ATESTADO')),
  employee_id uuid not null references public.epi_employees(id) on delete cascade,
  dados jsonb not null check (jsonb_typeof(dados) = 'object'),
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  usado_em timestamptz
);
create table if not exists private.arquivos_6 (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.epi_employees(id) on delete cascade,
  tipo text not null check (tipo in ('CONTRACHEQUE', 'ATESTADO')),
  caminho text not null unique check (caminho ~ '^(contracheque|atestado)/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$'),
  mime text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png')),
  tamanho integer not null check (tamanho between 1 and 6291456),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  enviado_em timestamptz not null default now(),
  enviado_por uuid not null references auth.users(id),
  removido_em timestamptz,
  removido_por uuid references auth.users(id)
);
create table if not exists private.contracheques_6a (
  id bigint generated always as identity primary key,
  arquivo_id uuid not null unique references private.arquivos_6(id),
  employee_id uuid not null references public.epi_employees(id) on delete cascade,
  competencia text not null check (competencia ~ '^20\d{2}-(0[1-9]|1[0-2])$'),
  tipo_folha text not null check (tipo_folha in ('mensal', 'adiantamento', 'ferias', 'decimo_terceiro')),
  publicado_em timestamptz not null default now(),
  visto_em timestamptz,
  removido_em timestamptz,
  removido_por uuid references auth.users(id)
);
create unique index if not exists contracheques_6a_ativo on private.contracheques_6a(employee_id, competencia, tipo_folha) where removido_em is null;
create table if not exists private.atestados_6b (
  id bigint generated always as identity primary key,
  arquivo_id uuid not null unique references private.arquivos_6(id),
  employee_id uuid not null references public.epi_employees(id) on delete cascade,
  chave uuid not null unique,
  data_inicio date not null,
  dias integer not null check (dias between 1 and 30),
  observacao text check (observacao is null or char_length(observacao) <= 200),
  status text not null default 'enviado' check (status in ('enviado', 'aceito', 'recusado', 'cancelado')),
  enviado_em timestamptz not null default now(),
  decidido_em timestamptz,
  decidido_por uuid references auth.users(id),
  motivo_recusa text check (motivo_recusa is null or char_length(motivo_recusa) between 5 and 300),
  dias_lancados integer
);
create index if not exists atestados_6b_status on private.atestados_6b(status, enviado_em);
alter table private.envios_6 enable row level security;
alter table private.arquivos_6 enable row level security;
alter table private.contracheques_6a enable row level security;
alter table private.atestados_6b enable row level security;
revoke all on private.envios_6, private.arquivos_6, private.contracheques_6a, private.atestados_6b from public, anon, authenticated, service_role;

create or replace function private.mes_extenso_6(p_mes text) returns text language sql immutable set search_path = '' as $$
  select (array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'])[substr(p_mes, 6, 2)::int]
    || ' de ' || substr(p_mes, 1, 4)
$$;

-- ---------- 6A: Gestão pede para publicar um contracheque ----------
create or replace function public.iniciar_contracheque_6a(p_employee_id uuid, p_competencia text, p_tipo_folha text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_ticket uuid; v_atual text := to_char((now() at time zone 'America/Fortaleza')::date, 'YYYY-MM');
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_competencia is null or p_competencia !~ '^20\d{2}-(0[1-9]|1[0-2])$' or p_competencia > v_atual or p_competencia < '2020-01' then
    raise exception 'competencia_invalida' using errcode = '22023'; end if;
  if p_tipo_folha not in ('mensal', 'adiantamento', 'ferias', 'decimo_terceiro') then raise exception 'pedido_invalido' using errcode = '22023'; end if;
  if not exists (select 1 from public.epi_employees where id = p_employee_id) then raise exception 'employee_not_found' using errcode = '22023'; end if;
  insert into private.envios_6(tipo, employee_id, dados, criado_por)
    values ('CONTRACHEQUE', p_employee_id, jsonb_build_object('competencia', p_competencia, 'tipo_folha', p_tipo_folha), (select auth.uid())) returning ticket into v_ticket;
  return v_ticket;
end $$;

-- ---------- 6B: funcionário pede para enviar um atestado ----------
create or replace function public.iniciar_atestado_6b(p_data_inicio date, p_dias integer, p_observacao text, p_chave uuid)
returns table(ticket uuid, employee_id uuid, duplicado boolean) language plpgsql security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t(); v_hoje date := (now() at time zone 'America/Fortaleza')::date; v_obs text := nullif(trim(coalesce(p_observacao, '')), '');
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  if p_chave is null then raise exception 'pedido_invalido' using errcode = '22023'; end if;
  if exists (select 1 from private.atestados_6b a where a.chave = p_chave and a.employee_id = v_emp) then
    return query select null::uuid, v_emp, true; return; end if;
  if p_data_inicio is null or p_data_inicio < v_hoje - 60 or p_data_inicio > v_hoje + 1 then raise exception 'data_invalida' using errcode = '22023'; end if;
  if p_dias is null or p_dias not between 1 and 30 then raise exception 'dias_invalidos' using errcode = '22023'; end if;
  if char_length(coalesce(v_obs, '')) > 200 or v_obs ~ '[[:cntrl:]]' then raise exception 'pedido_invalido' using errcode = '22023'; end if;
  -- Proteção contra excesso: no máximo 5 pedidos de envio por hora.
  if (select count(*) from private.envios_6 e where e.employee_id = v_emp and e.tipo = 'ATESTADO' and e.criado_em > now() - interval '1 hour') >= 5 then
    raise exception 'muitos_envios' using errcode = '54000'; end if;
  return query insert into private.envios_6(tipo, employee_id, dados, criado_por)
    values ('ATESTADO', v_emp, jsonb_build_object('data_inicio', p_data_inicio, 'dias', p_dias, 'observacao', v_obs, 'chave', p_chave), (select auth.uid()))
    returning envios_6.ticket, envios_6.employee_id, false;
end $$;

-- ---------- Conclusão (só a Edge Function, com a conexão do servidor): grava o arquivo e o registro ----------
create or replace function private.concluir_envio_6(p_ticket uuid, p_caminho text, p_mime text, p_tamanho integer, p_sha256 text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v record; v_arq uuid; v_id bigint; v_nome text;
begin
  select * into v from private.envios_6 where ticket = p_ticket for update;
  if v.ticket is null or v.usado_em is not null or v.criado_em < now() - interval '15 minutes' then raise exception 'bilhete_invalido' using errcode = '22023'; end if;
  if p_caminho is distinct from (lower(v.tipo) || '/' || v.employee_id || '/' || v.ticket || '.' || case p_mime when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' end) then
    raise exception 'caminho_invalido' using errcode = '22023'; end if;
  if v.tipo = 'CONTRACHEQUE' and p_mime <> 'application/pdf' then raise exception 'tipo_arquivo' using errcode = '22023'; end if;
  update private.envios_6 set usado_em = now() where ticket = p_ticket;
  insert into private.arquivos_6(employee_id, tipo, caminho, mime, tamanho, sha256, enviado_por)
    values (v.employee_id, v.tipo, p_caminho, p_mime, p_tamanho, p_sha256, v.criado_por) returning id into v_arq;
  select e.full_name into v_nome from public.epi_employees e where e.id = v.employee_id;
  if v.tipo = 'CONTRACHEQUE' then
    -- Mandar de novo o mesmo mês substitui o anterior (o anterior fica guardado como removido).
    update private.contracheques_6a set removido_em = now(), removido_por = v.criado_por
      where employee_id = v.employee_id and competencia = v.dados->>'competencia' and tipo_folha = v.dados->>'tipo_folha' and removido_em is null;
    insert into private.contracheques_6a(arquivo_id, employee_id, competencia, tipo_folha)
      values (v_arq, v.employee_id, v.dados->>'competencia', v.dados->>'tipo_folha') returning id into v_id;
    insert into private.avisos_funcionario_3u(employee_id, chave, tipo, titulo, corpo, url, expira_em)
    select v.employee_id, 'CC:' || v_id, 'CONTRACHEQUE', 'Contracheque no app',
      'Seu contracheque de ' || private.mes_extenso_6(v.dados->>'competencia') || ' já está no app.', '/colaborador/contracheques', now() + interval '10 days'
    where exists (select 1 from private.quem_recebe_3u() q where q.employee_id = v.employee_id)
    on conflict (chave) do nothing;
  else
    insert into private.atestados_6b(arquivo_id, employee_id, chave, data_inicio, dias, observacao)
      values (v_arq, v.employee_id, (v.dados->>'chave')::uuid, (v.dados->>'data_inicio')::date, (v.dados->>'dias')::int, v.dados->>'observacao') returning id into v_id;
  end if;
  return jsonb_build_object('id', v_id, 'arquivo_id', v_arq, 'tipo', v.tipo, 'nome', v_nome,
    'data_inicio', v.dados->>'data_inicio', 'dias', v.dados->>'dias');
exception when unique_violation then raise exception 'ja_enviado' using errcode = '23505';
end $$;

-- ---------- Abrir um arquivo: a própria pessoa ou o administrador ----------
create or replace function public.abrir_arquivo_6(p_id uuid) returns table(caminho text, mime text, nome text)
language plpgsql security definer set search_path = '' as $$
declare a record; v_emp uuid := private.funcionario_do_app_3t(); v_admin boolean := public.is_active_admin(); v_comp text;
begin
  select * into a from private.arquivos_6 x where x.id = p_id and x.removido_em is null;
  if a.id is null or not (v_admin or a.employee_id = v_emp) then raise exception 'arquivo_indisponivel' using errcode = '42501'; end if;
  if a.tipo = 'CONTRACHEQUE' then
    select c.competencia into v_comp from private.contracheques_6a c where c.arquivo_id = a.id and c.removido_em is null;
    if v_comp is null then raise exception 'arquivo_indisponivel' using errcode = '42501'; end if;
    -- Registro de que o funcionário abriu (só quando é ele mesmo).
    if a.employee_id = v_emp then update private.contracheques_6a set visto_em = now() where arquivo_id = a.id and visto_em is null; end if;
    return query select a.caminho, a.mime, 'contracheque-' || v_comp || '.pdf';
  else
    return query select a.caminho, a.mime, 'atestado-' || to_char(a.enviado_em at time zone 'America/Fortaleza', 'YYYY-MM-DD') || '.' || split_part(a.caminho, '.', 2);
  end if;
end $$;

-- ---------- Gestão ----------
create or replace function public.admin_contracheques_6a(p_competencia text)
returns table(id bigint, employee_id uuid, arquivo_id uuid, tipo_folha text, publicado_em timestamptz, visto_em timestamptz, tamanho integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  return query select c.id, c.employee_id, c.arquivo_id, c.tipo_folha, c.publicado_em, c.visto_em, a.tamanho
    from private.contracheques_6a c join private.arquivos_6 a on a.id = c.arquivo_id
    where c.competencia = p_competencia and c.removido_em is null order by c.publicado_em;
end $$;
create or replace function public.admin_remover_contracheque_6a(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  update private.contracheques_6a set removido_em = now(), removido_por = (select auth.uid()) where id = p_id and removido_em is null;
  if not found then raise exception 'nao_encontrado' using errcode = '22023'; end if;
end $$;
create or replace function public.admin_atestados_6b()
returns table(id bigint, employee_id uuid, funcionario text, matricula text, arquivo_id uuid, data_inicio date, dias integer, observacao text,
  status text, enviado_em timestamptz, decidido_em timestamptz, motivo_recusa text, dias_lancados integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  return query select a.id, a.employee_id, e.full_name, e.registration_code, a.arquivo_id, a.data_inicio, a.dias, a.observacao,
    a.status, a.enviado_em, a.decidido_em, a.motivo_recusa, a.dias_lancados
    from private.atestados_6b a join public.epi_employees e on e.id = a.employee_id
    where a.status = 'enviado' or a.enviado_em > now() - interval '60 days'
    order by (a.status = 'enviado') desc, a.enviado_em limit 200;
end $$;
-- Aceitar lança "Atestado" no ponto em cada dia de trabalho do período (mesma regra das ocorrências 4H; mês fechado trava).
create or replace function public.admin_decidir_atestado_6b(p_id bigint, p_aceitar boolean, p_motivo text) returns integer
language plpgsql security definer set search_path = '' as $$
declare a record; d date; v_jornada jsonb := public.jornada_padrao_4g(); n integer := 0; v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  select * into a from private.atestados_6b where id = p_id for update;
  if a.id is null or a.status <> 'enviado' then raise exception 'atestado_indisponivel' using errcode = '22023'; end if;
  if p_aceitar then
    for d in select g::date from generate_series(a.data_inicio, a.data_inicio + (a.dias - 1), interval '1 day') g loop
      if jsonb_array_length(coalesce(v_jornada -> extract(isodow from d)::int::text, '[]'::jsonb)) > 0
         and not exists (select 1 from private.feriados_4h f where f.data = d and f.ativo) then
        update private.ocorrencias_ponto_4h set cancelled_at = now(), cancelled_by = (select auth.uid())
          where employee_id = a.employee_id and data = d and cancelled_at is null;
        insert into private.ocorrencias_ponto_4h(employee_id, data, tipo, observacao, created_by)
          values (a.employee_id, d, 'atestado', 'Atestado enviado pelo app nº ' || a.id, (select auth.uid()));
        n := n + 1;
      end if;
    end loop;
    update private.atestados_6b set status = 'aceito', decidido_em = now(), decidido_por = (select auth.uid()), dias_lancados = n where id = p_id;
  else
    if char_length(coalesce(v_motivo, '')) < 5 then raise exception 'motivo_obrigatorio' using errcode = '22023'; end if;
    update private.atestados_6b set status = 'recusado', decidido_em = now(), decidido_por = (select auth.uid()), motivo_recusa = left(v_motivo, 300) where id = p_id;
  end if;
  insert into private.avisos_funcionario_3u(employee_id, chave, tipo, titulo, corpo, url, expira_em)
  select a.employee_id, 'AT:' || a.id || ':' || case when p_aceitar then 'A' else 'R' end, 'ATESTADO', 'Atestado',
    case when p_aceitar then 'Seu atestado foi recebido e lançado no ponto.' else 'Seu atestado não foi aceito. Veja o motivo no app.' end,
    '/colaborador/atestado', now() + interval '7 days'
  where exists (select 1 from private.quem_recebe_3u() q where q.employee_id = a.employee_id)
  on conflict (chave) do nothing;
  return n;
end $$;

-- ---------- App ----------
create or replace function public.my_contracheques_6a()
returns table(id bigint, arquivo_id uuid, competencia text, tipo_folha text, publicado_em timestamptz, visto_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t();
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  return query select c.id, c.arquivo_id, c.competencia, c.tipo_folha, c.publicado_em, c.visto_em from private.contracheques_6a c
    where c.employee_id = v_emp and c.removido_em is null order by c.competencia desc, c.publicado_em desc limit 36;
end $$;
create or replace function public.my_atestados_6b()
returns table(id bigint, arquivo_id uuid, data_inicio date, dias integer, status text, enviado_em timestamptz, decidido_em timestamptz, motivo_recusa text)
language plpgsql stable security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t();
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  return query select a.id, a.arquivo_id, a.data_inicio, a.dias, a.status, a.enviado_em, a.decidido_em, a.motivo_recusa from private.atestados_6b a
    where a.employee_id = v_emp order by a.enviado_em desc limit 24;
end $$;
create or replace function public.cancelar_atestado_6b(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t();
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  update private.atestados_6b set status = 'cancelado', decidido_em = now() where id = p_id and employee_id = v_emp and status = 'enviado';
  if not found then raise exception 'atestado_indisponivel' using errcode = '22023'; end if;
end $$;

revoke all on function public.iniciar_contracheque_6a(uuid, text, text), public.iniciar_atestado_6b(date, integer, text, uuid), public.abrir_arquivo_6(uuid),
  public.admin_contracheques_6a(text), public.admin_remover_contracheque_6a(bigint), public.admin_atestados_6b(), public.admin_decidir_atestado_6b(bigint, boolean, text),
  public.my_contracheques_6a(), public.my_atestados_6b(), public.cancelar_atestado_6b(bigint) from public, anon;
grant execute on function public.iniciar_contracheque_6a(uuid, text, text), public.iniciar_atestado_6b(date, integer, text, uuid), public.abrir_arquivo_6(uuid),
  public.admin_contracheques_6a(text), public.admin_remover_contracheque_6a(bigint), public.admin_atestados_6b(), public.admin_decidir_atestado_6b(bigint, boolean, text),
  public.my_contracheques_6a(), public.my_atestados_6b(), public.cancelar_atestado_6b(bigint) to authenticated;
revoke all on function private.concluir_envio_6(uuid, text, text, integer, text), private.mes_extenso_6(text) from public, anon, authenticated, service_role;
