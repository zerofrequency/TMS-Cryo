-- Fleet type + capacity rules
-- Unlimited capacity:
-- - Third-Party Carrier
-- - LTL Platform
-- Single capacity (must be released before reuse):
-- - Company Van Driver
-- - Company Truck Driver

alter table public.fleet_resources
  add column if not exists capacity_mode text not null default 'unlimited'
  check (capacity_mode in ('unlimited', 'single'));

do $$
begin
  -- Replace old fleet_type check constraint if it exists.
  if exists (
    select 1
    from pg_constraint
    where conname = 'fleet_resources_fleet_type_check'
  ) then
    alter table public.fleet_resources drop constraint fleet_resources_fleet_type_check;
  end if;
exception
  when undefined_object then
    null;
end $$;

alter table public.fleet_resources
  add constraint fleet_resources_fleet_type_check
  check (fleet_type in (
    'Third-Party Carrier',
    'Company Van Driver',
    'Company Truck Driver',
    'LTL Platform',
    'Other'
  ));

-- Best-effort backfill for existing rows (only runs if old values exist).
update public.fleet_resources
set fleet_type = case
  when fleet_type in ('Carrier') then 'Third-Party Carrier'
  when fleet_type in ('Truck') then 'Company Truck Driver'
  when fleet_type in ('Team', 'Owner Operator') then 'Company Van Driver'
  else fleet_type
end
where fleet_type in ('Carrier', 'Truck', 'Team', 'Owner Operator');

update public.fleet_resources
set capacity_mode = case
  when fleet_type in ('Company Van Driver', 'Company Truck Driver') then 'single'
  else 'unlimited'
end;

create or replace function public.enforce_fleet_capacity()
returns trigger
language plpgsql
as $$
declare
  mode text;
begin
  select fr.capacity_mode into mode
  from public.fleet_resources fr
  where fr.id = new.fleet_id;

  if mode = 'single' and new.assignment_status = 'Active' then
    if exists (
      select 1
      from public.fleet_assignments fa
      where fa.fleet_id = new.fleet_id
        and fa.assignment_status = 'Active'
        and fa.id <> new.id
    ) then
      raise exception 'Fleet resource is already occupied (single-capacity). Release it first.';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_enforce_fleet_capacity on public.fleet_assignments;
create trigger trg_enforce_fleet_capacity
before insert or update of assignment_status, fleet_id
on public.fleet_assignments
for each row execute function public.enforce_fleet_capacity();

