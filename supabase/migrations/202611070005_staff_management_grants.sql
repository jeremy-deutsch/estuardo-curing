begin;
-- The server-only admin client uses service_role. Bypassing RLS does not
-- bypass table privileges; grant the operations used by listing and approval.
grant select, insert, update on table public.staff_members to service_role;
commit;
