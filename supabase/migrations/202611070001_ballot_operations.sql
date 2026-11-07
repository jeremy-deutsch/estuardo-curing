-- One campaign per Supabase project. Staff access is explicitly granted by an administrator.
begin;
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create function public.is_staff() returns boolean language sql stable security definer
set search_path = '' as $$ select exists(select 1 from public.staff_members where user_id = (select auth.uid())); $$;
revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;
alter table public.staff_members enable row level security;
create policy read_own_membership on public.staff_members for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.staff_members from anon, authenticated;
grant select on public.staff_members to authenticated;

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  filename text not null check (length(filename) <= 250),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.imports(id) on delete cascade,
  row_number integer not null,
  record jsonb not null,
  status text not null default 'pending' check(status in ('pending','processing','imported','duplicate','failed')),
  error text,
  claimed_at timestamptz,
  unique(import_id, row_number)
);
create index import_rows_pending on public.import_rows(import_id, status);

create function public.voter_identity(first_name text, last_name text, street text, unit text, city text, state text, zip text)
returns text language sql immutable set search_path = '' as $$
  select concat_ws('|',
    regexp_replace(lower(first_name || ' ' || last_name), '[^[:alnum:]]', '', 'g'),
    regexp_replace(lower(street), '[^[:alnum:]]', '', 'g'),
    regexp_replace(lower(unit), '[^[:alnum:]]', '', 'g'),
    regexp_replace(lower(city), '[^[:alnum:]]', '', 'g'),
    regexp_replace(lower(state), '[^[:alnum:]]', '', 'g'),
    regexp_replace(lower(zip), '[^[:alnum:]]', '', 'g'));
$$;
create table public.voters (
  id uuid primary key default gen_random_uuid(),
  first_name text not null, last_name text not null,
  street text not null, unit text not null default '', city text not null,
  state text not null, zip text not null, phone text not null default '',
  latitude double precision not null check(latitude between -90 and 90),
  longitude double precision not null check(longitude between -180 and 180),
  location extensions.geography(Point,4326) generated always as
    (extensions.st_setsrid(extensions.st_makepoint(longitude, latitude),4326)::extensions.geography) stored,
  dedupe_key text generated always as (public.voter_identity(first_name,last_name,street,unit,city,state,zip)) stored unique,
  status text check(status in ('cured','interested','not_interested','no_response')),
  source_import_row_id uuid unique references public.import_rows(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp()
);
create index voters_location on public.voters using gist(location);
create index voters_status on public.voters(status);

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 1 and 120),
  kind text not null check(kind in ('door','phone')),
  public_token text not null default encode(extensions.gen_random_bytes(32),'hex') unique,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.batch_voters (
  batch_id uuid not null references public.batches(id) on delete cascade,
  voter_id uuid not null references public.voters(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key(batch_id, voter_id)
);
create index batch_voters_voter on public.batch_voters(voter_id);
create table public.status_events (
  id bigint generated always as identity primary key,
  voter_id uuid not null references public.voters(id),
  batch_id uuid not null references public.batches(id),
  previous_status text, new_status text,
  created_at timestamptz not null default clock_timestamp()
);

do $$ declare t text; begin
  foreach t in array array['imports','import_rows','voters','batches','batch_voters'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy staff_access on public.%I for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()))', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
alter table public.status_events enable row level security;
create policy staff_read on public.status_events for select to authenticated using ((select public.is_staff()));
revoke all on public.status_events from anon, authenticated;
grant select on public.status_events to authenticated;

-- Claim short chunks, with a lease so a disconnected browser can resume safely.
create function public.claim_import_rows(p_import_id uuid) returns setof public.import_rows
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  return query
  update public.import_rows set status = 'processing', claimed_at = clock_timestamp()
  where id in (
    select id from public.import_rows where import_id = p_import_id
      and (status = 'pending' or (status = 'processing' and claimed_at < now() - interval '3 minutes'))
    order by row_number limit 100 for update skip locked
  ) returning *;
end; $$;
revoke all on function public.claim_import_rows(uuid) from public;
grant execute on function public.claim_import_rows(uuid) to authenticated;

