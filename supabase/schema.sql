-- ============================================================
--  AB Smart Materials — Dataroom : Database schema
--  Run this ENTIRE file first in Supabase → SQL Editor → New query → Run.
--  Then run seed_experiments.sql to load your 522 experiments.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Identity / access control ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  full_name   text,
  role        text not null default 'member' check (role in ('admin','member')),
  status      text not null default 'pending' check (status in ('approved','pending')),
  created_at  timestamptz not null default now()
);

create table if not exists public.allowed_emails (
  email      text primary key,
  added_by   uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- Reference libraries (all extensible in-app) ----------
create table if not exists public.chemicals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  supplier text, full_name text, comments text, cas_no text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);
create table if not exists public.experiment_types ( id uuid primary key default gen_random_uuid(), name text unique not null );
create table if not exists public.process_names    ( id uuid primary key default gen_random_uuid(), name text unique not null );
create table if not exists public.measure_types    ( id uuid primary key default gen_random_uuid(), name text unique not null );
create table if not exists public.result_types     ( id uuid primary key default gen_random_uuid(), name text unique not null );

-- ---------- Experiments ----------
create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  en integer unique,
  date date,
  owner text,
  repeat text,
  experiment_type text,
  description text,
  method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create table if not exists public.experiment_materials (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  position int, name text, mass_g double precision, ratio text
);
create table if not exists public.experiment_processes (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  position int, process text, measure text, value text
);
create table if not exists public.experiment_results (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  position int, result_type text, value text, value_num double precision, comment text
);

create index if not exists idx_mat_exp on public.experiment_materials(experiment_id);
create index if not exists idx_proc_exp on public.experiment_processes(experiment_id);
create index if not exists idx_res_exp on public.experiment_results(experiment_id);
create index if not exists idx_res_type on public.experiment_results(result_type);

-- ---------- Helper functions (SECURITY DEFINER avoids RLS recursion) ----------
create or replace function public.is_approved() returns boolean language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'approved');
$$;
create or replace function public.is_admin() returns boolean language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'approved');
$$;
create or replace function public.get_next_en() returns integer language sql security definer stable as $$
  select coalesce(max(en),0) + 1 from public.experiments;
$$;

-- ---------- New-user handling: Reza = admin, allow-listed = approved, else pending ----------
create or replace function public.handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    case when new.email = 'reza@absmartmaterials.com' then 'admin' else 'member' end,
    case when new.email = 'reza@absmartmaterials.com'
           or exists (select 1 from public.allowed_emails a where a.email = new.email)
         then 'approved' else 'pending' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- updated_at maintenance ----------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_exp_touch on public.experiments;
create trigger trg_exp_touch before update on public.experiments
  for each row execute function public.touch_updated_at();

-- ============================================================
--  Row Level Security
-- ============================================================
alter table public.profiles            enable row level security;
alter table public.allowed_emails       enable row level security;
alter table public.chemicals            enable row level security;
alter table public.experiment_types     enable row level security;
alter table public.process_names        enable row level security;
alter table public.measure_types        enable row level security;
alter table public.result_types         enable row level security;
alter table public.experiments          enable row level security;
alter table public.experiment_materials enable row level security;
alter table public.experiment_processes enable row level security;
alter table public.experiment_results   enable row level security;

-- profiles: see your own (so the app can read your role/status); admins see & manage all
create policy "profiles self read"  on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles admin write" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- allow-list: admin only
create policy "allowed admin all" on public.allowed_emails for all using (public.is_admin()) with check (public.is_admin());

-- reference libraries: approved members read + add + edit; admins delete
do $$
declare t text;
begin
  foreach t in array array['chemicals','experiment_types','process_names','measure_types','result_types']
  loop
    execute format('create policy "%1$s read"   on public.%1$I for select using (public.is_approved());', t);
    execute format('create policy "%1$s insert" on public.%1$I for insert with check (public.is_approved());', t);
    execute format('create policy "%1$s update" on public.%1$I for update using (public.is_approved()) with check (public.is_approved());', t);
    execute format('create policy "%1$s delete" on public.%1$I for delete using (public.is_admin());', t);
  end loop;
end $$;

