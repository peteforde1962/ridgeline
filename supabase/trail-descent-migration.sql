-- Add explicit descent tracking on trails. Strava segments only carry
-- `total_elevation_gain` (climb), so for descent-only trails like McCloud
-- the climb field is near zero while the real vertical drop goes unrecorded.

alter table trails add column if not exists descent_m  int;
alter table trails add column if not exists elev_high  int;
alter table trails add column if not exists elev_low   int;
