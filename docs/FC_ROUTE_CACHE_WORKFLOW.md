# FC Route Cache Workflow

This document records the FC address, coordinate, transit time, and route-cache workflow.

## Purpose

The TMS uses `public.fba_fcs` for FC base data and `public.fba_fc_route_cache` for persisted route data from a fixed origin to each FC.

The current cached origin is:

```text
4651 E Francis dock 21, Ontario, CA 91761
```

## Data Model

`public.fba_fcs` stores one row per FC:

- Address, city, state, and ZIP.
- Latitude and longitude.
- `transit_days`, stored as days because trip planning code uses `transit_days * 24`.
- `legal_transit_hours`, an FMCSA HOS planning estimate from the cached Google drive duration.

`public.fba_fc_route_cache` stores one row per origin and FC:

- `origin_key`: stable origin identifier, currently `ontario_dock_21`.
- `fc`: destination FC code.
- Distance, duration, route description, and encoded polyline.
- `encoded_polyline` is retained for compact persistence and can be decoded by map clients.

Do not store route polylines directly in `public.fba_fcs`. Routes depend on origin, and large route strings would make normal FC reads too heavy.

## Repository Files

Merged project files:

- `sql/postgres-fba-fc-schema.sql`: owns the FC base table, weekly FC appointment table, and route cache table schema.
- `sql/postgres-fba-fc-final-data-update-2026-06-02.sql`: replays the final 212-row FC address, coordinate, and `transit_days` update.
- `sql/postgres-fba-fc-legal-transit-hours-update-2026-06-02.sql`: adds and fills `legal_transit_hours`.
- `docs/FC_ROUTE_CACHE_WORKFLOW.md`: explains the workflow and artifact purpose.

Local generated artifacts:

- `outputs/fc-route-cache-2026-06-02/`: final route package and audit files.

## Output Package

The local final package lives under:

```text
outputs/fc-route-cache-2026-06-02/
```

Important files:

- `01_fba_fcs_final_all_212.csv`: final 212 FC address and coordinate source.
- `02_update_public_fba_fcs_address_coords_transit.sql`: SQL backup for the FC update.
- `03_ontario_dock_21_routes_summary.csv`: route distance and duration summary.
- `04_ontario_dock_21_routes_cache_compact.jsonl`: compact route cache source.
- `05_ontario_dock_21_routes_webgl_simplified.geojson`: simplified route lines for WebGL.
- `06_ontario_dock_21_routes_google_earth_simplified.kml`: simplified route lines for Google Earth.
- `09_combined_schema_and_fba_update.sql`: schema plus FC update backup.
- `10_fba_fcs_legal_transit_hours.csv`: audit CSV for FMCSA-style legal transit calculations.

These files are generated artifacts and should stay local unless a reviewer explicitly asks to publish them.

## Legacy Update Status

The 2026-06-02 update was originally applied through the legacy Supabase REST endpoint before the VPS migration:

- `public.fba_fcs`: 212 FC rows updated.
- `public.fba_fc_route_cache`: 212 route rows uploaded.

## Legal Transit Calculation

`legal_transit_hours` is a planning estimate, not a live ETA. It uses:

```text
legal_transit_hours =
  Google fixed drive hours
  + 10 hours off-duty between each 11-hour driving segment
  + 0.5 hours break for each driving segment over 8 hours
```

This reflects the main FMCSA property-carrying HOS constraints used for route planning:

- Maximum 11 hours driving after 10 consecutive hours off duty.
- A 30-minute break when more than 8 cumulative driving hours are needed in a duty period.
- No realtime traffic, detention, loading, weather, team-driver, or weekly 60/70-hour cycle adjustment is included.

Trip Plan buffer calculations use `fba_fcs.legal_transit_hours` for known FC destinations. The create/edit form displays this as legal transit days by dividing hours by 24, while `time_buffer_hours` is calculated from the original legal hours value to avoid unnecessary rounding.

Appointment List can also display Solo Safe Transit. It uses `legal_transit_hours` plus a distance-based solo-driver safety buffer from `fba_fc_route_cache.distance_miles`: under 500 mi uses +10%, 500-1500 mi uses +15%, and over 1500 mi uses +25%.

## Rebuild Guidance

When regenerating routes:

- Use Google Routes API `computeRoutes`, not `computeRouteMatrix`, because full route polylines are required.
- Use `TRAFFIC_UNAWARE` for persistent cache data.
- Store realtime traffic separately if needed; do not overwrite fixed route duration with changing traffic estimates.
- Keep route artifacts in an ignored `outputs/fc-route-cache-[date]/` folder.
