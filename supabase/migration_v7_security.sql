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
