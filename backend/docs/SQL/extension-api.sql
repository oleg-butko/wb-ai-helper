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

create table if not exists public.ai_provider_profiles (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  base_url text not null,
  api_key_secret text not null,
  default_model text,
  created_by_admin_user_id uuid references auth.users(id),
  updated_by_admin_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_provider_profiles_label_not_empty check (length(trim(label)) > 0),
  constraint ai_provider_profiles_base_url_not_empty check (length(trim(base_url)) > 0),
  constraint ai_provider_profiles_api_key_not_empty check (length(trim(api_key_secret)) > 0)
);

create index if not exists ai_provider_profiles_created_idx
on public.ai_provider_profiles (created_at desc);

alter table public.ai_provider_profiles enable row level security;

create table if not exists public.ai_prompt_profiles (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  system_prompt text not null,
  product_details_template text not null,
  example_payload jsonb not null,
  is_active boolean not null default false,
  created_by_admin_user_id uuid references auth.users(id),
  updated_by_admin_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_prompt_profiles_label_not_empty check (length(trim(label)) > 0),
  constraint ai_prompt_profiles_system_prompt_not_empty check (length(trim(system_prompt)) > 0),
  constraint ai_prompt_profiles_template_not_empty check (length(trim(product_details_template)) > 0),
  constraint ai_prompt_profiles_example_is_object check (jsonb_typeof(example_payload) = 'object')
);

create unique index if not exists ai_prompt_profiles_one_active_idx
on public.ai_prompt_profiles ((is_active))
where is_active = true;

create index if not exists ai_prompt_profiles_created_idx
on public.ai_prompt_profiles (created_at desc);

alter table public.ai_prompt_profiles enable row level security;

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

create or replace function public.handle_ai_provider_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_ai_provider_profiles_updated_at on public.ai_provider_profiles;
create trigger set_ai_provider_profiles_updated_at
before update on public.ai_provider_profiles
for each row
execute function public.handle_ai_provider_profiles_updated_at();

create or replace function public.handle_ai_prompt_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_ai_prompt_profiles_updated_at on public.ai_prompt_profiles;
create trigger set_ai_prompt_profiles_updated_at
before update on public.ai_prompt_profiles
for each row
execute function public.handle_ai_prompt_profiles_updated_at();

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

create or replace function public.activate_ai_prompt_profile(
  profile_id uuid,
  admin_user_id uuid
)
returns table (
  id uuid,
  label text,
  system_prompt text,
  product_details_template text,
  example_payload jsonb,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.ai_prompt_profiles where ai_prompt_profiles.id = profile_id) then
    return;
  end if;

  update public.ai_prompt_profiles
  set is_active = false,
      updated_by_admin_user_id = admin_user_id
  where is_active = true
    and id <> profile_id;

  return query
  update public.ai_prompt_profiles
  set is_active = true,
      updated_by_admin_user_id = admin_user_id
  where ai_prompt_profiles.id = profile_id
  returning
    ai_prompt_profiles.id,
    ai_prompt_profiles.label,
    ai_prompt_profiles.system_prompt,
    ai_prompt_profiles.product_details_template,
    ai_prompt_profiles.example_payload,
    ai_prompt_profiles.is_active,
    ai_prompt_profiles.created_at,
    ai_prompt_profiles.updated_at;
end;
$$;

insert into public.ai_prompt_profiles (
  label,
  system_prompt,
  product_details_template,
  example_payload,
  is_active
)
values (
  'Default review response prompt',
  'You are an assistant helping a Wildberries seller write polite, concise, useful responses to customer reviews. Reply in Russian. Do not invent facts. If the review is negative, acknowledge the issue and answer professionally.',
  'Customer review data:

Customer name: {{name}}
Rating: {{rating}} / 5

Product:
- Name: {{product_name}}
- URL: {{product_url}}
- Vendor code 1: {{vendor_code_1}}
- Vendor code 2: {{vendor_code_2}}
- Colors: {{colors}}
- Size: {{size}}

Product details:
{{product_details}}

Feedback reasons:
{{feedback_reasons}}',
  '{
    "name": "Наталья",
    "product_details": [
      "Покупка: 10.06.2026",
      "Плюсы: Ничего",
      "Минусы: плохое качество",
      "Комментарий: Голимая синтетика. Кто пишет отзывы?"
    ],
    "feedback_reasons": ["Отказ", "Жалоба одобрена"],
    "rating": 1,
    "product_name": "Парные худи",
    "product_url": "https://www.wildberries.ru/catalog/637477223/detail.aspx",
    "vendor_code_1": "худи_коричневый",
    "vendor_code_2": "637477223",
    "colors": "Коричневый, коричневый мрамор, коричневый ротанг, коричневый меланж, светло-коричневый",
    "size": "M"
  }'::jsonb,
  true
)
on conflict do nothing;

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

create or replace function public.adjust_extension_api_key_quota(
  p_api_key_id uuid,
  p_delta integer,
  p_reason text,
  p_admin_user_id uuid
)
returns table (
  api_key_id uuid,
  label text,
  quota_total integer,
  quota_used integer,
  invalidated_at timestamptz,
  invalidation_reason text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_delta = 0 then
    raise exception 'Quota adjustment amount must be non-zero.'
      using errcode = '22023';
  end if;

  return query
  with updated_key as (
    update public.extension_api_keys
    set quota_total = quota_total + p_delta
    where id = p_api_key_id
      and quota_total + p_delta >= quota_used
      and quota_total + p_delta >= 0
    returning
      id,
      extension_api_keys.label,
      extension_api_keys.quota_total,
      extension_api_keys.quota_used,
      extension_api_keys.invalidated_at,
      extension_api_keys.invalidation_reason,
      extension_api_keys.created_at,
      extension_api_keys.updated_at
  ),
  inserted_event as (
    insert into public.extension_api_key_quota_events (
      api_key_id,
      event_type,
      amount,
      reason,
      created_by_admin_user_id
    )
    select
      updated_key.id,
      case when p_delta > 0 then 'grant' else 'remove' end,
      p_delta,
      p_reason,
      p_admin_user_id
    from updated_key
    returning 1
  )
  select
    updated_key.id,
    updated_key.label,
    updated_key.quota_total,
    updated_key.quota_used,
    updated_key.invalidated_at,
    updated_key.invalidation_reason,
    updated_key.created_at,
    updated_key.updated_at
  from updated_key;
end;
$$;

commit;
