# TMS MVP Roadmap

This document defines the next product direction for the TMS module. The current application is a working demo. The next goal is to make the TMS flow complete, testable, and ready for enterprise refactoring.

## Product Goal

Build a reliable TMS MVP that supports the core outbound transportation workflow:

1. Import or create carrier appointments.
2. Review appointment status, FC, schedule, CRDD, load type, and notes.
3. Create trip plans from one or more appointments.
4. Assign fleet, dock, and loading crew resources.
5. Move a trip through planned, waiting, loading, in transit, delivered, or voided states.
6. Preserve operational history for review and later audit.

## Current TMS Scope

### Live Modules

- Appointment Manager
- Hot FC Weekly Dashboard
- Trip Plan List
- Create / Edit Trip Plan
- Trip Plan Detail
- Resource Dashboard
- Resource Maintain

### Deferred Modules

- Inventory
- Ocean Container
- Carrier billing
- Live transportation tracking
- Exception management
- Enterprise user and permission management

## Business Flow

```text
Carrier Central export
  -> Appointment import
  -> Appointment review and load type update
  -> Trip plan creation
  -> ISA binding check
  -> Fleet assignment
  -> Dock and loading crew assignment
  -> Loading completion and dock departure
  -> In transit
  -> Delivered or voided
```

## MVP Priorities

### P0: Make The Current Flow Reliable

- Confirm CSV and XLSX import behavior using real Carrier Central exports.
- Keep ISA as the unique appointment key.
- Preserve manual Load Type and Notes during repeated imports.
- Prevent one active ISA from being attached to multiple active trip plans.
- Confirm resource assignment and release behavior for fleet, dock, and loading crew.
- Confirm trip status changes do not break assignment visibility.
- Add repeatable demo data and a manual test script.

### P1: Productize Trip Execution

- Replace free status changes with controlled workflow actions.
- Add responsible trailer and truck number registration to Trip Plan execution.
- Define allowed trip state transitions:

```text
Planned -> Waiting -> Loading -> In Transit -> Delivered
Planned -> voided
Waiting -> voided
Loading -> voided
In Transit -> Delivered
```

- Require a reason when voiding a trip.
- Add clear action buttons for status movement instead of relying on table dropdowns.
- Add change log entries for every status movement.
- Add resource validation before stage movement:
  - Fleet must be assigned before leaving Planned.
  - Trailer number and truck number should be recorded before dispatch.
  - Dock and loading crew should be assigned before entering Loading.
  - Active dock and crew assignments should be released when departing dock.

### P2: Add Operational Exception Handling

- Appointment exception reasons:
  - Missing load type
  - Missing schedule
  - Cancelled appointment
  - Rescheduled appointment
  - Late risk
  - Duplicate ISA conflict

- Trip exception reasons:
  - Negative time buffer
  - Missing fleet
  - Missing dock
  - Missing crew
  - Appointment conflict
  - Late departure
  - Delivery delay

- Add exception filters and counters to list pages.

### P3: Prepare Enterprise Architecture

- Move write operations behind backend APIs.
- Add user, role, organization, and warehouse concepts.
- Add audit log for all critical operations.
- Add import batch flow:

```text
Upload -> Parse -> Validate -> Preview changes -> Confirm -> Save -> Import log
```

- Add automated tests for core business rules.
- Separate TMS domain from future WMS domain.

## Recommended Data Model Direction

The current schema is enough for demo use. Enterprise TMS should evolve toward these core entities:

- Organization
- User
- Role
- Facility
- Appointment
- Shipment
- TripPlan
- TripStop
- Carrier
- FleetResource
- DockResource
- LoadingCrew
- ResourceAssignment
- Exception
- AuditLog
- ImportBatch
- ExternalIdentifier

## Product Requirements To Define Next

### Appointment

- Required fields
- Import mapping
- Merge rule
- Manual edit rule
- Status taxonomy
- Appointment conflict rules

### Trip Plan

- Plan type
- Stop count
- Stop source: appointment or private address
- Responsible trailer number
- Responsible truck number
- Optional driver or carrier contact reference
- Status machine
- Void rule
- Duplicate ISA rule
- Buffer calculation rule
- Delivery completion rule

Trailer and truck number requirement:

- A Trip Plan should record the trailer number and truck number responsible for the load.
- These fields belong to TMS execution, not WMS inventory.
- They should be visible on Trip Plan list, Trip Plan detail, and relevant resource assignment views.
- They should be editable before dispatch.
- They should be preserved in the trip change log when changed.
- Before a trip moves to `In Transit`, missing trailer or truck number should be treated as a dispatch readiness issue.

### Resource

- Fleet capacity mode
- Dock occupancy rule
- Crew task slot rule
- Assignment release rule
- Assignment conflict rule

### Reporting

- Open appointments by FC
- Upcoming trip plans
- Negative buffer trips
- Assigned and available resources
- Dock occupancy
- Crew task calendar

## Team Execution Plan

### Sprint 1: Stabilize Demo Flow

- Create test data.
- Run full appointment to trip to resource flow.
- Fix blocking bugs found during the walkthrough.
- Document current known limitations.

### Sprint 2: Trip Workflow Control

- Add controlled stage movement.
- Add void reason.
- Add required change logs.
- Add validations before each transition.

### Sprint 3: Import And Exception Handling

- Add import preview.
- Add exception classification.
- Add exception filters and summary cards.

### Sprint 4: Enterprise Foundation Design

- Finalize API boundary.
- Finalize permission matrix.
- Finalize audit log requirements.
- Finalize future WMS integration boundary.

## Definition Of Done For TMS MVP

- A product manager can run the full business flow without developer help.
- A new team member can set up Supabase and load demo data using documented steps.
- Every core flow has an acceptance checklist.
- Critical business rules are enforced consistently.
- Current demo limitations are documented.
- Enterprise refactoring requirements are clear enough for engineering estimation.
