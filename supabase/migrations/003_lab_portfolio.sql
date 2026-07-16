-- Phase 4: lab portfolio master (shared across local + Vercel)

create table if not exists lab_portfolio_meta (
  id int primary key default 1 check (id = 1),
  uploaded_at timestamptz not null default now(),
  file_name text not null default 'manual',
  updated_at timestamptz not null default now()
);

insert into lab_portfolio_meta (id, file_name)
values (1, 'manual')
on conflict (id) do nothing;

create table if not exists lab_funds (
  id text primary key,
  name text not null,
  product_code text,
  fund_name text,
  fund_code text,
  purchase_agency text,
  setup_date date,
  maturity_date date,
  loan_maturity_date date,
  repayment_date date,
  setup_amount numeric(18,2),
  balance numeric(18,2),
  interest_rate text,
  fee_rate text,
  trust_type text,
  trust_company text,
  site_address text,
  business_desc text,
  developer text,
  contractor text,
  land_area text,
  building_area text,
  total_floor_area text,
  building_scale text,
  household_count text,
  planned_progress_pct numeric(5,2),
  actual_progress_pct numeric(5,2),
  vs_plan text,
  note text,
  progress_comment text,
  interest_payments jsonb not null default '[]'::jsonb,
  status text not null default 'active'
    check (status in ('active', 'repaid', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lab_funds_name on lab_funds (name);
create index if not exists idx_lab_funds_status on lab_funds (status);
create index if not exists idx_lab_funds_setup_date on lab_funds (setup_date);

create table if not exists lab_deleted_names (
  name_key text primary key,
  lab_name text not null,
  deleted_at timestamptz not null default now()
);

alter table lab_portfolio_meta enable row level security;
alter table lab_funds enable row level security;
alter table lab_deleted_names enable row level security;

drop policy if exists "public read lab_portfolio_meta" on lab_portfolio_meta;
drop policy if exists "public read lab_funds" on lab_funds;
drop policy if exists "public read lab_deleted_names" on lab_deleted_names;
drop policy if exists "service write lab_portfolio_meta" on lab_portfolio_meta;
drop policy if exists "service write lab_funds" on lab_funds;
drop policy if exists "service write lab_deleted_names" on lab_deleted_names;

create policy "public read lab_portfolio_meta" on lab_portfolio_meta for select using (true);
create policy "public read lab_funds" on lab_funds for select using (true);
create policy "public read lab_deleted_names" on lab_deleted_names for select using (true);

create policy "service write lab_portfolio_meta" on lab_portfolio_meta
  for all using (true) with check (true);
create policy "service write lab_funds" on lab_funds
  for all using (true) with check (true);
create policy "service write lab_deleted_names" on lab_deleted_names
  for all using (true) with check (true);
