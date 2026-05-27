# Search Bar UI Standardization

Status: Ready for Development

## Owner Role

UI Support Developer

## Background

The TMS demo now has several search inputs across operational pages. They work, but their layout, visual hierarchy, helper text, and placement should be standardized so users can scan and filter data consistently.

Known search areas:

- `appts.html`: Appointment search
- `pages/trip-plans.html`: Trip Plan search
- `pages/carrier-billing.html`: Carrier Billing search
- `pages/create-trip-plans.html`: Stop ISA / FC search

This task is UI-focused. It should not change core filtering logic unless a clear defect is found and assigned separately.

## Scope

- Standardize search bar layout across existing list/filter pages.
- Improve visual consistency of search inputs, filter panels, labels, spacing, and clear filter actions.
- Improve usability of the ISA search field inside Create Trip Plan.
- Keep behavior consistent with current page logic.
- Document any search-result bug separately for Debug Specialist or Core Developer.

## Out Of Scope

- Changing database schema.
- Changing Supabase queries.
- Changing filtering business logic.
- Adding full-text search infrastructure.
- Adding backend APIs.
- Rebuilding pages with a new framework.
- Changing appointment merge, trip plan, billing, or resource logic.

## Design Recommendations

### 1. Use One Standard Search Pattern

For list pages, use this visual order:

```text
Search
Primary filters
Date filters
Clear filters
```

Search should be the first control in the filter panel because it is the fastest user action.

### 2. Make Search Inputs Wider Than Select Filters

Search inputs should have more horizontal room than status/type/date filters.

Recommended behavior:

- Desktop: search input spans full filter panel width or at least the first row.
- Tablet/mobile: search input remains full width.
- Select/date filters can sit below in a compact grid.

### 3. Keep Placeholder Text Specific

Use placeholders that tell users what fields are searched.

Recommended placeholders:

- Appointments: `ISA, FC, status, reference...`
- Trip Plans: `Plan, ISA, destination, trailer, truck...`
- Carrier Billing: `Carrier, invoice, plan, notes...`
- Create Trip Plan stop search: `Search ISA or FC`

If trailer/truck number is implemented in Trip Plan, include those terms in Trip Plan search placeholder and display expectations.

### 4. Add Consistent Clear Behavior

Every page with filters should have a clear action that:

- Clears search input.
- Clears select filters.
- Clears date fields.
- Re-renders current page results.

Button label should remain:

```text
Clear filters
```

### 5. Keep Labels Visible

Do not rely only on placeholders. Keep visible labels such as:

```text
Search
Status
Type
From
To
```

This improves scanning and avoids empty-input ambiguity.

### 6. Use Consistent Search Input Styling

Search inputs should share:

- Height
- Border radius
- Border color
- Focus ring
- Background color
- Font size
- Padding

Prefer existing project form styles. Do not introduce a new design system.

### 7. Avoid Search Layout Jumping

Search/filter panels should not resize unexpectedly when:

- Results change.
- Filter options load.
- Clear filters is clicked.
- Window width changes.

Use stable grid/flex dimensions.

### 8. Improve Empty Result Messaging

When search produces no result, empty state should say the result is filter-related.

Recommended copy:

```text
No matching records
Adjust search or clear filters to see more results.
```

Use page-specific noun if helpful:

- appointments
- trip plans
- carrier bills

### 9. Do Not Hide Important Filters Behind Search

Search is not a replacement for structured filters. Keep status/date/type filters visible for operational users.

### 10. Create Trip Plan ISA Search

The Stop ISA search is a task field, not a list-page filter. Optimize it separately:

- Keep it visually aligned with other stop fields.
- Make the input wide enough for full ISA values.
- Keep placeholder short: `Search ISA or FC`.
- If possible without behavior changes, show selected appointment context nearby:
  - FC
  - schedule time
  - load type

## Page-Level Recommendations

### Appointments

Recommended improvements:

- Keep search at the top of the filter panel.
- Make search full width.
- Group FC, Status, and Load Type below search.
- Group From/To dates together.
- Keep `Clear filters` visually aligned with filters.

Do not change:

- ISA merge behavior.
- Load Type behavior.
- Appointment table/calendar/timeline logic.

### Trip Plans

Recommended improvements:

- Make search full width.
- Include Plan, ISA, destination, and eventually trailer/truck in searchable hint.
- Keep Status and Type filters close together.
- Keep ETD From/To together.

Do not change:

- Trip status rules.
- Buffer calculation.
- ISA binding conflict rules.

### Carrier Billing

Recommended improvements:

- Align search/filter layout with Trip Plans.
- Keep Carrier and Billing Status filters below search.
- Keep Invoice Date and Due Date filter groups visually distinct.
- Keep export action near list actions, not buried in the filter block if space is tight.

Do not change:

- Billing total calculation.
- Billing status rules.
- Carrier bill schema.

### Create Trip Plan

Recommended improvements:

- Keep ISA search field prominent inside each stop card.
- Keep private/manual appointment fields visually separate from appointment-search mode.
- Avoid making the stop card too tall on desktop.

Do not change:

- Stop count logic.
- Appointment binding logic.
- Buffer calculation.

## Expected Files

Likely files involved:

- `appts.html`
- `pages/trip-plans.html`
- `pages/carrier-billing.html`
- `pages/create-trip-plans.html`
- `styles/appointments.css`
- `styles/trip-plans-list.css`
- `styles/carrier-billing.css`
- `styles/trip-plans.css`

Only touch scripts if needed for placeholder text, clear button consistency, or a clearly isolated UI issue.

## Acceptance Criteria

- Search inputs are visually consistent across Appointments, Trip Plans, and Carrier Billing.
- Search inputs are the most prominent control in each filter panel.
- Filter layouts remain clean on desktop and mobile.
- Clear filters behavior still works on all affected pages.
- Empty result messaging is clear when filters return no records.
- Create Trip Plan stop ISA search remains easy to use and aligned with stop fields.
- No business logic changes are introduced.
- Existing search/filter results remain functionally equivalent unless a separate bug task is created.

## Notes For Developer

- Owner role is UI Support Developer.
- Scope is UI only, no business logic changes.
- If search results are incorrect, create a Debug Specialist task instead of fixing filtering logic inside this task.
- Keep visual style consistent with current TMS pages.
- Avoid large redesigns.
