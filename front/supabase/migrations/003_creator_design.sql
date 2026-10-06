-- Apply after 002_sponsorships.sql. Existing offers and campaigns are preserved.
-- Small MVP images are stored as data URLs inside the design (1 MB per image).
-- Move images to object storage before scaling this to a public launch.
alter table public.sponsor_profiles
  add column if not exists design jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sponsor_design_size'
      and conrelid = 'public.sponsor_profiles'::regclass
  ) then
    alter table public.sponsor_profiles
      add constraint sponsor_design_size check (
        design is null or (jsonb_typeof(design) = 'object' and octet_length(design::text) <= 3000000)
      );
  end if;
end;
$$;

-- Existing RLS denies browser clients; only signed server requests write designs.
