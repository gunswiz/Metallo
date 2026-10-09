-- Marco 3U (TESTE ONLINE, dados fictícios): avisos no celular do FUNCIONÁRIO.
-- 1) Lembrete na hora do ponto (entrada, almoço, volta, saída), só se a marcação ainda não foi feita, e nunca em
--    feriado, folga, férias, atestado ou outra ocorrência lançada no espelho.
-- 2) Outros avisos: comunicado novo, resposta de troca de EPI, resposta de pedido de material, EPI ou item entregue
--    para confirmar. Esses só saem DENTRO do horário de trabalho do dia (direito à desconexão): o que chegar fora
--    do horário espera o próximo dia de trabalho.
-- O próprio funcionário liga/desliga e escolhe o que quer receber. Segredos (chaves VAPID) ficam só no Vault.

create table if not exists private.push_funcionario_3u (
  id bigint generated always as identity primary key,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.epi_employees(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  fail_count int not null default 0
);
create index if not exists push_funcionario_3u_emp on private.push_funcionario_3u(employee_id);
create table if not exists private.push_prefs_3u (
  employee_id uuid primary key references public.epi_employees(id) on delete cascade,
  lembrete_ponto boolean not null default true,
  outros_avisos boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists private.avisos_funcionario_3u (
  id bigint generated always as identity primary key,
  employee_id uuid not null references public.epi_employees(id) on delete cascade,
  chave text not null unique check (char_length(chave) <= 200),
  tipo text not null check (tipo in ('PONTO', 'COMUNICADO', 'TROCA_EPI', 'PEDIDO_MATERIAL', 'ENTREGA_EPI', 'ITEM_PESSOAL')),
  titulo text not null check (char_length(titulo) between 1 and 80),
  corpo text not null check (char_length(corpo) between 1 and 240),
  url text not null check (url ~ '^/colaborador/[a-z]+$'),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  enviado_em timestamptz,
  tentativas int not null default 0
);
create index if not exists avisos_funcionario_3u_pendentes on private.avisos_funcionario_3u(criado_em) where enviado_em is null;
create table if not exists private.avisos_estado_3u (singleton boolean primary key default true check (singleton), ultima_coleta timestamptz not null);
insert into private.avisos_estado_3u(singleton, ultima_coleta) values (true, now()) on conflict do nothing;
alter table private.push_funcionario_3u enable row level security;
alter table private.push_prefs_3u enable row level security;
alter table private.avisos_funcionario_3u enable row level security;
alter table private.avisos_estado_3u enable row level security;
revoke all on private.push_funcionario_3u, private.push_prefs_3u, private.avisos_funcionario_3u, private.avisos_estado_3u from public, anon, authenticated, service_role;

-- App do funcionário: liga este aparelho, desliga, lê e muda o que quer receber.
create or replace function public.save_my_push_3u(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t();
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  insert into private.push_funcionario_3u(auth_user_id, employee_id, endpoint, p256dh, auth)
    values ((select auth.uid()), v_emp, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set auth_user_id = excluded.auth_user_id, employee_id = excluded.employee_id,
    p256dh = excluded.p256dh, auth = excluded.auth, created_at = now(), fail_count = 0;
  insert into private.push_prefs_3u(employee_id) values (v_emp) on conflict do nothing;
end $$;
create or replace function public.delete_my_push_3u(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from private.push_funcionario_3u where endpoint = p_endpoint and auth_user_id = (select auth.uid());
$$;
create or replace function public.my_push_3u()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t();
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  return jsonb_build_object(
    'aparelhos', (select count(*) from private.push_funcionario_3u where employee_id = v_emp and auth_user_id = (select auth.uid())),
    'lembrete_ponto', coalesce((select lembrete_ponto from private.push_prefs_3u where employee_id = v_emp), true),
    'outros_avisos', coalesce((select outros_avisos from private.push_prefs_3u where employee_id = v_emp), true));
end $$;
create or replace function public.set_my_push_prefs_3u(p_lembrete_ponto boolean, p_outros_avisos boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t();
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  if p_lembrete_ponto is null or p_outros_avisos is null then raise exception 'pedido_invalido' using errcode = '22023'; end if;
  insert into private.push_prefs_3u(employee_id, lembrete_ponto, outros_avisos) values (v_emp, p_lembrete_ponto, p_outros_avisos)
  on conflict (employee_id) do update set lembrete_ponto = excluded.lembrete_ponto, outros_avisos = excluded.outros_avisos, updated_at = now();
end $$;
revoke all on function public.save_my_push_3u(text, text, text), public.delete_my_push_3u(text), public.my_push_3u(), public.set_my_push_prefs_3u(boolean, boolean) from public, anon;
grant execute on function public.save_my_push_3u(text, text, text), public.delete_my_push_3u(text), public.my_push_3u(), public.set_my_push_prefs_3u(boolean, boolean) to authenticated;

-- Horários do dia (Fortaleza) para a pessoa; vazio = não é dia de trabalho para ela (fim de semana, feriado, ocorrência).
create or replace function private.horarios_do_dia_3u(p_employee uuid, p_dia date)
returns text[] language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from private.feriados_4h f where f.data = p_dia and f.ativo) then array[]::text[]
    when exists (select 1 from private.ocorrencias_ponto_4h o where o.employee_id = p_employee and o.data = p_dia and o.cancelled_at is null) then array[]::text[]
    else coalesce((select array(select jsonb_array_elements_text(j.dias -> extract(isodow from p_dia)::int::text)) from private.jornada_4g j where j.singleton), array[]::text[])
  end;
$$;
-- Dentro do horário de trabalho de hoje (de 30 min antes da entrada até a saída)?
create or replace function private.em_horario_de_trabalho_3u(p_employee uuid, p_agora timestamptz default now())
returns boolean language sql stable security definer set search_path = '' as $$
  with h as (select (p_agora at time zone 'America/Fortaleza') local, private.horarios_do_dia_3u(p_employee, (p_agora at time zone 'America/Fortaleza')::date) hs)
  select cardinality(h.hs) >= 2 and h.local::time between (h.hs[1]::time - interval '30 minutes') and h.hs[cardinality(h.hs)]::time from h;
$$;

-- Quem tem aparelho ligado e quer "outros avisos" (um login por pessoa).
create or replace function private.quem_recebe_3u()
returns table(employee_id uuid, auth_user_id uuid) language sql stable security definer set search_path = '' as $$
  select distinct on (s.employee_id) s.employee_id, s.auth_user_id from private.push_funcionario_3u s
    left join private.push_prefs_3u p on p.employee_id = s.employee_id where coalesce(p.outros_avisos, true) order by s.employee_id, s.created_at desc;
$$;

-- Coleta dos avisos novos desde a última vez (com 15 min de folga; a chave única impede repetir).
create or replace function private.coletar_avisos_3u()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_desde timestamptz; v_ate timestamptz := now(); n integer := 0; k integer;
begin
  select ultima_coleta - interval '15 minutes' into v_desde from private.avisos_estado_3u where singleton for update;

  insert into private.avisos_funcionario_3u(employee_id, chave, tipo, titulo, corpo, url, expira_em)
  select q.employee_id, 'COM:' || c.id || ':' || q.employee_id, 'COMUNICADO', 'Novo comunicado', left(c.title, 200), '/colaborador/comunicados', now() + interval '7 days'
  from private.communications_3h c cross join private.quem_recebe_3u() q cross join lateral private.communication_context_3h(q.auth_user_id) ctx
  where c.status = 'PUBLISHED' and c.published_at > v_desde and c.published_at <= v_ate and (c.expires_at is null or c.expires_at > now())
    and ctx.employee_id = q.employee_id
    and (c.audience = 'ALL' or (c.audience = 'TEAM' and c.team_id = ctx.team_id) or (c.audience = 'WORK' and c.work_id = ctx.work_id))
  on conflict (chave) do nothing;
  get diagnostics k = row_count; n := n + k;

  insert into private.avisos_funcionario_3u(employee_id, chave, tipo, titulo, corpo, url, expira_em)
  select r.employee_id, 'TROCA:' || r.id || ':' || r.status, 'TROCA_EPI', 'Troca de EPI',
    case r.status when 'APROVADA' then 'Sua troca de ' || left(r.item_name_snapshot, 80) || ' foi aprovada.'
      else 'Sua troca de ' || left(r.item_name_snapshot, 80) || ' não foi aprovada. Veja o motivo no app.' end,
    '/colaborador/epis', now() + interval '7 days'
  from public.epi_exchange_requests r join private.quem_recebe_3u() q on q.employee_id = r.employee_id
  where r.status in ('APROVADA', 'RECUSADA') and r.decided_at > v_desde and r.decided_at <= v_ate
  on conflict (chave) do nothing;
  get diagnostics k = row_count; n := n + k;

  insert into private.avisos_funcionario_3u(employee_id, chave, tipo, titulo, corpo, url, expira_em)
  select p.employee_id, 'MATERIAL:' || p.id || ':' || p.status, 'PEDIDO_MATERIAL', 'Pedido de material',
    case p.status when 'atendido' then 'Seu pedido de ' || left(i.name, 80) || ' foi atendido.'
      else 'Seu pedido de ' || left(i.name, 80) || ' não foi atendido. Veja o motivo no app.' end,
    '/colaborador/material', now() + interval '7 days'
  from private.pedidos_material_3t p join public.items i on i.id = p.item_id join private.quem_recebe_3u() q on q.employee_id = p.employee_id
  where p.status in ('atendido', 'recusado') and p.decided_at > v_desde and p.decided_at <= v_ate
  on conflict (chave) do nothing;
  get diagnostics k = row_count; n := n + k;

  insert into private.avisos_funcionario_3u(employee_id, chave, tipo, titulo, corpo, url, expira_em)
  select g.employee_id, 'ENTREGA:' || g.id, 'ENTREGA_EPI', 'EPI entregue', 'Você recebeu EPI. Abra o app para conferir e confirmar o recebimento.',
    '/colaborador/epis', now() + interval '7 days'
  from public.epi_delivery_groups_3d g join private.quem_recebe_3u() q on q.employee_id = g.employee_id
  where g.delivered_at > v_desde and g.delivered_at <= v_ate
  on conflict (chave) do nothing;
  get diagnostics k = row_count; n := n + k;

  insert into private.avisos_funcionario_3u(employee_id, chave, tipo, titulo, corpo, url, expira_em)
  select d.employee_id, 'ITEM:' || d.id, 'ITEM_PESSOAL', 'Item entregue', 'Você recebeu: ' || left(d.item_name_snapshot, 80) || '. Confirme no app.',
    '/colaborador/itens', now() + interval '7 days'
  from private.personal_item_deliveries_3g d join private.quem_recebe_3u() q on q.employee_id = d.employee_id
  where d.delivered_at > v_desde and d.delivered_at <= v_ate
  on conflict (chave) do nothing;
  get diagnostics k = row_count; n := n + k;

  update private.avisos_estado_3u set ultima_coleta = v_ate where singleton;
  return n;
end $$;

-- Lembrete do ponto: do horário marcado até 9 min depois, se ainda faltar essa marcação hoje.
create or replace function private.lembretes_ponto_3u(p_agora timestamptz default now())
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; v_local timestamp := p_agora at time zone 'America/Fortaleza'; v_dia date := (p_agora at time zone 'America/Fortaleza')::date;
  hs text[]; i int; feitas int; n int := 0; k int; nomes text[] := array['entrada', 'saída para o almoço', 'volta do almoço', 'saída'];
begin
  for r in select distinct s.employee_id from private.push_funcionario_3u s
    left join private.push_prefs_3u p on p.employee_id = s.employee_id
    join public.epi_employees e on e.id = s.employee_id and e.active
    where coalesce(p.lembrete_ponto, true) loop
    hs := private.horarios_do_dia_3u(r.employee_id, v_dia);
    if cardinality(hs) = 0 then continue; end if;
    for i in 1 .. cardinality(hs) loop
      if v_local >= v_dia + hs[i]::time and v_local < v_dia + hs[i]::time + interval '9 minutes' then
        select count(*) into feitas from ponto.marcacao m where m.employee_id = r.employee_id
          and m.marking_at >= (v_dia::timestamp at time zone 'America/Fortaleza') and m.marking_at < ((v_dia + 1)::timestamp at time zone 'America/Fortaleza');
        if feitas < i then
          insert into private.avisos_funcionario_3u(employee_id, chave, tipo, titulo, corpo, url, expira_em)
          values (r.employee_id, 'PONTO:' || v_dia || ':' || i || ':' || r.employee_id, 'PONTO', 'Hora do ponto',
            'Hora de bater o ponto: ' || case when cardinality(hs) = 4 then nomes[i] else 'marcação ' || i end || ' (' || hs[i] || '). Se já bateu, pode ignorar.',
            '/colaborador/ponto', ((v_dia + hs[i]::time + interval '1 hour')::timestamp at time zone 'America/Fortaleza'))
          on conflict (chave) do nothing;
          get diagnostics k = row_count; n := n + k;
        end if;
      end if;
    end loop;
  end loop;
  return n;
end $$;

-- O que pode sair agora: lembrete do ponto sempre; os outros só no horário de trabalho da pessoa.
create or replace function private.avisos_para_enviar_3u()
returns table(aviso_id bigint, sub_id bigint, endpoint text, p256dh text, auth text, titulo text, corpo text, url text, tipo text)
language sql stable security definer set search_path = '' as $$
  select a.id, s.id, s.endpoint, s.p256dh, s.auth, a.titulo, a.corpo, a.url, a.tipo
  from private.avisos_funcionario_3u a join private.push_funcionario_3u s on s.employee_id = a.employee_id
  where a.enviado_em is null and a.expira_em > now() and a.tentativas < 5
    and (a.tipo = 'PONTO' or private.em_horario_de_trabalho_3u(a.employee_id, now()))
  order by a.id limit 500;
$$;
revoke all on function private.quem_recebe_3u(), private.horarios_do_dia_3u(uuid, date), private.em_horario_de_trabalho_3u(uuid, timestamptz), private.coletar_avisos_3u(),
  private.lembretes_ponto_3u(timestamptz), private.avisos_para_enviar_3u() from public, anon, authenticated, service_role;

-- A cada 5 minutos (o lembrete do ponto chega até 5 min depois do horário).
select cron.schedule('metallo-avisos-funcionario', '*/5 * * * *', $job$
  select net.http_post(
    url := 'https://cvimwiqokkujfhwynhmt.supabase.co/functions/v1/avisos-funcionario',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-metallo-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'metallo_cron_ponto')),
    body := '{"acao":"agendado"}'::jsonb, timeout_milliseconds := 30000);
$job$);

select '3U pronto' as status;
