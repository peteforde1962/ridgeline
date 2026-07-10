-- Public waitlist table for IG launch — captures emails from ridgeline-mtb.ca/waitlist
-- Anonymous users can INSERT their signup, but only authenticated admins can read.
-- Source tracking (?src=IG-post-1 etc) lets us know which post drove each signup.

create table if not exists waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  name       text,
  interests  text,
  source     text,             -- ?src= URL param, e.g. "ig-post-1"
  referrer   text,             -- document.referrer at time of submit
  user_agent text,
  created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness — same email can only signup once.
create unique index if not exists waitlist_email_unique
  on waitlist (lower(email));

-- Handy index for ordering by created_at when exporting.
create index if not exists waitlist_created_idx on waitlist (created_at desc);

-- RLS on. Anyone (anon) can insert their own signup; only admins can read.
alter table waitlist enable row level security;

-- Insert policy — no auth required. This is the whole point of a public waitlist.
create policy "public can insert" on waitlist
  for insert to anon, authenticated
  with check (true);

-- Read policy — admins only. Checks the profiles.is_admin flag.
create policy "admins can read" on waitlist
  for select to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- No update/delete policies — waitlist entries are effectively immutable
-- from the app's perspective. Admins can clean up via the SQL editor if needed.
