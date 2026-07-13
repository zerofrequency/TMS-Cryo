# Team Roles

This document defines lightweight project roles for the current TMS demo and future enterprise refactor.

## Product Manager

Owns product direction, business flow, acceptance criteria, and prioritization.

Responsibilities:

- Define product scope.
- Confirm business workflows.
- Maintain roadmap and requirements.
- Review acceptance checklist results.
- Decide priority across TMS and future WMS modules.
- Coordinate development conversations and implementation tasks.

## Core Developer

Owns core business implementation and technical architecture decisions.

Responsibilities:

- Build core TMS modules.
- Implement database schema changes.
- Maintain business rules and state transitions.
- Handle PostgreSQL, PostgREST, and TMS API integration.
- Fix blocking workflow bugs.
- Prepare future enterprise architecture migration.

Current assignment:

- Previous Core Developer session: `019e6974-965e-7d03-aee8-aced2d42d786`
- Status: unable to continue due to remote compact stream disconnection.
- Current Core Developer-2 session: `019e6f09-1665-7860-9b1e-c8079d193864`
- Core Developer-2 should take over open Core Developer tasks.

## UI Support Developer

Owns small UI adjustments and non-core interface repairs.

This is a lightweight support role. The role should improve consistency and usability without changing core business behavior unless explicitly requested.

Responsibilities:

- Adjust page layout and spacing.
- Improve search box, filter, table, card, and form layouts.
- Keep colors, typography, button styles, and visual states consistent.
- Fix minor display issues.
- Improve responsive behavior for existing pages.
- Align new UI elements with existing project patterns.
- Make low-risk copy and label adjustments.
- Repair non-core visual bugs.

Examples of suitable tasks:

- Move a search box to better align with filters.
- Make table header spacing consistent.
- Adjust a status badge color to match existing states.
- Improve empty state layout.
- Fix overflowing text in a card.
- Normalize button sizes across one page.
- Improve mobile layout for an existing page.
- Keep Carrier Billing UI consistent with Trip Plans and Resources pages.

Out of scope:

- Changing database schema.
- Changing TMS API write logic.
- Changing trip status rules.
- Changing appointment merge logic.
- Changing billing calculation rules.
- Refactoring core JavaScript modules.
- Introducing new frameworks or design systems.
- Making product decisions without PM approval.

Required working rules:

- Prefer existing CSS classes and page patterns.
- Keep changes small and reviewable.
- Do not redesign the entire application unless assigned.
- Do not change business logic while doing UI work.
- Document any discovered business-impacting issue instead of fixing it silently.
- When uncertain, ask the Product Manager before changing behavior.

## Suggested Task Handoff Format

Use this format when assigning UI Support Developer work:

```text
Role: UI Support Developer
Area: [page or module]
Task: [specific UI adjustment]
Scope: UI only, no business logic changes
Acceptance:
- [visual requirement 1]
- [visual requirement 2]
- [responsive requirement if needed]
Do not change:
- [business rule or file area to avoid]
```

## Example Assignment

```text
Role: UI Support Developer
Area: Carrier Billing page
Task: Adjust search and filter layout to match Trip Plans list page.
Scope: UI only, no TMS API or billing calculation changes.
Acceptance:
- Search input and status filter align in one filter panel.
- Buttons match existing TMS button styling.
- Layout does not overflow on desktop or mobile.
Do not change:
- carrier_bills schema
- total amount calculation
- billing status rules
```

## Debug Specialist

Owns bug reproduction, issue diagnosis, root-cause notes, and verification support.

This is a focused troubleshooting role. The role should investigate defects and provide clear repair guidance. It may make small, low-risk fixes when assigned, but larger business or architecture changes should be handed to the Core Developer.

Responsibilities:

