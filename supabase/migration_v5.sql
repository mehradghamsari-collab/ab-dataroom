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
