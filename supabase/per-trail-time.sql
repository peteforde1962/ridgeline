-- Track per-trail time on each ride.
-- Run in Supabase → SQL Editor → New query.

alter table ride_trails
  add column if not exists seconds_on_trail int,
  add column if not exists points_on_trail  int;  -- raw polyline-point count (for debugging)
