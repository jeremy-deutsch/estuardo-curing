begin;

create or replace function public.read_public_batch(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', b.name, 'kind', b.kind, 'voters', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',v.id,'first_name',v.first_name,'last_name',v.last_name,
      'street',v.street,'unit',v.unit,'city',v.city,'state',v.state,'zip',v.zip,'phone',v.phone,'age',v.age,
      'latitude',v.latitude,'longitude',v.longitude,'status',v.status,'updated_at',v.updated_at,'created_at',v.created_at
    ) order by v.street,v.unit,v.last_name,v.first_name)
    from public.batch_voters bv join public.voters v on v.id = bv.voter_id where bv.batch_id = b.id
  ),'[]'::jsonb)) from public.batches b where b.public_token = p_token and b.active;
$$;

commit;
