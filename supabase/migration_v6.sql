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
