create table if not exists public.appointments (
  isa text primary key,
  fc text,
  status text,
  schedule_time_raw text,
  schedule_time_la text,
  crdd_raw text,
  load_type text check (load_type in ('Floorload', 'Palletized') or load_type is null),
  reference_code text,
  trailer text,
  source text,
  notes text,
  change_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_imported_at timestamptz
);

create index if not exists appointments_schedule_time_raw_idx on public.appointments (schedule_time_raw);
create index if not exists appointments_fc_idx on public.appointments (fc);
create index if not exists appointments_status_idx on public.appointments (status);

alter table public.appointments enable row level security;

-- Personal-use policy for direct browser access with the anon key.
-- Tighten this when the MVP gains role-based server authentication.
drop policy if exists "personal anon read appointments" on public.appointments;
drop policy if exists "personal anon write appointments" on public.appointments;

create policy "personal anon read appointments"
on public.appointments
for select
to anon
using (true);

create policy "personal anon write appointments"
on public.appointments
for all
to anon
using (true)
with check (true);
