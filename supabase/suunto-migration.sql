-- Suunto integration: OAuth tokens on profile + dedup column on rides.
-- Run in Supabase → SQL Editor → New query.

alter table profiles
  add column if not exists suunto_user_id            text,
  add column if not exists suunto_access_token       text,
  add column if not exists suunto_refresh_token      text,
  add column if not exists suunto_token_expires_at   timestamptz,
  add column if not exists suunto_last_sync_at       timestamptz;

alter table rides
  add column if not exists suunto_workout_key text;

-- NOTE: this used to be a PARTIAL unique index with a WHERE clause. Postgres
-- refuses to use partial indexes for ON CONFLICT resolution, which broke all
-- Suunto sync upserts with "no unique or exclusion constraint matching the
-- ON CONFLICT specification". A regular unique index is safe here because
-- NULL != NULL in Postgres — multiple rides without a suunto_workout_key
-- (e.g. Strava-only imports) do not conflict.
create unique index if not exists rides_suunto_workout_key_unique
  on rides (user_id, suunto_workout_key);
