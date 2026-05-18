-- Multi-trail per ride. A ride can link to many trails (e.g. a Squamish ride
-- that hits Half Nelson + Pseudo Tsuga + Credit Line all in one session).
--
-- Run in Supabase → SQL Editor → New query.

create table if not exists ride_trails (
  ride_id  uuid not null references rides(id)  on delete cascade,
  trail_id uuid not null references trails(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (ride_id, trail_id)
);

-- Backfill from the existing single-trail column.
insert into ride_trails (ride_id, trail_id)
  select id, trail_id from rides where trail_id is not null
  on conflict do nothing;

-- RLS: a user can read/write a ride_trail row iff they own the underlying ride.
alter table ride_trails enable row level security;

do $$ begin
  create policy "own ride_trails select"
    on ride_trails for select
    using (exists (select 1 from rides r where r.id = ride_id and r.user_id = auth.uid()));
  create policy "own ride_trails insert"
    on ride_trails for insert
    with check (exists (select 1 from rides r where r.id = ride_id and r.user_id = auth.uid()));
  create policy "own ride_trails delete"
    on ride_trails for delete
    using (exists (select 1 from rides r where r.id = ride_id and r.user_id = auth.uid()));
exception when duplicate_object then null;
end $$;
