create table if not exists public.inventory_tickets (
  id uuid primary key default gen_random_uuid(),
  inventory_ticket_no text not null,
  external_ref_no text,
  product_name text,
  container_ref text,
  pallet_ref text,
  outbound_task_ref text,
  trip_plan_id uuid references public.trip_plans(id) on delete set null,
  fc text not null,
  inventory_status text not null default 'Draft',
  record_status text not null default 'Active',
  geo_status text not null default 'In Warehouse',
  stage_status text not null default 'Available',
  transport_status text not null default 'Not Started',
  exception_status text not null default 'None',
  weight_kg numeric(12,2) not null default 0,
  volume_cbm numeric(12,3) not null default 0,
  piece_carton integer not null default 0,
  remark text,
  change_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inventory_tickets
add column if not exists inventory_ticket_no text;

alter table public.inventory_tickets
add column if not exists external_ref_no text;

alter table public.inventory_tickets
add column if not exists container_ref text;

alter table public.inventory_tickets
add column if not exists pallet_ref text;

alter table public.inventory_tickets
add column if not exists outbound_task_ref text;

alter table public.inventory_tickets
add column if not exists trip_plan_id uuid references public.trip_plans(id) on delete set null;

alter table public.inventory_tickets
add column if not exists record_status text not null default 'Active';

alter table public.inventory_tickets
add column if not exists geo_status text not null default 'In Warehouse';

alter table public.inventory_tickets
add column if not exists stage_status text not null default 'Available';

alter table public.inventory_tickets
add column if not exists transport_status text not null default 'Not Started';

alter table public.inventory_tickets
add column if not exists exception_status text not null default 'None';

update public.inventory_tickets
set inventory_ticket_no = coalesce(nullif(inventory_ticket_no, ''), id::text)
where inventory_ticket_no is null or inventory_ticket_no = '';

alter table public.inventory_tickets
alter column inventory_ticket_no set not null;

update public.inventory_tickets
set
  record_status = case inventory_status
    when 'On Hold' then 'On Hold'
    when 'Cancelled' then 'Cancelled'
    else 'Active'
  end,
  geo_status = case inventory_status
    when 'Shipped' then 'Truck In Transit'
    else 'In Warehouse'
  end,
  stage_status = case inventory_status
    when 'Reserved' then 'Reserved'
    when 'Planned' then 'Planned'
    when 'Shipped' then 'In Transit'
    when 'On Hold' then 'Problem Handling'
    when 'Cancelled' then 'Problem Handling'
    else 'Available'
  end,
  exception_status = case inventory_status
    when 'On Hold' then 'At Risk'
    else coalesce(nullif(exception_status, ''), 'None')
  end
where record_status = 'Active'
  and geo_status = 'In Warehouse'
  and stage_status = 'Available'
  and inventory_status in ('Draft', 'Available', 'Reserved', 'Planned', 'Shipped', 'On Hold', 'Cancelled');

update public.inventory_tickets
set exception_status = 'At Risk'
where exception_status = 'On Hold';

alter table public.inventory_tickets
drop constraint if exists inventory_tickets_inventory_status_check;

alter table public.inventory_tickets
add constraint inventory_tickets_inventory_status_check
check (inventory_status in ('Draft', 'Available', 'Reserved', 'Planned', 'Shipped', 'On Hold', 'Cancelled'));

alter table public.inventory_tickets
drop constraint if exists inventory_tickets_record_status_check;

alter table public.inventory_tickets
add constraint inventory_tickets_record_status_check
check (record_status in ('Active', 'On Hold', 'Cancelled', 'Closed'));

alter table public.inventory_tickets
drop constraint if exists inventory_tickets_geo_status_check;

alter table public.inventory_tickets
add constraint inventory_tickets_geo_status_check
check (geo_status in ('Ocean In Transit', 'Arrived Port', 'Devanning', 'In Warehouse', 'Truck In Transit', 'Delivered'));

alter table public.inventory_tickets
drop constraint if exists inventory_tickets_stage_status_check;

alter table public.inventory_tickets
add constraint inventory_tickets_stage_status_check
check (
  (geo_status = 'Ocean In Transit' and stage_status in ('Pending'))
  or (geo_status = 'Arrived Port' and stage_status in ('Pending'))
  or (geo_status = 'Devanning' and stage_status in ('Container Pickup', 'Devanning', 'Devanned'))
  or (geo_status = 'In Warehouse' and stage_status in ('Available', 'Reserved', 'Planned', 'Staging', 'Problem Handling'))
  or (geo_status = 'Truck In Transit' and stage_status in ('In Transit', 'Delayed', 'Accident', 'Delivered Pending POD'))
  or (geo_status = 'Delivered' and stage_status in ('Delivered'))
);

alter table public.inventory_tickets
drop constraint if exists inventory_tickets_transport_status_check;

alter table public.inventory_tickets
add constraint inventory_tickets_transport_status_check
check (transport_status in ('Not Started', 'In Transit', 'Arrived', 'Delivered'));

alter table public.inventory_tickets
drop constraint if exists inventory_tickets_exception_status_check;

alter table public.inventory_tickets
add constraint inventory_tickets_exception_status_check
check (exception_status in ('None', 'At Risk', 'Damaged', 'Lost', 'Inspection', 'Customs Hold', 'Accident', 'Delayed', 'Shortage', 'Overage'));

alter table public.inventory_tickets
drop constraint if exists inventory_tickets_weight_kg_check;

alter table public.inventory_tickets
add constraint inventory_tickets_weight_kg_check
check (weight_kg >= 0);

alter table public.inventory_tickets
drop constraint if exists inventory_tickets_volume_cbm_check;

alter table public.inventory_tickets
add constraint inventory_tickets_volume_cbm_check
check (volume_cbm >= 0);

alter table public.inventory_tickets
drop constraint if exists inventory_tickets_piece_carton_check;

alter table public.inventory_tickets
add constraint inventory_tickets_piece_carton_check
check (piece_carton >= 0);

drop index if exists public.inventory_tickets_shipment_id_uidx;

create unique index if not exists inventory_tickets_ticket_no_uidx
on public.inventory_tickets (inventory_ticket_no);

create index if not exists inventory_tickets_ticket_no_idx on public.inventory_tickets (inventory_ticket_no);
create index if not exists inventory_tickets_external_ref_no_idx on public.inventory_tickets (external_ref_no);
create index if not exists inventory_tickets_product_name_idx on public.inventory_tickets (product_name);
create index if not exists inventory_tickets_container_ref_idx on public.inventory_tickets (container_ref);
create index if not exists inventory_tickets_pallet_ref_idx on public.inventory_tickets (pallet_ref);
create index if not exists inventory_tickets_outbound_task_ref_idx on public.inventory_tickets (outbound_task_ref);
create index if not exists inventory_tickets_trip_plan_id_idx on public.inventory_tickets (trip_plan_id);
create index if not exists inventory_tickets_fc_idx on public.inventory_tickets (fc);
create index if not exists inventory_tickets_status_idx on public.inventory_tickets (inventory_status);
create index if not exists inventory_tickets_record_status_idx on public.inventory_tickets (record_status);
create index if not exists inventory_tickets_geo_status_idx on public.inventory_tickets (geo_status);
create index if not exists inventory_tickets_stage_status_idx on public.inventory_tickets (stage_status);
create index if not exists inventory_tickets_transport_status_idx on public.inventory_tickets (transport_status);
create index if not exists inventory_tickets_exception_status_idx on public.inventory_tickets (exception_status);
create index if not exists inventory_tickets_updated_at_idx on public.inventory_tickets (updated_at);

create table if not exists public.inventory_ticket_shipments (
  id uuid primary key default gen_random_uuid(),
  inventory_ticket_id uuid not null references public.inventory_tickets(id) on delete cascade,
  shipment_id text not null,
  po text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_ticket_shipments_ticket_idx
on public.inventory_ticket_shipments (inventory_ticket_id);

create index if not exists inventory_ticket_shipments_shipment_idx
on public.inventory_ticket_shipments (shipment_id);

create index if not exists inventory_ticket_shipments_po_idx
on public.inventory_ticket_shipments (po);

create unique index if not exists inventory_ticket_shipments_ticket_shipment_uidx
on public.inventory_ticket_shipments (inventory_ticket_id, shipment_id);

create unique index if not exists inventory_ticket_shipments_ticket_po_uidx
on public.inventory_ticket_shipments (inventory_ticket_id, po);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_tickets'
      and column_name = 'shipment_id'
  ) then
    execute 'alter table public.inventory_tickets alter column shipment_id drop not null';
    execute 'create index if not exists inventory_tickets_legacy_shipment_id_idx on public.inventory_tickets (shipment_id)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_tickets'
      and column_name = 'po'
  ) then
    execute 'create index if not exists inventory_tickets_legacy_po_idx on public.inventory_tickets (po)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_tickets'
      and column_name = 'shipment_id'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_tickets'
      and column_name = 'po'
  ) then
    execute $migrate$
      insert into public.inventory_ticket_shipments (inventory_ticket_id, shipment_id, po)
      select id, shipment_id, po
      from public.inventory_tickets
      where nullif(shipment_id, '') is not null
        and nullif(po, '') is not null
      on conflict do nothing
    $migrate$;
  end if;
end $$;

alter table public.inventory_tickets enable row level security;
alter table public.inventory_ticket_shipments enable row level security;

drop policy if exists "personal anon read inventory_tickets" on public.inventory_tickets;
drop policy if exists "personal anon write inventory_tickets" on public.inventory_tickets;
drop policy if exists "personal anon read inventory_ticket_shipments" on public.inventory_ticket_shipments;
drop policy if exists "personal anon write inventory_ticket_shipments" on public.inventory_ticket_shipments;

create policy "personal anon read inventory_tickets"
on public.inventory_tickets
for select
to anon
using (true);

create policy "personal anon write inventory_tickets"
on public.inventory_tickets
for all
to anon
using (true)
with check (true);

create policy "personal anon read inventory_ticket_shipments"
on public.inventory_ticket_shipments
for select
to anon
using (true);

create policy "personal anon write inventory_ticket_shipments"
on public.inventory_ticket_shipments
for all
to anon
using (true)
with check (true);
