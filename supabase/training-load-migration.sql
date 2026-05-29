-- TrainingPeaks-style training load — capture intensity signals from Strava.
-- Run once in Supabase SQL Editor.

-- Per-ride intensity signals from Strava activities.
alter table rides add column if not exists avg_hr             int;
alter table rides add column if not exists max_hr             int;
alter table rides add column if not exists avg_watts          int;
alter table rides add column if not exists weighted_avg_watts int;   -- "NP" — normalized power
alter table rides add column if not exists suffer_score       int;   -- Strava Relative Effort
alter table rides add column if not exists kilojoules         int;
alter table rides add column if not exists tss                int;   -- our computed TSS (cached)

-- Personal training zones — needed for proper TSS / hrTSS.
alter table profiles add column if not exists ftp         int;       -- functional threshold power (W)
alter table profiles add column if not exists lthr        int;       -- lactate threshold HR (bpm)
alter table profiles add column if not exists hr_max      int;       -- max HR
