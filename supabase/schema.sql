create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  tier text not null default 'free' check (tier in ('free', 'plus', 'pro')),
  monthly_generation_limit integer check (
    monthly_generation_limit is null or monthly_generation_limit > 0
  ),
  billing_status text not null default 'inactive' check (
    billing_status in ('inactive', 'active', 'past_due', 'canceled')
  ),
  billing_customer_id text,
  billing_subscription_id text,
  billing_current_period_end timestamptz,
  is_blocked boolean not null default false,
  block_reason text,
  blocked_until timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  input_mode text not null check (input_mode in ('link', 'text', 'youtube')),
  tone text not null check (tone in ('professional', 'casual', 'viral', 'authority')),
  length_preset text not null default 'medium' check (length_preset in ('short', 'medium', 'long')),
  source_url text,
  source_title text,
  source_text text not null,
  source_meta jsonb not null default '{}'::jsonb,
  selected_platforms text[] not null default '{}'::text[],
  outputs jsonb not null default '{}'::jsonb,
  linkedin_post text not null default '',
  twitter_thread text not null default '',
  newsletter text not null default '',
  model_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.image_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt text not null,
  aspect_ratio text not null default '1:1' check (aspect_ratio in ('1:1', '3:4', '4:3', '9:16', '16:9')),
  model_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade unique,
  input_type text not null check (input_type in ('link', 'text', 'youtube')),
  raw_content text not null default '',
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);



create table if not exists public.auth_rate_limits (
  key text primary key,
  scope text not null check (scope in ('login_ip', 'login_email')),
  attempt_count integer not null default 0,
  window_started_at timestamptz not null default timezone('utc', now()),
  last_attempt_at timestamptz not null default timezone('utc', now()),
  blocked_until timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  target_user_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_logs_created_at_idx on public.user_logs (created_at desc);

create table if not exists public.app_settings (
  id int primary key,
  maintenance_mode boolean not null default false,
  maintenance_message text,
  allow_admin boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.app_settings (id) values (1)
on conflict (id) do nothing;

create table if not exists public.billing_webhook_events (
  id text primary key,
  event_type text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists generations_user_id_idx on public.generations (user_id);
create index if not exists generations_created_at_idx on public.generations (created_at desc);
create index if not exists generations_user_id_created_at_idx on public.generations (user_id, created_at desc);
create index if not exists image_generations_user_id_idx on public.image_generations (user_id);
create index if not exists image_generations_created_at_idx on public.image_generations (created_at desc);
create index if not exists image_generations_user_id_created_at_idx on public.image_generations (user_id, created_at desc);
create index if not exists auth_rate_limits_scope_idx on public.auth_rate_limits (scope);
create index if not exists auth_rate_limits_blocked_until_idx on public.auth_rate_limits (blocked_until);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    tier,
    monthly_generation_limit,
    billing_status,
    is_blocked,
    block_reason,
    blocked_until
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', null),
    'user',
    'free',
    5,
    'inactive',
    false,
    null,
    null
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        updated_at = timezone('utc', now());

  return new;
end;
$$;

create or replace function public.sync_profile_flags_to_auth_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  meta jsonb;
begin
  meta := coalesce((select raw_app_meta_data from auth.users where id = new.id), '{}'::jsonb);

  meta := jsonb_set(meta, '{is_admin}', to_jsonb(new.role = 'admin'), true);
  meta := jsonb_set(meta, '{is_blocked}', to_jsonb(coalesce(new.is_blocked, false)), true);
  meta := jsonb_set(meta, '{role}', to_jsonb(coalesce(new.role, 'user')), true);
  meta := jsonb_set(meta, '{block_reason}', coalesce(to_jsonb(new.block_reason), 'null'::jsonb), true);
  meta := jsonb_set(meta, '{blocked_until}', coalesce(to_jsonb(new.blocked_until), 'null'::jsonb), true);

  update auth.users
  set raw_app_meta_data = meta
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.prevent_unauthorized_profile_changes()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id then
    if new.role is distinct from old.role
      or new.is_blocked is distinct from old.is_blocked
      or new.block_reason is distinct from old.block_reason
      or new.blocked_until is distinct from old.blocked_until
      or new.tier is distinct from old.tier
      or new.monthly_generation_limit is distinct from old.monthly_generation_limit
      or new.billing_status is distinct from old.billing_status
      or new.billing_customer_id is distinct from old.billing_customer_id
      or new.billing_subscription_id is distinct from old.billing_subscription_id
      or new.billing_current_period_end is distinct from old.billing_current_period_end
    then
      raise exception 'Unauthorized profile update.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_unauthorized_profile_changes on public.profiles;
create trigger prevent_unauthorized_profile_changes
before update on public.profiles
for each row
execute function public.prevent_unauthorized_profile_changes();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists sync_profile_flags_to_auth_metadata on public.profiles;
create trigger sync_profile_flags_to_auth_metadata
after insert or update of role, is_blocked, block_reason, blocked_until on public.profiles
for each row
execute function public.sync_profile_flags_to_auth_metadata();


-- Backfill existing users so the auth token metadata matches profiles immediately.
update auth.users u
set raw_app_meta_data = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        coalesce(u.raw_app_meta_data, '{}'::jsonb),
        '{is_admin}',
        to_jsonb(coalesce(p.role = 'admin', false)),
        true
      ),
      '{is_blocked}',
      to_jsonb(coalesce(p.is_blocked, false)),
      true
    ),
    '{role}',
    to_jsonb(coalesce(p.role, 'user')),
    true
  ),
  '{block_reason}',
  coalesce(to_jsonb(p.block_reason), 'null'::jsonb),
  true
)
from public.profiles p
where p.id = u.id;




