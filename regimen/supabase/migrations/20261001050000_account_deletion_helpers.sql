-- Lists every progress-photo object a user owns, so the delete-account function can remove them through the Storage API.
create or replace function public.photo_paths_for_user(uid uuid)
returns table (name text)
language sql
security definer
set search_path = ''
as $$
  select o.name from storage.objects o
  where o.bucket_id = 'progress-photos' and (storage.foldername(o.name))[1] = uid::text;
$$;
revoke all on function public.photo_paths_for_user(uuid) from public, anon, authenticated;
grant execute on function public.photo_paths_for_user(uuid) to service_role;
