# UI Design System Requirements

Status: Product Direction Approved

## Owner Role

Product Manager

## Background

The current TMS demo has working pages, but each module still carries page-specific UI decisions. Before expanding the MVP and preparing for an enterprise frontend/backend separation, the product needs a consistent interface foundation that can support TMS now and WMS later.

This document defines the product-level UI direction. Implementation tasks should reference this document instead of making isolated page-by-page design decisions.

## Product Goal

Create a calm, operational, enterprise-ready UI system that makes dispatch, appointment review, trip execution, resource assignment, and billing workflows fast to scan and reliable to operate.

The UI should feel like an internal operations product, not a marketing site.

## MVP UI Scope

The MVP UI system must cover the current live TMS modules:

- Home / module hub
- Appointment Manager
- Hot FC Weekly Dashboard
- Trip Plan List
- Create / Edit Trip Plan
- Trip Plan Detail
- Resource Dashboard
- Resource Maintain
- Carrier Billing

## Enterprise Foundation Scope

The UI foundation must leave room for:

- Multi-module navigation across TMS, WMS, Inventory, Ocean Container, Billing, and Reporting.
- Future authentication and user role display.
- Organization, facility, and warehouse switching.
- Permission-based disabled or hidden actions.
- Backend API error states.
- Audit/change history surfaces.
- Import preview and approval workflows.
- Exception management and operational alerts.

These enterprise features do not need to be fully built in the MVP, but the UI patterns should not block them.

## Design Principles

- Dense but readable: operators should scan tables, statuses, and actions quickly.
- Consistent over custom: common controls should behave and look the same across modules.
- Workflow first: page layout should follow the operational task order.
- Low decoration: avoid gradients, oversized cards, and decorative visuals that reduce information density.
- Clear hierarchy: primary action, secondary action, and destructive action must be visually distinct.
- Stable states: loading, empty, error, disabled, active, and selected states must be defined.
- Responsive enough for review: desktop is primary, but mobile and narrow windows must not overflow.

## Required UI Standards

### Page Shell

- All pages should use a shared top navigation pattern.
- Each page should have a consistent content width, page padding, and section spacing.
- Module pages should start with a compact module header that includes page title, short operational context, and primary action when needed.

### Navigation

- Current module should be visibly active.
- Deferred modules may appear disabled only if they help communicate the future product map.
- Future enterprise navigation should support grouping modules without redesigning every page.

### Filter And Search

- Search, status filters, FC filters, date/week selectors, and module filters should use one consistent top toolbar pattern.
- Search and filters must not live in a persistent left sidebar for list/dashboard pages.
- The main horizontal space should be reserved for the table, map, board, or primary content.
- Filters should appear before the primary result table or result grid as a compact horizontal toolbar.
- Filter labels should be short and operational.
- Reset/clear actions should be placed consistently.

Recommended desktop order:

```text
Module Header
Summary Strip
Toolbar: Search / Core Filters / More Filters / Reset / Export
Main Content
```

Toolbar rules:

- Search is the primary wide control.
- Common filters stay visible in the toolbar.
- Less common filters should move behind a `More Filters` control when space is tight.
- Search should flex wider than select, date, and action controls.
- Toolbar controls may wrap on narrow screens, but must not push the table into a narrow side-by-side layout.
- Mobile should stack toolbar controls vertically or in a simple responsive grid.

### Tables And Lists

- Table density should be consistent across Appointment, Trip Plans, Resources, and Billing.
- Headers should be readable and sticky only where useful.
- Row actions should appear in a predictable right-side action area.
- Status, dates, IDs, and operational numbers should be easy to compare by column.

### Detail Panels

- Detail panels should use consistent section headers, metadata rows, tabs, action placement, and empty states.
- Panels should separate summary, workflow actions, documents, resources, and history when those sections exist.

### Status Badges

- Status colors must be shared across the product.
- Color should support meaning, not create page-specific palettes.
- Status badge labels should map to business terms used in roadmap and requirements.

### Buttons And Actions

- Primary buttons should be reserved for the next expected workflow action.
- Secondary buttons should be used for navigation, view, edit, export, and utility actions.
- Destructive or irreversible actions should have a distinct style and confirmation when needed.
- Disabled actions should explain why when the reason is not obvious.

### Forms

- Form fields should have consistent label placement, spacing, validation style, helper text, and disabled states.
- Required fields should be clear before save.
- Validation messages should describe the business issue, not just the technical failure.

### Empty, Loading, And Error States

- Empty states should tell the operator what is missing and what action can resolve it.
- Loading states should preserve layout shape where practical.
- Error states should distinguish connection/API failure, validation failure, and missing configuration.

### Responsive Behavior

- Tables may become horizontally scrollable on narrow screens, but filters and action bars must remain usable.
- Cards, panels, and nav items must not overlap or overflow.
- Text should wrap cleanly instead of shrinking unpredictably.

## MVP Acceptance Criteria

- Appointments, Trip Plans, Resources, and Carrier Billing use consistent navigation, headers, filters, tables, buttons, badges, and form fields.
- Trip Plan Detail and Carrier Billing detail/document areas use compatible panel and card styles.
- Search and filter layouts use the shared top toolbar pattern and do not shift unpredictably between pages.
- Common statuses use a shared visual language.
- Mobile and narrow desktop layouts do not overflow.
- No business logic, TMS API write behavior, or schema is changed as part of UI standardization.

## Enterprise Readiness Acceptance Criteria

- The UI standards document identifies reusable patterns for future TMS and WMS modules.
- The navigation model can support future modules and organization/facility context.
- Form, table, error, and status patterns can work with future backend API responses.
- The UI task does not introduce hardcoded page-only patterns that would make a frontend rewrite harder.

## Role Routing

- Product Manager owns this requirements document and resolves design priority questions.
- UI Support Developer owns visual standardization implementation.
- Core Developer owns API/data boundaries and business-rule preserving integration changes.
- Debug Specialist verifies regressions, overflow, console errors, and broken workflows.
- Version And File Manager controls commit boundaries for UI-only changes.

## Related Documents

- `docs/TMS_MVP_ROADMAP.md`
- `docs/FRONTEND_BACKEND_SEPARATION_PREP.md`
- `docs/tasks/2026-05-29-ui-design-system-prep.md`
- `docs/tasks/2026-05-29-api-boundary-prep.md`
