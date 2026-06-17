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