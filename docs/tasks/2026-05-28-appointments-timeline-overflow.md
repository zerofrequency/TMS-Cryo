# Appointments Timeline Overflow

Status: Ready for Development

## Owner Role

UI Support Developer

## Background

In `appts.html`, the Appointment List has a Timeline view. When one day has too many appointments, the appointments for that day may not display completely. This affects operational review because users cannot reliably see all scheduled appointments for a busy day.

## Scope

- Fix Timeline view layout so all appointments for a single day can be viewed.
- Preserve existing timeline grouping by appointment date.
- Preserve existing appointment selection behavior.
- Preserve existing filters and search behavior.
- Improve scrolling behavior if needed.

## Out Of Scope

- Changing appointment import logic.
- Changing appointment filtering logic.
- Changing Supabase schema.
- Changing table or calendar view behavior unless required for shared CSS safety.
- Redesigning the whole Appointments page.

## Requirements

- Timeline day sections must support a large number of appointment items.
- Users must be able to scroll and view all appointments within a busy day.
- Timeline layout should remain readable on desktop.
- Timeline layout should remain usable on smaller screens.
- Appointment items should not be clipped by fixed-height containers.
- Appointment items should not overlap each other.
- Selected appointment styling should still work.
- The timeline should continue to auto-scroll to today or the nearest upcoming date if that behavior already exists.

## Expected Files

Likely files involved:

- `appts.html`
- `styles/appointments.css`
- `scripts/appointments.js`

Start with CSS/layout inspection. Only change JavaScript if the render structure or scroll behavior is causing the clipping.

## Acceptance Criteria

- Open `appts.html`.
- Switch Appointment List to Timeline view.
- Use data where one date has many appointments.
- All appointments for that date are reachable by scrolling.
- No appointment item is visually cut off.
- Timeline day headers remain understandable.
- Clicking a timeline appointment still opens/selects the detail panel.
- Existing filters still update Timeline results.
- Table and Calendar views still work as before.

## Notes For Developer

- This is likely a UI/layout overflow issue.
- Preferred fix is CSS-only if possible.
- Consider vertical scrolling inside the timeline area or within each busy day group.
- Avoid hiding overflow on containers that need to show appointment stacks.
- If the issue is caused by render logic limiting items, document that and route to Core Developer.
