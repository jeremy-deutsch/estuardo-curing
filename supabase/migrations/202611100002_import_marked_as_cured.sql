begin;

-- Keep a snapshot so reports survive later voter edits or removals.
alter table public.imports add column if not exists marked_as_cured jsonb not null default '[]'::jsonb;

create or replace function public.prepare_import(p_filename text, p_rows jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare result uuid;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  insert into public.imports(filename) values(p_filename) returning id into result;
  insert into public.import_rows(import_id,row_number,record,status,error)
  select result, r.row_number, r.record, r.status, r.error
    from jsonb_to_recordset(p_rows) as r(row_number integer,record jsonb,status text,error text);

  -- Compare against the entire file, including failed rows with matching identities.
  -- Do this before new voters are inserted, in the same transaction as the upload.
  with changed as (
    update public.voters v set status = 'cured', updated_at = clock_timestamp()
    where v.status is distinct from 'cured' and v.status is distinct from 'do_not_cure'
      and not exists (
        select 1 from public.import_rows r
        where r.import_id = result and v.dedupe_key = public.voter_identity(
          r.record->>'first_name',r.record->>'last_name',r.record->>'street',
          r.record->>'unit',r.record->>'city',r.record->>'state',r.record->>'zip')
      )
    returning v.id, v.first_name, v.last_name, v.street, v.unit, v.city, v.state, v.zip, v.phone, v.age
  )
  update public.imports set marked_as_cured = coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'record', to_jsonb(c) - 'id')
      order by c.last_name, c.first_name, c.id) from changed c
  ), '[]'::jsonb) where id = result;
  return result;
end; $$;
revoke all on function public.prepare_import(text,jsonb) from public;
grant execute on function public.prepare_import(text,jsonb) to authenticated;

commit;
