-- Enforce: one ISA appointment can only be bound to one active trip plan,
-- unless the trip plan is cancelled (bindings are released).

create table if not exists public.trip_plan_isa_bindings (
  id uuid primary key default gen_random_uuid(),
  isa text not null,
  trip_plan_id uuid not null references public.trip_plans(id) on delete cascade,
  binding_status text not null default 'active' check (binding_status in ('active', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_plan_isa_bindings_trip_plan_idx
on public.trip_plan_isa_bindings (trip_plan_id);

-- Only one active binding per ISA.
create unique index if not exists trip_plan_isa_bindings_one_active_isa_idx
on public.trip_plan_isa_bindings (isa)
where binding_status = 'active';

create or replace function public.release_isa_bindings_when_cancelled()
returns trigger
language plpgsql
as $$
begin
  if (new.control_status = 'Cancelled' and old.control_status is distinct from 'Cancelled') then
    update public.trip_plan_isa_bindings
      set binding_status = 'released',
          updated_at = now()
    where trip_plan_id = new.id
      and binding_status = 'active';
  end if;
  return new;
end $$;

drop trigger if exists trg_release_isa_bindings_when_voided on public.trip_plans;
drop trigger if exists trg_release_isa_bindings_when_cancelled on public.trip_plans;
create trigger trg_release_isa_bindings_when_cancelled
after update of control_status
on public.trip_plans
for each row
execute function public.release_isa_bindings_when_cancelled();

alter table public.trip_plan_isa_bindings enable row level security;

drop policy if exists "personal anon read trip_plan_isa_bindings" on public.trip_plan_isa_bindings;
drop policy if exists "personal anon write trip_plan_isa_bindings" on public.trip_plan_isa_bindings;

create policy "personal anon read trip_plan_isa_bindings"
on public.trip_plan_isa_bindings
for select
to anon
using (true);

create policy "personal anon write trip_plan_isa_bindings"
on public.trip_plan_isa_bindings
for all
to anon
using (true)
with check (true);
