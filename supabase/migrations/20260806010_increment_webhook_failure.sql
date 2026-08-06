-- operator-webhook-dispatch calls supabase.rpc('increment_webhook_failure', {webhook_id})
-- on every failed delivery, and discards the rpc error. The function never existed
-- (confirmed: information_schema.routines had only increment_promo_use), so
-- rentivo_webhooks.failure_count was NEVER incremented — a dead operator endpoint
-- is retried forever and any auto-disable-after-N-failures never fires. The column
-- exists; only the function was missing.
create or replace function public.increment_webhook_failure(webhook_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.rentivo_webhooks
     set failure_count = coalesce(failure_count, 0) + 1,
         -- Auto-disable after 10 consecutive failures so a permanently-dead
         -- endpoint stops being retried. A successful delivery resets
         -- failure_count to 0 (done directly by the dispatcher), so this only
         -- trips on a genuine run of failures.
         is_active = case when coalesce(failure_count, 0) + 1 >= 10 then false else is_active end
   where id = webhook_id;
end;
$$;

-- Called only by the dispatcher, which runs with the service role. Never exposed
-- to clients.
revoke all on function public.increment_webhook_failure(uuid) from public, anon, authenticated;
grant execute on function public.increment_webhook_failure(uuid) to service_role;
