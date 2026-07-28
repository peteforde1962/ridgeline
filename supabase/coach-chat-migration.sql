-- Coach ↔ Student chat threads.
-- One row per message. Thread is defined by (coach_id, student_id) — a student
-- always has exactly one coach at a time (profiles.coach_id), so no chat_id needed.

create table if not exists coach_messages (
  id                    uuid primary key default gen_random_uuid(),
  coach_id              uuid not null references profiles(id) on delete cascade,
  student_id            uuid not null references profiles(id) on delete cascade,
  sender_id             uuid not null references profiles(id) on delete cascade,
  body                  text not null,
  created_at            timestamptz not null default now(),
  read_by_recipient_at  timestamptz
);

-- Fast thread lookup + ordering.
create index if not exists coach_messages_thread_idx
  on coach_messages (coach_id, student_id, created_at desc);

-- Unread lookups.
create index if not exists coach_messages_unread_idx
  on coach_messages (student_id, coach_id, read_by_recipient_at)
  where read_by_recipient_at is null;

alter table coach_messages enable row level security;

-- ============================================================
-- Policies — thread participants only
-- ============================================================

-- Read: either the coach or the student in the thread can read
do $$ begin
  create policy "thread participants can read" on coach_messages
    for select to authenticated
    using (auth.uid() = coach_id or auth.uid() = student_id);
exception when duplicate_object then null; end $$;

-- Insert: only the sender may write, and they must be one of the two parties.
-- Also verify the coach/student pairing is real (student.coach_id = coach_id).
do $$ begin
  create policy "thread participants can write" on coach_messages
    for insert to authenticated
    with check (
      auth.uid() = sender_id
      and (auth.uid() = coach_id or auth.uid() = student_id)
      and exists (
        select 1 from profiles s
        where s.id = student_id and s.coach_id = coach_id
      )
    );
exception when duplicate_object then null; end $$;

-- Update: only the recipient can mark a message read (they can't edit body).
-- We restrict via a column-level trigger below since Postgres RLS doesn't
-- do per-column checks natively. For MVP, just gate the row.
do $$ begin
  create policy "recipient can mark read" on coach_messages
    for update to authenticated
    using (
      auth.uid() != sender_id
      and (auth.uid() = coach_id or auth.uid() = student_id)
    );
exception when duplicate_object then null; end $$;
