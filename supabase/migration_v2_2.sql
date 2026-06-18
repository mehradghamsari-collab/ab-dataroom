-- ============================================================
--  A&B Smart Materials — Dataroom : v2.2 (named accounts + titles)
--  Run ONCE in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- 1) Add a job title to profiles, and let the allow-list carry a name/title/admin flag
alter table public.profiles      add column if not exists title text;
alter table public.allowed_emails add column if not exists full_name text;
alter table public.allowed_emails add column if not exists title text;
alter table public.allowed_emails add column if not exists make_admin boolean not null default false;

-- 2) New-user handler now copies name + title from the allow-list and grants admin where flagged
create or replace function public.handle_new_user() returns trigger language plpgsql security definer as $$
declare a public.allowed_emails%rowtype;
begin
  select * into a from public.allowed_emails where email = new.email;
  insert into public.profiles (id, email, full_name, title, role, status)
  values (
    new.id,
    new.email,
    coalesce(a.full_name, new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    a.title,
    case when new.email = 'reza@absmartmaterials.com' or coalesce(a.make_admin,false) then 'admin' else 'member' end,
    case when new.email = 'reza@absmartmaterials.com' or a.email is not null then 'approved' else 'pending' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3) Seed the team (names + titles + access). Founders are admins; researchers are members.
insert into public.allowed_emails (email, full_name, title, make_admin) values
  ('reza@absmartmaterials.com',    'Reza',    'Researcher',        true),
  ('giulia@absmartmaterials.com',  'Giulia',  'Researcher',        false),
  ('ben@absmartmaterials.com',     'Ben',     'Researcher',        false),
  ('mantas@absmartmaterials.com',  'Mantas',  'Researcher',        false),
  ('fabiola@absmartmaterials.com', 'Fabiola', 'Associate Founder', true),
  ('amaury@absmartmaterials.com',  'Amaury',  'Founder',           true)
on conflict (email) do update
  set full_name = excluded.full_name, title = excluded.title, make_admin = excluded.make_admin;

-- 4) Apply names/titles/access to anyone who has already signed up
update public.profiles p set
  full_name = a.full_name,
  title     = a.title,
  status    = 'approved',
  role      = case when a.make_admin or p.email = 'reza@absmartmaterials.com' then 'admin' else p.role end
from public.allowed_emails a
where a.email = p.email and a.full_name is not null;

-- ============================================================
--  v2.2 (part B): absorbency auto-calc + raw-material costs + benchmark
-- ============================================================

-- A) Researcher mass readings — the app computes FSC/CRC/AUP from these.
--    FSC = ((swollen − 2) − 0.25) / 0.25 ; CRC = (after-centrifuge − 0.6) / 0.25 ; AUP = (after-AUP − 0.85) / 0.85
alter table public.experiments add column if not exists fsc_mass double precision;
alter table public.experiments add column if not exists crc_mass double precision;
alter table public.experiments add column if not exists aup_mass double precision;

-- B) Reference synthetic benchmark (FSC 48 / CRC 45.5 / AUP 17.9 g/g)
insert into public.benchmarks (name, fsc, crc, aup, notes)
select 'SYNTHETIC', 48, 45.5, 17.9, 'Reference synthetic superabsorbent'
where not exists (select 1 from public.benchmarks where name = 'SYNTHETIC');

-- C) Raw-material prices ($/g = lowest quoted $/ton ÷ 1,000,000). Final cost = raw-material cost for now.
--    Every price is editable in-app: Library → Chemicals.
update public.chemicals set price = 809.0/1e6,   price_unit='g', currency='USD' where name ilike '%citric%';
update public.chemicals set price = 1175.0/1e6,  price_unit='g', currency='USD' where (name ilike 'CMC%' or name ilike '%carboxymethyl cellulose%');
update public.chemicals set price = 694.12/1e6,  price_unit='g', currency='USD' where (name ilike 'CMS%' or name ilike '%carboxymethyl starch%');
update public.chemicals set price = 1800.0/1e6,  price_unit='g', currency='USD' where (name ilike 'XN %' or name ilike 'XN(%' or name ilike 'XG %' or name ilike 'XG(%' or name ilike '%xanthan%');
update public.chemicals set price = 650.0/1e6,   price_unit='g', currency='USD' where (name ilike 'NaOH%' or name ilike '%hydroxide%');
update public.chemicals set price = 252.0/1e6,   price_unit='g', currency='USD' where name ilike '%bicarbonate%';
update public.chemicals set price = 3.92/1e6,    price_unit='g', currency='USD' where name ilike '%water%';
update public.chemicals set price = 620.0/1e6,   price_unit='g', currency='USD' where name ilike '%acetone%';
update public.chemicals set price = 2000.0/1e6,  price_unit='g', currency='USD' where name ilike '%malic%';
update public.chemicals set price = 2300.0/1e6,  price_unit='g', currency='USD' where name ilike '%tartaric%';
-- aspartic: poly-aspartic priced separately from the monomer
update public.chemicals set price = 4450.0/1e6,  price_unit='g', currency='USD' where (name ilike '%poly aspartic%' or name ilike '%polyaspartic%');
update public.chemicals set price = 1570.0/1e6,  price_unit='g', currency='USD' where name ilike '%aspartic%' and name not ilike '%poly aspartic%' and name not ilike '%polyaspartic%';
-- PEG family (patterns are mutually exclusive)
update public.chemicals set price = 3080.0/1e6,  price_unit='g', currency='USD' where (name ilike '%pegdac%' or name ilike '%diacrylate%');
update public.chemicals set price = 8000.0/1e6,  price_unit='g', currency='USD' where name ilike '%bis(carboxymethyl)%';
update public.chemicals set price = 4000.0/1e6,  price_unit='g', currency='USD' where name ilike '%pegdiglycidyl%';
update public.chemicals set price = 1300.0/1e6,  price_unit='g', currency='USD' where (name ilike '%pegdialcohol%' or name ilike '%peg%diol%');
-- poly-glutamic acid (PGA), only on PGA entries (not the glutamic-acid monomer)
update public.chemicals set price = 5000.0/1e6,  price_unit='g', currency='USD' where (name ilike 'PGA%' or name ilike '%poly-glutamic%' or name ilike '%polyglutamic%' or name ilike '%poly glutamic%');
