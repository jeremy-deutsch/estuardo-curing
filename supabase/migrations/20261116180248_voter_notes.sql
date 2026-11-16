begin;

create table if not exists public.voter_notes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid references public.voters(id) on delete set null,
  batch_id uuid references public.batches(id) on delete set null,
  -- Preserve the context even if staff later remove the voter or batch.
  voter_name text not null,
  voter_address text not null,
  voter_phone text not null,
  batch_name text not null,
  author_name text not null check (length(author_name) between 1 and 120 and author_name ~ '[^[:space:]]'),
  body text not null check (length(body) between 1 and 5000 and body ~ '[^[:space:]]'),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists voter_notes_voter on public.voter_notes(voter_id);
create index if not exists voter_notes_batch on public.voter_notes(batch_id);

alter table public.voter_notes enable row level security;
drop policy if exists staff_read on public.voter_notes;
create policy staff_read on public.voter_notes for select to authenticated
  using ((select public.is_staff()));
revoke all on public.voter_notes from public, anon, authenticated;
grant select on public.voter_notes to authenticated;

-- Only the narrow invoker wrapper is exposed through the Data API.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;
create or replace function private.add_public_note(
  p_token text, p_voter_id uuid, p_author_name text, p_body text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  context record;
  note_id uuid;
  author_name text := btrim(p_author_name, E' \t\r\n\v\f');
  body text := btrim(p_body, E' \t\r\n\v\f');
begin
  if coalesce(length(author_name), 0) not between 1 and 120
    or coalesce(length(body), 0) not between 1 and 5000
    or author_name !~ '[^[:space:]]' or body !~ '[^[:space:]]' then
    raise exception 'A name and note are required and must fit the length limits' using errcode = '22023';
  end if;
  -- Lock all three rows so disable/removal and note creation have a defined order.
  select b.id as batch_id, b.name as batch_name,
    v.first_name || ' ' || v.last_name as voter_name,
    concat_ws(', ', v.street, nullif(v.unit, ''), v.city || ', ' || v.state || ' ' || v.zip) as voter_address,
    v.phone as voter_phone
  into context
  from public.batches b
  join public.batch_voters bv on bv.batch_id = b.id
  join public.voters v on v.id = bv.voter_id
  where b.public_token = p_token and b.active and v.id = p_voter_id
  for share of b, bv, v;
  if not found then return null; end if;

  insert into public.voter_notes(voter_id, batch_id, voter_name, voter_address, voter_phone, batch_name, author_name, body)
  values(p_voter_id, context.batch_id, context.voter_name, context.voter_address, context.voter_phone, context.batch_name, author_name, body)
  returning id into note_id;
  return note_id;
end; $$;
revoke all on function private.add_public_note(text,uuid,text,text) from public;
grant execute on function private.add_public_note(text,uuid,text,text) to anon, authenticated;

create or replace function public.add_public_note(
  p_token text, p_voter_id uuid, p_author_name text, p_body text
) returns uuid language sql security invoker set search_path = '' as $$
  select private.add_public_note(p_token, p_voter_id, p_author_name, p_body);
$$;
revoke all on function public.add_public_note(text,uuid,text,text) from public;
grant execute on function public.add_public_note(text,uuid,text,text) to anon, authenticated;

commit;
