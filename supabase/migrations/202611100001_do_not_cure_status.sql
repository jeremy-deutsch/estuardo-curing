begin;

alter table public.voters drop constraint if exists voters_status_check;
alter table public.voters add constraint voters_status_check
  check (status in ('cured','interested','not_interested','no_response','do_not_cure'));

create or replace function public.set_public_status(p_token text, p_voter_id uuid, p_status text, p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b_id uuid; old_status text; current_updated timestamptz; result jsonb;
begin
  if p_status is not null and p_status not in ('cured','interested','not_interested','no_response','do_not_cure') then raise exception 'Invalid status'; end if;
  -- Lock the batch too, so revocation and updates have a well-defined order.
  select b.id into b_id from public.batches b join public.batch_voters bv on bv.batch_id = b.id
    where b.public_token = p_token and b.active and bv.voter_id = p_voter_id for share of b;
  if b_id is null then return jsonb_build_object('error','unavailable'); end if;
  select status,updated_at into old_status,current_updated from public.voters where id = p_voter_id for update;
  if current_updated is distinct from p_expected_updated_at then return jsonb_build_object('error','conflict'); end if;
  update public.voters set status = p_status, updated_at = clock_timestamp() where id = p_voter_id
    returning jsonb_build_object('status',status,'updated_at',updated_at) into result;
  insert into public.status_events(voter_id,batch_id,previous_status,new_status) values(p_voter_id,b_id,old_status,p_status);
  return result;
end; $$;
revoke all on function public.set_public_status(text,uuid,text,timestamptz) from public;
grant execute on function public.set_public_status(text,uuid,text,timestamptz) to anon, authenticated;

commit;
