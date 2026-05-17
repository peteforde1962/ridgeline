-- Admin role + Strava subscription tracking.
-- Run in Supabase → SQL Editor → New query.
--
-- IMPORTANT: change the email below to YOUR email before running.

alter table profiles
  add column if not exists is_admin boolean default false;

-- Set Pete as admin
update profiles set is_admin = true
 where email = 'pete.forde@gmail.com';

-- Allow admins to read any profile (used by /admin to list users).
do $$ begin
  create policy "admins see all profiles"
    on profiles for select
    using (
      exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true)
    );
exception when duplicate_object then null;
end $$;

-- Tracks the single (per-app) Strava push subscription.
create table if not exists strava_subscription (
  id              bigint primary key,        -- subscription id returned by Strava
  callback_url    text,
  created_at      timestamptz default now()
);
