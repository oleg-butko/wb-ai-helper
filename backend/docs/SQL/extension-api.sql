begin;

create extension if not exists pgcrypto;

create table if not exists public.admins (
  email text primary key,
  created_at timestamptz not null default now(),
  disabled_at timestamptz,
  constraint admins_email_normalized check (email = lower(trim(email))),
  constraint admins_email_not_empty check (length(trim(email)) > 0)
);

alter table public.admins enable row level security;

create table if not exists public.extension_api_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  label text,
  quota_total integer not null default 0,
  quota_used integer not null default 0,
  invalidated_at timestamptz,
  invalidated_by_admin_user_id uuid references auth.users(id),
  invalidation_reason text,
  created_by_admin_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint extension_api_keys_hash_not_empty check (length(trim(key_hash)) > 0),
  constraint extension_api_keys_quota_nonnegative check (
    quota_total >= 0
    and quota_used >= 0
    and quota_used <= quota_total
  )
);

create index if not exists extension_api_keys_created_idx
on public.extension_api_keys (created_at desc);

create index if not exists extension_api_keys_invalidated_idx
on public.extension_api_keys (invalidated_at)
where invalidated_at is not null;

alter table public.extension_api_keys enable row level security;

create table if not exists public.extension_api_key_quota_events (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references public.extension_api_keys(id) on delete cascade,
  event_type text not null,
  amount integer not null,
  request_id uuid,
  reason text,
  created_by_admin_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint extension_api_key_quota_events_type_check check (
    event_type in ('grant', 'remove', 'consume', 'invalidate')
  ),
  constraint extension_api_key_quota_events_amount_valid check (
    (event_type = 'invalidate' and amount = 0)
    or (event_type <> 'invalidate' and amount <> 0)
  )
);

create index if not exists extension_api_key_quota_events_key_created_idx
on public.extension_api_key_quota_events (api_key_id, created_at desc);

alter table public.extension_api_key_quota_events enable row level security;

create table if not exists public.extension_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  first_api_key_id uuid references public.extension_api_keys(id),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  constraint extension_users_email_not_empty check (length(trim(email)) > 0)
);

create index if not exists extension_users_last_seen_idx
on public.extension_users (last_seen_at desc);

alter table public.extension_users enable row level security;

create table if not exists public.extension_api_key_users (
  api_key_id uuid not null references public.extension_api_keys(id) on delete cascade,
  extension_user_id uuid not null references public.extension_users(user_id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz,
  primary key (api_key_id, extension_user_id)
);

create index if not exists extension_api_key_users_user_seen_idx
on public.extension_api_key_users (extension_user_id, last_seen_at desc);

alter table public.extension_api_key_users enable row level security;

create table if not exists public.extension_generation_requests (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references public.extension_api_keys(id) on delete cascade,
  extension_user_id uuid not null,
  request_payload jsonb not null,
  response_payload jsonb,
  status text not null,
  quota_consumed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint extension_generation_requests_status_check check (
    status in ('received', 'succeeded', 'failed')
  )
);

create index if not exists extension_generation_requests_key_created_idx
on public.extension_generation_requests (api_key_id, created_at desc);

create index if not exists extension_generation_requests_user_created_idx
on public.extension_generation_requests (extension_user_id, created_at desc);

create index if not exists extension_generation_requests_status_created_idx
on public.extension_generation_requests (status, created_at desc);

alter table public.extension_generation_requests enable row level security;

create table if not exists public.extension_generation_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.extension_generation_requests(id) on delete cascade,
  api_key_id uuid not null references public.extension_api_keys(id) on delete cascade,
  extension_user_id uuid not null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint extension_generation_events_type_not_empty check (length(trim(event_type)) > 0)
);

create index if not exists extension_generation_events_request_created_idx
on public.extension_generation_events (request_id, created_at asc);

create index if not exists extension_generation_events_key_created_idx
on public.extension_generation_events (api_key_id, created_at desc);

alter table public.extension_generation_events enable row level security;

create table if not exists public.extension_errors (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.extension_generation_requests(id) on delete set null,
  api_key_id uuid references public.extension_api_keys(id) on delete set null,
  extension_user_id uuid,
  error_code text not null,
  error_message text not null,
  error_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint extension_errors_code_not_empty check (length(trim(error_code)) > 0),
  constraint extension_errors_message_not_empty check (length(trim(error_message)) > 0)
);

create index if not exists extension_errors_key_created_idx
on public.extension_errors (api_key_id, created_at desc);

create index if not exists extension_errors_code_created_idx
on public.extension_errors (error_code, created_at desc);

alter table public.extension_errors enable row level security;

create or replace function public.handle_extension_api_keys_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_extension_generation_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_extension_api_keys_updated_at on public.extension_api_keys;
create trigger set_extension_api_keys_updated_at
before update on public.extension_api_keys
for each row
execute function public.handle_extension_api_keys_updated_at();

drop trigger if exists set_extension_generation_requests_updated_at on public.extension_generation_requests;
create trigger set_extension_generation_requests_updated_at
before update on public.extension_generation_requests
for each row
execute function public.handle_extension_generation_requests_updated_at();

create or replace function public.consume_extension_api_key_quota(
  p_api_key_id uuid,
  p_amount integer,
  p_request_id uuid,
  p_reason text
)
returns table (
  api_key_id uuid,
  quota_total integer,
  quota_used integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then
    raise exception 'Quota consumption amount must be positive.'
      using errcode = '22023';
  end if;

  return query
  with updated_key as (
    update public.extension_api_keys
    set quota_used = quota_used + p_amount
    where id = p_api_key_id
      and invalidated_at is null
      and quota_used + p_amount <= quota_total
    returning id, extension_api_keys.quota_total, extension_api_keys.quota_used
  ),
  inserted_event as (
    insert into public.extension_api_key_quota_events (
      api_key_id,
      event_type,
      amount,
      request_id,
      reason
    )
    select
      updated_key.id,
      'consume',
      p_amount,
      p_request_id,
      p_reason
    from updated_key
    returning 1
  )
  select
    updated_key.id,
    updated_key.quota_total,
    updated_key.quota_used
  from updated_key;
end;
$$;

commit;
