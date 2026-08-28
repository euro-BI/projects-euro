create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema net to postgres;
grant usage on schema cron to postgres;

create or replace function euro_dash.invoke_sync_pipe_manual()
returns bigint
language plpgsql
security definer
set search_path = public, net, cron, euro_dash
as $$
declare
  request_id bigint;
begin
  select net.http_post(
    url := 'https://rzdepoejfchewvjzojan.supabase.co/functions/v1/sync-pipe-manual',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function euro_dash.invoke_sync_pipe_manual() from public;
grant execute on function euro_dash.invoke_sync_pipe_manual() to postgres;

do $$
declare
  existing_jobid bigint;
begin
  select jobid
    into existing_jobid
  from cron.job
  where jobname = 'sync-pipe-manual-hourly'
  limit 1;

  if existing_jobid is not null then
    perform cron.unschedule(existing_jobid);
  end if;
end;
$$;

select cron.schedule(
  'sync-pipe-manual-hourly',
  '0 * * * *',
  $job$select euro_dash.invoke_sync_pipe_manual();$job$
);
