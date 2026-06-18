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