-- experiments: approved members read + add + edit; delete by creator or admin
create policy "exp read"   on public.experiments for select using (public.is_approved());
create policy "exp insert" on public.experiments for insert with check (public.is_approved());
create policy "exp update" on public.experiments for update using (public.is_approved()) with check (public.is_approved());
create policy "exp delete" on public.experiments for delete using (public.is_admin() or created_by = auth.uid());

-- experiment children: approved members full access (managed alongside parent)
do $$
declare t text;
begin
  foreach t in array array['experiment_materials','experiment_processes','experiment_results']
  loop
    execute format('create policy "%1$s all" on public.%1$I for all using (public.is_approved()) with check (public.is_approved());', t);
  end loop;
end $$;

-- ---------- Live updates for the whole team ----------
do $$
declare t text;
begin
  foreach t in array array['experiments','experiment_materials','experiment_processes','experiment_results',
                            'chemicals','experiment_types','process_names','measure_types','result_types']
  loop
    begin execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;


-- ============================================================
--  Seed reference libraries
-- ============================================================
insert into public.allowed_emails (email) values ('reza@absmartmaterials.com') on conflict do nothing;
insert into public.chemicals (name,supplier,full_name,comments,cas_no) values
  ('Acetone',null,null,null,null),
  ('Citric acid (MERCK)',null,null,null,null),
  ('CMC (Sigma, 2024, DS=0.9, Mw 250,000)','Sigma Aldrich','Sodium carboxymethyl cellulose',null,null),
  ('CMS (old)- China, DS=0.19-0.26, Purity=87%-95%, pH=11, Hebei Yan Xing Chemical Co., Ltd',null,null,null,null),
  ('DI water',null,null,null,null),
  ('NaOH',null,null,null,null),
  ('NaOH (1M)',null,null,null,null),
  ('PEGdialcohol (thermoscient, 2025, d=1.12, Mw 300)',null,'Poly(ethylene glycol)',null,'25322-68-3'),
  ('PEGdiglycidyl (Sigma, 04-26, Mw 500)',null,null,null,'25322-68-4'),
  ('PEGdiglycidyl (Sigma, 2025, Mw 500)',null,null,null,null),
  ('PGA (MarkNature, 04-26, 1MDa)',null,null,null,null),
  ('PGA (MarkNature, AgriGrade, 30% purity, 2025)',null,null,null,null),
  ('Sorbitol (FISHER)',null,null,null,null),
  ('STMP',null,'Sodium trimetaphosphate',null,null),
  ('XN (5kg, Mar26, SpecialIngredients)',null,'Xanthan Gum',null,null),
  ('DL-Malic acid (Sigma)',null,null,null,null),
  ('L-Aspartic acid (ThermoScientific)',null,null,null,null),
  ('Phosphoric acid (85%wt, Sigma)',null,null,null,null),
  ('Methanol (FISHER)',null,null,null,null),
  ('THF',null,null,null,null),
  ('DCM',null,null,null,null),
  ('XN (1kg, Apr26, SpecialIngredients)',null,null,null,null),
  ('XN (5kg, Nov25, SpecialIngredients)',null,null,null,null),
  ('Poly(ethylene glycol) bis(carboxymethyl) ether MN 600',null,null,null,null),
  ('Poly(ethylene glycol) bis(carboxymethyl) ether MN 250',null,null,null,null),
  ('NaOH (5M)',null,null,null,null),
  ('PEGDAc (Merck, 250 g/mol)',null,null,null,null),
  ('Sodium metabisilphite (merck)',null,null,null,null),
  ('CMS (new)- China, DS=0.45, pH=6-9, Hebei Yan Xing Chemical Co., Ltd',null,null,null,null),
  ('L-Glutamic acid (thermo scientific, 99%)',null,null,null,null),
  ('Urea (Merck)',null,null,null,null),
  ('Tin (II) Chloride (Sigma)',null,null,null,null),
  ('Poly Aspartic Acid (Mark Nature, 5-8kDa, industrial grade)',null,null,null,null),
  ('1,4-Butanediol diglycidyl ether (Sigma)',null,null,null,null),
  ('ethylene carbonate (sigma)',null,null,null,null),
  ('fumed silica (merck)',null,null,null,null),
  ('zeolite Type A (HEILTR PFEN)',null,null,null,null),
  ('Glycerol (Sigma)',null,null,null,null),
  ('DMF',null,null,null,null),
  ('Hexamethylenediamine (Sigma)',null,null,null,null),
  ('XG (Industrial, viscosity: 1200-1800, Chinese, amaury''s sample)',null,null,null,null),
  ('XG (deosen biochemicals, ZIBOXAN XD)',null,null,null,null),
  ('CMS (DS=0.5 - 0.8, vis:4800-5500, China, Amaury''s sample)',null,null,null,null),
  ('CMS (DS=0.5 - 0.8, vis:300-400, China, Amaury''s sample)',null,null,null,null),
  ('CMC (55%, Vis: 100-700, China, Amaury''s sample)',null,null,null,null),
  ('CMC (70%, Vis: 600-1200, China, Amaury''s sample)',null,null,null,null),
  ('CMC (70%, Vis: 100-700, China, Amaury''s sample)',null,null,null,null),
  ('Sodium bicarbonate',null,null,null,null),
  ('tartaric acid ( SpecialIngredients)',null,null,null,null),
  ('oxalic acid (merck)',null,null,null,null),
  ('Poly Acrylic Acid (Sigma, 323667)',null,null,null,null),
  ('CMS (DS: 0.52, 15/5/2026 - China)',null,null,null,null),
  ('CMS (DS: 0.82, 15/5/2026 - China)',null,null,null,null),
  ('XG (15/5/2026, China)',null,null,null,null),
  ('Bountigel sample (22/05/26)',null,null,null,null),
  ('CNF (Nanografi)','Nanografi','Cellulose nanofibers',null,null),
  ('N-(1,3-Dimethylbutyl)-N′-phenyl-p-phenylenediamine (ABCR, Chaoying)',null,null,null,null),
  ('fumed silica (amazon sample, Origin:china)',null,null,null,null),
  ('DL-Aspartic acid (ThermoSci)',null,null,null,null),
  ('Pentaerythritol tetrakis(3,5-di-tert-butyl-4-hydroxyhydrocinnamate)',null,null,null,null),
  ('PEGdialcohol (4000Da, Sigma)',null,null,null,null),
  ('HCl (1%)',null,null,null,null),
  ('Aluminium L-lactate','Sigma-Aldrich',null,'L-Lactic acid aluminum salt','18917-91-4'),
  ('Pentaerythritol tetrakis(3-mercaptopropionate) (Sigma)',null,null,null,null),
  ('Ethylenediaminetetraacetic acid disodium salt dihydrate (Acros)',null,null,null,null),
  ('calcium chloride (fisher)',null,null,null,null),
  ('sodium chloride (fisher)',null,null,null,null),
  ('Poly(dimethylsiloxane) (100 cSt, Thermo)',null,null,null,null),
  ('DMSO',null,null,null,null),
  ('Gellan gum (LT)','SpecialIngredients','Gellan Gum LT100 ( High Acyl )',null,null),
  ('DENACOL EX-614B (Nagase, May 2026)',null,null,null,null),
  ('FAVOR Bio T180 (Stockhausen, May 2026)',null,null,null,null),
  ('APS','Sigma-Aldrich','Ammonium persulfate',null,'7727-54-0'),
  ('AA','Merk','Acrylic acid','contains 200 ppm MEHQ as inhibitor','79-10-7'),
  ('AMPS','Merk','2-Acrylamido-2-methyl-1-propanesulfonic acid',null,'15214-89-8');
