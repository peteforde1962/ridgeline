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

create unique index if not exists rides_suunto_workout_unique
  on rides (user_id, suunto_workout_key)
  where suunto_workout_key is not null;
