# Carrier Appointment Manager

Lightweight personal dashboard for managing Amazon Carrier Central appointments.

## Team development

Use one regular clone of this repository for day-to-day development. Keep `main` stable and create a short-lived branch for each change:

```sh
git checkout main
git pull
git checkout -b feat/your-change-name
```

Open a pull request before merging back to `main`. Do not commit local credentials, exported appointment files, or browser-generated files. See `CONTRIBUTING.md` for the team workflow.

If you use Git worktrees locally, treat them as an advanced personal setup only. The canonical project is the repository root after a normal clone, not a parent folder containing multiple worktrees.

## Open

Run a local development server from the project root, then open the homepage through HTTP:

```sh
npm run dev
```

```text
http://127.0.0.1:5173/
```

Use **Appt** for appointments, **Trip Plans** to review outbound plans, and **Create Trip Plan** from that page to add a new plan. If port `5173` is already in use, run `npm run dev -- --port 8080` and open that local URL. Avoid using `file://` as the normal testing path.

See `docs/LOCAL_DEV_SERVER_GUIDE.md` for the full local testing workflow.

## MVP development and VPS deployment

GitHub remains the code source of truth. Develop locally on the Mac, commit and push to `main`, then deploy the static app to the `vps-sh` test environment.

```sh
npm run dev
npm test
npm run check:vps
npm run deploy:vps
```

The VPS deployment is a test/showcase environment:

- Public URL: `http://tms.zefanlong.space`
- Static files: `/var/www/tms/current`
- nginx serves the app on port `80`
- DERP remains the primary VPS service on HTTPS `443`; do not move DERP for TMS
- `tms-login.service` handles the simple login page on local port `3100`
- `tms-postgrest.service` exposes the PostgreSQL REST API on `127.0.0.1:3000`
- `tms-documents.service` stores authenticated POD uploads on `127.0.0.1:3101`
- PostgreSQL database `tms` runs locally on port `5433`
- uploaded files live under `/var/lib/tms/documents`

Back up the VPS database before risky data or schema work:

```sh
npm run backup:vps-db
```

Backups are downloaded under `outputs/backups/`, which is intentionally ignored by Git.

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

Use the time toggle above the appointment list to switch the table, calendar, and timeline between appointment time and latest departure time. Latest departure is calculated from the appointment time minus `fba_fcs.legal_transit_hours`, so dispatch planning can sort and group by the latest compliant loading/departure deadline.

Use **Add Manually** to create or update a single appointment by ISA. Manual entries merge by `ISA` and save through the TMS API or to the local backup just like CSV/XLSX imports.

## Storage

The current deployed MVP uses PostgreSQL on `vps-sh` through PostgREST. The previous Supabase project is retained as a legacy backup, not the primary database.

For local browser testing, copy `tms-config.example.js` to `tms-config.js`, then set an explicit API base and optional generic token only when testing against a non-same-origin PostgREST environment.

If the REST config is not configured or unavailable, the appointment page can use local `IndexedDB` as a backup.

CSV/XLSX uploads are merged by ISA and saved to the configured REST backend when `tms-config.js` is valid.

POD files are uploaded through the authenticated `/documents/` route and stored on the VPS. Their metadata remains in PostgreSQL table `business_documents`.

## PostgreSQL schema setup

The SQL files under `sql/` are PostgreSQL schema and migration files with a `postgres-*` prefix.

Run `sql/postgres-schema.sql` before syncing appointments. Run `sql/postgres-fba-fc-schema.sql` to add the FBA FC base data, weekly FC appointment table, and persisted FC route cache table. Run `sql/postgres-trip-plans-schema.sql` before saving trip plans.

Run `sql/postgres-resources-schema.sql` to add Carrier, Dock, and Loading Crew resource tables plus their assignment tables.

Run `sql/postgres-fba-fc-final-data-update-2026-06-02.sql` to reapply the latest 212-row FC address, coordinate, and route-duration update if the `fba_fcs` data needs to be restored. Run `sql/postgres-fba-fc-legal-transit-hours-update-2026-06-02.sql` to add and fill the FMCSA-style `legal_transit_hours` planning estimate.

Create and edit local `tms-config.js` for the API endpoint you are testing:

