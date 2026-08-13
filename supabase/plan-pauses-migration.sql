-- Plan pauses / holidays — user can mark date ranges where they want to
-- pause the plan (travel, injury recovery, ski season, etc). During a pause:
--   • no daily briefing email
--   • /today shows an "on holiday" state
--   • plan sessions on those dates are visually dimmed but not deleted
--
-- Multiple pauses per user allowed so a rider can add "Christmas week" plus
-- "wedding weekend in June" independently.

create table if not exists plan_pauses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  starts_on  date not null,
  ends_on    date not null,
  reason     text,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index if not exists plan_pauses_user_range_idx
  on plan_pauses (user_id, starts_on, ends_on);

alter table plan_pauses enable row level security;

do $$ begin
  create policy "own pauses" on plan_pauses
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
