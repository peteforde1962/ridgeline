-- Gate coaches behind admin approval.
-- Anyone can request the Coach role from /profile, but no coach features
-- (no /coaching, no Sidebar link, no student visibility) activate until
-- an admin flips coach_approved=true in /admin.

alter table profiles add column if not exists coach_approved   boolean default false;
alter table profiles add column if not exists coach_requested_at timestamptz;

-- Existing coaches (only the admin's own account so far) get auto-approved.
update profiles set coach_approved = true where role = 'coach' and is_admin = true;
