-- Coach prescribes workouts + uploads videos for their students.
-- Run once in Supabase SQL Editor.

-- ============================================================
-- plan_sessions: attribute prescribed workouts to the coach
-- ============================================================
alter table plan_sessions add column if not exists prescribed_by_coach_id uuid references profiles(id) on delete set null;
alter table plan_sessions add column if not exists prescribed_at         timestamptz;

-- ============================================================
-- RLS: coaches can insert + update their students' plan_sessions
-- ============================================================
do $$ begin
  create policy "coach writes student plan_sessions" on plan_sessions for insert
    with check (is_coach_of(user_id) and auth.uid() = prescribed_by_coach_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "coach updates student plan_sessions" on plan_sessions for update
    using (is_coach_of(user_id));
exception when duplicate_object then null; end $$;

-- ============================================================
-- RLS: coaches can insert videos under their students' accounts
-- ============================================================
do $$ begin
  create policy "coach inserts student videos" on videos for insert
    with check (is_coach_of(user_id));
exception when duplicate_object then null; end $$;

-- ============================================================
-- Storage: coaches can upload to their students' folders
-- (existing SELECT policy already lets them read these files)
-- ============================================================
do $$ begin
  create policy "coach uploads to student video folder" on storage.objects for insert
    with check (
      bucket_id = 'videos'
      and exists (
        select 1 from profiles
        where id::text = (storage.foldername(name))[1]
        and coach_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;
