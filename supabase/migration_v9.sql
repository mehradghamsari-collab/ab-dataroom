-- ============================================================
-- Migration v9 — recycle bin (soft delete), draft/unfinished flag,
-- and an instrument-characterization table (FTIR / TGA / DSC / ...).
-- Idempotent.
-- ============================================================

-- Soft delete: experiments move to a recycle bin instead of vanishing.
alter table public.experiments add column if not exists deleted_at timestamptz;
create index if not exists idx_experiments_deleted on public.experiments(deleted_at);

-- Draft flag: unfinished experiments are hidden from the main list until done.
alter table public.experiments add column if not exists is_done boolean not null default true;

-- Instrument characterization tests done in-house on an experiment.
create table if not exists public.instrument_tests (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid references public.experiments(id) on delete cascade,
  technique text not null,
  result_summary text,
  test_date date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_instr_experiment on public.instrument_tests(experiment_id);
create index if not exists idx_instr_created on public.instrument_tests(created_at desc);

alter table public.instrument_tests enable row level security;
drop policy if exists "instr read"   on public.instrument_tests;
drop policy if exists "instr insert" on public.instrument_tests;
drop policy if exists "instr update" on public.instrument_tests;
drop policy if exists "instr delete" on public.instrument_tests;
create policy "instr read"   on public.instrument_tests for select using (public.is_approved());
create policy "instr insert" on public.instrument_tests for insert with check (public.is_approved());
create policy "instr update" on public.instrument_tests for update using (public.is_approved()) with check (public.is_approved());
create policy "instr delete" on public.instrument_tests for delete using (public.is_admin() or created_by = auth.uid());

-- realtime
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'instrument_tests') then
    alter publication supabase_realtime add table public.instrument_tests;
  end if;
end $$;
