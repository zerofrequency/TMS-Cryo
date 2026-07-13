# TMS Current Status

Last updated: 2026-07-13

## Canonical Entry Points

- Agent entry: `AGENTS.md`
- User and app overview: `README.md`
- Project structure: `docs/PROJECT_STRUCTURE.md`
- Role model: `docs/TEAM_ROLES.md`
- Task handoff process: `docs/TASK_HANDOFF_PROCESS.md`
- Local dev server: `docs/LOCAL_DEV_SERVER_GUIDE.md`

## True Root

The active project root is:

```text
/Users/cryo/Documents/Codex/TMS/TMS-main
```

Avoid starting project work from the parent `TMS` folder unless the task is about workspace organization.

## Current Working Model

Use one project-lead thread for product direction and coordination. For implementation, prefer short-lived task-scoped agents:

- Debug Specialist for reproduction and root cause.
- UI Support Developer for UI-only fixes.
- Core Developer for business logic, persistence, schema, calculations, and integration.
- Version And File Manager for git scope, commits, pushes, and local-only file checks.

## Handoff Rule

When a task needs to outlive chat memory, write or update a handoff under `docs/tasks/` using `docs/TASK_HANDOFF_PROCESS.md`.

Every handoff should include:

- owner role
- background
- scope
- out of scope
- requirements
- expected files
- acceptance criteria
- verification steps

## Local-Only Areas

Do not commit or treat these as durable product docs:

- `docs/tasks/`
- `outputs/`
- `supabase-config.js`
- `map-config.js`

## Current Dev Command

```sh
npm run dev
```

Default URL:

```text
http://127.0.0.1:5173/
```

## VPS Test Deployment

The current test deployment runs on `vps-sh`:

```text
http://tms.zefanlong.space
```

The VPS's primary service is DERP on HTTPS `443`; do not move or replace DERP for TMS. TMS is an HTTP-only test site on nginx port `80`.

Current VPS components:

- nginx serves `/var/www/tms/current`
- `tms-login.service` handles the simple login page on local port `3100`
- `tms-postgrest.service` exposes the PostgreSQL REST API on port `3000`
- PostgreSQL `tms` database runs on local port `5433`

Runtime secrets and generated credentials live only on the VPS under `/etc/tms/` and must not be committed.
