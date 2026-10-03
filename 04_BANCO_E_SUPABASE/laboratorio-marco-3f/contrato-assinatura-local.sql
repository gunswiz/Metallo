-- Marco 3F: somente Supabase local. Não integrar ao diretório de migrations remotas.
-- Escritas exclusivamente pelo servidor local depois de validar JWT e WebAuthn.
-- Nenhuma função SECURITY DEFINER ou RPC pública nova.

create table if not exists private.epi_signature_credentials_3f (
  credential_id text primary key check (length(credential_id) between 20 and 2048),
  account_id uuid not null references auth.users(id) on delete restrict,
  identity_id uuid not null references private.employee_identity(id) on delete restrict,
  employee_id uuid not null references public.epi_employees(id) on delete restrict,
  public_key text not null check (length(public_key) between 20 and 8192),
  counter bigint not null default 0 check (counter >= 0),
  device_type text not null check (device_type in ('singleDevice','multiDevice')),
  backed_up boolean not null default false,
  transports text[] not null default '{}',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  constraint epi_signature_3f_revocation_pair check ((revoked_at is null)=(revoked_by is null))
);
create index if not exists epi_signature_credentials_account_3f
  on private.epi_signature_credentials_3f(account_id,created_at desc);

create table if not exists private.epi_signature_challenges_3f (
  id uuid primary key,
  account_id uuid not null references auth.users(id) on delete restrict,
  identity_id uuid not null references private.employee_identity(id) on delete restrict,
  employee_id uuid not null references public.epi_employees(id) on delete restrict,
  session_hash text not null check (length(session_hash)=64),
  purpose text not null check (purpose in ('register','sign')),
  challenge text not null unique check (length(challenge) between 32 and 256),
  credential_id text references private.epi_signature_credentials_3f(credential_id) on delete restrict,
  group_id uuid references public.epi_delivery_groups_3d(id) on delete restrict,
  transaction_id uuid not null unique,
  payload_canonical text,
  payload_snapshot jsonb,
  payload_hash text check (payload_hash is null or length(payload_hash)=64),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint epi_signature_3f_purpose_shape check (
    (purpose='register' and credential_id is null and group_id is null
      and payload_canonical is null and payload_snapshot is null and payload_hash is null)
    or (purpose='sign' and group_id is not null
      and payload_canonical is not null and payload_snapshot is not null and payload_hash is not null)),
  constraint epi_signature_3f_expiry check (expires_at>created_at and expires_at<=created_at+interval '5 minutes')
);
create index if not exists epi_signature_challenges_account_3f
  on private.epi_signature_challenges_3f(account_id,created_at desc);

create table if not exists private.epi_signature_events_3f (
  id uuid primary key,
  challenge_id uuid not null unique references private.epi_signature_challenges_3f(id) on delete restrict,
  account_id uuid not null references auth.users(id) on delete restrict,
  identity_id uuid not null references private.employee_identity(id) on delete restrict,
  employee_id uuid not null references public.epi_employees(id) on delete restrict,
  credential_id text not null references private.epi_signature_credentials_3f(credential_id) on delete restrict,
  group_id uuid not null references public.epi_delivery_groups_3d(id) on delete restrict,
  feedback_id bigint not null unique references public.epi_delivery_feedback_events_3d(id) on delete restrict,
  transaction_id uuid not null unique,
  payload_version text not null check (payload_version='3F-v1'),
  payload_canonical text not null,
  payload_hash text not null check (length(payload_hash)=64),
  assertion jsonb not null,
  verified_counter bigint not null check (verified_counter>=0),
  verified_at timestamptz not null default now(),
  method text not null default 'webauthn-passkey' check (method='webauthn-passkey'),
  unique(group_id)
);
create index if not exists epi_signature_events_employee_3f
  on private.epi_signature_events_3f(employee_id,verified_at desc);

create table if not exists private.epi_signature_revocations_3f (
  id bigint generated always as identity primary key,
  credential_id text not null references private.epi_signature_credentials_3f(credential_id) on delete restrict,
  account_id uuid not null references auth.users(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (reason in ('owner','lost_device','incident','termination')),
  occurred_at timestamptz not null default now(),
  unique(credential_id)
);

alter table private.epi_signature_credentials_3f enable row level security;
alter table private.epi_signature_challenges_3f enable row level security;
alter table private.epi_signature_events_3f enable row level security;
alter table private.epi_signature_revocations_3f enable row level security;
revoke all on private.epi_signature_credentials_3f, private.epi_signature_challenges_3f,
  private.epi_signature_events_3f, private.epi_signature_revocations_3f
  from public,anon,authenticated,service_role;
revoke all on sequence private.epi_signature_revocations_3f_id_seq
  from public,anon,authenticated,service_role;

-- Eventos já registrados permanecem; somente credenciais/challenges mudam de estado.
create trigger epi_signature_events_3f_immutable before update or delete
  on private.epi_signature_events_3f for each row execute function public.guard_epi_3d_immutable();
create trigger epi_signature_revocations_3f_immutable before update or delete
  on private.epi_signature_revocations_3f for each row execute function public.guard_epi_3d_immutable();

create or replace function private.guard_epi_signature_credential_3f()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'signature_credential_immutable'; end if;
  if (old.credential_id,old.account_id,old.identity_id,old.employee_id,
    old.public_key,old.device_type,old.transports,old.created_at)
    is distinct from (new.credential_id,new.account_id,new.identity_id,new.employee_id,
    new.public_key,new.device_type,new.transports,new.created_at)
    or new.counter < old.counter or (old.revoked_at is not null and
      (new.revoked_at,new.revoked_by) is distinct from (old.revoked_at,old.revoked_by))
  then raise exception 'signature_credential_immutable'; end if;
  return new;
end $$;
alter function private.guard_epi_signature_credential_3f() owner to postgres;
revoke all on function private.guard_epi_signature_credential_3f() from public,anon,authenticated,service_role;
create trigger epi_signature_credential_3f_guard before update or delete
  on private.epi_signature_credentials_3f for each row execute function private.guard_epi_signature_credential_3f();
