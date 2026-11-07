begin;
alter table public.voters add column if not exists support_id text not null default '';

-- Recover the field from any import records that already retained it.
update public.voters v set support_id = r.record->>'support_id'
from public.import_rows r
where v.source_import_row_id = r.id and v.support_id = ''
  and coalesce(r.record->>'support_id', '') <> '';

create or replace function public.finish_import_rows(p_results jsonb) returns void
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
      -- Reuploads can recover Support ID discarded by older importers.
      if coalesce(v.support_id, '') = '' and coalesce(source.record->>'support_id', '') <> '' then
        update public.voters set support_id = source.record->>'support_id' where id = v.id;
      end if;
      update public.import_rows set status = case when v.source_import_row_id = source.id then 'imported' else 'duplicate' end,
        error = case when v.source_import_row_id = source.id then null else 'Name and address already exist in the system' end where id = source.id;
    elsif r->>'error' is not null then
      update public.import_rows set status = 'failed',error = r->>'error' where id = source.id;
    else
      insert into public.voters(first_name,last_name,street,unit,city,state,zip,phone,support_id,latitude,longitude,source_import_row_id)
      values(source.record->>'first_name',source.record->>'last_name',source.record->>'street',source.record->>'unit',source.record->>'city',source.record->>'state',source.record->>'zip',source.record->>'phone',coalesce(source.record->>'support_id',''),(r->>'latitude')::double precision,(r->>'longitude')::double precision,source.id)
      on conflict(dedupe_key) do nothing returning * into v;
      update public.import_rows set status = case when v.id is null then 'duplicate' else 'imported' end,
        error = case when v.id is null then 'Name and address already exist in the system' else null end where id = source.id;
    end if;
  end loop;
end; $$;
revoke all on function public.finish_import_rows(jsonb) from public;
grant execute on function public.finish_import_rows(jsonb) to authenticated;
commit;
