# Trip Plan Status Requirements

Status: Product Direction Approved

## Owner Role

Product Manager

## Background

The current Trip Plan status flow is too simple for the intended outbound TMS workflow. The product needs statuses that separate planning, schedule confirmation, loading queue, loading execution, transportation, delivery proof, financial completion, cancellation, and delay risk.

This document defines the product-level Trip Plan status model. Core Developer implementation tasks should reference this document.

## Status Model

Trip Plan must use a two-part status model:

```text
execution_status = Planned / Scheduled / Pending / Loading / In Transit / Delivered
control_status = Active / At Risk / Cancelled / Locked
```

`execution_status` represents the normal operational workflow.

`control_status` represents special control states that sit above the workflow. `At Risk`, `Cancelled`, and `Locked` must not be rendered as normal stages in Trip Plan Detail.

## Execution Status List

Use these execution statuses:

```text
Planned
Scheduled
Pending
Loading
In Transit
Delivered
```

## Execution Status Definitions

### Planned

The Trip Plan has been created, but the operational plan is not fully confirmed yet.

Required product meaning:

- Plan record exists.
- ISA binding is required.
- ETA is required before the plan can be confirmed.
- Plan can still be edited freely within normal planning rules.

### Scheduled

The Trip Plan has been confirmed and is ready for transportation resource matching.

Required product meaning:

- ISA and ETA are confirmed.
- Carrier should be matched or assigned.
- Trailer and truck can be added now or later.
- A carrier bill should be created for the scheduled plan.
- The plan has not entered the warehouse loading queue yet.

### Pending

The Trip Plan has entered the loading sequence and is waiting for loading.

Required product meaning:

- Loading queue position has started.
- Crew and dock matching are required.
- The plan is not actively loading yet.

### Loading

The warehouse has started loading the Trip Plan.

Required product meaning:

- Dock and loading crew should be assigned.
- Loading work is in progress.
- Departure from dock moves the plan to `In Transit`.

### In Transit

The Trip Plan has left the warehouse and is on the way to destination.

Required product meaning:

- Vehicle has departed.
- Active dock and crew assignments should be released or completed.
- Route/timing review belongs in this status.

### Delivered

The Trip Plan has arrived at destination.

Required product meaning:

- Delivery is complete operationally.
- Proof of Delivery (POD) upload is required before the plan can be locked.
- Billing can continue after delivery.

## Control Status List

Use these control statuses:

```text
Active
At Risk
Cancelled
Locked
```

## Control Status Definitions

### Active

The Trip Plan is active and follows the normal execution workflow.

Required product meaning:

- No special exception or lock state is currently applied.
- Trip Plan Detail should show the regular execution stage flow.
- The current `execution_status` determines where the plan sits in the workflow.

### At Risk

The Trip Plan cannot be completed on time or is at material risk of missing the expected schedule.

Required product meaning:

- The plan still exists and may continue.
- Risk reason is required.
- Risk status should be visible in filters, badges, and exception reporting.
- It is distinct from `Cancelled`; `At Risk` means delayed/risk, not terminated.
- It can coexist with a normal execution status, for example `Pending + At Risk`.

### Cancelled

The Trip Plan has been cancelled.

Required product meaning:

- The plan will not continue through execution.
- Cancellation reason is required.
- Active ISA bindings should be released.
- Active resource assignments should be released or cancelled.
- Related carrier bill should be voided or reviewed according to billing rules.
- Trip Plan Detail should keep the execution stage flow visible but disabled/greyed out.

### Locked

The Trip Plan is fully complete and locked.

Required product meaning:

- All operational content is complete.
- Required POD has been uploaded.
- Related carrier bill is settled/paid.
- The plan should become read-only except for authorized enterprise audit actions.
- Trip Plan Detail should show Delivered as the completed execution stage and show Locked separately as a control banner/state.

## Recommended Transition Model

Primary flow:

```text
Planned -> Scheduled -> Pending -> Loading -> In Transit -> Delivered
```

Exception flow:

```text
control_status Active -> At Risk
control_status At Risk -> Active
control_status Active -> Cancelled
control_status At Risk -> Cancelled
control_status Active -> Locked
```

