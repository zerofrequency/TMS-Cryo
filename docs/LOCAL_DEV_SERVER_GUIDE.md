# Local Development Server Guide

Use a local HTTP server to open and test the TMS web pages.

Do not rely on directly opening HTML files with `file://` for normal development or testing.

## Why

Opening pages with `file://` can trigger browser security restrictions, including:

- Blocked local file access.
- Inconsistent script loading.
- CORS-like restrictions.
- Storage/API behavior differences.
- Supabase config loading issues.
- Map or document preview issues.
- Future module/import limitations.

The project should be tested through:

```text
http://localhost:[port]
```

or:

```text
http://127.0.0.1:[port]
```

## Recommended Command

From the project root:

```sh
cd /Users/cryo/Documents/Codex/TMS/TMS-main
npm run dev
```

Then open:

```text
http://127.0.0.1:5173/
```

## Alternative Ports

If port `5173` is already in use, use another port:

```sh
npm run dev -- --port 8080
```

Then open:

```text
http://127.0.0.1:8080/
```

## Required Testing Rule

All role-based development conversations should test pages through the local server.

Examples:

```text
http://127.0.0.1:5173/appts.html
http://127.0.0.1:5173/pages/trip-plans.html
http://127.0.0.1:5173/pages/trip-plan-detail.html?id=[trip_plan_id]
http://127.0.0.1:5173/pages/carrier-billing.html
```

## What Not To Do

Avoid:

```text
file:///Users/cryo/Documents/Codex/TMS/TMS-main/index.html
```

That path may appear to work for simple pages but can fail once the page depends on browser APIs, external requests, storage, maps, or generated documents.

## Notes

- The local server should only serve local development files.
- Do not commit local runtime output.
- Do not expose the local server publicly.
- Keep API keys and local config in ignored local config files.
