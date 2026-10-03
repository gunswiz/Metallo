-- Exclusivo do núcleo sintético local. Não aplicar em Supabase Gestão/remoto.
create table if not exists lab_context (
 auth_user_id uuid primary key,
 source_employee_id uuid not null unique,
 worker_ref text not null unique,
 employment_ref text not null unique,
 employer_ref text not null,
 establishment_ref text not null,
 active boolean not null,
 context_status text not null check (context_status in ('active','inactive','revoked','ambiguous','invalid')),
 context_version integer not null check (context_version > 0),
 context_updated_at timestamptz not null,
 valid_until timestamptz not null
);
create table if not exists lab_time_event (
 event_id uuid primary key,
 auth_user_id uuid not null references lab_context(auth_user_id),
 idempotency_key uuid not null unique,
 contract_version integer not null check (contract_version = 1),
 worker_snapshot_ref text not null,
 employment_snapshot_ref text not null,
 employer_snapshot_ref text not null,
 establishment_snapshot_ref text not null,
 context_version integer not null,
 server_received_at_utc timestamptz not null,
 server_committed_at_utc timestamptz not null,
 collector_version text not null,
 channel text not null check (channel = 'metallo-colaborador-lab'),
 payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 hash_version integer not null default 1 check (hash_version = 1)
);
create index if not exists lab_time_event_owner_time on lab_time_event(auth_user_id,server_received_at_utc desc);
create table if not exists lab_intent_result (
 idempotency_key uuid primary key references lab_time_event(idempotency_key),
 auth_user_id uuid not null,
 request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
 event_id uuid not null unique references lab_time_event(event_id)
);
create or replace function deny_lab_event_mutation() returns trigger language plpgsql as $$
begin raise exception 'Original sintético imutável'; end $$;
drop trigger if exists lab_event_no_update_delete on lab_time_event;
create trigger lab_event_no_update_delete before update or delete on lab_time_event
 for each row execute function deny_lab_event_mutation();

-- Criado somente em bootstrap explícito; startup de banco existente não executa este arquivo.
create table if not exists lab_recovery_state (
 singleton boolean primary key check (singleton),
 schema_version integer not null check (schema_version = 2),
 database_id uuid not null,
 recovery_epoch integer not null check (recovery_epoch >= 0)
);
