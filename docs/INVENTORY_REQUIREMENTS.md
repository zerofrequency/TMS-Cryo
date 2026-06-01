# Inventory Requirements

Status: Ready for Development

## Owner Role

Product Manager

## Background

Inventory is the next module after the current TMS flow. The first version should manage inventory at the single shipment/ticket level. Each inventory record represents one operational inventory unit that can later connect to trip planning, warehouse handling, and WMS workflows.

The MVP should stay lightweight and fit the current static HTML, browser JavaScript, and Supabase REST architecture.

Enterprise WMS architecture direction is documented separately:

- `docs/INVENTORY_WMS_ARCHITECTURE.md`

## Product Goal

Create an Inventory module that lets operators create, review, search, update, and export single-ticket inventory records by FC, status, shipment identifiers, PO, product name, quantity, weight, volume, and notes.

## MVP Scope

### In Scope

- Inventory navigation entry.
- Inventory page.
- Supabase schema for inventory records.
- Create inventory record.
- Edit inventory record.
- List inventory records.
- Search and filter inventory records.
- View inventory record detail.
- Export filtered inventory records to CSV.
- Track basic change log for important edits.
- Track lifecycle binding references for container, pallet, and linked Trip Plan.

### Out Of Scope

- Full WMS bin/location management.
- SKU-level inventory.
- Lot/serial tracking.
- Inventory allocation engine.
- Warehouse receiving/putaway workflow.
- Full container management module.
- Full pallet management module.
- Full outbound task execution module.
- Cycle count.
- Barcode scanning.
- Backend API refactor.
- Permission model.
- Inventory-to-trip automatic planning.
- Enterprise WMS/OMS state machine.
- Exception blocking workflow.
- Inter-warehouse transfer workflow.
- Goods/carrier/location three-layer data model.

## Inventory Unit

The smallest management unit is one inventory ticket.

One ticket should represent one operational shipment/inventory unit with:

- One internal system ticket number
- One or more Amazon `Shipment ID` / PO pairs
- Optional external customer reference number
- One or more PO references if needed later
- One product name
- One destination or related FC
- One status
- Aggregated weight, volume, and carton count
- Optional lifecycle binding references as the inventory moves through inbound, warehouse, and outbound stages

For MVP, each row is one inventory ticket. A ticket may contain multiple Amazon `Shipment ID` / `PO` pairs. `Shipment ID` and `PO` have a one-to-one relationship inside the ticket and should be stored in a child table, not as the unique identity of the ticket.

## Inventory Identifiers

Inventory must separate system identity from external business references.

Identifier rules:

- `Inventory Ticket No` is the internal system business number and should be unique.
- `Shipment ID` is Amazon's reference ID and is not unique.
- `PO` has a one-to-one business relationship with `Shipment ID` inside an inventory ticket.
- One Inventory Ticket can contain multiple `Shipment ID` / `PO` rows.
- `External Ref No` is the customer's own order/reference number and is not unique unless later required by a customer workflow.
- The database `id` remains the technical UUID primary key.

Recommended database fields:

```text
inventory_ticket_no text not null
external_ref_no text
```

Child table fields:

```text
inventory_ticket_id uuid
shipment_id text not null
po text not null
```

## Inventory Lifecycle Binding

Inventory status and operational ownership depend on where the ticket is in the warehouse lifecycle.

MVP should capture the references without building full Container, Pallet, or Outbound Task modules yet.

Lifecycle rules:

- Before container pickup and warehouse arrival, inventory should be bound to a container reference.
- After container unloading/devanning, inventory should be bound to a pallet reference.
- After outbound dispatch planning, inventory should be linked to a Trip Plan.

Recommended lifecycle reference fields:

```text
container_ref text
pallet_ref text
trip_plan_id uuid
```

Meaning:

- `container_ref`: container number or temporary container identifier before warehouse receiving is complete.
- `pallet_ref`: pallet ID or pallet label after container unloading/devanning.
- `trip_plan_id`: optional structured link to `trip_plans.id`.

MVP behavior:

- These references are optional.
- User can enter or edit them manually.
- User can link an Inventory Ticket to an existing Trip Plan.
- They should be visible in list/detail/form where space allows.
- Changes should be recorded in `change_log`.
- Linking to a Trip Plan should not automatically change Trip Plan status, resource assignment, or Carrier Billing behavior in this MVP task.

Future enterprise direction:

- `container_ref` should connect to an Ocean Container module.
- `pallet_ref` should connect to WMS pallet/location records.
- `trip_plan_id` should connect Inventory to Trip Plan execution.
- Trip Plan is the outbound task for MVP. Do not expose a separate Outbound Task Ref field.
- Full enterprise Inventory should move toward the goods/carrier/location model in `docs/INVENTORY_WMS_ARCHITECTURE.md`.