drop trigger if exists set_generations_updated_at on public.generations;
create trigger set_generations_updated_at
before update on public.generations
for each row
execute function public.set_updated_at();

drop trigger if exists set_image_generations_updated_at on public.image_generations;
create trigger set_image_generations_updated_at
before update on public.image_generations
for each row
execute function public.set_updated_at();

drop trigger if exists set_drafts_updated_at on public.drafts;
create trigger set_drafts_updated_at
before update on public.drafts
for each row
execute function public.set_updated_at();

drop trigger if exists set_auth_rate_limits_updated_at on public.auth_rate_limits;
create trigger set_auth_rate_limits_updated_at
before update on public.auth_rate_limits
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.generations enable row level security;
alter table public.image_generations enable row level security;
alter table public.drafts enable row level security;
alter table public.billing_webhook_events enable row level security;
alter table public.user_logs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "generations_select_own" on public.generations;
create policy "generations_select_own"
on public.generations
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "generations_insert_own" on public.generations;
create policy "generations_insert_own"
on public.generations
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "generations_update_own" on public.generations;
create policy "generations_update_own"
on public.generations
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "generations_delete_own" on public.generations;
create policy "generations_delete_own"
on public.generations
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "image_generations_select_own" on public.image_generations;
create policy "image_generations_select_own"
on public.image_generations
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "image_generations_insert_own" on public.image_generations;
create policy "image_generations_insert_own"
on public.image_generations
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "image_generations_update_own" on public.image_generations;
create policy "image_generations_update_own"
on public.image_generations
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "image_generations_delete_own" on public.image_generations;
create policy "image_generations_delete_own"
on public.image_generations
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "drafts_select_own" on public.drafts;
create policy "drafts_select_own"
on public.drafts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "drafts_insert_own" on public.drafts;
create policy "drafts_insert_own"
on public.drafts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "drafts_update_own" on public.drafts;
create policy "drafts_update_own"
on public.drafts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "drafts_delete_own" on public.drafts;
create policy "drafts_delete_own"
on public.drafts
for delete
to authenticated
using (auth.uid() = user_id);
