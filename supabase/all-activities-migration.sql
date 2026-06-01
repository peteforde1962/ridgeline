-- Expand the `rides` table to hold any Strava activity type
-- (run, hike, swim, ski, paddle, strength, yoga, climbing, etc.).
--
-- Run once in Supabase SQL Editor.

alter table rides add column if not exists sport_type     text;   -- raw Strava sport_type (e.g. "TrailRun", "AlpineSki")
alter table rides add column if not exists activity_kind  text;   -- our category (cycle/run/hike/swim/ski/paddle/strength/yoga/climb/other)

-- Backfill: anything we previously imported was cycling.
update rides set activity_kind = 'cycle' where activity_kind is null and source = 'strava';
update rides set activity_kind = 'cycle' where activity_kind is null and (source is null or source = 'manual');
