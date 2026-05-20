-- Community trail conditions feed.
-- Reports are keyed by trail name + region (not by individual user's trail row)
-- so reports show up across all users who ride the same real-world trail.
-- Run in Supabase → SQL Editor → New query.

create table if not exists trail_conditions (
  id            uuid primary key default gen_random_uuid(),
  trail_name    text not null,
  region        text,
  status        text not null,            -- 'dry'|'tacky'|'wet'|'muddy'|'snow'|'closed'
  notes         text,
  user_id       uuid not null references profiles(id) on delete cascade,
  reporter_name text,
  reported_at   timestamptz default now()
);

create index if not exists trail_conditions_name_idx
  on trail_conditions (lower(trail_name));
create index if not exists trail_conditions_recent_idx
  on trail_conditions (reported_at desc);

alter table trail_conditions enable row level security;

do $$ begin
  -- Anyone signed in can read all condition reports (community feed).
  create policy "trail_conditions all read"
    on trail_conditions for select
    using (auth.role() = 'authenticated');
  -- Users can only insert reports under their own user_id.
  create policy "trail_conditions own insert"
    on trail_conditions for insert
    with check (auth.uid() = user_id);
  -- Users can delete their own reports.
  create policy "trail_conditions own delete"
    on trail_conditions for delete
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