## Required Fields

Display labels:

```text
FC
Status
Weight (KG)
CBM
Cartons
Remark
Inventory Ticket No
Shipment ID
External Ref No
PO
Product Name
Container Ref
Pallet Ref
Linked Trip Plan
```

Recommended database fields:

```text
fc text
inventory_status text
weight_kg numeric(12,2)
volume_cbm numeric(12,3)
piece_carton integer
remark text
inventory_ticket_no text
external_ref_no text
product_name text
container_ref text
pallet_ref text
trip_plan_id uuid
```

Note: the user-provided `column (cbm)` should be implemented as `volume_cbm` and displayed as `CBM`.

## Recommended Statuses

Use these MVP inventory statuses for the inventory ticket:

```text
Draft
Available
Reserved
Planned
Shipped
On Hold
Cancelled
```

Status definitions:

- `Draft`: record created but not confirmed.
- `Available`: inventory is available for planning.
- `Reserved`: inventory is reserved for an outbound plan but not shipped.
- `Planned`: inventory is assigned to a Trip Plan or outbound movement.
- `Shipped`: inventory has left the warehouse.
- `On Hold`: inventory has an exception or cannot be used.
- `Cancelled`: inventory record is cancelled and should remain visible for history.

## Additional Ticket Status Fields

Inventory detail should distinguish inventory status from transport and exception status.

Recommended display fields:

```text
Inventory Status
Transport Status
Exception Status
```

Recommended database fields on `inventory_tickets`:

```text
inventory_status text
transport_status text
exception_status text
```

MVP transport statuses:

```text
Not Started
In Transit
Arrived
Delivered
```

MVP exception statuses:

```text
None
At Risk
On Hold
Damaged
Lost
Inspection
Customs Hold
```

MVP behavior:

- `inventory_status` remains the main inventory workflow status.
- `transport_status` gives the movement state of the ticket.
- `exception_status` gives the current exception/hold state.
- Exception status does not need to implement full blocking logic in MVP, but it should be visible in detail and searchable/filterable when practical.

## Page Requirements

Create an Inventory page that follows the shared UI foundation.

Recommended page:

```text
pages/inventory.html
```

Recommended assets:

```text
scripts/inventory.js
styles/inventory.css
sql/supabase-inventory-schema.sql
```

### Navigation

- Inventory should become a live navigation item.
- Home module card should link to the Inventory page.
- Shared navigation should include Inventory alongside Appointments, Trip Plans, Resources, and Carrier Billing.

### Summary Cards

Show:

- Total tickets
- Available tickets
- Reserved/Planned tickets
- On Hold tickets
- Total weight KG
- Total CBM
- Total cartons

### Filters

Support filtering by:

- Search text
- FC
- Status

Search should match:

- Inventory Ticket No
- Shipment ID
- External Ref No
- PO
- Product Name
- Container Ref
- Pallet Ref
- Linked Trip Plan
- FC
- Remark

### List View

Show columns:

- Inventory Ticket No
- External Ref No
- Product Name
- Container Ref
- Pallet Ref
- Linked Trip Plan
- FC
- Status
- Transport Status
- Exception Status
- Shipment / PO Count
- Weight (KG)
- CBM
- Cartons
- Updated At
- Actions

Actions:

- View detail
- Edit
- Export current filtered results

### Detail Panel

Show:

- Inventory Ticket No
- External Ref No
- Product Name
- Container Ref
- Pallet Ref
- Linked Trip Plan
- FC
- Status
- Transport Status
- Exception Status
- Weight (KG)
- CBM
- Cartons
- Remark
- Change log

Detail must also show a `PO / Shipment ID List`:

```text
Shipment ID | PO
```

The list should support adding, editing, and removing Shipment ID / PO pairs for the ticket.

### Create / Edit Form

Allow users to enter or update:

- Inventory Ticket No
- External Ref No
- Product Name
- Container Ref
- Pallet Ref
- FC
- Status
- Transport Status
- Exception Status
- Weight (KG)
- CBM
- Cartons
- Remark

Validation:

- Inventory Ticket No is required.
- FC is required.
- Status is required.
- Weight cannot be negative.
- CBM cannot be negative.
- Cartons cannot be negative.

## Data / Schema Direction

Create a table:

```text
inventory_tickets
```

Recommended columns:

```text
id uuid primary key default gen_random_uuid()
inventory_ticket_no text not null
external_ref_no text
product_name text
container_ref text
pallet_ref text
trip_plan_id uuid references public.trip_plans(id) on delete set null
fc text not null
inventory_status text not null default 'Draft'
transport_status text not null default 'Not Started'
exception_status text not null default 'None'
weight_kg numeric(12,2) default 0
volume_cbm numeric(12,3) default 0
piece_carton integer default 0
remark text
change_log jsonb not null default '[]'::jsonb
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Recommended constraints:

```text
inventory_status in ('Draft', 'Available', 'Reserved', 'Planned', 'Shipped', 'On Hold', 'Cancelled')
transport_status in ('Not Started', 'In Transit', 'Arrived', 'Delivered')
exception_status in ('None', 'At Risk', 'On Hold', 'Damaged', 'Lost', 'Inspection', 'Customs Hold')
weight_kg >= 0
volume_cbm >= 0
piece_carton >= 0
```

Create child table:

```text
inventory_ticket_shipments
```

Recommended columns:

```text
id uuid primary key default gen_random_uuid()
inventory_ticket_id uuid not null references public.inventory_tickets(id) on delete cascade
shipment_id text not null
po text not null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Recommended child constraints:

```text
unique (inventory_ticket_id, shipment_id)
unique (inventory_ticket_id, po)
```

These constraints preserve the one-to-one Shipment ID / PO relationship within a ticket while still allowing the same Amazon reference values to exist in other tickets when needed.

Recommended indexes:

```text
inventory_tickets_ticket_no_idx on inventory_ticket_no
inventory_tickets_external_ref_no_idx on external_ref_no
inventory_tickets_product_name_idx on product_name
inventory_tickets_container_ref_idx on container_ref
inventory_tickets_pallet_ref_idx on pallet_ref
inventory_tickets_trip_plan_id_idx on trip_plan_id
inventory_tickets_fc_idx on fc
inventory_tickets_status_idx on inventory_status
inventory_tickets_transport_status_idx on transport_status
inventory_tickets_exception_status_idx on exception_status
inventory_tickets_updated_at_idx on updated_at
inventory_ticket_shipments_ticket_idx on inventory_ticket_id
inventory_ticket_shipments_shipment_id_idx on shipment_id
inventory_ticket_shipments_po_idx on po
```

For MVP, `inventory_ticket_no` should be unique. `shipment_id` should not be unique at the ticket table level because it is Amazon's reference ID. Shipment ID and PO should live in `inventory_ticket_shipments`.

## TMS / WMS Boundary

MVP Inventory may link to a Trip Plan for traceability. It should not automatically change Trip Plan status or resource assignment.

The MVP should not implement automatic state transitions based on container, pallet, or Trip Plan linkage changes. Those rules belong to the future WMS/OMS state machine.

Future integration direction:

- Trip Plan can reference one or more inventory tickets through `trip_plan_id`.
- Inventory status can become `Reserved`, `Planned`, or `Shipped` based on outbound workflow.
- Container references can become formal Ocean Container records.
- Pallet references can become formal WMS pallet/location records.
- Outbound task references can become formal dispatch or Trip Plan task records.
- Amazon FC transfer requests can propose destination FC changes, but inventory destination should only be updated after external Amazon approval.
- WMS can later expand this into SKU, location, receiving, pick, pack, and cycle count.
- WMS/OMS can later add exception blocking for damaged, lost, inspection, customs hold, splitting, staging, and transfer workflows.

## Acceptance Criteria

- Inventory appears as a live module in navigation and home.
- User can create one inventory ticket with required fields.
- User can edit inventory ticket fields.
- User can search by Inventory Ticket No, Shipment ID, External Ref No, PO, Product Name, Container Ref, Pallet Ref, linked Trip Plan, FC, and remark.
- User can filter by FC and status.
- Ticket list has a View action that opens ticket detail.
- Ticket detail shows inventory status, transport status, exception status, and change log.
- Ticket detail shows linked Trip Plan when `trip_plan_id` exists.
- Ticket detail shows a PO / Shipment ID list.
- User can add, edit, and remove Shipment ID / PO pairs under one Inventory Ticket.
- Inventory page does not show upper dashboard or summary cards.
- Filtered inventory records export to CSV.
- Invalid negative numbers are blocked.
- Inventory Ticket No is required and unique.
- Shipment ID is optional or repeatable and must not be used as the unique inventory key.
- Changes to status, transport status, exception status, quantity, weight, CBM, Shipment ID / PO child rows, External Ref No, Product Name, Container Ref, Pallet Ref, linked Trip Plan, FC, or remark create change log entries.
- UI follows `docs/UI_DESIGN_SYSTEM_REQUIREMENTS.md`.

## Related Documents

- `docs/UI_DESIGN_SYSTEM_REQUIREMENTS.md`
- `docs/FRONTEND_BACKEND_SEPARATION_PREP.md`
- `docs/INVENTORY_WMS_ARCHITECTURE.md`
- `docs/AMAZON_FC_TRANSFER_REQUESTS_REQUIREMENTS.md`
- `docs/tasks/2026-05-30-inventory-mvp.md`
