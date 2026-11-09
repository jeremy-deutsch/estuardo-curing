begin;
alter table public.voters add column if not exists age integer check (age between 0 and 120);

create or replace function public.finish_import_rows(p_results jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare r jsonb; source public.import_rows; v public.voters; identity_key text; imported_age integer;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  for r in select value from jsonb_array_elements(p_results) loop
    select * into source from public.import_rows where id = (r->>'id')::uuid and status = 'processing' for update;
    if source.id is null then continue; end if;
    imported_age := nullif(source.record->>'age', '')::integer;
    identity_key := public.voter_identity(source.record->>'first_name',source.record->>'last_name',source.record->>'street',source.record->>'unit',source.record->>'city',source.record->>'state',source.record->>'zip');
    select * into v from public.voters where dedupe_key = identity_key;
    if v.id is not null then
      -- Fill missing fields without replacing values from earlier imports.
      update public.voters set
        age = coalesce(age, imported_age),
        support_id = case when support_id = '' then coalesce(source.record->>'support_id', '') else support_id end
      where id = v.id and ((age is null and imported_age is not null)
        or (support_id = '' and coalesce(source.record->>'support_id', '') <> ''));
      update public.import_rows set status = case when v.source_import_row_id = source.id then 'imported' else 'duplicate' end,
        error = case when v.source_import_row_id = source.id then null else 'Name and address already exist in the system' end where id = source.id;
    elsif r->>'error' is not null then
      update public.import_rows set status = 'failed',error = r->>'error' where id = source.id;
    else
      insert into public.voters(first_name,last_name,street,unit,city,state,zip,phone,age,support_id,latitude,longitude,source_import_row_id)
      values(source.record->>'first_name',source.record->>'last_name',source.record->>'street',source.record->>'unit',source.record->>'city',source.record->>'state',source.record->>'zip',source.record->>'phone',imported_age,coalesce(source.record->>'support_id',''),(r->>'latitude')::double precision,(r->>'longitude')::double precision,source.id)
      -- A concurrent import may have inserted this voter after our lookup.
      on conflict(dedupe_key) do update set
        age = coalesce(voters.age, excluded.age),
        support_id = case when voters.support_id = '' then excluded.support_id else voters.support_id end
      where (voters.age is null and excluded.age is not null)
        or (voters.support_id = '' and excluded.support_id <> '')
      returning * into v;
      update public.import_rows set status = case when v.source_import_row_id = source.id then 'imported' else 'duplicate' end,
        error = case when v.source_import_row_id = source.id then null else 'Name and address already exist in the system' end where id = source.id;
    end if;
  end loop;
end; $$;
revoke all on function public.finish_import_rows(jsonb) from public;
grant execute on function public.finish_import_rows(jsonb) to authenticated;
commit;
