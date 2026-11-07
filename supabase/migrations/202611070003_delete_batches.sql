begin;
-- Preserve contact history when a batch is deleted. Memberships already cascade.
alter table public.status_events alter column batch_id drop not null;
alter table public.status_events drop constraint status_events_batch_id_fkey;
alter table public.status_events add constraint status_events_batch_id_fkey
  foreign key (batch_id) references public.batches(id) on delete set null;
commit;