insert into public.experiment_types (name) values ('Polymer synthesis'),('Bulk processing'),('Surface processing'),('Oven Poly-Condensation') on conflict (name) do nothing;
insert into public.process_names (name) values ('Fisher oven (Gravity convection)'),('Chinese oven (medium)'),('Air dry'),('Chinese oven (small)'),('Hotplate'),('Hotplate stir (30mm stirrer)'),('Overhead stirrer (small)'),('Overhead stirrer (silverson)'),('Coffee grinder'),('Large grinder'),('Hand grinding'),('Genlab oven'),('Vortex'),('Leybold Vac Pump'),('Round Bottom Flask'),('Dialysis'),('HAAKE MiniLab (Chaoying)'),('re-dissolve in water'),('neutralized by NaOH 5M'),('crosslinking with PEGDE'),('surface linking by ACETON/WATER 87:13 Citric acid'),('washing with acetone'),('Fisher oven'),('Hotplate stir'),('silica addition as powder'),('genlab oven') on conflict (name) do nothing;
insert into public.measure_types (name) values ('Temperature (°C)'),('Time (h)'),('RPM'),('Size (mm)'),('Time (min)'),('Volume (mL)'),('Mw cut off'),('Time (days)'),('ml'),('volume (ml)') on conflict (name) do nothing;
insert into public.result_types (name) values ('FSC in saline (g/g)'),('CRC in saline (g/g)'),('AUP in saline (g/g)'),('FSC in DI water (g/g)'),('General evaluation'),('Rate of dissolution (seconds)'),('Vortex speed of absorption in saline (JIS K 7224)'),('AUP in saline (0.3 PSI) (g/g)'),('AUP in saline (0.7 PSI) (g/g)') on conflict (name) do nothing;

