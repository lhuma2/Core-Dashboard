-- Migration 053 — prospects.status gains 'seen'
--
-- Every candidate a search ever surfaces is now recorded immediately as
-- 'seen' (no reveal, no contact info) so it's excluded from all future
-- searches even if the user never saves or dismisses it — closes the gap
-- where a contact you looked at (but didn't save) could resurface later.
--
-- Using the same "find the constraint by definition, don't guess its name"
-- pattern as migration 044 — inline `check` constraints get an
-- auto-generated name that shouldn't be assumed.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'prospects'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table prospects drop constraint %I', con.conname);
  end loop;
end $$;

alter table prospects add constraint prospects_status_check
  check (status in ('seen', 'saved', 'dismissed'));