-- Create/assign in one transaction: no empty orphan batches if membership fails.
create function public.assign_batch(p_name text, p_kind text, p_voter_ids uuid[], p_batch_id uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare result uuid;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  if cardinality(p_voter_ids) < 1 or cardinality(p_voter_ids) > 10000 then raise exception 'Select between 1 and 10000 voters'; end if;
  if p_batch_id is null then
    insert into public.batches(name,kind) values(trim(p_name),p_kind) returning id into result;
  else
    select id into result from public.batches where id = p_batch_id and active for update;
    if result is null then raise exception 'Batch is unavailable'; end if;
  end if;
  insert into public.batch_voters(batch_id,voter_id) select result, unnest(p_voter_ids) on conflict do nothing;
  return result;
end; $$;
revoke all on function public.assign_batch(text,text,uuid[],uuid) from public;
grant execute on function public.assign_batch(text,text,uuid[],uuid) to authenticated;

-- Anonymous users cannot read tables. A random token grants only this batch's projection.
create function public.read_public_batch(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', b.name, 'kind', b.kind, 'voters', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',v.id,'first_name',v.first_name,'last_name',v.last_name,
      'street',v.street,'unit',v.unit,'city',v.city,'state',v.state,'zip',v.zip,'phone',v.phone,
      'latitude',v.latitude,'longitude',v.longitude,'status',v.status,'updated_at',v.updated_at,'created_at',v.created_at
    ) order by v.street,v.unit,v.last_name,v.first_name)
    from public.batch_voters bv join public.voters v on v.id = bv.voter_id where bv.batch_id = b.id
  ),'[]'::jsonb)) from public.batches b where b.public_token = p_token and b.active;
$$;
revoke all on function public.read_public_batch(text) from public;
grant execute on function public.read_public_batch(text) to anon, authenticated;

create function public.set_public_status(p_token text, p_voter_id uuid, p_status text, p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b_id uuid; old_status text; current_updated timestamptz; result jsonb;
begin
  if p_status is not null and p_status not in ('cured','interested','not_interested','no_response') then raise exception 'Invalid status'; end if;
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
create function public.prepare_import(p_filename text, p_rows jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare result uuid;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  insert into public.imports(filename) values(p_filename) returning id into result;
  insert into public.import_rows(import_id,row_number,record,status,error)
  select result, r.row_number, r.record, r.status, r.error
    from jsonb_to_recordset(p_rows) as r(row_number integer,record jsonb,status text,error text);
  return result;
end; $$;
revoke all on function public.prepare_import(text,jsonb) from public;
grant execute on function public.prepare_import(text,jsonb) to authenticated;

create function public.finish_import_rows(p_results jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare r jsonb; source public.import_rows; v public.voters; identity_key text;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  for r in select value from jsonb_array_elements(p_results) loop
    select * into source from public.import_rows where id = (r->>'id')::uuid and status = 'processing' for update;
    if source.id is null then continue; end if;
    identity_key := public.voter_identity(source.record->>'first_name',source.record->>'last_name',source.record->>'street',source.record->>'unit',source.record->>'city',source.record->>'state',source.record->>'zip');
    select * into v from public.voters where dedupe_key = identity_key;
    if v.id is not null then
      update public.import_rows set status = case when v.source_import_row_id = source.id then 'imported' else 'duplicate' end,
        error = case when v.source_import_row_id = source.id then null else 'Name and address already exist in the system' end where id = source.id;
    elsif r->>'error' is not null then
      update public.import_rows set status = 'failed',error = r->>'error' where id = source.id;
    else
      insert into public.voters(first_name,last_name,street,unit,city,state,zip,phone,latitude,longitude,source_import_row_id)
      values(source.record->>'first_name',source.record->>'last_name',source.record->>'street',source.record->>'unit',source.record->>'city',source.record->>'state',source.record->>'zip',source.record->>'phone',(r->>'latitude')::double precision,(r->>'longitude')::double precision,source.id)
      on conflict(dedupe_key) do nothing returning * into v;
      update public.import_rows set status = case when v.id is null then 'duplicate' else 'imported' end,
        error = case when v.id is null then 'Name and address already exist in the system' else null end where id = source.id;
    end if;
  end loop;
end; $$;
revoke all on function public.finish_import_rows(jsonb) from public;
grant execute on function public.finish_import_rows(jsonb) to authenticated;
commit;