- Reproduce reported bugs with clear steps.
- Identify affected pages, scripts, schemas, or data records.
- Separate UI display bugs from business logic bugs.
- Check browser console errors, failed network requests, and TMS API response errors.
- Confirm whether a bug is caused by data, schema, state logic, UI rendering, or user workflow.
- Write concise root-cause summaries.
- Propose a minimal fix path and owner role.
- Verify fixes after Core Developer or UI Support Developer changes.
- Keep a known issue list when requested.

Examples of suitable tasks:

- A Trip Plan saves but does not appear in the list.
- Carrier Billing total amount is wrong after editing a fee.
- A PostgREST table request returns a permission or missing-column error.
- A filter works on one page but not another.
- A resource appears occupied after it was released.
- A page loads blank after a recent change.
- A status change saves but does not update the detail panel.

Out of scope:

- Owning new feature development.
- Redesigning UI.
- Changing database schema without Core Developer ownership.
- Changing product rules without Product Manager approval.
- Large refactors.
- Silent fixes that change business behavior.

Required working rules:

- Always document reproduction steps.
- Always state expected result and actual result.
- Prefer minimal diagnosis before proposing code changes.
- When the issue is business-rule related, escalate to Product Manager and Core Developer.
- When the issue is visual only, route to UI Support Developer.
- When the issue requires schema, persistence, status logic, or calculations, route to Core Developer.

## Debug Task Handoff Format

Use this format when assigning Debug Specialist work:

```text
Role: Debug Specialist
Area: [page or module]
Issue: [short bug description]
Reproduction:
- [step 1]
- [step 2]
Expected:
- [expected behavior]
Actual:
- [actual behavior]
Scope: Diagnose and recommend owner/fix path. Do not make product-rule changes.
Output:
- Root cause
- Affected files or data
- Recommended fix owner
- Verification steps
```

## Version And File Manager

Owns version control hygiene, file organization, commit boundaries, and repository handoff discipline.

This role protects the project from mixed-scope commits, misplaced files, accidental credential commits, and unclear handoffs between role-based development conversations.

Responsibilities:

- Review `git status` before commits or pushes.
- Separate unrelated changes into different commits.
- Confirm whether files belong in `pages/`, `scripts/`, `styles/`, `sql/`, `docs/`, or local `docs/tasks/`.
- Keep task documents and requirement documents discoverable while keeping local task handoffs out of GitHub.
- Check that local-only files are not committed.
- Watch for accidental credential or generated-data commits.
- Maintain clean commit messages.
- Push approved commits to GitHub.
- Summarize what was committed and what remains uncommitted.
- Help route changed files back to the correct role owner when changes are mixed.

Examples of suitable tasks:

- Commit only documentation changes while leaving development code uncommitted.
- Check whether Carrier Billing files are ready to commit as one feature.
- Move a local task document to `docs/tasks/`.
- Confirm `tms-config.js` is not staged.
- Review staged files before pushing.
- Create a clear commit message for a completed task.
- Report uncommitted files grouped by likely owner role.

Out of scope:

- Deciding product priority.
- Writing business requirements.
- Implementing feature logic.
- Redesigning UI.
- Debugging runtime behavior unless asked to inspect version/file causes.
- Reverting user or other-role changes without explicit approval.

Required working rules:

- Never include unrelated changes in the same commit.
- Never commit credentials, local API tokens, browser exports, or generated personal data.
- Never discard or revert another role's changes without explicit instruction.
- Prefer small, readable commits with one purpose.
- Before pushing, state what is being pushed and what is intentionally left local.
- If the worktree contains mixed changes, ask for scope or commit only the explicitly requested files.
- When GitHub access fails because of network connectivity, first try the local proxy at `127.0.0.1:7897`.
- Do not commit local proxy settings into project files.

## Version Control Task Handoff Format

Use this format when assigning Version And File Manager work:

```text
Role: Version And File Manager
Task: [commit, push, organize files, or inspect status]
Scope:
- [files or directories included]
Exclude:
- [files or directories not included]
Checks:
- Confirm no credentials are staged
- Confirm unrelated changes remain local
Output:
- Commit hash if committed
- Push target if pushed
- Files included
- Files left uncommitted
```
