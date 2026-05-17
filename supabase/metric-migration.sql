-- Switch RidgeLine to metric (km + meters).
-- Run in Supabase → SQL Editor → New query.
-- Safe to re-run: uses IF NOT EXISTS and conditional updates.

-- Add new metric columns
alter table trails
  add column if not exists length_km numeric,
  add column if not exists elev_m    int;

alter table rides
  add column if not exists km     numeric,
  add column if not exists elev_m int;

-- Backfill: convert any existing imperial values to metric.
-- (Only fills rows where the new column is still null.)
update trails
   set length_km = round((length_mi * 1.60934)::numeric, 2)
 where length_mi is not null and length_km is null;

update trails
   set elev_m = round(elev_ft * 0.3048)::int
 where elev_ft is not null and elev_m is null;

update rides
   set km = round((miles * 1.60934)::numeric, 2)
 where miles is not null and km is null;

update rides
   set elev_m = round(elev_ft * 0.3048)::int
 where elev_ft is not null and elev_m is null;
