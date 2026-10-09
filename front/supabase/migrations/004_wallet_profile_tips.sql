begin;

-- Wallet sessions are opaque, revocable, and accessible only to the server.
create table public.wallet_nonces (
  id uuid primary key,
  wallet text not null,
  message text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index wallet_nonces_rate on public.wallet_nonces(wallet, created_at);
create table public.wallet_sessions (
  token_hash text primary key,
  wallet text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index wallet_sessions_expiry on public.wallet_sessions(expires_at);

alter table public.cards_users
  add column design jsonb,
  add column published boolean not null default false,
  add column tips_enabled boolean not null default true,
  add column claim_cluster text,
  add column claim_lamports bigint,
  add column claim_treasury text,
  add column claim_verified_at timestamptz;
alter table public.cards_users add constraint creator_design_size check (
  design is null or (jsonb_typeof(design) = 'object' and octet_length(design::text) <= 3000000)
);

-- Carry existing wallet-owned published sponsorship designs into the creator card.
update public.cards_users c set
  design = s.design || jsonb_build_object('alias', c.username),
  display_name = coalesce(c.display_name, s.display_name),
  bio = coalesce(c.bio, s.bio),
  avatar_url = coalesce(c.avatar_url, s.design->>'avatar'),
  banner_url = coalesce(c.banner_url, s.design->>'cover'),
  published = true
from public.sponsor_profiles s
where s.wallet = c.wallet_address and s.design is not null;

create table public.tips (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.cards_users(id),
  payer text not null,
  recipient text not null,
  lamports bigint not null check (lamports between 10000 and 10000000000),
  signature text not null unique,
  cluster text not null default 'devnet' check (cluster = 'devnet'),
  status text not null default 'confirmed' check (status = 'confirmed'),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index tips_creator_activity on public.tips(creator_id, created_at desc);

alter table public.wallet_nonces enable row level security;
alter table public.wallet_sessions enable row level security;
alter table public.tips enable row level security;
revoke all on public.wallet_nonces, public.wallet_sessions, public.tips from anon, authenticated;
grant all on public.wallet_nonces, public.wallet_sessions, public.tips to service_role;

-- Profile reads now go through server projections. Unpublished editor data is private.
drop policy if exists "Cards are publicly readable" on public.cards_users;
revoke all on public.cards_users from anon, authenticated;
grant all on public.cards_users to service_role;

create function public.creator_tip_summary(owner_wallet text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('lamports', coalesce(sum(t.lamports), 0)::text, 'count', count(t.id))
  from public.cards_users c left join public.tips t on t.creator_id = c.id
  where c.wallet_address = owner_wallet;
$$;
revoke all on function public.creator_tip_summary(text) from public, anon, authenticated;
grant execute on function public.creator_tip_summary(text) to service_role;

commit;
