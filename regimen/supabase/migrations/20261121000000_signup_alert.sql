-- Email the owner when an account is created (edge function signup-alert).
-- The recipient is app_secrets 'signup_alert_to', set directly in the database (not in this repo).

create or replace function public.notify_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform net.http_post(
      url := 'https://nfdfmlnffbktlwrccfom.supabase.co/functions/v1/signup-alert',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select value from public.app_secrets where name = 'lifecycle_cron_auth')),
      body := jsonb_build_object('email', new.email,
        'name', coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
        'provider', coalesce(new.raw_app_meta_data->>'provider', 'email'),
        'created_at', new.created_at),
      timeout_milliseconds := 10000);
  exception when others then
    null; -- an alert must never block a sign-up
  end;
  return new;
end $$;
revoke execute on function public.notify_signup() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_alert on auth.users;
create trigger on_auth_user_created_alert after insert on auth.users
  for each row execute function public.notify_signup();
