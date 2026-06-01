# Carrier Billing Requirements

This document defines the development requirements for the Carrier Billing MVP in the current TMS demo project.

The implementation should stay within the existing demo architecture:

- Static HTML pages
- Browser JavaScript
- Existing CSS patterns
- Supabase REST API
- No backend framework yet
- No enterprise architecture refactor in this task

## Product Positioning

Carrier Billing is the TMS financial settlement module. It tracks carrier charges related to outbound transportation work.

The first version should support a simple operational flow:

```text
Trip Plan
  -> Trip Plan Scheduled
  -> Create Carrier Bill
  -> Enter charge details
  -> Review billing status
  -> Approve, dispute, pay, or void
  -> Export billing records
```

In the future enterprise model, billing should likely attach to a Shipment entity. The current project does not have a Shipment entity yet, so this MVP should attach billing records to `trip_plans.id`.

## MVP Scope

### In Scope

- New Carrier Billing page.
- Carrier Billing navigation entry.
- Supabase schema for carrier billing records.
- List billing records.
- Create billing record.
- Edit billing record.
- Link billing record to a Trip Plan.
- Search and filter billing records.
- Track billing status.
- Calculate total amount from fee fields.
- Export billing records to CSV.
- Basic change log stored on the billing record.

### Out Of Scope

- Payment gateway integration.
- Accounting system integration.
- Carrier contract rate engine.
- Automatic freight rating.
- Invoice OCR.
- File attachment upload.
- Approval permissions.
- Multi-user enterprise access control.
- Backend API refactor.
- WMS integration.

## Navigation

Add Carrier Billing as a live TMS module.

Recommended navigation label:

```text
Carrier Billing
```

Recommended page:

```text
pages/carrier-billing.html
```

Recommended assets:

```text
scripts/carrier-billing.js
styles/carrier-billing.css
sql/supabase-carrier-billing-schema.sql
```

The page should be reachable from:

- `index.html`
- Shared site navigation on existing pages

## Data Model

Create a Supabase table named:

```text
carrier_bills
```

Recommended columns:

```text
id uuid primary key default gen_random_uuid()
trip_plan_id uuid references public.trip_plans(id) on delete set null
carrier_name text
invoice_number text
invoice_date date
due_date date
paid_date date
billing_status text
base_freight numeric(12,2) default 0
fuel_surcharge numeric(12,2) default 0
accessorial_fee numeric(12,2) default 0
detention_fee numeric(12,2) default 0
lumper_fee numeric(12,2) default 0
other_fee numeric(12,2) default 0
total_amount numeric(12,2) default 0
currency text default 'USD'
notes text
change_log jsonb not null default '[]'::jsonb
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Recommended indexes:

```text
carrier_bills_trip_plan_id_idx on trip_plan_id
carrier_bills_status_idx on billing_status
carrier_bills_carrier_name_idx on carrier_name
carrier_bills_invoice_number_idx on invoice_number
carrier_bills_due_date_idx on due_date
```

For current demo use, follow the project's existing personal-use Supabase RLS pattern with anon read/write policies.

## Billing Status

Use these statuses:

```text
Draft
Submitted
Under Review
Approved
Disputed
Paid
Voided
```

## Business Rules

- A billing record may be linked to one Trip Plan.
- One Trip Plan may have multiple billing records.
- When a Trip Plan becomes `Scheduled`, the system should create a linked `Draft` carrier bill if one does not already exist.
- Re-saving or re-entering `Scheduled` must not create duplicate draft bills for the same Trip Plan.
- `total_amount` must be calculated from:
  - `base_freight`
  - `fuel_surcharge`
  - `accessorial_fee`
  - `detention_fee`
  - `lumper_fee`
  - `other_fee`
- Users should not need to manually type `total_amount`.
- `Paid` status should require `paid_date`.
- `Disputed` status should strongly encourage notes.
- `Voided` records should remain visible and should not be physically deleted.
- Status changes should add a basic change log entry.
- Amount changes should add a basic change log entry.
- Empty amount fields should count as `0`.
- Default currency should be `USD`.

## Page Requirements

### Summary Cards

Show high-level billing totals:

- Total bills
- Approved amount
- Unpaid amount
- Disputed amount

Unpaid means records that are not `Paid` and not `Voided`.

### Filters

Support filtering by:

- Search text
- Carrier
- Billing status
- Invoice date from/to
- Due date from/to

Search should match:

- Carrier name
- Invoice number
- Trip plan name
- Notes

### List View

The billing list should show:

- Carrier
- Linked Trip Plan
- Invoice Number
- Billing Status
- Invoice Date
- Due Date
- Total Amount
- Currency
- Updated At
- Actions

Actions:

- Select / view details
- Edit
- Export should apply to current filtered results

### Detail Panel

The detail panel should show:

- Linked Trip Plan summary
- Carrier name
- Invoice information
- Fee breakdown
- Total amount
- Status
- Notes
- Change log

### Create / Edit Form

The form should allow:

- Select Trip Plan from existing `trip_plans`
- Enter carrier name
- Enter invoice number
- Enter invoice date
- Enter due date
- Enter paid date
- Select billing status
- Enter fee fields
- Enter notes

The total amount should update when fee fields change.

## Trip Plan Integration

MVP requirement:

- Carrier Billing page can select existing Trip Plans.
- Billing list and detail should display linked Trip Plan name/status when available.

Recommended follow-up:

- Add "Create Bill" or "View Bills" from Trip Plan Detail.
- Add carrier bill summary on Trip Plan Detail.

This follow-up is P1 and does not have to block MVP if time is limited.

## CSV Export

Export current filtered records with these columns:

```text
Carrier
Trip Plan
Trip Status
Invoice Number
Invoice Date
Due Date
Paid Date
Billing Status
Base Freight
Fuel Surcharge
Accessorial Fee
Detention Fee
Lumper Fee
Other Fee
Total Amount
Currency
Notes
Updated At
```

## Acceptance Criteria

### Flow 1: Create Carrier Bill

1. Open Carrier Billing.
2. Create a new bill.
3. Select a Trip Plan.
4. Enter carrier name and fee fields.
5. Save.

Expected:

- Bill is saved in Supabase.
- Bill appears in the list.
- Total amount equals the sum of fee fields.
- Linked Trip Plan is visible.

### Flow 2: Edit Carrier Bill

1. Select an existing bill.
2. Change a fee amount.
3. Save.

Expected:

- Total amount recalculates.
- Updated value persists after refresh.
- Change log records the amount change.

### Flow 3: Status Management

1. Change a bill from Draft to Submitted.
2. Change it to Approved.
3. Change it to Paid and enter paid date.

Expected:

- Status persists after refresh.
- Paid status includes paid date.
- Change log records status changes.

### Flow 4: Dispute

1. Change a bill to Disputed.
2. Add notes explaining the dispute.

Expected:

- Bill appears in disputed filter.
- Disputed summary amount updates.

### Flow 5: Void

1. Change a bill to Voided.

Expected:

- Bill remains visible.
- Bill no longer counts as unpaid.
- Record is not deleted.

### Flow 6: Export

1. Apply filters.
2. Export CSV.

Expected:

- CSV contains only filtered records.
- Fee fields and total amount are included.

## Priority

### P0

- Supabase schema
- Carrier Billing page
- Create/edit billing record
- Link to Trip Plan
- Fee total calculation
- Status tracking
- Filters
- CSV export

### P1

- Trip Plan Detail integration
- Invoice number duplicate warning
- Overdue indicator
- Better change log display

### P2

- Attachment upload
- Approval workflow
- Payment records
- Dispute workflow

### P3

- Carrier contracts
- Rate cards
- Automatic charge calculation
- Accounting integration