```js
window.TMS_CONFIG = {
  apiBaseUrl: "",
  apiToken: "",
  documentBaseUrl: "/documents",
};
```

Leave `apiBaseUrl` and `apiToken` empty for the same-origin VPS deployment. Never put a PostgreSQL password or privileged PostgREST token in browser configuration.

For team development, each developer should create their own local `tms-config.js`. This file is ignored by Git and must not be shared in commits.

## Route map setup

Trip Plan Detail can show an in-transit route map with MapLibre GL JS, OpenFreeMap tiles, and openrouteservice directions. Copy `map-config.example.js` to `map-config.js`, then set your local origin and optional openrouteservice key:

```js
window.TMS_MAP_CONFIG = {
  provider: "openrouteservice",
  openRouteServiceKey: "paste local key here",
  origin: {
    name: "Warehouse",
    latitude: 34.0522,
    longitude: -118.2437
  }
};
```

`map-config.js` is ignored by Git. If no openrouteservice key is provided, the page still draws a straight-line route preview when origin and FC coordinates exist.

## Hot FC weekly page

`pages/fc-dashboard.html` shows FCs with a non-empty weekly appointment status. Select a week, choose an FC, enter the appointment status, and save. Clearing the status removes that FC from the selected week view. The list and Three.js map both hide empty weekly rows.

## FC route cache

`public.fba_fcs` stores FC base data, `transit_days`, and `legal_transit_hours`. `public.fba_fc_route_cache` stores persisted Google route data by origin and FC so route distance, duration, and encoded polylines do not have to be fetched repeatedly.

The current local route package is under `outputs/fc-route-cache-2026-06-02/` and uses origin `4651 E Francis dock 21, Ontario, CA 91761`. See `docs/FC_ROUTE_CACHE_WORKFLOW.md` for the data model, generated artifacts, and rebuild guidance.

## Trip plans

`pages/trip-plans.html` is the outbound trip plan review page. It shows plan status, ETD, stops, destinations, transport, and minimum time buffer.

`pages/trip-plan-detail.html` shows a single trip plan with a stage flow for planned, waiting, loading, in transit, delivered, and voided. Open it from the **View** button in the Trip Plans detail panel.

`pages/create-trip-plans.html` creates outbound trip plans. A plan can be single-drop, two-drop, three-drop, or four-drop. Each stop can bind to an existing ISA or use manually entered private-address appointment information. The page records ETD, ISA/reference, destination, transport, legal transit days, appointment time, and time buffer. For known FC destinations, buffer calculation uses `fba_fcs.legal_transit_hours`; manual private destinations fall back to the entered legal transit days.

## Resources

`pages/resources.html` is the Resource Dashboard. It shows Carrier, Dock, and Loading Crew availability, occupancy, and active trip-plan usage.

`pages/resource-maintain.html` maintains Carrier, Dock, and Loading Crew base records only. It does not assign resources to trips.

Resource assignment is handled in `pages/trip-plan-detail.html`:

- Planned stage assigns Carrier
- Waiting stage assigns Dock
- Loading stage assigns Loading Crew

The resource module uses three base tables plus three assignment tables:

- `fleet_resources` and `fleet_assignments`
- `dock_resources` and `dock_assignments`
- `loading_crews` and `loading_crew_assignments`

Dock occupancy is derived from active dock assignments. Creating an active dock assignment in a trip plan marks it occupied in the dashboard; releasing or cancelling that assignment makes the dock available again.

## Folder structure

- `index.html`: module homepage
- `appts.html`: appointment manager
- `pages/`: secondary HTML pages
- `scripts/`: browser JavaScript
- `styles/`: page CSS
- `sql/`: PostgreSQL schema and migration files
- `server/`: loopback backend services
- `deploy/`: nginx and systemd deployment templates
- `tests/`: Node and Python automated tests
- `data/`: tracked reference data and ignored local generated data

See `docs/PROJECT_STRUCTURE.md` for where team members should add new files.

## Incremental updates

`ISA` is the unique value. When a new upload contains an existing ISA, the app updates the appointment details from the new file instead of creating a duplicate. Manual `Load Type` and `Notes` are preserved unless the existing value is blank.
