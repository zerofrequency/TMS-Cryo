# Project Structure

This repository is organized by browser entry points, page-specific assets, database setup, and team process files.

## Root files

- `index.html`: module homepage and navigation entry.
- `appts.html`: appointment manager page.
- `README.md`: project overview, setup, and feature notes.
- `CONTRIBUTING.md`: team workflow, branch naming, pull request expectations, and local setup rules.
- `supabase-config.example.js`: safe template for local Supabase configuration.
- `map-config.example.js`: safe template for local map configuration.

## Directories

- `.github/`: GitHub collaboration files such as the pull request template.
- `data/`: tracked reference data. Personal generated data exports are ignored by Git.
- `docs/`: project documentation, requirements, workflow guides, and planning notes.
- `docs/tasks/`: local dated task handoff files for role-based development work. This directory is ignored by Git.
- `outputs/`: local generated artifacts such as test data and one-off route cache packages.
- `pages/`: secondary HTML pages.
- `scripts/`: browser JavaScript files.
- `sql/`: Supabase schema and migration SQL files.
- `styles/`: CSS files.

## Local-only files

The following files may exist on a developer machine, but they are ignored and should not be committed:

- `.DS_Store`
- `.env`
- `.env.*`
- `supabase-config.js`
- `map-config.js`
- `data/carrier-appointments.json`
- `docs/tasks/`
- `outputs/`
- imported `.csv`, `.xlsx`, and `.xls` files

Keep `supabase-config.js` at the repository root because the browser pages load it from there. Do not move it into another folder.
Keep `map-config.js` at the repository root when using local map credentials. Do not commit it.
Keep role task handoffs in `docs/tasks/` for local coordination only. Do not commit them.

## Where to add new files

- Add new pages to `pages/` unless they are primary root entry points.
- Add page behavior to `scripts/`.
- Add page styling to `styles/`.
- Add database changes to `sql/`.
- Add contributor-facing documentation, requirements, setup guides, and planning notes to `docs/`.
- Add role task handoffs to local `docs/tasks/` using dated filenames. These files should stay untracked.
- Add large generated route, map, and import/export packages under `outputs/` and document their purpose in `docs/`.
- Add GitHub process files to `.github/`.
