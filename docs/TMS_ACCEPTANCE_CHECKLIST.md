# TMS Acceptance Checklist

Use this checklist to verify that the current TMS demo can run the core business flow end to end.

## Setup

- Open `index.html`.
- Confirm the navigation shows Home, Appt, Trip Plans, and Resources.
- Confirm `supabase-config.js` exists locally and contains a valid Supabase URL and anon key.
- Confirm required SQL files have been run in Supabase:
  - `sql/supabase-schema.sql`
  - `sql/supabase-fba-fc-schema.sql`
  - `sql/supabase-trip-plans-schema.sql`
  - `sql/supabase-isa-binding-schema.sql`
  - `sql/supabase-resources-schema.sql`
  - `sql/supabase-crew-slots-migration.sql`
  - `sql/supabase-fleet-capacity-migration.sql`

## Flow 1: Appointment Import

### Goal

Import Carrier Central appointment data and confirm appointments are searchable, editable, and saved.

### Steps

1. Open Appt.
2. Upload a Carrier Central CSV or XLSX file.
3. Confirm rows appear in the appointment table.
4. Search by ISA.
5. Filter by FC.
6. Filter by Status.
7. Filter by Load Type.
8. Open one appointment detail panel.
9. Set Load Type to Floorload or Palletized.
10. Add Notes.
11. Refresh the page.
12. Confirm Load Type and Notes remain saved.
13. Export CSV.

### Expected Results

- Imported appointments are merged by ISA.
- Re-importing the same ISA updates appointment details instead of creating duplicates.
- Manual Load Type and Notes are preserved unless previously blank.
- Table, calendar, and timeline views show consistent appointment data.
- Exported CSV includes current filtered records.

## Flow 2: Manual Appointment

### Goal

Create or update a single appointment without uploading a file.

### Steps

1. Open Appt.
2. Click Add Manually.
3. Enter ISA, FC, Status, Schedule Time, CRDD, Load Type, Reference, and Trailer.
4. Save the appointment.
5. Search for the ISA.
6. Edit Status or Notes.
7. Refresh the page.

### Expected Results

- A new appointment is created when the ISA does not exist.
- An existing appointment is updated when the ISA already exists.
- The saved record remains visible after refresh.

## Flow 3: Hot FC Weekly Status

### Goal

Maintain weekly appointment status for FCs.

### Steps

1. Open Hot FCs from Appt.
2. Select a week.
3. Select an FC.
4. Set an appointment status.
5. Save.
6. Switch between list and map views.
7. Clear the status and save again.

### Expected Results

- FCs with a non-empty weekly status appear in the week view.
- Clearing the status removes the FC from the active weekly list.
- Map and list views show matching weekly FC status data.

## Flow 4: Create Trip Plan

### Goal

Create a trip plan from one or more appointments.

### Steps

1. Open Trip Plans.
2. Click Create Trip Plan.
3. Select plan type: Single Drop, Two Drops, Three Drops, or Four Drops.
4. Select ETD date and period.
5. Set transport mode.
6. Enter the responsible trailer number.
7. Enter the responsible truck number.
8. Bind each stop to an existing appointment ISA or enter a private address appointment.
9. Confirm destination, schedule time, transit days, and buffer.
10. Save Trip Plan.
11. Return to Trip Plans list.

### Expected Results

- The trip plan is saved to Supabase.
- Stops are saved in the correct order.
- Appointment ISA stops show appointment-derived destination and schedule data.
- Buffer is calculated for each stop.
- Trailer number and truck number are saved with the trip plan.
- Trailer number and truck number are visible when the trip is reopened.
- New plan appears in the Trip Plans list.

## Flow 5: Duplicate ISA Protection

### Goal

Confirm one active ISA cannot be bound to more than one active trip plan.

### Steps

1. Create a trip plan using an appointment ISA.
2. Create another trip plan using the same ISA.
3. Attempt to save the second plan.

### Expected Results

- The second save is blocked.
- The user sees a conflict message.
- No duplicate active binding is created.

## Flow 6: Resource Maintenance

### Goal

Create base fleet, dock, and loading crew resources.

### Steps

1. Open Resources.
2. Click Maintain Resources.
3. Create one Fleet resource.
4. Create one Dock resource.
5. Create one Loading Crew resource.
6. Return to Resource Dashboard.

### Expected Results

- New resources are saved.
- Active resources appear as available when they have no active assignments.
- Inactive and Maintenance resources are counted separately.

## Flow 7: Trip Plan Resource Assignment

### Goal

Assign resources to a trip plan and confirm resource availability changes.

### Steps

1. Open a Trip Plan detail page.
2. Confirm trailer number and truck number are visible in the trip summary or execution area.
3. In Planned stage, assign Fleet.
4. In Waiting stage, assign Dock.
5. In Waiting stage, assign Loading Crew and task slot.
6. Open Resource Dashboard.
7. Confirm assigned resources show as in use or occupied.
8. Return to Trip Plan detail.
9. Release or cancel one assignment.
10. Confirm Resource Dashboard updates.

### Expected Results

- Fleet assignment is linked to the trip plan.
- Trailer number and truck number remain visible after resource assignment.
- Dock assignment marks the dock occupied.
- Loading crew assignment is linked to the selected work date and task slot.
- Released or cancelled assignments no longer count as active use.

## Flow 8: Loading Departure

### Goal

Release active loading resources and move the trip into In Transit.

### Steps

1. Open a Trip Plan detail page with active dock and crew assignments.
2. Confirm trailer number and truck number are present.
3. Open Loading stage.
4. Click Depart Dock.
5. Confirm trip status moves to In Transit.
6. Confirm dock and crew assignments are released.
7. Confirm change log records the departure.

### Expected Results

- Trip status becomes In Transit.
- Trailer number and truck number are retained on the In Transit trip.
- Active dock assignment becomes Completed.
- Active crew assignment becomes Completed.
- Change log includes vehicle departure details.

## Flow 9: Trip Status Review

### Goal

Review trip status, stop details, countdown, and change log.

### Steps

1. Open Trip Plans list.
2. Filter by status.
3. Filter by plan type.
4. Select a plan row.
5. Open detail panel.
6. Click View.
7. Review all stages in Trip Plan Detail.

### Expected Results

- List filters work correctly.
- Detail panel shows plan metadata, stops, countdown, and change log.
- Detail page shows current stage and all stage views.

## Flow 10: Known Enterprise Gaps

These are expected gaps in the current demo and should not block demo acceptance:

- No formal login or enterprise permission model.
- Browser directly writes to Supabase.
- No backend API layer.
- No full audit log table.
- No import preview or approval flow.
- No shipment entity separate from trip plan.
- No carrier billing.
- No live tracking.
- No full WMS inventory model.
- No automated test suite.
