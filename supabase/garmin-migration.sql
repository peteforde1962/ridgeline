-- Garmin Connect integration columns. Run once in Supabase SQL Editor.

alter table profiles add column if not exists garmin_user_id           text;
alter table profiles add column if not exists garmin_access_token      text;
alter table profiles add column if not exists garmin_refresh_token     text;
alter table profiles add column if not exists garmin_token_expires_at  timestamptz;
alter table profiles add column if not exists garmin_last_sync_at      timestamptz;

-- Garmin activity key (unique per Garmin user activity) so we can dedupe imports.
alter table rides add column if not exists garmin_activity_id text;
create unique index if not exists rides_user_garmin_activity_uniq
  on rides (user_id, garmin_activity_id)
  where garmin_activity_id is not null;
