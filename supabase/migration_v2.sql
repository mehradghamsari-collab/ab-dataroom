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
