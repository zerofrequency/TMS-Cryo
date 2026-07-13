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
- `tms-config.js`
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
- `tms-postgrest.service` exposes the PostgreSQL REST API on `127.0.0.1:3000`
- `tms-documents.service` handles authenticated uploads on `127.0.0.1:3101`
- PostgreSQL `tms` database runs on local port `5433`
- uploaded documents live under `/var/lib/tms/documents`

Runtime secrets and generated credentials live only on the VPS under `/etc/tms/` and must not be committed.

## Development Flow

Keep GitHub as the code source of truth. Do not migrate the canonical Git repository to the VPS.

Recommended flow:

1. Develop locally from `/Users/cryo/Documents/Codex/TMS/TMS-main`.
2. Verify locally with `npm test` and `npm run dev`.
3. Commit and push to GitHub `main`.
4. Deploy to the VPS test environment with `npm run deploy:vps`.
5. Check the running VPS environment with `npm run check:vps`.

Useful commands:

```sh
npm run deploy:vps
npm run backup:vps-db
npm run check:vps
```

`npm run deploy:vps` publishes tracked static app files to a new `/var/www/tms/releases/<timestamp>` release and updates `/var/www/tms/current`. It preserves VPS-local `tms-config.js` and `map-config.js` from the previous current release.

The deployment also installs the tracked document service and renders nginx from a secret-free template using the session token already stored under `/etc/tms`. It runs the full VPS health check after switching releases and restores the previous static release and nginx configuration if verification fails.

`npm run backup:vps-db` downloads a PostgreSQL custom-format dump from the VPS into `outputs/backups/`, which is ignored by Git.
