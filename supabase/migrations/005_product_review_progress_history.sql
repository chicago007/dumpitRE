-- Phase 6: product master persistence, review queue, progress time series

-- ── product_master (제안서/업로드 매칭용) ──
create table if not exists product_master (
  id text primary key,
  lab_name text not null default '',
  fund_name text,
  site_address text not null default '',
  site_name text,
  aliases jsonb not null default '[]'::jsonb,
  site_id text,
  contract_amount numeric(18,2),
  notes text,
  has_proposal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_product_master_lab on product_master (lab_name);
create index if not exists idx_product_master_address on product_master (site_address);

alter table product_master enable row level security;
drop policy if exists "public read product_master" on product_master;
drop policy if exists "service write product_master" on product_master;
create policy "public read product_master" on product_master for select using (true);
create policy "service write product_master" on product_master
  for all using (true) with check (true);

-- ── review_queue (검토 대기함) ──
create table if not exists review_queue (
  id text primary key,
  kind text not null
    check (kind in (
      'progress_match',
      'progress_stale',
      'progress_extract_failed',
      'proposal_register'
    )),
  status text not null default 'pending'
    check (status in ('pending', 'resolved', 'dismissed')),
  document_id text,
  file_name text not null default '',
  message text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_review_queue_status on review_queue (status, created_at desc);
create index if not exists idx_review_queue_document on review_queue (document_id);

alter table review_queue enable row level security;
drop policy if exists "public read review_queue" on review_queue;
drop policy if exists "service write review_queue" on review_queue;
create policy "public read review_queue" on review_queue for select using (true);
create policy "service write review_queue" on review_queue
  for all using (true) with check (true);

-- ── lab_progress: 랩당 1행 → 확인일별 시계열 ──
drop index if exists idx_lab_progress_lab_name;

create unique index if not exists idx_lab_progress_lab_date
  on lab_progress (lab_name, confirmed_date)
  where confirmed_date is not null;

create index if not exists idx_lab_progress_lab_name_date
  on lab_progress (lab_name, confirmed_date desc nulls last);

create index if not exists idx_lab_progress_fund_date
  on lab_progress (lab_fund_id, confirmed_date desc nulls last);
