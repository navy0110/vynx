-- Sponsorship MVP. Apply after 001_profiles.sql in the Supabase SQL editor.
-- Only the server service-role client can read private requests or mutate data.
create table public.sponsor_profiles (
  wallet text primary key,
  alias text unique not null check (alias ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  bio text not null default '' check (char_length(bio) <= 280),
  website text not null default '',
  price_cents integer not null check (price_cents between 100 and 1000000),
  duration_days integer not null check (duration_days in (7,14,30)),
  accepting boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.sponsor_requests (
  id uuid primary key default gen_random_uuid(),
  creator_wallet text not null references public.sponsor_profiles(wallet),
  brand_wallet text not null check (brand_wallet <> creator_wallet),
  brand_name text not null check (char_length(brand_name) between 1 and 60),
  headline text not null check (char_length(headline) between 1 and 100),
  description text not null check (char_length(description) between 1 and 240),
  destination_url text not null,
  price_cents integer not null check (price_cents between 100 and 1000000),
  duration_days integer not null check (duration_days in (7,14,30)),
  status text not null default 'pending' check (status in ('pending','approved','rejected','active')),
  payment_signature text unique,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'active' and payment_signature is not null and starts_at is not null and ends_at > starts_at)
    or (status <> 'active' and payment_signature is null and starts_at is null and ends_at is null))
);
create index sponsor_requests_creator on public.sponsor_requests(creator_wallet, created_at desc);
create index sponsor_requests_brand on public.sponsor_requests(brand_wallet, created_at desc);

-- A server-issued challenge binds each signature to the exact requested action.
create table public.sponsor_challenges (
  id uuid primary key,
  wallet text not null,
  message text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sponsor_challenges_expiry on public.sponsor_challenges(expires_at);

alter table public.sponsor_profiles enable row level security;
alter table public.sponsor_requests enable row level security;
alter table public.sponsor_challenges enable row level security;
revoke all on public.sponsor_profiles, public.sponsor_requests, public.sponsor_challenges from anon, authenticated;
grant all on public.sponsor_profiles, public.sponsor_requests, public.sponsor_challenges to service_role;

-- One exclusive space per creator. Activation and overlap validation are atomic.
create or replace function public.activate_sponsorship(request_id uuid, tx_signature text)
returns void language plpgsql security definer set search_path = public as $$
declare campaign public.sponsor_requests;
begin
  select * into campaign from public.sponsor_requests where id = request_id;
  if not found then raise exception 'Campaign not found'; end if;
  perform 1 from public.sponsor_profiles where wallet = campaign.creator_wallet for update;
  select * into campaign from public.sponsor_requests where id = request_id for update;
  if campaign.status <> 'approved' then raise exception 'Campaign is not approved'; end if;
  if exists (select 1 from public.sponsor_requests where creator_wallet = campaign.creator_wallet
      and status = 'active' and ends_at > now()) then
    raise exception 'There is already an active sponsorship';
  end if;
  update public.sponsor_requests set status = 'active', payment_signature = tx_signature,
    starts_at = now(), ends_at = now() + make_interval(days => campaign.duration_days)
    where id = request_id;
end;
$$;
revoke all on function public.activate_sponsorship(uuid,text) from public, anon, authenticated;
grant execute on function public.activate_sponsorship(uuid,text) to service_role;

create or replace function public.review_sponsorship(request_id uuid, reviewer text, decision text)
returns void language plpgsql security definer set search_path = public as $$
declare campaign public.sponsor_requests;
begin
  if decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
  select * into campaign from public.sponsor_requests where id = request_id;
  if not found or campaign.creator_wallet <> reviewer then raise exception 'Request not found'; end if;
  perform 1 from public.sponsor_profiles where wallet = reviewer for update;
  select * into campaign from public.sponsor_requests where id = request_id for update;
  if campaign.status <> 'pending' then raise exception 'Request already reviewed'; end if;
  if decision = 'approved' and exists (select 1 from public.sponsor_requests
      where creator_wallet = reviewer and (status = 'approved' or (status = 'active' and ends_at > now()))) then
    raise exception 'Your space is already reserved or active';
  end if;
  update public.sponsor_requests set status = decision where id = request_id;
end;
$$;
revoke all on function public.review_sponsorship(uuid,text,text) from public, anon, authenticated;
grant execute on function public.review_sponsorship(uuid,text,text) to service_role;
