# Detail Page UI Reference

Status: Ready for Development

## Owner Role

UI Support Developer

## Background

Trip Plan Detail and Carrier Billing Detail need a more operational detail-page UI. The reference design shows a shipment tracking layout with:

- Top action bar
- Back button and record identifier
- Left detail panel
- Overview / Details / Documents tabs
- Main map or route canvas area
- Document cards with view/download actions

This task translates the reference into a TMS-appropriate UI direction.

Related Core Developer task:

- `docs/tasks/2026-05-28-trip-billing-documents.md`

## Scope

- Design and implement the detail-page UI pattern for Trip Plan Detail.
- Apply the same pattern where practical to Carrier Billing Detail.
- Add tabbed detail structure:
  - Overview
  - Details
  - Documents
- Make the Documents tab visually support generated and uploaded documents.
- Preserve existing business logic and data behavior.

## Out Of Scope

- Implementing document generation logic.
- Implementing POD upload persistence.
- Changing Supabase schema.
- Changing trip status rules.
- Changing billing calculations.
- Adding a real map provider.
- Rebuilding the app with a new framework.

## UI Direction

### Overall Layout

Use a two-zone detail layout:

```text
Top action bar
------------------------------------------------
Left detail panel                Right visual area
Overview / Details / Documents   Route/map/workspace
```

The left panel should be the operational control area. The right side can be a simple route/map-style canvas or neutral workspace in the current MVP.

### Top Action Bar

Recommended elements:

- Back to list button
- Record identifier:
  - Trip Plan name or ID
  - Carrier Bill invoice number or bill ID
- Primary actions:
  - Edit
  - Generate / Download document where appropriate
- Secondary actions:
  - Share / Export can be deferred if not currently supported

Do not add fake actions that do nothing. If an action is not implemented, omit it or show disabled state only if useful.

### Tabs

Use three tabs:

```text
Overview
Details
Documents
```

Tab behavior:

- Active tab should be visually clear.
- Tabs should remain at the top of the left panel.
- Switching tabs should not lose selected record context.
- Mobile layout should keep tabs usable.

### Trip Plan Overview Tab

Show high-level execution status and readiness.

Recommended sections:

- Current status card
- ETD / appointment timing summary
- Carrier / fleet / trailer / truck summary if available
- Pickup / delivery or stop summary
- Dispatch readiness warnings:
  - Missing trailer number
  - Missing truck number
  - Missing fleet
  - Missing dock
  - Missing loading crew
  - Negative buffer
- Activity or change log summary

### Trip Plan Details Tab

Show structured record details.

Recommended sections:

- Shipment / trip details:
  - Trip Plan name
  - Plan type
  - Status
  - ETD date and period
  - Transport mode
  - Trailer number
  - Truck number
  - Updated at
- Locations and cargo / stops:
  - Stop number
  - ISA or reference
  - Destination
  - Appointment time
  - Load type
  - Transit days
  - Buffer
- Assigned resources:
  - Fleet
  - Dock
  - Loading crew

### Trip Plan Documents Tab

Follow the reference structure with document groups.

Required groups:

```text
Freight documents
Proof documents
Loading documents
```

Recommended document cards:

- Bill of Lading
  - Generated
  - View
  - Download
- Proof of Delivery
  - Uploaded or Missing
  - Upload / Replace
  - View / Download when available
- Loading List
  - Generated
  - View
  - Download

Card layout:

- Document title
- Status badge
- Last generated/uploaded date if available
- View button
- Download button
- Upload/Replace button for POD

### Carrier Billing Overview Tab

Show financial status and linked trip context.

Recommended sections:

- Billing status card
- Carrier name
- Invoice number
- Linked Trip Plan
- Total amount
- Currency
- Due date
- Paid date if available
- Billing readiness or issue hints:
  - Missing invoice number
  - Missing due date
  - Paid without paid date
  - Disputed without notes

### Carrier Billing Details Tab

Show fee breakdown and metadata.

Recommended sections:

- Invoice details:
  - Invoice number
  - Carrier
  - Invoice date
  - Due date
  - Paid date
  - Status
- Fee breakdown:
  - Base Freight
  - Fuel Surcharge
  - Accessorial Fee
  - Detention Fee
  - Lumper Fee
  - Other Fee
  - Total
- Notes
- Change log

### Carrier Billing Documents Tab

Required group:

```text
Invoices
```

Document card:

- Carrier Invoice
  - Generated
  - View
  - Download
  - Regenerate if billing values changed

## Visual Style Guidance

- Keep the UI clean and operational, not decorative.
- Use compact panels and clear section headers.
- Cards should be simple and dense enough for operations work.
- Avoid oversized marketing-style hero sections.
- Keep cards at modest border radius consistent with current project style.
- Use existing button and badge styles where possible.
- Add icons only if the project already has suitable icon patterns or simple text buttons are clearer.
- Make document action buttons easy to scan.

## Right Visual Area

The reference design shows a map.

For MVP:

- A real map is not required.
- Use a clean route/workspace panel or neutral canvas.
- If stop coordinates are not available, show route summary cards instead of pretending to map exact locations.
- Do not block document/detail UI on map implementation.

Recommended content:

- Pickup/stop/delivery cards
- Route placeholder
- Stop count
- Status markers

## Responsive Requirements

- Desktop:
  - Left panel fixed or constrained width.
  - Right visual area fills remaining space.
- Tablet/mobile:
  - Stack detail panel above visual area.
  - Tabs remain visible and tappable.
  - Document cards remain readable.
  - Buttons should not overflow.

## Expected Files

Likely files involved:

- `pages/trip-plan-detail.html`
- `scripts/trip-plan-detail.js`
- `styles/trip-plan-detail.css`
- `pages/carrier-billing.html`
- `scripts/carrier-billing.js`
- `styles/carrier-billing.css`

Coordinate with Core Developer if the Documents tab needs data or actions that are not yet implemented.

## Acceptance Criteria

- Trip Plan Detail has Overview, Details, and Documents tabs.
- Carrier Billing Detail has Overview, Details, and Documents tabs or a clearly equivalent detail structure.
- Documents tab visually supports View and Download actions.
- POD has clear Upload/Replace UI in Trip Plan Documents.
- Generated documents are shown as generated or available only when Core Developer functionality exists.
- Existing trip stage/resource workflow remains usable.
- Existing billing create/edit behavior remains usable.
- Layout is usable on desktop and mobile.
- UI does not introduce fake working actions.

## Notes For Developer

- This is a UI task, but it depends on the Core Developer document task for actual document generation/upload.
- Implement visual structure first, then wire actions only when available.
- If document data is missing, show honest states such as `Not generated` or `Missing`.
- Do not change business rules in this task.
