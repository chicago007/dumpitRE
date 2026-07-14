-- Dumpit RE initial schema
create extension if not exists vector;

create table sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  address text,
  status text not null default 'in_progress'
    check (status in ('planned','in_progress','completed','suspended')),
  start_date date,
  end_date date,
  contract_amount numeric(18,2),
  contractor text,
  cm_company text,
  google_drive_folder_id text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id),
  type text not null
    check (type in ('proposal','progress_report','fund_schedule','other')),
  file_name text not null,
  mime_type text,
  google_drive_file_id text,
  google_drive_url text,
  analysis_status text default 'pending'
    check (analysis_status in ('pending','processing','done','failed','needs_review')),
  analysis_error text,
  uploaded_at timestamptz default now(),
  analyzed_at timestamptz
);

create table progress_reports (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id),
  document_id uuid references documents(id),
  report_month date not null,
  overall_progress_pct numeric(5,2),
  planned_progress_pct numeric(5,2),
  details jsonb,
  notes text,
  extracted_at timestamptz default now(),
  unique (site_id, report_month)
);

create table fund_schedules (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id),
  document_id uuid references documents(id),
  schedule_month date not null,
  planned_amount numeric(18,2) not null default 0,
  actual_amount numeric(18,2),
  notes text,
  source text default 'manual'
    check (source in ('manual','document','import')),
  updated_at timestamptz default now(),
  unique (site_id, schedule_month)
);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id),
  document_id uuid references documents(id),
  total_budget numeric(18,2),
  construction_period_months int,
  key_items jsonb,
  raw_extract jsonb,
  extracted_at timestamptz default now()
);

create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  site_id uuid references sites(id),
  chunk_index int not null,
  content text not null,
  embedding vector(768),
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id),
  title text,
  created_at timestamptz default now()
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions(id) on delete cascade,
  role text check (role in ('user','assistant')),
  content text not null,
  citations jsonb,
  created_at timestamptz default now()
);

create index idx_progress_reports_site on progress_reports(site_id, report_month desc);
create index idx_fund_schedules_site on fund_schedules(site_id, schedule_month desc);
create index idx_documents_site on documents(site_id);
