create table if not exists public.fleet_resources (
  id uuid primary key default gen_random_uuid(),
  fleet_name text not null,
  fleet_type text not null default 'Carrier' check (fleet_type in ('Carrier', 'Truck', 'Team', 'Owner Operator', 'Other')),
  contact_name text,
  phone text,
  email text,
  mc_number text,
  dot_number text,
  home_base text,
  equipment_type text,
  resource_status text not null default 'Active' check (resource_status in ('Active', 'Inactive', 'Maintenance')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dock_resources (
  id uuid primary key default gen_random_uuid(),
  dock_name text not null,
  dock_type text not null check (dock_type in ('inbound', 'outbound')),
  fc text,
  location_note text,
  resource_status text not null default 'Active' check (resource_status in ('Active', 'Inactive', 'Maintenance')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loading_crews (
  id uuid primary key default gen_random_uuid(),
  crew_name text not null,
  lead_name text,
  phone text,
  email text,
  crew_size integer not null default 1 check (crew_size > 0),
  shift text,
  home_base text,
  resource_status text not null default 'Active' check (resource_status in ('Active', 'Inactive', 'Maintenance')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fleet_assignments (
  id uuid primary key default gen_random_uuid(),
  trip_plan_id uuid not null references public.trip_plans(id) on delete cascade,
  fleet_id uuid not null references public.fleet_resources(id) on delete cascade,
  assignment_status text not null default 'Active' check (assignment_status in ('Active', 'Completed', 'Cancelled')),
  assigned_at timestamptz not null default now(),
  released_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dock_assignments (
  id uuid primary key default gen_random_uuid(),
  trip_plan_id uuid not null references public.trip_plans(id) on delete cascade,
  dock_id uuid not null references public.dock_resources(id) on delete cascade,
  assignment_status text not null default 'Active' check (assignment_status in ('Active', 'Completed', 'Cancelled')),
  occupied_from timestamptz not null default now(),
  released_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loading_crew_assignments (
  id uuid primary key default gen_random_uuid(),
  trip_plan_id uuid not null references public.trip_plans(id) on delete cascade,
  crew_id uuid not null references public.loading_crews(id) on delete cascade,
  assignment_status text not null default 'Active' check (assignment_status in ('Active', 'Completed', 'Cancelled')),
  assigned_at timestamptz not null default now(),
  released_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fleet_resources_name_idx on public.fleet_resources (fleet_name);
create index if not exists dock_resources_name_idx on public.dock_resources (dock_name);
create index if not exists dock_resources_type_idx on public.dock_resources (dock_type);
create index if not exists loading_crews_name_idx on public.loading_crews (crew_name);

create index if not exists fleet_assignments_trip_plan_idx on public.fleet_assignments (trip_plan_id);
create index if not exists fleet_assignments_fleet_idx on public.fleet_assignments (fleet_id);
create index if not exists dock_assignments_trip_plan_idx on public.dock_assignments (trip_plan_id);
create index if not exists dock_assignments_dock_idx on public.dock_assignments (dock_id);
create index if not exists loading_crew_assignments_trip_plan_idx on public.loading_crew_assignments (trip_plan_id);
create index if not exists loading_crew_assignments_crew_idx on public.loading_crew_assignments (crew_id);

create unique index if not exists fleet_assignments_one_active_trip_idx
on public.fleet_assignments (trip_plan_id)
where assignment_status = 'Active';

create unique index if not exists dock_assignments_one_active_trip_idx
on public.dock_assignments (trip_plan_id)
where assignment_status = 'Active';

create unique index if not exists dock_assignments_one_active_dock_idx
on public.dock_assignments (dock_id)
where assignment_status = 'Active';

create unique index if not exists loading_crew_assignments_one_active_trip_idx
on public.loading_crew_assignments (trip_plan_id)
where assignment_status = 'Active';

create unique index if not exists loading_crew_assignments_one_active_crew_idx
on public.loading_crew_assignments (crew_id)
where assignment_status = 'Active';

create or replace function public.cancel_active_resource_assignments_when_trip_cancelled()
returns trigger
language plpgsql
as $$
begin
  if (new.control_status = 'Cancelled' and old.control_status is distinct from 'Cancelled') then
    update public.fleet_assignments
      set assignment_status = 'Cancelled',
          released_at = now(),
          updated_at = now()
    where trip_plan_id = new.id
      and assignment_status = 'Active';

    update public.dock_assignments
      set assignment_status = 'Cancelled',
          released_at = now(),
          updated_at = now()
    where trip_plan_id = new.id
      and assignment_status = 'Active';

    update public.loading_crew_assignments
      set assignment_status = 'Cancelled',
          released_at = now(),
          updated_at = now()
    where trip_plan_id = new.id
      and assignment_status = 'Active';
  end if;
  return new;
end $$;

drop trigger if exists trg_cancel_active_resource_assignments_when_trip_cancelled on public.trip_plans;
create trigger trg_cancel_active_resource_assignments_when_trip_cancelled
after update of control_status
on public.trip_plans
for each row
execute function public.cancel_active_resource_assignments_when_trip_cancelled();

alter table public.fleet_resources enable row level security;
alter table public.dock_resources enable row level security;
alter table public.loading_crews enable row level security;
alter table public.fleet_assignments enable row level security;
alter table public.dock_assignments enable row level security;
alter table public.loading_crew_assignments enable row level security;

drop policy if exists "personal anon read fleet_resources" on public.fleet_resources;
drop policy if exists "personal anon write fleet_resources" on public.fleet_resources;
drop policy if exists "personal anon read dock_resources" on public.dock_resources;
drop policy if exists "personal anon write dock_resources" on public.dock_resources;
drop policy if exists "personal anon read loading_crews" on public.loading_crews;
drop policy if exists "personal anon write loading_crews" on public.loading_crews;
drop policy if exists "personal anon read fleet_assignments" on public.fleet_assignments;
drop policy if exists "personal anon write fleet_assignments" on public.fleet_assignments;
drop policy if exists "personal anon read dock_assignments" on public.dock_assignments;
drop policy if exists "personal anon write dock_assignments" on public.dock_assignments;
drop policy if exists "personal anon read loading_crew_assignments" on public.loading_crew_assignments;
drop policy if exists "personal anon write loading_crew_assignments" on public.loading_crew_assignments;

create policy "personal anon read fleet_resources"
on public.fleet_resources
for select
to anon
using (true);

create policy "personal anon write fleet_resources"
on public.fleet_resources
for all
to anon
using (true)
with check (true);

create policy "personal anon read dock_resources"
on public.dock_resources
for select
to anon
using (true);

create policy "personal anon write dock_resources"
on public.dock_resources
for all
to anon
using (true)
with check (true);

create policy "personal anon read loading_crews"
on public.loading_crews
for select
to anon
using (true);

create policy "personal anon write loading_crews"
on public.loading_crews
for all
to anon
using (true)
with check (true);

create policy "personal anon read fleet_assignments"
on public.fleet_assignments
for select
to anon
using (true);

create policy "personal anon write fleet_assignments"
on public.fleet_assignments
for all
to anon
using (true)
with check (true);

create policy "personal anon read dock_assignments"
on public.dock_assignments
for select
to anon
using (true);

create policy "personal anon write dock_assignments"
on public.dock_assignments
for all
to anon
using (true)
with check (true);

create policy "personal anon read loading_crew_assignments"
on public.loading_crew_assignments
for select
to anon
using (true);

create policy "personal anon write loading_crew_assignments"
on public.loading_crew_assignments
for all
to anon
using (true)
with check (true);
