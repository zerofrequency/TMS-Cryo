-- Restrict weekly FC appointment status to the four supported dashboard states.
-- Run this after supabase-fba-fc-schema.sql if the table already exists.

update public.fc_weekly_appointments
set appointment_status = null
where appointment_status is not null
  and appointment_status not in ('Normal', 'Slightly Busy', 'Very Busy', 'Severely Full');

alter table public.fc_weekly_appointments
drop constraint if exists fc_weekly_appointments_appointment_status_check;

alter table public.fc_weekly_appointments
add constraint fc_weekly_appointments_appointment_status_check
check (
  appointment_status in ('Normal', 'Slightly Busy', 'Very Busy', 'Severely Full')
  or appointment_status is null
);
