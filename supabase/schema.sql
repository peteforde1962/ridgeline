-- RidgeLine database schema
-- Run this once in Supabase: SQL Editor → New query → paste this → Run.
--
-- It creates:
--   profiles      — one row per signed-up user (preferences, preset, intensity)
--   plans         — periodized training plans
--   check_ins     — daily body readiness logs
--   rides         — logged rides
--   trails        — saved trails
--   skills        — self-rated skills per user
--   videos        — uploaded or linked training videos
--
-- It also turns on Row Level Security so each user only sees their own data.

-- ============================================================
-- profiles
-- ============================================================
create table if not exists profiles (
  id                uuid primary key references auth.users on delete cascade,
  email             text,
  name              text,
  preset            text default 'Sport',          -- 'Novice' | 'Sport' | 'Pro'
  level             text default 'Intermediate',
  weekly_hours      int  default 6,
  goal              text default 'Race fitness',
  race_date         date,
  intensity         text default 'standard',       -- 'easier' | 'standard' | 'harder'
  plan_weeks        int  default 12,
  focus_skills      text[] default '{}',
  started_at        date default current_date,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Auto-create a profile row when a user signs up.
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- check_ins
-- ============================================================
create table if not exists check_ins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  date        date not null default current_date,
  sleep       int check (sleep between 1 and 10),
  soreness    int check (soreness between 1 and 10),
  energy      int check (energy between 1 and 10),
  notes       text,
  created_at  timestamptz default now(),
  unique (user_id, date)
);

-- ============================================================
-- trails
-- ============================================================
create table if not exists trails (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  name        text not null,
  length_mi   numeric,
  elev_ft     int,
  difficulty  text,         -- Green / Blue / Black / Double Black
  region      text,
  pr_minutes  numeric,
  last_ride   date,
  created_at  timestamptz default now()
);

-- ============================================================
-- rides
-- ============================================================
create table if not exists rides (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  trail_id    uuid references trails(id) on delete set null,
  date        date not null default current_date,
  miles       numeric,
  elev_ft     int,
  minutes     int,
  feel        int check (feel between 1 and 5),
  notes       text,
  created_at  timestamptz default now()
);

-- ============================================================
-- skills (self-ratings)
-- ============================================================
create table if not exists skills (
  user_id    uuid not null references profiles(id) on delete cascade,
  key        text not null,         -- endurance, power, cornering, drops, climbs, descents, mobility, strength
  rating     int  default 5 check (rating between 1 and 10),
  primary key (user_id, key)
);

-- ============================================================
-- videos
-- ============================================================
create table if not exists videos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  name        text not null,
  kind        text not null,        -- 'upload' or 'youtube'
  url         text not null,
  type        text default 'Tutorial',  -- Ride POV / Form check / Tutorial / Race / Other
  notes       text,
  date        date default current_date,
  created_at  timestamptz default now()
);

-- ============================================================
-- plan_sessions
-- per-session state: completed, intensity tweak, swap, etc.
-- ============================================================
create table if not exists plan_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  week_index   int not null,        -- 0..N
  day_index    int not null,        -- 0..6
  session_idx  int not null,        -- 0..N within the day
  completed    boolean default false,
  tweak        text default 'standard',  -- easier|standard|harder|skipped
  swapped_to   text,
  unique (user_id, week_index, day_index, session_idx)
);

-- ============================================================
-- Row Level Security
-- Each user sees and modifies only their own rows.
-- ============================================================
alter table profiles      enable row level security;
alter table check_ins     enable row level security;
alter table trails        enable row level security;
alter table rides         enable row level security;
alter table skills        enable row level security;
alter table videos        enable row level security;
alter table plan_sessions enable row level security;

-- Policy helper: anyone can read their own row, write their own row.
do $$ begin
  -- profiles
  create policy "own profile select" on profiles for select using (auth.uid() = id);
  create policy "own profile update" on profiles for update using (auth.uid() = id);
  create policy "own profile insert" on profiles for insert with check (auth.uid() = id);

  -- check_ins
  create policy "own checkins"          on check_ins     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  -- trails
  create policy "own trails"            on trails        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  -- rides
  create policy "own rides"             on rides         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  -- skills
  create policy "own skills"            on skills        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  -- videos
  create policy "own videos"            on videos        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  -- plan_sessions
  create policy "own plan sessions"     on plan_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
