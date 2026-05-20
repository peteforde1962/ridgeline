-- Plan flexibility: extras + day notes.
-- Run in Supabase → SQL Editor → New query.

-- 1. Extend plan_sessions to support user-added "extra" workouts and custom details.
alter table plan_sessions
  add column if not exists is_extra      boolean default false,
  add column if not exists custom_name   text,
  add column if not exists custom_notes  text;

-- 2. New table for per-day general notes.
create table if not exists plan_day_notes (
  user_id    uuid not null references profiles(id) on delete cascade,
  week_index int not null,
  day_index  int not null,
  note       text not null,
  updated_at timestamptz default now(),
  primary key (user_id, week_index, day_index)
);

alter table plan_day_notes enable row level security;

do $$ begin
  create policy "own plan_day_notes"
    on plan_day_notes for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
