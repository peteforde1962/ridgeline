-- Coach/Student roles + video coaching.
-- Run once in Supabase SQL Editor.

-- ============================================================
-- profiles: add role, coach_id (student → coach link), coach_code
-- ============================================================
alter table profiles add column if not exists role        text default 'student';   -- 'student' | 'coach'
alter table profiles add column if not exists coach_id    uuid references profiles(id) on delete set null;
alter table profiles add column if not exists coach_code  text unique;              -- 6-char code coaches share

-- Generate a coach_code for any existing coach without one.
create or replace function gen_coach_code() returns text language plpgsql as $$
declare c text;
begin
  loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from profiles where coach_code = c);
  end loop;
  return c;
end $$;

-- ============================================================
-- videos: cache pose keypoints + analysis state
-- ============================================================
alter table videos add column if not exists pose_keypoints  jsonb;
alter table videos add column if not exists pose_status     text default 'idle';  -- idle|analyzing|done|failed
alter table videos add column if not exists pose_fps        int;                  -- frames per second of the keypoints array

-- ============================================================
-- video_comments: timestamped comments by student OR their coach
-- ============================================================
create table if not exists video_comments (
  id            uuid primary key default gen_random_uuid(),
  video_id      uuid not null references videos(id) on delete cascade,
  author_id     uuid not null references profiles(id) on delete cascade,
  timestamp_ms  int not null default 0,        -- 0 = general comment, >0 = at video time
  body          text not null,
  frame_pose    jsonb,                          -- optional snapshot of pose at that frame
  created_at    timestamptz default now()
);
create index if not exists video_comments_video_idx on video_comments(video_id, timestamp_ms);

-- ============================================================
-- RLS: coaches can read their students' data; students see their own + their coach.
-- ============================================================
alter table video_comments enable row level security;

-- Helper: is this user a coach of that student?
create or replace function is_coach_of(student_id uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from profiles
    where id = student_id and coach_id = auth.uid()
  );
$$;

-- profiles: coaches can read their own students; students can read their assigned coach.
do $$ begin
  create policy "coach reads students" on profiles for select
    using (coach_id = auth.uid());
exception when duplicate_object then null; end $$;

-- SECURITY DEFINER helper to look up the current user's coach_id without
-- triggering RLS recursion on profiles.
create or replace function my_coach_id() returns uuid
language sql security definer stable as $$
  select coach_id from profiles where id = auth.uid();
$$;

do $$ begin
  create policy "student reads own coach" on profiles for select
    using (id = my_coach_id());
exception when duplicate_object then null; end $$;

-- check_ins, rides, trails, plan_sessions: coaches can read their students' rows.
do $$ begin
  create policy "coach reads student check_ins"   on check_ins     for select using (is_coach_of(user_id));
  create policy "coach reads student rides"       on rides         for select using (is_coach_of(user_id));
  create policy "coach reads student trails"      on trails        for select using (is_coach_of(user_id));
  create policy "coach reads student plan_sess"   on plan_sessions for select using (is_coach_of(user_id));
  create policy "coach reads student skills"      on skills        for select using (is_coach_of(user_id));
  create policy "coach reads student videos"      on videos        for select using (is_coach_of(user_id));
  create policy "coach updates student videos"    on videos        for update using (is_coach_of(user_id));   -- to save pose_keypoints
exception when duplicate_object then null; end $$;

-- video_comments: author can manage own; viewers = video owner OR their coach.
do $$ begin
  create policy "comments select" on video_comments for select using (
    exists (
      select 1 from videos v
      where v.id = video_comments.video_id
      and (v.user_id = auth.uid() or is_coach_of(v.user_id))
    )
  );
  create policy "comments insert" on video_comments for insert with check (
    author_id = auth.uid() and exists (
      select 1 from videos v
      where v.id = video_comments.video_id
      and (v.user_id = auth.uid() or is_coach_of(v.user_id))
    )
  );
  create policy "comments update own" on video_comments for update using (author_id = auth.uid());
  create policy "comments delete own" on video_comments for delete using (author_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ============================================================
-- Storage: coaches can read their students' video files.
-- The path convention is {user_id}/{filename}, so we join on the first folder.
-- ============================================================
do $$ begin
  create policy "coach reads student video files" on storage.objects for select using (
    bucket_id = 'videos'
    and exists (
      select 1 from profiles
      where id::text = (storage.foldername(name))[1]
      and coach_id = auth.uid()
    )
  );
exception when duplicate_object then null; end $$;
