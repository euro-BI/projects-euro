create or replace function euro_dash.invoke_sync_pipe_manual()
returns bigint
language plpgsql
security definer
set search_path = public, net, cron, euro_dash, vault
as $$
declare
  request_id bigint;
  api_key text;
  bypass text;
begin
  select decrypted_secret into api_key
  from vault.decrypted_secrets
  where name = 'turing_bi_api_key';

  select decrypted_secret into bypass
  from vault.decrypted_secrets
  where name = 'turing_vercel_bypass';

  select net.http_post(
    url := 'https://rzdepoejfchewvjzojan.supabase.co/functions/v1/sync-pipe-manual',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'api_key', coalesce(api_key, ''),
      'bypass', coalesce(bypass, '')
    ),
    timeout_milliseconds := 120000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function euro_dash.invoke_sync_pipe_manual() from public;
grant execute on function euro_dash.invoke_sync_pipe_manual() to postgres;
