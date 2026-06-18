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