The exact allowed transitions may be tightened during implementation, but the UI must not treat statuses as a free-form dropdown for long-term enterprise use.

## Required Validations

- `Planned -> Scheduled` requires ISA binding and ETA.
- `Scheduled -> Pending` should require or strongly prompt carrier assignment.
- `Scheduled` should create a related carrier bill if one does not already exist.
- Trailer and truck may be blank in `Scheduled`, but should be treated as dispatch readiness issues before `In Transit`.
- `Pending -> Loading` requires dock and loading crew assignment.
- `Loading -> In Transit` requires trailer and truck number.
- `control_status = Locked` requires `execution_status = Delivered`, POD upload, and related carrier bill paid/settled.
- `control_status = Cancelled` requires cancellation reason.
- `control_status = At Risk` requires risk reason.

## Data / Schema Direction

Core Developer should add or prepare for separate fields:

```text
execution_status text not null default 'Planned'
control_status text not null default 'Active'
```

If the current `plan_status` field must remain temporarily for compatibility, it should be treated as legacy and mapped into the two-field model.

Recommended `execution_status` values are title case as displayed:

```text
Planned
Scheduled
Pending
Loading
In Transit
Delivered
```

Recommended `control_status` values are title case as displayed:

```text
Active
At Risk
Cancelled
Locked
```

Legacy status mapping:

```text
plan_status Waiting -> execution_status Pending, control_status Active
plan_status voided -> keep previous execution_status if available, control_status Cancelled
plan_status Voided -> keep previous execution_status if available, control_status Cancelled
plan_status Active -> execution_status Planned, control_status Active
plan_status Locked -> execution_status Delivered, control_status Locked
plan_status At Risk -> keep previous execution_status if available, control_status At Risk
plan_status Cancelled -> keep previous execution_status if available, control_status Cancelled
```

## Carrier Billing Integration

When a Trip Plan becomes `Scheduled`, the system should create or prepare a related carrier bill for that plan.

MVP behavior:

- If no carrier bill exists for the Trip Plan, create one in `Draft` status.
- Link the bill to `trip_plans.id`.
- Carry over available carrier name when known.
- Do not create duplicate draft bills for repeated status saves.

Enterprise behavior later:

- Bill creation may become an explicit approval workflow.
- Carrier contract/rate logic may populate draft charges.
- Permission checks should control who can approve and pay bills.

## UI Requirements

- Trip Plan list filters should support both execution status and control status.
- Trip Plan status badges must use the shared UI status system.
- Trip Plan Detail stage flow must show only `Planned -> Scheduled -> Pending -> Loading -> In Transit -> Delivered`.
- Trip Plan Detail must show `control_status` separately from the stage flow.
- `At Risk` should appear as a warning/exception banner or panel without removing the plan from its execution stage.
- `Cancelled` should appear as a termination banner/state, with the execution flow visible but disabled/greyed out.
- `Locked` should appear as a completion/lock banner/state, with Delivered shown as completed and the page mostly read-only.
- Execution status changes and control status changes should use workflow actions where practical, not only row dropdowns.

## Acceptance Criteria

- New `execution_status` and `control_status` fields are documented and implemented consistently in schema, list, detail, appointment binding display, and filters.
- Legacy `Waiting` values display and migrate as `execution_status = Pending` and `control_status = Active`.
- Legacy `voided` / `Voided` values display and migrate as `control_status = Cancelled`.
- Execution status and control status changes create change log entries.
- Scheduled plans create or prepare carrier bills without duplicates.
- Delivered plans cannot be locked until POD is uploaded and carrier billing is settled.
- Cancelled plans require a cancellation reason and release active ISA/resource bindings.
- At Risk plans require a risk reason and appear in exception/reporting filters.
- Trip Plan Detail does not render `Locked`, `At Risk`, or `Cancelled` as regular execution stages.

## Related Documents

- `docs/TMS_MVP_ROADMAP.md`
- `docs/CARRIER_BILLING_REQUIREMENTS.md`
- `docs/TMS_ACCEPTANCE_CHECKLIST.md`
- `docs/tasks/2026-05-30-trip-plan-status-model-update.md`
