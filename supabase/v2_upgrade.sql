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