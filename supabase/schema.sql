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
    tier,
    monthly_generation_limit,
    billing_status
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', null),
    'free',
    5,
    'inactive'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

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

alter table public.profiles enable row level security;
alter table public.generations enable row level security;
alter table public.image_generations enable row level security;
alter table public.billing_webhook_events enable row level security;

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
