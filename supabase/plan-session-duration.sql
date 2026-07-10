-- Add explicit planned duration to plan sessions.
-- Previously, duration lived only inside the template name string ("60 min Z2
-- endurance"), so users couldn't set or edit a duration on their own workouts.
-- Now every plan_sessions row (template or extra) can carry planned_minutes.

alter table plan_sessions
  add column if not exists planned_minutes int;
