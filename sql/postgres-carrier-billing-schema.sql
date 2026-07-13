create table if not exists public.carrier_bills (
  id uuid primary key default gen_random_uuid(),
  trip_plan_id uuid references public.trip_plans(id) on delete set null,
  carrier_name text,
  invoice_number text,
  invoice_date date,
  due_date date,
  paid_date date,
  billing_status text not null default 'Draft',
  base_freight numeric(12,2) default 0,
  fuel_surcharge numeric(12,2) default 0,
  accessorial_fee numeric(12,2) default 0,
  detention_fee numeric(12,2) default 0,
  lumper_fee numeric(12,2) default 0,
  other_fee numeric(12,2) default 0,
  total_amount numeric(12,2) default 0,
  currency text default 'USD',
  notes text,
  change_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.carrier_bills
drop constraint if exists carrier_bills_billing_status_check;

alter table public.carrier_bills
add constraint carrier_bills_billing_status_check
check (billing_status in ('Draft', 'Submitted', 'Under Review', 'Approved', 'Disputed', 'Paid', 'Voided'));

alter table public.carrier_bills
alter column billing_status set default 'Draft';

alter table public.carrier_bills
alter column currency set default 'USD';

alter table public.carrier_bills
alter column change_log set default '[]'::jsonb;

create index if not exists carrier_bills_trip_plan_id_idx on public.carrier_bills (trip_plan_id);
create index if not exists carrier_bills_status_idx on public.carrier_bills (billing_status);
create index if not exists carrier_bills_carrier_name_idx on public.carrier_bills (carrier_name);
create index if not exists carrier_bills_invoice_number_idx on public.carrier_bills (invoice_number);
create index if not exists carrier_bills_due_date_idx on public.carrier_bills (due_date);

alter table public.carrier_bills enable row level security;

drop policy if exists "personal anon read carrier_bills" on public.carrier_bills;
drop policy if exists "personal anon write carrier_bills" on public.carrier_bills;

create policy "personal anon read carrier_bills"
on public.carrier_bills
for select
to anon
using (true);

create policy "personal anon write carrier_bills"
on public.carrier_bills
for all
to anon
using (true)
with check (true);
