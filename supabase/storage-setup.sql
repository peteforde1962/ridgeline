-- Run this ONCE in Supabase → SQL Editor.
-- Creates the videos storage bucket and gates it with row-level security so
-- each user can only see/upload their own files.

-- 1. Create the videos bucket (private — files served via signed URLs).
insert into storage.buckets (id, name, public)
values ('videos', 'videos', false)
on conflict (id) do nothing;

-- 2. Storage RLS policies.
-- Files are stored at `{user_id}/{filename}`, so we verify ownership via the folder.
do $$ begin
  create policy "users can upload to own folder"
    on storage.objects for insert
    with check (
      bucket_id = 'videos'
      and (storage.foldername(name))[1] = auth.uid()::text
    );

  create policy "users can read own files"
    on storage.objects for select
    using (
      bucket_id = 'videos'
      and (storage.foldername(name))[1] = auth.uid()::text
    );

  create policy "users can delete own files"
    on storage.objects for delete
    using (
      bucket_id = 'videos'
      and (storage.foldername(name))[1] = auth.uid()::text
    );

  create policy "users can update own files"
    on storage.objects for update
    using (
      bucket_id = 'videos'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null;
end $$;
