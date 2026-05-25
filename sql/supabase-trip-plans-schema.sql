create table if not exists public.trip_plans (
  id uuid primary key default gen_random_uuid(),
  plan_name text,
  plan_type text not null check (plan_type in ('Single Drop', 'Two Drops', 'Three Drops', 'Four Drops')),
  plan_status text not null default 'Planned' check (plan_status in ('voided', 'Planned', 'Waiting', 'Loading', 'In Transit', 'Delivered')),
  plan_date date,
  eta_date date not null,
  eta_period text not null check (eta_period in ('00-03', '03-06', '06-09', '09-12', '12-15', '15-18', '18-21', '21-24', 'AM', 'PM')),
  eta_at timestamptz not null,
  transport_mode text,
  notes text,
  stops jsonb not null default '[]'::jsonb,
  change_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trip_plans
add column if not exists plan_status text not null default 'Planned';

alter table public.trip_plans
add column if not exists change_log jsonb not null default '[]'::jsonb;

alter table public.trip_plans
drop constraint if exists trip_plans_eta_period_check;

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
add constraint trip_plans_eta_period_check
check (eta_period in ('00-03', '03-06', '06-09', '09-12', '12-15', '15-18', '18-21', '21-24', 'AM', 'PM'));

create index if not exists trip_plans_eta_at_idx on public.trip_plans (eta_at);
create index if not exists trip_plans_plan_date_idx on public.trip_plans (plan_date);
create index if not exists trip_plans_plan_status_idx on public.trip_plans (plan_status);

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
