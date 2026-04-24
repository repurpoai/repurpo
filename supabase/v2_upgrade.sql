-- Run this only on an existing Version 1 database.
-- Fresh projects should use supabase/schema.sql only.

alter table public.profiles
drop constraint if exists profiles_tier_check;

alter table public.profiles
add constraint profiles_tier_check
check (tier in ('free', 'plus', 'pro'));

update public.profiles
set monthly_generation_limit = 5
where tier = 'free' and monthly_generation_limit is null;

update public.profiles
set monthly_generation_limit = null
where tier in ('plus', 'pro');

alter table public.generations
drop constraint if exists generations_input_mode_check;

alter table public.generations
add constraint generations_input_mode_check
check (input_mode in ('link', 'text', 'youtube'));

alter table public.generations
add column if not exists length_preset text not null default 'medium';

alter table public.generations
drop constraint if exists generations_length_preset_check;

alter table public.generations
add constraint generations_length_preset_check
check (length_preset in ('short', 'medium', 'long'));

alter table public.generations
add column if not exists source_meta jsonb not null default '{}'::jsonb;

alter table public.generations
add column if not exists selected_platforms text[] not null default '{}'::text[];

alter table public.generations
add column if not exists outputs jsonb not null default '{}'::jsonb;

update public.generations
set selected_platforms = array_remove(array[
  case when coalesce(linkedin_post, '') <> '' then 'linkedin' end,
  case when coalesce(twitter_thread, '') <> '' then 'x' end,
  case when coalesce(newsletter, '') <> '' then 'newsletter' end
], null)
where coalesce(array_length(selected_platforms, 1), 0) = 0;

update public.generations
set outputs = jsonb_strip_nulls(
  jsonb_build_object(
    'linkedin', nullif(linkedin_post, ''),
    'x', nullif(twitter_thread, ''),
    'newsletter', nullif(newsletter, '')
  )
)
where outputs = '{}'::jsonb;

create table if not exists public.image_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt text not null,
  aspect_ratio text not null default '1:1' check (aspect_ratio in ('1:1', '3:4', '4:3', '9:16', '16:9')),
  model_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists image_generations_user_id_idx on public.image_generations (user_id);
create index if not exists image_generations_created_at_idx on public.image_generations (created_at desc);
create index if not exists image_generations_user_id_created_at_idx on public.image_generations (user_id, created_at desc);

drop trigger if exists set_image_generations_updated_at on public.image_generations;
create trigger set_image_generations_updated_at
before update on public.image_generations
for each row
execute function public.set_updated_at();

alter table public.image_generations enable row level security;

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


alter table public.profiles
add column if not exists billing_current_period_end timestamptz;


create table if not exists public.billing_webhook_events (
  id text primary key,
  event_type text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.billing_webhook_events enable row level security;


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

create index if not exists auth_rate_limits_scope_idx on public.auth_rate_limits (scope);
create index if not exists auth_rate_limits_blocked_until_idx on public.auth_rate_limits (blocked_until);

drop trigger if exists set_auth_rate_limits_updated_at on public.auth_rate_limits;
create trigger set_auth_rate_limits_updated_at
before update on public.auth_rate_limits
for each row
execute function public.set_updated_at();


alter table public.profiles
add column if not exists role text not null default 'user';

alter table public.profiles
add column if not exists is_blocked boolean not null default false;

alter table public.profiles
add column if not exists block_reason text;

alter table public.profiles
add column if not exists blocked_until timestamptz;

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


drop trigger if exists prevent_unauthorized_profile_changes on public.profiles;
create trigger prevent_unauthorized_profile_changes
before update on public.profiles
for each row
execute function public.prevent_unauthorized_profile_changes();


-- Draft autosave table used by the dashboard
create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade unique,
  input_type text not null check (input_type in ('link', 'text', 'youtube')),
  raw_content text not null default '',
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists drafts_user_id_idx on public.drafts (user_id);

drop trigger if exists set_drafts_updated_at on public.drafts;
create trigger set_drafts_updated_at
before update on public.drafts
for each row
execute function public.set_updated_at();

alter table public.drafts enable row level security;

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

-- Sync flags to auth metadata so middleware can read admin/block state without querying profiles
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

