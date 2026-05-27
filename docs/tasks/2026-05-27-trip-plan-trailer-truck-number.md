# Trip Plan Trailer And Truck Number

Status: Ready for Development

## Owner Role

Core Developer

## Background

Trip Plan execution needs to record the responsible trailer number and truck number for each load. These fields are required for dispatch readiness and operational traceability.

The product requirement has also been added to:

- `docs/TMS_MVP_ROADMAP.md`
- `docs/TMS_ACCEPTANCE_CHECKLIST.md`

## Scope

- Add trailer number and truck number fields to Trip Plan create/edit flow.
- Persist both fields with the trip plan record.
- Display both fields on Trip Plans list/detail views where appropriate.
- Display both fields in Trip Plan Detail execution summary.
- Keep both fields visible through resource assignment and loading departure flow.
- Treat missing trailer/truck number as a dispatch readiness issue before moving to In Transit.
- Record changes to trailer/truck number in trip `change_log`.

## Out Of Scope

- WMS inventory behavior.
- Carrier Billing behavior.
- Full shipment entity refactor.
- Enterprise backend API refactor.
- Permission or approval workflow.
- UI redesign beyond what is required to place the fields cleanly.

## Requirements

- User can enter responsible trailer number when creating a Trip Plan.
- User can enter responsible truck number when creating a Trip Plan.
- User can edit trailer number and truck number on an existing Trip Plan.
- Existing trip plans without these fields must still load without errors.
- Missing trailer/truck number should be visible as a readiness issue before dispatch.
- The values should remain visible after resource assignment and after loading departure.

## Data / Schema Impact

Preferred schema update on `trip_plans`:

```text
trailer_number text
truck_number text
```

If a temporary JSON-based implementation is used instead, document why and keep the field names stable for future migration.

## Expected Files

Likely files involved:

- `sql/supabase-trip-plans-schema.sql`
- `pages/create-trip-plans.html`
- `scripts/trip-plans.js`
- `pages/trip-plans.html`
- `scripts/trip-plans-list.js`
- `pages/trip-plan-detail.html`
- `scripts/trip-plan-detail.js`
- `styles/trip-plans.css`
- `styles/trip-plans-list.css`
- `styles/trip-plan-detail.css`

## Acceptance Criteria

- User can enter trailer number and truck number when creating a Trip Plan.
- User can edit trailer number and truck number on an existing Trip Plan.
- Values persist after page refresh.
- Values appear in Trip Plans list/detail and Trip Plan Detail.
- Depart Dock or move to In Transit warns or blocks when either value is missing.
- Changing either value creates a `change_log` entry.
- Existing trip plans without these fields still load without errors.

## Notes For Developer

- Follow the existing static HTML + browser JavaScript + Supabase REST architecture.
- Do not introduce a backend framework.
- Do not refactor unrelated Trip Plan logic.
- Preserve existing ISA binding rules.
- Preserve existing Trip Plan status behavior unless required for dispatch readiness validation.
