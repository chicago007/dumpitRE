-- 진행현황 코멘트 첨부(인허가 PDF·사진 등)
alter table lab_funds
  add column if not exists progress_attachments jsonb not null default '[]'::jsonb;
