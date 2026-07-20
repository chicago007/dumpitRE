-- Phase 5: lab-level progress snapshots (기성보고서/공정확인서)

create table if not exists lab_progress (
  id text primary key,
  lab_fund_id text,
  lab_name text not null,
  fund_name text,
  site_address text,
  planned_progress_pct numeric(7,2),
  actual_progress_pct numeric(7,2),
  achievement_pct numeric(7,2),
  delay_days numeric(7,1),
  confirmed_date date,
  special_notes text,
  source_file_name text,
  document_id text,
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_lab_progress_lab_name
  on lab_progress (lab_name);

create index if not exists idx_lab_progress_confirmed
  on lab_progress (confirmed_date desc nulls last);

alter table lab_progress enable row level security;

drop policy if exists "public read lab_progress" on lab_progress;
drop policy if exists "service write lab_progress" on lab_progress;

create policy "public read lab_progress" on lab_progress for select using (true);
create policy "service write lab_progress" on lab_progress
  for all using (true) with check (true);
