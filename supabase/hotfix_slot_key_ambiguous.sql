-- hotfix_slot_key_ambiguous.sql
-- Fixes PostgreSQL error 42702: "column reference slot_key is ambiguous"
-- in claim_generation_slot. The final SELECT was unqualified; PostgreSQL
-- couldn't distinguish the function's own OUT column from the CTE column
-- of the same name. Fix: qualify every column with the CTE alias "updated".

create or replace function public.claim_generation_slot(
  p_owner_key      text,
  p_owner_user_id  uuid,
  p_lock_seconds   integer default 180
)
returns table(slot_id integer, slot_key text, locked_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select gs.id
    from public.generation_slots gs
    where gs.locked_until is null or gs.locked_until < timezone('utc', now())
    order by gs.locked_until nulls first, gs.id
    for update skip locked
    limit 1
  ), updated as (
    update public.generation_slots gs
    set owner_key        = p_owner_key,
        owner_user_id    = p_owner_user_id,
        locked_until     = timezone('utc', now()) + make_interval(secs => greatest(p_lock_seconds, 60)),
        last_acquired_at = timezone('utc', now()),
        updated_at       = timezone('utc', now())
    from candidate
    where gs.id = candidate.id
    returning gs.id, gs.slot_key, gs.locked_until
  )
  -- Use explicit CTE alias to avoid ambiguity with the function's own
  -- OUT-column names (PostgreSQL error 42702).
  select updated.id, updated.slot_key, updated.locked_until
  from updated;
end;
$$;
