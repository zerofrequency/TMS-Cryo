# Amazon FC Transfer Request Requirements

Status: Ready for Development

## Owner Role

Product Manager

## Background

Operations sometimes need to request Amazon approval to change the destination FC for inbound goods. Example: goods originally planned for FC A now need to be delivered to FC B. This is not an internal warehouse transfer. It is an external Amazon destination-change request and the result depends on Amazon confirmation.

This module should track the request lifecycle, supporting evidence, Amazon confirmation result, and the downstream impact on Inventory, Trip Plans, and appointments.

## Product Goal

Create a module to manage Amazon FC transfer requests from original FC to requested FC, with clear external confirmation status, multi-leg transfer-chain history, and audit history.

## Scope

MVP scope:

- Create Amazon FC transfer request.
- Add FC Transfer Requests as an Inventory submodule.
- Add entry from the Inventory module page.
- Link request to one or more inventory tickets when available.
- Record original FC and requested FC.
- Support multiple transfer requests for the same goods, such as `A -> B -> C`, `A -> B -> A`, or `A -> B -> C -> D`.
- Track Amazon request status.
- Record Amazon confirmation reference and response details.
- Support search, filter, detail view, edit, and CSV export.
- Preserve change log.

## Out Of Scope

- Automatically submitting requests to Amazon.
- Scraping or automating Carrier Central / Seller Central.
- Automatically changing appointment or Trip Plan destination before Amazon approval.
- Full OMS/WMS allocation engine.
- Backend API refactor.
- Permission workflow.

## Request Unit

One request represents one Amazon destination-change application for one transfer leg.

The same goods can have multiple requests over time. Each request is one leg in a transfer chain.

Examples:

```text
A -> B
A -> B -> C
A -> B -> A
A -> B -> C -> D
```

Use:

- `transfer_chain_key` to group requests for the same goods or shipment.
- `leg_sequence` to order each request in that chain.

The request may cover:

- One inventory ticket.
- Multiple inventory tickets.
- One shipment ID.
- One container reference.
- One PO group.

MVP can start with simple text references, then normalize relationships later.

## Required Fields

Display labels:

```text
Request ID
Transfer Chain
Leg Sequence
Request Status
Original FC
Requested FC
Shipment ID
PO
Product Name
Container Ref
Inventory Ticket Ref
Amazon Case ID
Amazon Confirmation Ref
Amazon Response Note
Requested At
Confirmed At
Rejected At
Remark
```

Recommended database fields:

```text
request_code text
transfer_chain_key text
leg_sequence integer
request_status text
original_fc text not null
requested_fc text not null
shipment_id text
po text
product_name text
container_ref text
inventory_ticket_ref text
amazon_case_id text
amazon_confirmation_ref text
amazon_response_note text
requested_at timestamptz
confirmed_at timestamptz
rejected_at timestamptz
remark text
change_log jsonb
```

## Request Statuses

Use these statuses:

```text
Draft
Submitted
Amazon Reviewing
Approved
Rejected
Cancelled
Expired
```

Status definitions:

- `Draft`: request is being prepared internally.
- `Submitted`: request has been submitted to Amazon externally.
- `Amazon Reviewing`: Amazon is reviewing or pending response.
- `Approved`: Amazon has confirmed the destination change.
- `Rejected`: Amazon denied the destination change.
- `Cancelled`: internal team cancelled the request before final use.
- `Expired`: request is no longer usable because timing or shipment conditions changed.

## Business Rules

- `Original FC` and `Requested FC` are required.
- `Original FC` and `Requested FC` cannot be the same.
- The same goods can have multiple requests in sequence.
- A later request should reference the same `transfer_chain_key` as earlier requests for the same goods.
- `leg_sequence` should increase within the same transfer chain.
- A return transfer is allowed, such as `A -> B -> A`.
- A multi-hop transfer is allowed, such as `A -> B -> C -> D`.
- A new leg should normally start from the last approved destination FC in the chain.
- If a new leg starts from a different FC than the previous approved destination, user must add a remark explaining the mismatch.
- `Approved` requires Amazon confirmation reference or response note.
- `Rejected` requires Amazon response note or rejection reason.
- Internal users cannot treat the destination as changed until request status is `Approved`.
- Before `Approved`, Inventory, Trip Plan, and Appointment destination should continue to show the original FC unless clearly marked as pending transfer.
- When request becomes `Approved`, downstream modules may update destination only through a separate approved integration task.
- Status changes must create `change_log` entries.

## Inventory Integration

MVP behavior:

- Inventory ticket can show a linked transfer request reference.
- Inventory destination FC should not automatically change in MVP unless Core Developer implements an explicitly approved update action.
- Inventory list/detail should be able to indicate pending Amazon FC transfer if linked.

Future behavior:

- Approved request can update inventory destination FC from original FC to requested FC.
- Rejected request should keep inventory tied to original FC.
- Transfer request should become part of the inventory audit trail.
- Inventory detail should show transfer-chain history when multiple requests exist for the same shipment/ticket.

