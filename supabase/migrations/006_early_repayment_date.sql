-- Phase 7: early repayment date separate from repayment date

alter table lab_funds
  add column if not exists early_repayment_date date;

create index if not exists idx_lab_funds_early_repayment
  on lab_funds (early_repayment_date);