-- ============================================================
--  A&B Smart Materials — Dataroom : v2 upgrade
--  Run this ONCE in Supabase → SQL Editor (after the original schema.sql).
--  Safe to run more than once.
-- ============================================================

-- Experiments: two-step flag, discontinued flag, optional process/overhead cost
alter table public.experiments add column if not exists is_two_step boolean not null default false;
alter table public.experiments add column if not exists discontinued boolean not null default false;
alter table public.experiments add column if not exists extra_cost double precision;   -- process + overhead cost (optional / from TEA)

-- Materials: amount unit (mass vs volume) and which step it belongs to
alter table public.experiment_materials add column if not exists unit  text not null default 'g';   -- 'g' | 'mL'
alter table public.experiment_materials add column if not exists stage text;                          -- 'bulk' | 'surface' | null

-- Processes: which step it belongs to
alter table public.experiment_processes add column if not exists stage text;                          -- 'bulk' | 'surface' | null

-- Chemicals: optional price for cost-of-formulation
alter table public.chemicals add column if not exists price       double precision;  -- cost per unit
alter table public.chemicals add column if not exists price_unit  text default 'g';  -- 'g' | 'mL'
alter table public.chemicals add column if not exists currency    text default 'USD';

-- Benchmark synthetic samples (FSC/CRC/AUP + price) used for parity analysis
create table if not exists public.benchmarks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fsc  double precision,
  crc  double precision,
  aup  double precision,
  price double precision,          -- cost per kg (for price parity)
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

alter table public.benchmarks enable row level security;
drop policy if exists "benchmarks read"   on public.benchmarks;
drop policy if exists "benchmarks insert" on public.benchmarks;
drop policy if exists "benchmarks update" on public.benchmarks;
drop policy if exists "benchmarks delete" on public.benchmarks;
create policy "benchmarks read"   on public.benchmarks for select using (public.is_approved());
create policy "benchmarks insert" on public.benchmarks for insert with check (public.is_approved());
create policy "benchmarks update" on public.benchmarks for update using (public.is_approved()) with check (public.is_approved());
create policy "benchmarks delete" on public.benchmarks for delete using (public.is_admin());

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.benchmarks';
  exception when duplicate_object then null; end;
end $$;

-- Work package / project that an experiment belongs to (v2.1)
alter table public.experiments add column if not exists project text;


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


-- ============================================================
--  A&B Smart Materials — Dataroom : v3 (team super-app)
--  Adds: daily check-ins, external-test tracking, leave calendar,
--        weekly goals, manager role, owner-only experiment editing.
--  Run ONCE in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- ---------- Manager role ----------
alter table public.profiles      add column if not exists is_manager boolean not null default false;
alter table public.allowed_emails add column if not exists make_manager boolean not null default false;

create or replace function public.is_manager() returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved' and (is_manager = true or role = 'admin')
  );
$$;

