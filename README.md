# Carrier Appointment Manager

Lightweight personal dashboard for managing Amazon Carrier Central appointments.

## Open

Open `index.html` in a browser to use the module homepage. Use **Appt** for appointments, **Trip Plans** to review outbound plans, and **Create Trip Plan** from that page to add a new plan.

## Import

Use **Upload CSV/XLSX** and select an Amazon Carrier Central download file. The importer maps:

- `Destination FC` to `FC`
- `Carrier Requested Delivery Date` to `CRDD`
- `Scheduled Time` to `Schedule Time`
- `Status` to `Status`
- `Appointment ID` to `ISA`
- `Appointment Reference Code` to `Reference Code`
- `Trailer Number` to `Trailer`

`Load Type` is kept as an editable manual field because the provided Carrier Central export does not include a load type column. The supported values are `Floorload` and `Palletized`. The list view and detail panel use the same load type configuration, so colors, filters, and editable dropdowns stay consistent.

Use the table/calendar switch above the appointment list to change views. The calendar view shows appointments by scheduled date with only `FC` and `ISA`; click an appointment to open it in the detail panel.

Use **Add Manually** to create or update a single appointment by ISA. Manual entries merge by `ISA` and save to Supabase or the local backup just like CSV/XLSX imports.

## Storage

Records can be synced to Supabase. Copy `supabase-config.example.js` to `supabase-config.js`, then put your Supabase project URL and anon public key in `supabase-config.js`.

If Supabase is not configured or unavailable, the app uses local `IndexedDB` as a backup.

CSV/XLSX uploads are merged by ISA and saved to Supabase when `supabase-config.js` has a valid anon key.

## Supabase setup

Run `sql/supabase-schema.sql` in the Supabase SQL editor before syncing appointments. Run `sql/supabase-fba-fc-schema.sql` to add the FBA FC base data and weekly FC appointment tables. Run `sql/supabase-trip-plans-schema.sql` before saving trip plans. The current direct-browser setup uses the anon key and an open personal-use RLS policy. Tighten this later when adding Supabase Auth.

Create and edit `supabase-config.js`:

```js
window.CARRIER_APPT_SUPABASE = {
  url: "https://dilazfiqeqqqpwgocfvw.supabase.co",
  anonKey: "paste anon public key here",
};
```

Do not use the `service_role` key in this file.

## Hot FC weekly page

`pages/fc-dashboard.html` shows FCs with a non-empty weekly appointment status. Select a week, choose an FC, enter the appointment status, and save. Clearing the status removes that FC from the selected week view. The list and Three.js map both hide empty weekly rows.

## Trip plans

`pages/trip-plans.html` is the outbound trip plan review page. It shows plan status, ETA, stops, destinations, transport, and minimum time buffer.

`pages/create-trip-plans.html` creates outbound trip plans. A plan can be single-drop, two-drop, three-drop, or four-drop. Each stop can bind to an existing ISA or use manually entered private-address appointment information. The page records ETA, ISA/reference, destination, transport, transit days, appointment time, and time buffer.

## Folder structure

- `pages/`: secondary HTML pages
- `scripts/`: browser JavaScript
- `styles/`: page CSS
- `sql/`: Supabase schema files
- `data/`: local generated data assets

## Incremental updates

`ISA` is the unique value. When a new upload contains an existing ISA, the app updates the appointment details from the new file instead of creating a duplicate. Manual `Load Type` and `Notes` are preserved unless the existing value is blank.
