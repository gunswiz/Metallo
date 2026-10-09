-- Marco 3P (TESTE ONLINE, dados fictícios): aviso no celular para lembrar o consumo do dia.
-- Segredos (chaves VAPID e segredo do agendamento) ficam no Vault do projeto, nunca no repositório.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists private.push_subscriptions_3p (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  fail_count int not null default 0
);
create index if not exists push_subscriptions_3p_user on private.push_subscriptions_3p(user_id);
alter table private.push_subscriptions_3p enable row level security;
revoke all on private.push_subscriptions_3p from public, anon, authenticated, service_role;

-- Só quem usa a Gestão (perfil ativo) liga avisos. Se o aparelho já estava ligado a outra conta, passa para esta.
create or replace function public.save_push_subscription_3p(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not exists (select 1 from public.profiles where id = (select auth.uid()) and active)
  then raise exception 'gestao_required' using errcode = '42501'; end if;
  insert into private.push_subscriptions_3p(user_id, endpoint, p256dh, auth)
    values ((select auth.uid()), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    created_at = now(), fail_count = 0;
end $$;
create or replace function public.delete_push_subscription_3p(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from private.push_subscriptions_3p where endpoint = p_endpoint and user_id = (select auth.uid());
$$;
create or replace function public.my_push_count_3p()
returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int from private.push_subscriptions_3p where user_id = (select auth.uid());
$$;
revoke all on function public.save_push_subscription_3p(text, text, text), public.delete_push_subscription_3p(text), public.my_push_count_3p() from public, anon;
grant execute on function public.save_push_subscription_3p(text, text, text), public.delete_push_subscription_3p(text), public.my_push_count_3p() to authenticated;

-- Equipes de campo ativas sem nenhum consumo lançado hoje (dia de Fortaleza).
create or replace function private.equipes_sem_consumo_hoje_3p()
returns table(team_id uuid, team_name text) language sql stable security definer set search_path = '' as $$
  select t.id, t.name from public.teams t
  where t.active and t.location_type = 'field'
    and not exists (select 1 from public.movements m where m.movement_type = 'consumption' and m.origin_team_id = t.id
      and (m.occurred_at at time zone 'America/Fortaleza')::date = (now() at time zone 'America/Fortaleza')::date)
  order by t.name;
$$;
revoke all on function private.equipes_sem_consumo_hoje_3p() from public, anon, authenticated, service_role;

-- Quem pode lançar consumo de uma equipe (mesma regra de public.can_operate, para um perfil qualquer).
create or replace function private.pode_lancar_consumo_3p(p_user uuid, p_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role = 'admin' or (
      'consumption:write' = any(coalesce(p.operation_permissions, case p.role
        when 'engineer' then array['consumption:write'] when 'leader' then array['consumption:write'] else array[]::text[] end))
      and case when p.operation_team_ids is not null then p_team = any(p.operation_team_ids) else p.role = 'engineer' or p.team_id = p_team end)
    from public.profiles p where p.id = p_user and p.active), false);
$$;
revoke all on function private.pode_lancar_consumo_3p(uuid, uuid) from public, anon, authenticated, service_role;

-- Para a tela Início: equipes que o usuário pode lançar e ainda estão sem consumo hoje.
create or replace function public.my_teams_without_consumption_today_3p()
returns table(team_id uuid, team_name text) language sql stable security definer set search_path = '' as $$
  select e.team_id, e.team_name from private.equipes_sem_consumo_hoje_3p() e
  where private.pode_lancar_consumo_3p((select auth.uid()), e.team_id);
$$;
revoke all on function public.my_teams_without_consumption_today_3p() from public, anon;
grant execute on function public.my_teams_without_consumption_today_3p() to authenticated;

-- Agendamento: segunda a sábado, 16h30 em Fortaleza (19h30 UTC). O segredo vai no cabeçalho, lido do Vault na hora.
select cron.unschedule('metallo-lembrete-consumo') where exists (select 1 from cron.job where jobname = 'metallo-lembrete-consumo');
select cron.schedule('metallo-lembrete-consumo', '30 19 * * 1-6', $job$
  select net.http_post(
    url := 'https://cvimwiqokkujfhwynhmt.supabase.co/functions/v1/lembrete-consumo',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-metallo-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'metallo_cron_lembrete')),
    body := '{"acao":"agendado"}'::jsonb, timeout_milliseconds := 20000);
$job$);

select '3P pronto' as status;
