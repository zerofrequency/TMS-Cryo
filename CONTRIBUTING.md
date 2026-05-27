# Contributing

This project uses a simple branch-and-pull-request workflow for team development.

## Daily workflow

1. Start from the latest `main`.

   ```sh
   git checkout main
   git pull
   ```

2. Create a branch for one focused change.

   ```sh
   git checkout -b feat/short-description
   ```

3. Make the change, test it in a browser, and review the diff before committing.

   ```sh
   git status
   git diff
   ```

4. Commit with a clear message.

   ```sh
   git add .
   git commit -m "feat: describe the change"
   ```

5. Push the branch and open a pull request into `main`.

   ```sh
   git push -u origin feat/short-description
   ```

## Branch naming

Use short branch names that describe the work:

- `feat/trip-plan-filter`
- `fix/fc-status-save`
- `chore/update-schema-docs`
- `docs/team-workflow`

## Pull request expectations

Each pull request should include:

- What changed
- How it was tested
- Any Supabase SQL that must be run
- Any manual setup needed by other developers

Keep pull requests focused. Separate schema changes, UI changes, and large data changes when practical.

## Local configuration

Create local configuration from the example:

```sh
cp supabase-config.example.js supabase-config.js
```

Put only the Supabase project URL and anon public key in `supabase-config.js`.

Never commit:

- `supabase-config.js`
- `.env` or `.env.*`
- imported Carrier Central exports
- local appointment backup data
- `.DS_Store`

The Supabase `service_role` key must never be used in browser code.

## Database changes

Supabase schema files live in `sql/`. When changing tables or constraints:

- Add or update the relevant SQL file.
- Mention the required SQL file in the pull request.
- Avoid mixing unrelated schema changes into UI-only pull requests.

## Optional worktrees

Git worktrees are fine for experienced developers who want multiple branches checked out at once, but they are not the default team setup. New contributors should use one normal clone and switch branches inside that clone.
