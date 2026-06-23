-- ============================================================
-- Migration v8 — sample industry class + custom step-2 label
-- Idempotent: safe to run more than once.
-- ============================================================

-- Industry class of the sample: 'agricultural' (FSC in DI water) or
-- 'hygiene' (FSC saline + CRC + AUP). Null = unspecified / legacy.
alter table public.experiments add column if not exists industry text;

-- Optional constraint to keep the values clean (drop+recreate so re-runs work)
do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'experiments' and constraint_name = 'experiments_industry_check'
  ) then
    alter table public.experiments
      add constraint experiments_industry_check
      check (industry is null or industry in ('agricultural', 'hygiene'));
  end if;
end $$;

-- Label for the second processing step (e.g. 'Surface crosslinking',
-- 'Bulk crosslinking'). Null falls back to the default in the UI.
alter table public.experiments add column if not exists step2_label text;