## Trip Plan / Appointment Impact

MVP behavior:

- Do not automatically update active Trip Plans or appointments.
- If an active Trip Plan or appointment exists, show the request as a planning warning.

Future behavior:

- Approved request may trigger appointment re-planning.
- Approved request may trigger Trip Plan destination update or cancellation/recreate workflow.
- Rejected request should block B-FC planning unless manually overridden with reason.

## Page Requirements

Recommended page:

```text
pages/amazon-fc-transfer-requests.html
```

Recommended assets:

```text
scripts/amazon-fc-transfer-requests.js
styles/amazon-fc-transfer-requests.css
sql/supabase-amazon-fc-transfer-requests-schema.sql
```

### Navigation

- Add as an Inventory submodule, not a standalone top-level module.
- Do not replace Inventory.
- Label recommendation: `FC Transfer Requests`.
- The top-level site navigation should keep `Inventory` as the main module entry.
- The homepage should keep `Inventory` as the main module card.
- Inventory page should provide a visible entry/tab/action for `FC Transfer Requests`.
- If a direct link is added elsewhere, it should be visually grouped under Inventory, not presented as a separate top-level business module.

### Summary Cards

Show:

- Total requests
- Pending Amazon response
- Approved
- Rejected
- Expired / Cancelled

### Filters

Use the shared top toolbar pattern.

Core visible filters:

- Search
- Request Status
- Original FC
- Requested FC

Search should match:

- Request ID
- Shipment ID
- PO
- Product Name
- Container Ref
- Amazon Case ID
- Amazon Confirmation Ref
- Remark

### List View

Show columns:

- Request ID
- Status
- Original FC
- Requested FC
- Shipment ID
- PO
- Container Ref
- Amazon Case ID
- Updated At
- Actions

### Detail Panel

Show:

- Request summary
- Transfer chain timeline
- Inventory references
- Amazon response details
- Downstream planning impact
- Change log

### Create / Edit Form

Allow user to enter:

- Original FC
- Requested FC
- Shipment ID
- PO
- Product Name
- Container Ref
- Inventory Ticket Ref
- Amazon Case ID
- Amazon Confirmation Ref
- Amazon Response Note
- Remark

## Data / Schema Direction

Create table:

```text
amazon_fc_transfer_requests
```

Recommended columns:

```text
id uuid primary key default gen_random_uuid()
request_code text
transfer_chain_key text
leg_sequence integer
request_status text not null default 'Draft'
original_fc text not null
requested_fc text not null
shipment_id text
po text
product_name text
container_ref text
inventory_ticket_ref text
amazon_case_id text
amazon_confirmation_ref text
amazon_response_note text
requested_at timestamptz
confirmed_at timestamptz
rejected_at timestamptz
remark text
change_log jsonb not null default '[]'::jsonb
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Recommended constraints:

```text
request_status in ('Draft', 'Submitted', 'Amazon Reviewing', 'Approved', 'Rejected', 'Cancelled', 'Expired')
original_fc <> requested_fc
leg_sequence is null or leg_sequence > 0
```

Recommended indexes:

```text
amazon_fc_transfer_requests_status_idx on request_status
amazon_fc_transfer_requests_chain_idx on transfer_chain_key
amazon_fc_transfer_requests_chain_leg_idx on transfer_chain_key, leg_sequence
amazon_fc_transfer_requests_original_fc_idx on original_fc
amazon_fc_transfer_requests_requested_fc_idx on requested_fc
amazon_fc_transfer_requests_shipment_id_idx on shipment_id
amazon_fc_transfer_requests_container_ref_idx on container_ref
amazon_fc_transfer_requests_case_id_idx on amazon_case_id
```

## Acceptance Criteria

- FC Transfer Requests appears as an Inventory submodule.
- User can open FC Transfer Requests from the Inventory module.
- User can create a transfer request from Original FC to Requested FC.
- User can create multiple transfer requests for the same goods/shipment.
- User can review transfer chain history in order, such as `A -> B -> C` or `A -> B -> A`.
- User cannot save request when Original FC and Requested FC are the same.
- User can track request through Draft, Submitted, Amazon Reviewing, Approved, Rejected, Cancelled, and Expired.
- Approved requires Amazon confirmation reference or response note.
- Rejected requires Amazon response note or rejection reason.
- User can search and filter requests.
- Request detail shows Amazon response and change log.
- No Inventory, Appointment, or Trip Plan destination is automatically changed before Amazon approval.
- UI follows shared top toolbar and UI foundation requirements.

## Related Documents

- `docs/INVENTORY_REQUIREMENTS.md`
- `docs/INVENTORY_WMS_ARCHITECTURE.md`
- `docs/UI_DESIGN_SYSTEM_REQUIREMENTS.md`
- `docs/tasks/2026-05-30-amazon-fc-transfer-requests-mvp.md`
