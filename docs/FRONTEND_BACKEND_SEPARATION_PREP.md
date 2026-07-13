# Frontend Backend Separation Preparation

Status: Product / Architecture Draft

## Owner Role

Product Manager and Core Developer

## Background

The current TMS demo is a static browser application that calls PostgREST through a shared TMS API client and stores significant business behavior in frontend scripts. This is acceptable for the current MVP, but the future enterprise product needs a clearer separation between user interface, business rules, persistence, audit, and permissions.

This document defines the preparation direction. It does not approve a full rewrite yet.

## Product Goal

Preserve the current working demo while preparing the codebase for a future enterprise architecture where:

- Frontend owns presentation, interaction, and client-side workflow guidance.
- Backend APIs own persistence, validation, authorization, audit, and integration with external systems.
- PostgreSQL is accessed through controlled service boundaries instead of exposing database credentials to the browser.

## Current State

- HTML pages are served as static files.
- Browser scripts call PostgREST through `scripts/tms-api.js`.
- Local IndexedDB is used as fallback for appointment storage.
- Business rules are distributed across frontend scripts.
- The VPS has a simple single-user login, but no enterprise permission model, custom business API, or audit service.

## MVP Boundary Direction

For MVP, do not stop development to perform a full rewrite. Instead:

- Keep current pages working.
- Isolate data access behind frontend module functions where practical.
- Keep data access centralized in the shared TMS API client.
- Avoid adding new business rules deeply inside rendering code.
- Keep product rules explicit in docs and task handoffs.
- Add UI states that can later map to backend API success, validation, and error responses.

## Future Enterprise Boundary

Future enterprise architecture should introduce API modules for:

- Appointments
- Trip Plans
- Resources
- Carrier Billing
- Inventory / WMS
- Amazon FC Transfer Requests
- Documents
- Exceptions
- Audit Log
- Users / Roles / Organizations / Facilities

Each API module should define:

- Read operations
- Write operations
- Validation ownership
- Error model
- Permission checks
- Audit events
- External identifiers

## Business Rules That Should Move Backend-Side

- ISA uniqueness and duplicate active trip-plan binding prevention.
- Appointment import merge rules.
- Manual load type and notes preservation.
- Trip status transition rules.
- Void reason requirement.
- Resource assignment conflict checks.
- Dock and crew release behavior.
- Billing total calculations and bill status transitions.
- Inventory state transitions, carrier/location binding, allocation locks, exception blocks, and warehouse transfer rules.
- Amazon FC transfer request approval rules and downstream destination-change effects.
- Document upload, approval, and audit history.
- Permission checks for create, edit, void, dispatch, billing, and admin actions.

## UI Foundation Requirements

The UI design system must prepare for this future separation by supporting:

- Validation messages returned by backend APIs.
- Permission-disabled actions.
- Loading and retry states.
- Empty states for role-restricted data.
- Audit/history sections.
- Import preview and approval screens.
- Exception counters and filters.
- Organization/facility context in navigation.

See:

- `docs/UI_DESIGN_SYSTEM_REQUIREMENTS.md`

## Recommended Migration Order

1. Maintain the shared TMS API contract and remove page-level request duplication.
2. Standardize UI states so backend errors can be displayed consistently.
3. Wrap one low-risk module's data access behind a frontend API adapter.
4. Move high-risk business rules to backend endpoints only after contracts are clear.
5. Add authentication, roles, and audit once the API boundary is stable.

## First Backend Candidate

Trip Plan execution should be the first serious backend boundary candidate because it combines:

- Status transitions
- Resource assignment
- ISA binding protection
- Vehicle readiness
- Change log / audit requirements

Appointments import can remain frontend-led during MVP, but import validation and merge approval should move backend-side for enterprise use.

## Related Tasks

- `docs/tasks/2026-05-29-api-boundary-prep.md`
- `docs/tasks/2026-05-30-ui-foundation-for-mvp-enterprise.md`