-- New-user handler: copy name/title + admin/manager flags from the allow-list
create or replace function public.handle_new_user() returns trigger language plpgsql security definer as $$
declare a public.allowed_emails%rowtype;
begin
  select * into a from public.allowed_emails where email = new.email;
  insert into public.profiles (id, email, full_name, title, role, status, is_manager)
  values (
    new.id,
    new.email,
    coalesce(a.full_name, new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    a.title,
    case when new.email = 'reza@absmartmaterials.com' or coalesce(a.make_admin,false) then 'admin' else 'member' end,
    case when new.email = 'reza@absmartmaterials.com' or a.email is not null then 'approved' else 'pending' end,
    coalesce(a.make_manager,false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Ben and Amaury approve leave (managers). Reza/Fabiola/Amaury remain admins.
update public.allowed_emails set make_manager = true
  where email in ('ben@absmartmaterials.com','amaury@absmartmaterials.com');

update public.profiles p set is_manager = true
  from public.allowed_emails a where a.email = p.email and a.make_manager = true;

-- ---------- Let approved teammates see the roster (names/titles) ----------
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles read" on public.profiles for select using (public.is_approved() or id = auth.uid());

-- ---------- Lock experiment editing to the creator or an admin ----------
create or replace function public.can_edit_experiment(exp uuid) returns boolean language sql security definer stable as $$
  select public.is_admin() or exists (
    select 1 from public.experiments e where e.id = exp and e.created_by = auth.uid()
  );
$$;

drop policy if exists "exp update" on public.experiments;
create policy "exp update" on public.experiments for update
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['experiment_materials','experiment_processes','experiment_results']
  loop
    execute format('drop policy if exists "%1$s all" on public.%1$I;', t);
    execute format('create policy "%1$s read"   on public.%1$I for select using (public.is_approved());', t);
    execute format('create policy "%1$s write"  on public.%1$I for insert with check (public.can_edit_experiment(experiment_id));', t);
    execute format('create policy "%1$s modify" on public.%1$I for update using (public.can_edit_experiment(experiment_id)) with check (public.can_edit_experiment(experiment_id));', t);
    execute format('create policy "%1$s remove" on public.%1$I for delete using (public.can_edit_experiment(experiment_id));', t);
  end loop;
end $$;

-- ============================================================
--  New tables
-- ============================================================

-- Daily check-ins: morning goal + afternoon update (also an HR start/stop log)
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('morning','update')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_checkins_created on public.checkins(created_at desc);

-- External testing tracker
create table if not exists public.external_tests (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid references public.experiments(id) on delete set null,
  sample_label text,
  destination text,
  delivery_company text,
  reference_code text,
  sent_date date,
  status text not null default 'sent' check (status in ('sent','in_progress','results_in','cancelled')),
  result_summary text,
  result_date date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_extests_created on public.external_tests(created_at desc);

-- Leave / remote-work calendar
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('holiday','sick','remote')),
  start_date date not null,
  end_date date not null,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  note text,
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_leave_dates on public.leave_requests(start_date, end_date);

-- Weekly goals (set by managers each Monday)
create table if not exists public.weekly_goals (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  body text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_goals_week on public.weekly_goals(week_start desc);

-- ---------- RLS for the new tables ----------
alter table public.checkins        enable row level security;
alter table public.external_tests  enable row level security;
alter table public.leave_requests  enable row level security;
alter table public.weekly_goals    enable row level security;

-- check-ins: everyone approved reads; you write/edit/remove your own (admin can remove any)
drop policy if exists "checkins read" on public.checkins;
drop policy if exists "checkins insert" on public.checkins;
drop policy if exists "checkins update" on public.checkins;
drop policy if exists "checkins delete" on public.checkins;
create policy "checkins read"   on public.checkins for select using (public.is_approved());
create policy "checkins insert" on public.checkins for insert with check (public.is_approved() and user_id = auth.uid());
create policy "checkins update" on public.checkins for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "checkins delete" on public.checkins for delete using (user_id = auth.uid() or public.is_admin());

-- external tests: everyone approved reads + adds + edits; admin removes
drop policy if exists "extests read" on public.external_tests;
drop policy if exists "extests insert" on public.external_tests;
drop policy if exists "extests update" on public.external_tests;
drop policy if exists "extests delete" on public.external_tests;
create policy "extests read"   on public.external_tests for select using (public.is_approved());
create policy "extests insert" on public.external_tests for insert with check (public.is_approved());
create policy "extests update" on public.external_tests for update using (public.is_approved()) with check (public.is_approved());
create policy "extests delete" on public.external_tests for delete using (public.is_admin() or created_by = auth.uid());

-- leave: everyone approved reads (shared calendar); you create your own; managers decide; you delete your own pending
drop policy if exists "leave read" on public.leave_requests;
drop policy if exists "leave insert" on public.leave_requests;
drop policy if exists "leave update" on public.leave_requests;
drop policy if exists "leave delete" on public.leave_requests;
create policy "leave read"   on public.leave_requests for select using (public.is_approved());
create policy "leave insert" on public.leave_requests for insert with check (public.is_approved() and (user_id = auth.uid() or public.is_manager()));
create policy "leave update" on public.leave_requests for update using (public.is_manager() or user_id = auth.uid()) with check (public.is_manager() or user_id = auth.uid());
create policy "leave delete" on public.leave_requests for delete using (user_id = auth.uid() or public.is_admin());

-- weekly goals: everyone approved reads; managers manage
drop policy if exists "goals read" on public.weekly_goals;
drop policy if exists "goals write" on public.weekly_goals;
create policy "goals read"  on public.weekly_goals for select using (public.is_approved());
create policy "goals write" on public.weekly_goals for all using (public.is_manager()) with check (public.is_manager());

-- ---------- Realtime ----------
do $$
declare t text;
begin
  foreach t in array array['checkins','external_tests','leave_requests','weekly_goals','profiles']
  loop
    begin execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;


-- ============================================================
--  A&B Smart Materials — Dataroom : v4
--  Supplier samples — raw materials received from external suppliers,
--  with cost/ton, DS, purity, viscosity, colour, and performance
--  pulled from experiments the user links.
--  Run ONCE in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists public.supplier_samples (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  supplier text,
  code text,
  cost_per_ton numeric,
  degree_substitution text,
  purity text,
  viscosity text,
  colour text,
  experiment_ids uuid[] not null default '{}',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_supplier_samples_name on public.supplier_samples(name);

alter table public.supplier_samples enable row level security;
drop policy if exists "supplier_samples read"   on public.supplier_samples;
drop policy if exists "supplier_samples insert" on public.supplier_samples;
drop policy if exists "supplier_samples update" on public.supplier_samples;
drop policy if exists "supplier_samples delete" on public.supplier_samples;
create policy "supplier_samples read"   on public.supplier_samples for select using (public.is_approved());
create policy "supplier_samples insert" on public.supplier_samples for insert with check (public.is_approved());
create policy "supplier_samples update" on public.supplier_samples for update using (public.is_approved()) with check (public.is_approved());
create policy "supplier_samples delete" on public.supplier_samples for delete using (public.is_admin() or created_by = auth.uid());

do $$ begin
  begin execute 'alter publication supabase_realtime add table public.supplier_samples';
  exception when duplicate_object then null; end;
end $$;


-- ============================================================
--  A&B Smart Materials — Dataroom : v5
--  Batches — make a big stock/batch once (e.g. 5 L of 4% XG in water),
--  then draw small portions of it into later experiments.
--  Run ONCE in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text not null,
  description text,
  composition jsonb not null default '[]',   -- [{ name, amount, unit }]
  total_made text,
  dried_yield text,
  prepared_date date,
  owner text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_batches_name on public.batches(name);

-- a material drawn from a batch points back to it (amount used stays in mass_g)
alter table public.experiment_materials add column if not exists batch_id uuid references public.batches(id) on delete set null;

alter table public.batches enable row level security;
drop policy if exists "batches read"   on public.batches;
drop policy if exists "batches insert" on public.batches;
drop policy if exists "batches update" on public.batches;
drop policy if exists "batches delete" on public.batches;
create policy "batches read"   on public.batches for select using (public.is_approved());
create policy "batches insert" on public.batches for insert with check (public.is_approved());
create policy "batches update" on public.batches for update using (public.is_approved()) with check (public.is_approved());
create policy "batches delete" on public.batches for delete using (public.is_admin() or created_by = auth.uid());

do $$ begin
  begin execute 'alter publication supabase_realtime add table public.batches';
  exception when duplicate_object then null; end;
end $$;


-- ============================================================
--  A&B Smart Materials — Dataroom : v6
--  Qualitative observations (colour, texture, structure, general
--  evaluation, outcome…) for experiments — especially useful when a
--  product isn't good enough to run quantitative absorbency tests.
--  Run ONCE in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists public.experiment_observations (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  position int,
  attribute text,           -- e.g. Colour, Texture, Final structure
  value text,               -- e.g. pale yellow, brittle, foamy
  stage text,
  created_at timestamptz not null default now()
);
create index if not exists idx_obs_exp on public.experiment_observations(experiment_id);

alter table public.experiment_observations enable row level security;
drop policy if exists "experiment_observations read"   on public.experiment_observations;
drop policy if exists "experiment_observations write"  on public.experiment_observations;
drop policy if exists "experiment_observations modify" on public.experiment_observations;
drop policy if exists "experiment_observations remove" on public.experiment_observations;
create policy "experiment_observations read"   on public.experiment_observations for select using (public.is_approved());
create policy "experiment_observations write"  on public.experiment_observations for insert with check (public.can_edit_experiment(experiment_id));
create policy "experiment_observations modify" on public.experiment_observations for update using (public.can_edit_experiment(experiment_id)) with check (public.can_edit_experiment(experiment_id));
create policy "experiment_observations remove" on public.experiment_observations for delete using (public.can_edit_experiment(experiment_id));

do $$ begin
  begin execute 'alter publication supabase_realtime add table public.experiment_observations';
  exception when duplicate_object then null; end;
end $$;


-- ============================================================
--  A&B Smart Materials — Dataroom : v7  (security hardening)
--  Adds defense-in-depth on top of the existing Row Level Security.
--  Run ONCE in Supabase → SQL Editor. Safe to re-run. No app change.
--
--  What this does, in plain terms:
--   1. Locks the "search path" of every privileged (SECURITY DEFINER)
--      function. Without this, a logged-in user could in theory shadow a
--      table/function the privileged code relies on and make it run their
--      version. Pinning the search path closes that class of attack and
--      clears Supabase's "Function Search Path Mutable" warning.
--   2. Restricts the email allow-list table so only admins can read it
--      (it says who is admin/approved — not something members should see).
--      The signup trigger still works because it runs as a privileged
--      function and bypasses RLS.
-- ============================================================

-- 1) Pin search_path on every SECURITY DEFINER function ----------------
--    (bodies are unchanged; all object refs are already schema-qualified)

create or replace function public.is_approved() returns boolean
  language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'approved');
$$;

create or replace function public.is_admin() returns boolean
  language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'approved');
$$;

create or replace function public.is_manager() returns boolean
  language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved' and (is_manager = true or role = 'admin')
  );
$$;

create or replace function public.get_next_en() returns integer
  language sql security definer stable set search_path = '' as $$
  select coalesce(max(en),0) + 1 from public.experiments;
$$;

create or replace function public.can_edit_experiment(exp uuid) returns boolean
  language sql security definer stable set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.experiments e where e.id = exp and e.created_by = auth.uid()
  );
