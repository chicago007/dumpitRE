-- Phase 3: vector search, denormalized stats, seed data, RLS policies

alter table sites
  add column if not exists latest_progress_pct numeric(5,2),
  add column if not exists planned_progress_pct numeric(5,2),
  add column if not exists latest_fund_pct numeric(5,2),
  add column if not exists latest_report_month date;

create index if not exists idx_document_chunks_embedding
  on document_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function match_document_chunks(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 8,
  filter_site_id uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  site_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    dc.id,
    dc.document_id,
    dc.site_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  where dc.embedding is not null
    and (filter_site_id is null or dc.site_id = filter_site_id)
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

-- Fixed UUID seed (legacy_id in metadata for slug mapping)
insert into sites (id, name, code, address, status, start_date, end_date, contract_amount, contractor, cm_company, latest_progress_pct, planned_progress_pct, latest_fund_pct, latest_report_month, metadata)
values
  ('a0000001-0000-4000-8000-000000000001', '의정부 호원동 LH매입 공동주택', 'HW-001', '경기 의정부시 호원동 57-3 외 4필지', 'in_progress', '2025-06-01', '2027-12-31', 20537400000, '계림종합건설', '코스트CM', 28.57, 47.64, 27.08, '2026-05-01', '{"legacy_id":"site-hwawon"}'),
  ('a0000002-0000-4000-8000-000000000002', '광진 자양동 491-5 도시형생활주택', 'JY-002', '서울 광진구 자양동 491-5', 'in_progress', '2025-11-20', '2026-11-21', 2950000000, '에스하임월드', '코스트CM', 52.76, 43.70, null, '2026-06-01', '{"legacy_id":"site-jayang"}'),
  ('a0000003-0000-4000-8000-000000000003', '창동 609-45 SH매입확약', 'CD-003', '서울 도봉구 창동 609-44', 'in_progress', '2025-12-31', '2027-06-30', 42000000000, '명성인토피아', '코스트CM', 58, 65, 52, '2026-05-01', '{"legacy_id":"site-changdong"}'),
  ('a0000004-0000-4000-8000-000000000004', '길동 IM_SH (강동구 228-1)', 'GD-004', '서울 강동구 길동 228-1', 'planned', '2026-06-04', '2028-03-21', 16000000000, '대정종합건설', '코스트CM', null, null, null, null, '{"legacy_id":"site-gildong"}'),
  ('a0000005-0000-4000-8000-000000000005', '판교 ○○ 오피스', 'PG-005', '경기 성남시 분당구', 'in_progress', '2025-03-01', '2026-12-31', 55000000000, '○○건설', '코스트CM', 89, 85, 85, '2026-07-01', '{"legacy_id":"site-pangyo"}'),
  ('a0000006-0000-4000-8000-000000000006', '일산 ○△ 신축', 'IS-006', '경기 고양시 일산동구', 'in_progress', '2025-01-15', '2026-10-31', 28000000000, '△△건설', '코스트CM', 44, 58, 38, '2026-07-01', '{"legacy_id":"site-ilsan"}')
on conflict (code) do update set
  name = excluded.name,
  latest_progress_pct = excluded.latest_progress_pct,
  planned_progress_pct = excluded.planned_progress_pct,
  latest_fund_pct = excluded.latest_fund_pct,
  latest_report_month = excluded.latest_report_month;

insert into progress_reports (id, site_id, report_month, overall_progress_pct, planned_progress_pct, details, notes)
values
  ('b0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', '2026-05-01', 28.57, 47.64, '[{"trade":"토목","actual":8.56,"planned":8.56},{"trade":"건축","actual":14.15,"planned":24.94}]', '제9회 CM기성실사'),
  ('b0000002-0000-4000-8000-000000000002', 'a0000002-0000-4000-8000-000000000002', '2026-06-01', 52.76, 43.70, '[{"trade":"건축","actual":32.13,"planned":37.39}]', '제4회 CM기성실사')
on conflict (site_id, report_month) do nothing;

insert into fund_schedules (id, site_id, schedule_month, planned_amount, actual_amount, source)
values
  ('c0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', '2026-05-01', 666600000, 666600000, 'document')
on conflict (site_id, schedule_month) do nothing;

-- Public read for MVP (tighten with auth in production)
alter table sites enable row level security;
alter table documents enable row level security;
alter table progress_reports enable row level security;
alter table fund_schedules enable row level security;
alter table document_chunks enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;

create policy "public read sites" on sites for select using (true);
create policy "public read documents" on documents for select using (true);
create policy "public read progress" on progress_reports for select using (true);
create policy "public read funds" on fund_schedules for select using (true);
create policy "public read chunks" on document_chunks for select using (true);
create policy "public read chat_sessions" on chat_sessions for select using (true);
create policy "public read chat_messages" on chat_messages for select using (true);

create policy "service insert sites" on sites for insert with check (true);
create policy "service update sites" on sites for update using (true);
create policy "service insert documents" on documents for insert with check (true);
create policy "service insert progress" on progress_reports for insert with check (true);
create policy "service update progress" on progress_reports for update using (true);
create policy "service insert funds" on fund_schedules for insert with check (true);
create policy "service update funds" on fund_schedules for update using (true);
create policy "service insert chunks" on document_chunks for insert with check (true);
create policy "service insert chat" on chat_sessions for insert with check (true);
create policy "service insert messages" on chat_messages for insert with check (true);
