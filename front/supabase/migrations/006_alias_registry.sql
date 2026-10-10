begin;
-- Supabase remains a profile index. The devnet program establishes ownership.
alter table public.cards_users drop constraint if exists username_format;
alter table public.cards_users add constraint username_format check (username ~ '^[a-z0-9_]{1,30}$');
alter table public.sponsor_profiles drop constraint if exists sponsor_profiles_alias_check;
alter table public.sponsor_profiles add constraint sponsor_profiles_alias_check check (alias ~ '^[a-z0-9_]{1,30}$');
alter table public.cards_users add column if not exists claim_program text;
alter table public.cards_users add column if not exists claim_alias_pda text;
alter table public.cards_users add column if not exists claim_owner_pda text;
alter table public.cards_users add column if not exists claim_price_version bigint;
create table public.alias_registration_intents (
  id uuid primary key,
  wallet text not null,
  alias text not null check (alias ~ '^[a-z0-9_]{1,30}$'),
  transaction text not null,
  signature text not null unique,
  blockhash text not null,
  last_valid_block_height bigint not null,
  expires_at_slot bigint not null,
  price_lamports bigint not null check (price_lamports > 0),
  price_version bigint not null,
  sponsor text not null,
  treasury text not null,
  reserved_fee bigint not null check (reserved_fee between 1 and 50000),
  state text not null default 'prepared' check (state in ('prepared','confirmed','failed','expired')),
  created_at timestamptz not null default now()
);
create unique index alias_registration_pending_wallet on public.alias_registration_intents(wallet) where state = 'prepared';
create index alias_registration_budget on public.alias_registration_intents(created_at);
alter table public.alias_registration_intents enable row level security;
revoke all on public.alias_registration_intents from anon, authenticated;
grant all on public.alias_registration_intents to service_role;
-- Serialize reservations across app instances. Failed and expired attempts still
-- consume the rolling budget; clients can retain signed messages until expiry.
create function public.reserve_alias_registration(candidate jsonb, daily_budget bigint)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare existing public.alias_registration_intents; spent bigint; attempts integer;
begin
  perform pg_advisory_xact_lock(74291006);
  select * into existing from public.alias_registration_intents where wallet = candidate->>'wallet' and state = 'prepared';
  if found then return jsonb_build_object('accepted', false, 'existing', to_jsonb(existing)); end if;
  select coalesce(sum(reserved_fee),0) into spent from public.alias_registration_intents where created_at > now() - interval '24 hours';
  select count(*) into attempts from public.alias_registration_intents where wallet = candidate->>'wallet' and created_at > now() - interval '1 hour';
  if daily_budget < 1 or spent + (candidate->>'reserved_fee')::bigint > daily_budget or attempts >= 5 then return jsonb_build_object('accepted',false,'limited',true); end if;
  insert into public.alias_registration_intents select * from jsonb_populate_record(null::public.alias_registration_intents, candidate || jsonb_build_object('state','prepared','created_at',now()));
  return jsonb_build_object('accepted',true);
end $$;
revoke all on function public.reserve_alias_registration(jsonb,bigint) from public, anon, authenticated;
grant execute on function public.reserve_alias_registration(jsonb,bigint) to service_role;

notify pgrst, 'reload schema';
commit;
