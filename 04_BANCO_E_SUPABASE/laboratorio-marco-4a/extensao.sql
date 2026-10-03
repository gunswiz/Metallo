-- Extensão do MESMO núcleo aprovado, em uma instância sintética própria do 4A.
-- Não modifica tabelas, funções ou arquivos do 2F; não aplicar no Supabase remoto.
create schema lab4a;
revoke all on schema lab4a from public;
create table lab4a.intent (
  idempotency_key uuid primary key,
  auth_user_id uuid not null,
  employee_id uuid not null,
  marking_at timestamptz not null default date_trunc('milliseconds',clock_timestamp()),
  timezone text not null default 'America/Fortaleza' check(timezone='America/Fortaleza'),
  collector text not null default 'BROWSER' check(collector='BROWSER'),
  online boolean not null default true check(online)
);
create table lab4a.context (
  idempotency_key uuid primary key references lab4a.intent(idempotency_key),
  location jsonb not null,
  request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$')
);
create table lab4a.receipt (
  synthetic_sequence bigint generated always as identity primary key,
  idempotency_key uuid not null unique references lab4a.context(idempotency_key),
  event_id uuid not null unique references public.lab_time_event(event_id),
  recorded_at timestamptz not null,
  previous_hash text,
  hash_version integer not null check(hash_version=1),
  payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$')
);
create function lab4a.immutable() returns trigger language plpgsql as $$
begin raise exception 'Extensão original 4A imutável'; end $$;
create trigger immutable before update or delete on lab4a.intent for each row execute function lab4a.immutable();
create trigger immutable before update or delete on lab4a.context for each row execute function lab4a.immutable();
create trigger immutable before update or delete on lab4a.receipt for each row execute function lab4a.immutable();
alter table lab4a.intent enable row level security;
alter table lab4a.context enable row level security;
alter table lab4a.receipt enable row level security;
revoke all on all tables in schema lab4a from public;
revoke all on all sequences in schema lab4a from public;
revoke all on all functions in schema lab4a from public;
