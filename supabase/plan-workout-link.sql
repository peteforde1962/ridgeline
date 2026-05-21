-- Link plan sessions to actual rides + cache AI-generated workout details.
-- Run in Supabase → SQL Editor → New query.

alter table plan_sessions
  add column if not exists ride_id     uuid references rides(id) on delete set null,
  add column if not exists ai_workout  text;
