create table if not exists public.trip_plans (
  id uuid primary key default gen_random_uuid(),
  plan_name text,
  plan_type text not null check (plan_type in ('Single Drop', 'Two Drops', 'Three Drops', 'Four Drops')),
  plan_status text not null default 'Planned' check (plan_status in ('voided', 'Planned', 'Waiting', 'Loading', 'In Transit', 'Delivered')),
  plan_date date,
  etd_date date not null,
  etd_period text not null check (etd_period in ('00-03', '03-06', '06-09', '09-12', '12-15', '15-18', '18-21', '21-24', 'AM', 'PM')),
  etd_at timestamptz not null,
  transport_mode text,
  truck_number text,
  trailer_number text,
  notes text,
  stops jsonb not null default '[]'::jsonb,
  change_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trip_plans' and column_name = 'eta_date'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trip_plans' and column_name = 'etd_date'
  ) then
    alter table public.trip_plans rename column eta_date to etd_date;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trip_plans' and column_name = 'eta_period'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trip_plans' and column_name = 'etd_period'
  ) then
    alter table public.trip_plans rename column eta_period to etd_period;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trip_plans' and column_name = 'eta_at'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trip_plans' and column_name = 'etd_at'
  ) then
    alter table public.trip_plans rename column eta_at to etd_at;
  end if;
end $$;

alter table public.trip_plans
add column if not exists plan_status text not null default 'Planned';

alter table public.trip_plans
add column if not exists change_log jsonb not null default '[]'::jsonb;

alter table public.trip_plans
add column if not exists truck_number text;

alter table public.trip_plans
add column if not exists trailer_number text;

alter table public.trip_plans
drop constraint if exists trip_plans_eta_period_check;

alter table public.trip_plans
drop constraint if exists trip_plans_etd_period_check;

alter table public.trip_plans
drop constraint if exists trip_plans_plan_status_check;

update public.trip_plans
set plan_status = case
  when plan_status in ('Voided', 'Active') then case when plan_status = 'Voided' then 'voided' else 'Planned' end
  when plan_status is null or plan_status = '' then 'Planned'
  else plan_status
end;

alter table public.trip_plans
alter column plan_status set default 'Planned';

alter table public.trip_plans
add constraint trip_plans_plan_status_check
check (plan_status in ('voided', 'Planned', 'Waiting', 'Loading', 'In Transit', 'Delivered'));

alter table public.trip_plans
add constraint trip_plans_etd_period_check
check (etd_period in ('00-03', '03-06', '06-09', '09-12', '12-15', '15-18', '18-21', '21-24', 'AM', 'PM'));

create index if not exists trip_plans_etd_at_idx on public.trip_plans (etd_at);
drop index if exists public.trip_plans_eta_at_idx;
create index if not exists trip_plans_plan_date_idx on public.trip_plans (plan_date);
create index if not exists trip_plans_plan_status_idx on public.trip_plans (plan_status);
create index if not exists trip_plans_truck_number_idx on public.trip_plans (truck_number);
create index if not exists trip_plans_trailer_number_idx on public.trip_plans (trailer_number);

alter table public.trip_plans enable row level security;

drop policy if exists "personal anon read trip_plans" on public.trip_plans;
drop policy if exists "personal anon write trip_plans" on public.trip_plans;

create policy "personal anon read trip_plans"
on public.trip_plans
for select
to anon
using (true);

create policy "personal anon write trip_plans"
on public.trip_plans
for all
to anon
using (true)
with check (true);
