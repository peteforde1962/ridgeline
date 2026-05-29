-- Fix infinite recursion in profiles RLS.
-- The "student reads own coach" policy was subquerying profiles inside
-- its own USING clause. Replace with a SECURITY DEFINER helper that
-- bypasses RLS for the lookup.

-- Drop the recursive policy if it exists.
drop policy if exists "student reads own coach" on profiles;

-- Helper: returns the current user's coach_id, bypassing RLS.
create or replace function my_coach_id() returns uuid
language sql security definer stable as $$
  select coach_id from profiles where id = auth.uid();
$$;

-- Recreate the policy using the helper.
create policy "student reads own coach" on profiles for select
  using (id = my_coach_id());
