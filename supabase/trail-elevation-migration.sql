-- Add geometry + cached elevation profile to trails.
-- Run once in Supabase SQL Editor.

-- Stored OSM polyline: array of {lat, lon}
alter table trails add column if not exists geometry            jsonb;
-- Cached elevation profile: { samples: [{km, elev}], total_climb, total_descent, fetched_at, source }
alter table trails add column if not exists elevation_profile   jsonb;
