# Carrier Billing MVP

Status: Ready for Development

## Owner Role

Core Developer

## Background

Carrier Billing is the TMS financial settlement module. It tracks carrier charges related to outbound transportation work.

The upstream product requirements are defined in:

- `docs/CARRIER_BILLING_REQUIREMENTS.md`

The implementation should stay within the current demo architecture:

- Static HTML pages
- Browser JavaScript
- Existing CSS patterns
- Supabase REST API
- No backend framework
- No enterprise architecture refactor

## Scope

- Add a Carrier Billing module to the current TMS demo.
- Add a Carrier Billing navigation entry.
- Add Supabase schema for carrier billing records.
- Allow users to create, edit, list, filter, and export carrier bills.
- Link carrier bills to existing Trip Plans through `trip_plans.id`.
- Track billing status.
- Calculate total amount from fee fields.
- Store basic status and amount changes in `change_log`.

## Out Of Scope

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
- Shipment entity refactor.

## Requirements

### Navigation

Add Carrier Billing as a live TMS module.

Recommended label:

```text
Carrier Billing
```

The page should be reachable from:

- `index.html`
- Shared site navigation on existing pages

### Page

Create:

```text
pages/carrier-billing.html
scripts/carrier-billing.js
styles/carrier-billing.css
```

The page should support:

- Summary cards
- Billing list
- Detail panel
- Create/edit form
- Filters
- CSV export

### Summary Cards

Show:

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

Show these columns:

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

Actions should include:

- Select / view details
- Edit
- Export current filtered results

### Detail Panel

Show:

- Linked Trip Plan summary
- Carrier name
- Invoice information
- Fee breakdown
- Total amount
- Status
- Notes
- Change log

### Create / Edit Form

Allow users to:

- Select Trip Plan from existing `trip_plans`
- Enter carrier name
- Enter invoice number
- Enter invoice date
- Enter due date
- Enter paid date
- Select billing status
- Enter fee fields
- Enter notes

Total amount should update when fee fields change.

## Data / Schema Impact

Create:

```text
sql/supabase-carrier-billing-schema.sql
```

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

Follow the project's existing personal-use Supabase RLS pattern with anon read/write policies.

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
- `total_amount` must be calculated from:
  - `base_freight`
  - `fuel_surcharge`
  - `accessorial_fee`
  - `detention_fee`
  - `lumper_fee`
  - `other_fee`
- Users should not need to manually type `total_amount`.
- Empty amount fields should count as `0`.
- Default currency should be `USD`.
- `Paid` status should require `paid_date`.
- `Disputed` status should strongly encourage notes.
- `Voided` records should remain visible and should not be physically deleted.
- Status changes should add a basic change log entry.
- Amount changes should add a basic change log entry.

## Trip Plan Integration

MVP requirements:

- Carrier Billing page can select existing Trip Plans.
- Billing list should display linked Trip Plan name/status when available.
- Billing detail should display linked Trip Plan summary when available.

P1 follow-up, do not block MVP:

- Add "Create Bill" or "View Bills" from Trip Plan Detail.
- Add carrier bill summary on Trip Plan Detail.

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

## Expected Files

Likely files involved:

- `sql/supabase-carrier-billing-schema.sql`
- `pages/carrier-billing.html`
- `scripts/carrier-billing.js`
- `styles/carrier-billing.css`
- `index.html`
- `appts.html`
- `pages/trip-plans.html`
- `pages/create-trip-plans.html`
- `pages/trip-plan-detail.html`
- `pages/resources.html`
- `pages/resource-maintain.html`
- `pages/fc-dashboard.html`
- `styles/site-nav.css` if navigation styling needs small adjustments

## Acceptance Criteria

### Flow 1: Create Carrier Bill

- User can open Carrier Billing.
- User can create a new bill.
- User can select a Trip Plan.
- User can enter carrier name and fee fields.
- User can save the bill.

Expected:

- Bill is saved in Supabase.
- Bill appears in the list.
- Total amount equals the sum of fee fields.
- Linked Trip Plan is visible.

### Flow 2: Edit Carrier Bill

- User can select an existing bill.
- User can change a fee amount.
- User can save.

Expected:

- Total amount recalculates.
- Updated value persists after refresh.
- Change log records the amount change.

### Flow 3: Status Management

- User can change a bill from `Draft` to `Submitted`.
- User can change it to `Approved`.
- User can change it to `Paid` and enter paid date.

Expected:

- Status persists after refresh.
- Paid status includes paid date.
- Change log records status changes.

### Flow 4: Dispute

- User can change a bill to `Disputed`.
- User can add notes explaining the dispute.

Expected:

- Bill appears in disputed filter.
- Disputed summary amount updates.

### Flow 5: Void

- User can change a bill to `Voided`.

Expected:

- Bill remains visible.
- Bill no longer counts as unpaid.
- Record is not deleted.

### Flow 6: Export

- User can apply filters.
- User can export CSV.

Expected:

- CSV contains only filtered records.
- Fee fields and total amount are included.

## Notes For Developer

- Use the existing static page style and Supabase request patterns.
- Keep this as a TMS demo feature, not an enterprise backend refactor.
- Do not introduce a new framework or build step.
- Keep UI consistent with Trip Plans and Resources.
- Preserve existing Trip Plan behavior.
- If related Carrier Billing files already exist, inspect and continue from them instead of replacing user or other-agent work.
