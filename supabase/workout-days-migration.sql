-- Let riders specify which days of the week they want to work out.
-- Days not in the array become rest days in their plan.
-- Encoding: 0 = Monday, 1 = Tuesday, ..., 6 = Sunday (matches our existing
-- Monday-anchored calendar).

alter table profiles
  add column if not exists workout_days int[] default '{0,1,2,3,4,5,6}';
