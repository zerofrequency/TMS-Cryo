-- Loading crew scheduling slots (Los Angeles time)
-- Base on Trip Plan ETD date (date only) + slot code.
--
-- Normal shifts:
-- - 09:00-11:00
-- - 11:00-13:00
-- - 13:00-15:00
-- - 15:00-17:00
-- Emergency shifts:
-- - 17:00-19:00
-- - 19:00-21:00

alter table public.loading_crew_assignments
  add column if not exists work_date date;

alter table public.loading_crew_assignments
  add column if not exists task_slot text;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'loading_crew_assignments_task_slot_check'
  ) then
    alter table public.loading_crew_assignments drop constraint loading_crew_assignments_task_slot_check;
  end if;
exception
  when undefined_object then
    null;
end $$;

alter table public.loading_crew_assignments
  add constraint loading_crew_assignments_task_slot_check
  check (task_slot in (
    '09-11',
    '11-13',
    '13-15',
    '15-17',
    '17-19',
    '19-21'
  ) or task_slot is null);

-- Backfill work_date from trip plan ETD date if missing (best effort).
update public.loading_crew_assignments lca
set work_date = tp.etd_date
from public.trip_plans tp
where lca.work_date is null
  and tp.id = lca.trip_plan_id;

-- One crew can only have one ACTIVE assignment per (work_date, task_slot).
-- Drop the previous "one active crew" constraint to allow multiple slots/day.
drop index if exists loading_crew_assignments_one_active_crew_idx;

drop index if exists loading_crew_assignments_one_active_crew_slot_idx;
create unique index loading_crew_assignments_one_active_crew_slot_idx
on public.loading_crew_assignments (crew_id, work_date, task_slot)
where assignment_status = 'Active';