$$;

create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare a public.allowed_emails%rowtype;
begin
  select * into a from public.allowed_emails where email = new.email;
  insert into public.profiles (id, email, full_name, title, role, status, is_manager)
  values (
    new.id,
    new.email,
    coalesce(a.full_name, new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    a.title,
    case when new.email = 'reza@absmartmaterials.com' or coalesce(a.make_admin,false) then 'admin' else 'member' end,
    case when new.email = 'reza@absmartmaterials.com' or a.email is not null then 'approved' else 'pending' end,
    coalesce(a.make_manager,false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 2) Email allow-list: admins only ------------------------------------
alter table public.allowed_emails enable row level security;
drop policy if exists "allowed_emails admin"  on public.allowed_emails;
drop policy if exists "allowed_emails read"    on public.allowed_emails;
drop policy if exists "allowed_emails write"   on public.allowed_emails;
create policy "allowed_emails admin" on public.allowed_emails
  for all using (public.is_admin()) with check (public.is_admin());

-- 3) OPTIONAL extra layer (uncomment to apply) ------------------------
--    Removes table privileges from the anonymous (logged-out) role.
--    RLS already blocks logged-out access, so this is belt-and-suspenders.
--    Safe because the app only reads these tables once a user is signed in.
--    If you apply it, just confirm you can still log in afterwards.
--
-- revoke all on all tables in schema public from anon;
