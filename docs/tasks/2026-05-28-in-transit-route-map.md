# Trip Plan In Transit Route Map

Status: Ready for Development

## Owner Role

Core Developer

## Background

`trip-plan-detail.html` should show a map on the right side when a Trip Plan is in `In Transit` status.

For the current MVP, the map only needs to show the route from warehouse/origin to destination. Later, this should evolve to support driver-side GPS tracking.

## Scope

- Add a route map area to the right side of `trip-plan-detail.html`.
- Show the map when the trip status is `In Transit`.
- Display an origin-to-destination route for the current Trip Plan.
- Support current Trip Plan stop data.
- Keep existing stage flow, resource assignment, and document behavior intact.
- Choose a low-cost/free-friendly map provider suitable for MVP.

## Out Of Scope

- Driver mobile app.
- Live driver GPS streaming.
- Real-time ETA updates.
- Geofencing.
- Route optimization.
- Fleet tracking backend.
- Enterprise telematics integration.
- Paid production map contract.

## Recommended Map API Direction

### MVP Recommendation

Use:

```text
MapLibre GL JS + OpenFreeMap tiles + openrouteservice directions
```

Reasoning:

- MapLibre GL JS is open source and browser-friendly.
- OpenFreeMap offers free public map tiles without API keys.
- openrouteservice offers a free route API tier suitable for demo/MVP usage.
- This avoids early dependency on Google Maps billing or Mapbox billing.
- The implementation can later swap routing providers if needed.

### Provider Notes

#### MapLibre GL JS

Use for rendering the interactive map in the browser.

Pros:

- Open-source rendering library.
- Good fit for static HTML/browser JavaScript.
- Works with vector tile styles.
- Avoids Mapbox GL JS lock-in.

Cons:

- Requires choosing a tile provider.
- Requires more setup than Google Maps iframe/embed.

#### OpenFreeMap

Use for map tiles in MVP if acceptable.

Pros:

- Public instance is free.
- No API key required.
- Supports commercial usage.
- Uses OpenStreetMap data.

Cons:

- No SLA.
- Public free service may not be suitable for enterprise production.
- Should be treated as MVP/demo infrastructure, not final enterprise dependency.

#### openrouteservice

Use for route geometry from warehouse to destination.

Pros:

- Free standard tier is enough for MVP testing.
- Supports directions.
- Based on OpenStreetMap data.

Cons:

- Requires API key.
- Has daily and per-minute limits.
- Production use may require quota review or paid/self-hosted alternative.

#### Mapbox

Viable alternative if simpler integration and hosted routing are preferred.

Pros:

- Strong developer experience.
- Hosted maps and Directions API.
- Large free tier for early usage.

Cons:

- Requires API token and account.
- Usage may become paid as volume grows.
- Vendor lock-in is higher than MapLibre/open-source stack.

#### Google Maps Platform

Not recommended for MVP unless the team specifically wants Google ecosystem.

Pros:

- Familiar map quality.
- Strong route and place data.
- Enterprise-grade.

Cons:

- Billing setup required for normal usage.
- Free caps are lower for Dynamic Maps and Routes than Mapbox's stated free tiers.
- Costs can rise as usage grows.

## Current Pricing / Free-Tier Reference

As of research on 2026-05-28:

- Google Maps Platform lists `Dynamic Maps` with a 10,000 free usage cap and `Routes: Compute Routes Essentials` with a 10,000 free usage cap.
- Mapbox pricing lists Mapbox GL JS map loads free up to 50,000 monthly loads and Directions API free up to 100,000 monthly requests.
- openrouteservice standard plan lists Directions limits of 2,000 per day and 40 per minute.
- OpenFreeMap states its public instance is free, with no registration, API keys, or request/view limits, but no SLA.
- OpenStreetMap's own tile servers should not be treated as a production tile backend; OSM tile policy says OSM data is free, but tile server capacity is limited and no SLA is provided.

## Data Requirements

To draw a route, the implementation needs origin and destination coordinates.

Potential coordinate sources:

1. Existing FC data from `fba_fcs` if stop destination is an Amazon FC.
2. Trip Plan stop destination if it can be geocoded.
3. Default warehouse/origin coordinates configured in code or a future facility table.
4. Private address geocoding, if route provider supports it and quota allows.

MVP should start with the lowest-risk option:

- Use existing FC latitude/longitude when available.
- Use a configured warehouse/origin coordinate.
- If destination coordinates are missing, show a clear map empty state instead of failing.

## UI Requirements

When status is `In Transit`:

- Right side of Trip Plan Detail should show a map panel.
- Map should show:
  - Origin marker
  - Destination marker
  - Route line
  - Basic route summary if available:
    - distance
    - estimated duration
- If multiple stops exist, show route segments or markers for each stop when coordinates are available.
- If route cannot be loaded, show a clear fallback state:

```text
Route map unavailable
Missing coordinates or route provider configuration.
```

For non-`In Transit` statuses:

- The map can remain visible as a route preview, or
- Show route preview only in the right visual area if it improves consistency.

Product preference:

- Prioritize showing it for `In Transit`.
- Route preview for other statuses can be a follow-up.

## Configuration Requirements

Do not hardcode secrets into committed files.

Recommended local config:

```js
window.TMS_MAP_CONFIG = {
  provider: "openrouteservice",
  openRouteServiceKey: "local key here",
  origin: {
    name: "Warehouse",
    latitude: 0,
    longitude: 0
  }
};
```

If added, provide a safe example file only:

```text
map-config.example.js
```

Actual API keys must remain local and ignored by Git.

## Future GPS Direction

Later driver GPS tracking should be designed separately.

Future architecture should include:

- Driver app or driver web check-in
- GPS position event table
- Trip tracking event stream
- Current truck location marker
- ETA recalculation
- Privacy and driver permission controls
- Dispatch monitoring view

Do not build this in the current task.

## Expected Files

Likely files involved:

- `pages/trip-plan-detail.html`
- `scripts/trip-plan-detail.js`
- `styles/trip-plan-detail.css`
- `supabase-config.example.js` or a new safe map config example
- Possibly `README.md` or docs if configuration steps are added

If using external libraries by CDN, document the dependency and keep it consistent with the current no-build architecture.

## Acceptance Criteria

- Open a Trip Plan with status `In Transit`.
- The right side of `trip-plan-detail.html` shows a map area.
- Origin and destination markers are visible when coordinates exist.
- A route line is visible when the route API returns geometry.
- Route loading failure shows a readable fallback state.
- Existing Trip Plan stage flow still works.
- Existing resource assignment display still works.
- No API key or local secret is committed.
- Map implementation is documented enough for another developer to configure locally.

## Notes For Developer

- Use MapLibre GL JS for map rendering unless there is a strong implementation blocker.
- Prefer OpenFreeMap for MVP base map tiles.
- Prefer openrouteservice for MVP route geometry.
- Keep provider code isolated so the project can switch to Mapbox, Google, or self-hosted routing later.
- If external API limits block testing, add a mocked route fallback for development.
