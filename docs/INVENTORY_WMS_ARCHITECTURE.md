# Inventory WMS Architecture

Status: Enterprise Architecture Direction

## Owner Role

Product Manager and Core Developer

## Background

The Inventory MVP starts as a single-ticket inventory module, but the long-term product direction is a fast-turnover, high-change, multi-status inventory system that blends WMS and OMS behavior.

The main complexity is not basic quantity storage. The core challenges are:

- State machine design.
- Dynamic cargo form conversion.
- Decoupling goods from carriers and locations.
- Strong exception blocking.
- Preventing ghost inventory during transfers.
- Keeping outbound allocation synchronized with physical warehouse movement.

This document defines the enterprise direction. It should guide future architecture, but it should not expand the MVP implementation unless a separate task is approved.

## Core Architecture Principle

Do not model inventory as a simple quantity row only.

Enterprise inventory should decouple:

- Goods: what the inventory is.
- Carrier: what currently holds or transports the goods.
- Location: where the carrier or goods physically sit.

The normal operational status is mostly derived from current carrier and location binding.

## Three-Layer Model

### Goods / Item Layer

Smallest countable or auditable unit.

Examples:

- Item
- Carton
- Inventory ticket
- Shipment line

Core attributes:

- Owner / customer
- Product name
- SKU if enterprise SKU model exists
- Weight
- Volume
- Piece / carton count
- Shipment ID
- PO
- Damage/hold flags

### Carrier Layer

Dynamic carrier that holds or transports goods.

Examples:

- Ocean container
- Pallet
- Carton group
- Tail-mile truck
- Trip / outbound task

Core identifiers:

- `container_no`
- `pallet_id`
- `trip_id`
- `outbound_task_id`

Goods can move between carriers as physical form changes.

### Location Layer

Physical or virtual space.

Examples:

- Yard
- Dock
- Warehouse zone
- Aisle / bay / slot
- Staging area
- Exception hold area
- Damage/destruction area
- Virtual in-transit warehouse

Core identifiers:

- `warehouse_id`
- `location_id`
- `location_type`

## Normal Lifecycle And Form Conversion

Fast-turnover inventory should rely on scan/event triggers instead of manual status editing where possible.

### 1. Ocean Container Transit

Goods form:

```text
Floorload or Palletized
```

Core binding:

```text
goods -> container
container -> transit / yard / appointment
```

Operational state:

- Transit
- Container pickup pending
- Container picked up

### 2. Container Pickup / Yard Arrival

Core action:

- Register pickup or arrival.
- Keep goods bound to container.
- Location may become yard, dock, or receiving area.

### 3. Devanning / Unloading

Key conversion:

```text
Floorload -> Palletized
```

Core action:

- Generate pallet IDs.
- Scan cartons/items into pallets.
- Release or close container binding after unload confirmation.
- Bind goods to pallet.

### 4. Inventory / Putaway

Core binding:

```text
goods -> pallet
pallet -> location
```

Operational rule:

- Goods are on pallet.
- Pallet is in location.

### 5. Allocation / Outbound Planning

Core action:

- Allocation engine locks eligible goods/pallet/location.
- Inventory becomes unavailable for other outbound plans.

Operational state:

- Allocated
- Reserved
- Planned

### 6. Outbound Loading

Possible conversion:

```text
Palletized -> Palletized truck load
Palletized -> Floorload truck load
```

Core action:

- Scan pallet out of location.
- Release location binding.
- Release pallet binding if goods are floorloaded into truck.
- Bind goods to outbound task, trip, or vehicle.

### 7. Delivery

Core action:

- Trip/outbound task enters delivery.
- POD confirms delivery.
- Physical inventory is deducted or archived.

### 8. Lock

Final control state:

- Operational content complete.
- POD and billing settlement complete if connected to TMS/OMS.
- Record becomes locked/read-only except audit actions.

## Enterprise State Machine Direction

Avoid open-ended manual status edits.

Use event-driven transitions such as:

```text
container_picked_up
container_arrived
devanning_started
devanning_completed
pallet_created
putaway_completed
allocated
staged
loaded
departed
delivered
locked
```

Illegal jumps should be rejected. Example:

```text
Container Transit -> Outbound Loading
```

should not be allowed without receiving/devanning/putaway or approved bypass logic.

## Exception Blocking Model

Exceptions must use a blocking model. Once an exception is applied to a goods/carrier/location subject, normal workflow should stop until the exception ticket is closed or released.

Recommended exception subjects:

- Item / goods
- Pallet
- Container
- Location
- Outbound task

Recommended exception fields:

```text
exception_type
exception_status
exception_reason
blocked_subject_type
blocked_subject_id
opened_at
opened_by
released_at
released_by
resolution_note
```

### Damaged / Lost

Trigger:

- Found during devanning, inventory count, putaway, staging, or loading.

System behavior:

- Reduce available quantity.
- Move affected goods to exception location.
- Create claim, destroy, or adjustment task.
- Block allocation for affected goods.

Release:

- Destroy/write off through adjustment.
- Re-palletize and release back to available inventory after approval.

### Inspection / Customs Hold

Trigger:

- Pickup, customs, devanning, or external inspection.

System behavior:

- Freeze container or pallet.
- Hide frozen goods from allocation.
- Preserve original workflow context.

Release:

- Release hold.
- Return goods to previous normal lifecycle step.

### Splitting

Scenario:

- One pallet needs to split into multiple pallets or orders.

System behavior:

- Reduce original pallet quantity.
- Create child pallets.
- Preserve parent-child pallet relationship.
- Assign new locations or outbound tasks as needed.

### Staging

Scenario:

- Goods are unloaded but not put away, or picked for outbound but waiting for group loading.

System behavior:

- Move goods/pallet into staging location.
- Do not treat as fully available inventory.
- Record physical move.

## Inter-Warehouse Transfer

Inter-warehouse transfer must avoid ghost inventory.

Use two-phase commit with a virtual in-transit warehouse:

```text
A Warehouse Available
  -> A Warehouse Allocated / Locked For Transfer
  -> Virtual In-Transit Warehouse
  -> B Warehouse Staging / Receiving
  -> B Warehouse Available
```

Rules:

- Starting transfer locks A warehouse inventory from allocation.
- Shipping from A removes inventory from A physical availability.
- In transit inventory is held in a virtual warehouse/location.
- B warehouse should not show inventory as available until receiving and putaway are confirmed.
- Transfer records must preserve source, destination, carrier, timestamps, and count variance.

## Technical Direction

### Backend State Machine

Enterprise implementation should move state transitions backend-side.

The frontend should not own critical transition rules.

Recommended backend responsibilities:

- Validate allowed transitions.
- Apply carrier/location binding changes atomically.
- Create audit logs.
- Enforce exception blocks.
- Prevent duplicate allocation.
- Prevent ghost inventory.

### Scanning Workflow

Warehouse users should do minimal actions:

- Scan goods/carton/pallet.
- Scan carrier/location.
- Select action or confirm suggested action.

Examples:

- Devanning: scan cartons, scan new pallet, system creates pallet binding.
- Putaway: scan pallet, scan location, system binds pallet to location.
- Loading: scan pallet, scan outbound task/truck, system releases location and binds outbound task.

### Event-Driven Integration

Long-term architecture should publish events for:

- Devanning complete
- Pallet created
- Putaway complete
- Allocation changed
- Transfer shipped
- Transfer received
- Outbound loaded
- Delivered
- Exception opened/released

Consumers may include:

- OMS
- TMS
- Billing
- Dashboards
- Audit/reporting

## MVP Boundary

The current Inventory MVP should not implement this full architecture.

MVP should:

- Keep one inventory ticket as the managed unit.
- Store simple lifecycle references:
  - `container_ref`
  - `pallet_ref`
  - `outbound_task_ref`
- Keep manual create/edit/search/filter/export.
- Preserve change log.
- Avoid automatic Trip Plan, carrier, or location updates.

Enterprise follow-up tasks should introduce the three-layer model, backend state machine, scanning workflows, and exception blocking.

## Related Documents

- `docs/INVENTORY_REQUIREMENTS.md`
- `docs/TMS_MVP_ROADMAP.md`
- `docs/FRONTEND_BACKEND_SEPARATION_PREP.md`
