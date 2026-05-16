-- Strava integration: store OAuth tokens on the profile + track imported activities.
-- Run in Supabase → SQL Editor → New query.

alter table profiles
  add column if not exists strava_athlete_id        bigint,
  add column if not exists strava_access_token      text,
  add column if not exists strava_refresh_token     text,
  add column if not exists strava_token_expires_at  timestamptz,
  add column if not exists strava_last_sync_at      timestamptz;

alter table rides
  add column if not exists strava_activity_id bigint,
  add column if not exists source             text default 'manual';  -- 'manual' or 'strava'

-- Prevent the same Strava activity being imported twice.
create unique index if not exists rides_strava_activity_unique
  on rides (user_id, strava_activity_id)
  where strava_activity_id is not null;
