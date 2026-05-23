-- Daily email preferences.
-- Run in Supabase → SQL Editor → New query.

alter table profiles
  add column if not exists daily_email_enabled boolean default true,
  add column if not exists daily_email_hour    int default 6;
