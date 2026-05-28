# Trip Plan And Carrier Billing Documents

Status: Ready for Development

## Owner Role

Core Developer

## Background

Carrier Billing and Trip Plans need document support from their list/detail flows.

Current user workflow:

- `carrier-billing.html` list has View actions that enter a detail view.
- `trip-plans.html` list has View actions that enter `trip-plan-detail.html`.

Users need to see or manage business documents related to each record:

- Carrier Billing needs an Invoice document.
- Trip Plans need BOL, POD, and Loading List documents.

## Scope

- Add document viewing/management support from Carrier Billing detail.
- Add document viewing/management support from Trip Plan detail.
- Support generated documents for:
  - Carrier Billing Invoice
  - Trip Plan BOL
  - Trip Plan Loading List
- Support uploaded document for:
  - Trip Plan POD
- Preserve existing list and detail navigation behavior.
- Keep implementation compatible with current static HTML + browser JavaScript + Supabase architecture.

## Out Of Scope

- Full enterprise document management system.
- OCR.
- E-signature workflow.
- Accounting integration.
- Carrier portal.
- WMS document workflow.
- Backend document rendering service.
- Complex PDF design beyond usable MVP output.
- Permission-based document access.

## Requirements

### Carrier Billing Detail Documents

Carrier Billing detail should support:

- A document section.
- Invoice generation.
- Invoice preview or download.
- Invoice regeneration after billing changes.

Required document:

```text
Invoice
```

Invoice should include at minimum:

- Invoice number
- Carrier name
- Linked Trip Plan name or ID
- Trip Plan status if available
- Invoice date
- Due date
- Paid date if available
- Billing status
- Fee breakdown:
  - Base Freight
  - Fuel Surcharge
  - Accessorial Fee
  - Detention Fee
  - Lumper Fee
  - Other Fee
- Total amount
- Currency
- Notes

### Trip Plan Detail Documents

Trip Plan detail should support a document section.

Required documents:

```text
BOL
POD
Loading List
```

Document behavior:

- BOL: generated
- POD: uploaded
- Loading List: generated

### BOL Generation

BOL should include at minimum:

- Trip Plan name
- Trip Plan ID
- Plan status
- ETD date and period
- Trailer number if available
- Truck number if available
- Transport mode
- Stop list
- For each stop:
  - Stop number
  - ISA or reference
  - Destination
  - Appointment time
  - Load type
  - Transit days
- Notes

### POD Upload

POD should support upload from Trip Plan detail.

MVP behavior:

- User can upload one POD file per Trip Plan.
- If a POD already exists, user can replace it or see clear replacement behavior.
- Detail page shows whether POD exists.
- User can open or download uploaded POD.

Recommended accepted file types:

```text
PDF, PNG, JPG, JPEG
```

### Loading List Generation

Loading List should include at minimum:

- Trip Plan name
- Trip Plan ID
- ETD date and period
- Trailer number if available
- Truck number if available
- Assigned fleet if available
- Assigned dock if available
- Assigned loading crew if available
- Stop list
- For each stop:
  - Stop number
  - ISA or reference
  - Destination
  - Appointment time
  - Load type
- Operational notes

## Data / Schema Impact

MVP can use one of these approaches.

### Preferred Approach: Document Metadata Table

Create a document metadata table:

```text
business_documents
```

Recommended columns:

```text
id uuid primary key default gen_random_uuid()
entity_type text not null
entity_id uuid not null
document_type text not null
document_status text not null default 'active'
file_name text
file_url text
storage_path text
mime_type text
source text
generated_payload jsonb
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Recommended values:

`entity_type`:

```text
trip_plan
carrier_bill
```

`document_type`:

```text
invoice
bol
pod
loading_list
```

`source`:

```text
generated
uploaded
```

### Alternative MVP Approach

If a generic document table is too large for this iteration, store document metadata directly on:

- `carrier_bills`
- `trip_plans`

Only use this if the implementation can remain clean and migration-friendly.

## Storage Guidance

For uploaded POD files, use Supabase Storage if available.

Recommended bucket:

```text
business-documents
```

Recommended path pattern:

```text
trip-plans/{trip_plan_id}/pod/{filename}
carrier-bills/{carrier_bill_id}/invoice/{filename}
```

Generated documents can be:

- Generated client-side and downloaded directly, or
- Saved as metadata first and downloaded on demand.

For MVP, client-side generated printable HTML or PDF is acceptable if it is stable and usable.

## Expected Files

Likely files involved:

- `pages/carrier-billing.html`
- `scripts/carrier-billing.js`
- `styles/carrier-billing.css`
- `pages/trip-plan-detail.html`
- `scripts/trip-plan-detail.js`
- `styles/trip-plan-detail.css`
- `sql/supabase-carrier-billing-schema.sql`
- `sql/supabase-trip-plans-schema.sql`
- New SQL file if using generic document table:
  - `sql/supabase-business-documents-schema.sql`

## Acceptance Criteria

### Carrier Billing Invoice

- Open `carrier-billing.html`.
- Select or view a billing record.
- Detail area shows a Documents section.
- User can generate Invoice.
- Invoice includes billing header, linked trip plan, fee breakdown, total amount, currency, and notes.
- Invoice can be previewed, opened, printed, or downloaded.
- Existing billing create/edit/filter behavior still works.

### Trip Plan BOL

- Open `trip-plans.html`.
- Click View for a trip plan.
- Trip Plan Detail shows a Documents section.
- User can generate BOL.
- BOL includes trip identity, ETD, trailer/truck if available, transport mode, and stop details.
- Existing trip stage/resource behavior still works.

### Trip Plan POD Upload

- Open Trip Plan Detail.
- User can upload POD file.
- Page shows POD uploaded state.
- User can open or download POD.
- Replacing POD is clear to the user.
- Existing trip detail behavior still works.

### Trip Plan Loading List

- Open Trip Plan Detail.
- User can generate Loading List.
- Loading List includes trip identity, ETD, trailer/truck if available, assigned resources if available, and stop details.
- Existing trip stage/resource behavior still works.

## Notes For Developer

- This is a Core Developer task because it touches data persistence, file upload, generated documents, and cross-module detail flows.
- Keep generated document design simple and operational.
- Do not introduce a backend rendering service in this task.
- Do not block the MVP on perfect PDF styling.
- If Supabase Storage is not configured, document fallback behavior clearly.
- If UI-only layout refinements are needed after functionality works, create a follow-up UI Support Developer task.
