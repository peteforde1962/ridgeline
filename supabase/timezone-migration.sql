-- Store the user's IANA timezone for accurate "today" calculations.
-- Run in Supabase → SQL Editor → New query.

alter table profiles
  add column if not exists timezone text;
