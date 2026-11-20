-- Run the lifecycle-emails function once a day at 15:00 UTC (10:00 Eastern / 07:00 Pacific).
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$ begin
  if not exists (select 1 from cron.job where jobname = 'lifecycle-emails-daily') then
    perform cron.schedule('lifecycle-emails-daily', '0 15 * * *', $job$
      select net.http_post(
        url := 'https://nfdfmlnffbktlwrccfom.supabase.co/functions/v1/lifecycle-emails',
        headers := jsonb_build_object('Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select value from public.app_secrets where name = 'lifecycle_cron_auth')),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    $job$);
  end if;
end $$;
