# Codex Entry - TMS

## Project

Personal Carrier Appointment Manager / TMS demo for appointments, trip plans, resources, FC data, routing, and PostgreSQL-backed workflows.

## Start Here

1. Read `README.md` for app usage and local setup.
2. Read `docs/CURRENT.md` for current Codex-facing status.
3. Read `docs/TEAM_ROLES.md` only when the user asks for role-based work.
4. Read `docs/TASK_HANDOFF_PROCESS.md` before creating or consuming task handoffs.
5. Read `docs/PROJECT_STRUCTURE.md` before adding or moving files.

## Common Commands

```sh
npm run dev
npm test
```

Default local URL:

```text
http://127.0.0.1:5173/
```

If port `5173` is busy:

```sh
npm run dev -- --port 8080
```

## Role Usage

Prefer task-scoped sub-agents over long-lived role threads:

```text
Role: UI Support Developer
Mission: Fix one visual issue
Read first:
- docs/TEAM_ROLES.md
- docs/tasks/<task>.md
Scope:
- UI only
Output:
- Files changed
- Verification performed
```

Use persistent role threads only for genuinely long-running coordination.

## Local-Only / Do Not Commit

- `docs/tasks/`
- `outputs/`
- `tms-config.js`
- `map-config.js`
- downloaded Carrier Central files
- browser-generated local files

## Documentation Sync Rule

After each task, decide whether project docs need updates.

Update `docs/CURRENT.md` when:

- workflow, branch meaning, commands, dev server path, or current source of truth changes
- a new durable output directory, artifact, or operating convention is introduced
- a task changes what future Codex sessions should read first

Update `AGENTS.md` only when:

- Codex startup instructions change
- common commands change
- local-only or do-not-edit boundaries change
- role or sub-agent delegation rules change

Update `docs/tasks/<date>-<task>.md` or another task handoff when:

- work is incomplete
- another thread or agent needs to continue
- the task introduces decisions, blockers, or follow-up steps

## Secrets

Never commit PostgreSQL credentials, privileged API tokens, Mapbox/OpenRouteService tokens, or local config files. `tms-config.js` and `map-config.js` are local-only.
