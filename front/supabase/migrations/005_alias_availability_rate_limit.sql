begin;

-- Shared across application instances. Only keyed hashes of client IPs are stored.
create table public.alias_availability_limits (
  client_hash text primary key check (client_hash ~ '^[a-f0-9]{64}$'),
  requests integer not null check (requests between 1 and 31),
  expires_at timestamptz not null
);
create index alias_availability_limits_expiry on public.alias_availability_limits(expires_at);
alter table public.alias_availability_limits enable row level security;
revoke all on public.alias_availability_limits from anon, authenticated;
grant all on public.alias_availability_limits to service_role;

create function public.consume_alias_availability_limit(client_hash text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  current_time_value timestamptz := clock_timestamp();
  consumed public.alias_availability_limits%rowtype;
begin
  -- Bounded cleanup keeps expired client keys from accumulating indefinitely.
  delete from public.alias_availability_limits where alias_availability_limits.client_hash in (
    select limits.client_hash from public.alias_availability_limits limits
    where limits.expires_at < current_time_value - interval '1 day'
    order by limits.expires_at limit 100 for update skip locked
  );

  insert into public.alias_availability_limits as limits (client_hash, requests, expires_at)
  values (consume_alias_availability_limit.client_hash, 1, current_time_value + interval '60 seconds')
  on conflict on constraint alias_availability_limits_pkey do update set
    requests = case when limits.expires_at <= current_time_value then 1 else least(limits.requests + 1, 31) end,
    expires_at = case when limits.expires_at <= current_time_value then current_time_value + interval '60 seconds' else limits.expires_at end
  returning * into consumed;

  return jsonb_build_object(
    'allowed', consumed.requests <= 30,
    'retry_after', greatest(1, ceil(extract(epoch from consumed.expires_at - current_time_value))::integer)
  );
end;
$$;
revoke all on function public.consume_alias_availability_limit(text) from public, anon, authenticated;
grant execute on function public.consume_alias_availability_limit(text) to service_role;

notify pgrst, 'reload schema';
commit;
