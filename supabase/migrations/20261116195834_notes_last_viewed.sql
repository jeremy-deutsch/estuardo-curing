begin;

alter table public.staff_members add column if not exists notes_last_viewed_at timestamptz;
alter table public.staff_members add column if not exists notes_read_through_at timestamptz;
create index if not exists voter_notes_created_at on public.voter_notes(created_at);

-- Status reads never mark the page viewed (including Next.js prefetches).
create or replace function public.notes_read_status() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare last_viewed timestamptz; read_through timestamptz; checked_at timestamptz := clock_timestamp();
begin
  if not public.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  select notes_last_viewed_at, notes_read_through_at into last_viewed, read_through
    from public.staff_members where user_id = (select auth.uid());
  return jsonb_build_object(
    'last_viewed_at', last_viewed,
    'checked_at', checked_at,
    'has_unread', exists(
      select 1 from public.voter_notes
      where created_at > coalesce(read_through, '-infinity'::timestamptz)
    )
  );
end; $$;
revoke all on function public.notes_read_status() from public, anon;
grant execute on function public.notes_read_status() to authenticated;

-- Only this helper can update a staff member's own timestamp. No user ID is accepted.
create or replace function private.mark_notes_viewed(p_viewed_at timestamptz)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare saved timestamptz;
begin
  if not public.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  if p_viewed_at is null or not isfinite(p_viewed_at) or p_viewed_at > clock_timestamp() then
    raise exception 'Invalid Notes visit timestamp' using errcode = '22023';
  end if;
  update public.staff_members
    set notes_last_viewed_at = clock_timestamp(),
      notes_read_through_at = greatest(notes_read_through_at, p_viewed_at)
    where user_id = (select auth.uid())
    returning notes_last_viewed_at into saved;
  return saved;
end; $$;
revoke all on function private.mark_notes_viewed(timestamptz) from public, anon;
grant execute on function private.mark_notes_viewed(timestamptz) to authenticated;

create or replace function public.mark_notes_viewed(p_viewed_at timestamptz)
returns timestamptz language sql security invoker set search_path = '' as $$
  select private.mark_notes_viewed(p_viewed_at);
$$;
revoke all on function public.mark_notes_viewed(timestamptz) from public, anon;
grant execute on function public.mark_notes_viewed(timestamptz) to authenticated;

commit;
