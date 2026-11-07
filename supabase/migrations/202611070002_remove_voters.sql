begin;
-- Keep contact history after removal; batch memberships already cascade.
alter table public.status_events alter column voter_id drop not null;
alter table public.status_events drop constraint status_events_voter_id_fkey;
alter table public.status_events add constraint status_events_voter_id_fkey
  foreign key (voter_id) references public.voters(id) on delete set null;

create or replace function public.remove_voters(p_voter_ids uuid[])
returns integer language plpgsql security invoker set search_path = '' as $$
declare removed integer;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  if coalesce(cardinality(p_voter_ids), 0) not between 1 and 10000 then
    raise exception 'Select between 1 and 10000 voters';
  end if;
  delete from public.voters where id = any(p_voter_ids);
  get diagnostics removed = row_count;
  return removed;
end; $$;
revoke all on function public.remove_voters(uuid[]) from public;
grant execute on function public.remove_voters(uuid[]) to authenticated;
commit;
