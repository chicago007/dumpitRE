-- guest 계정 로그인 기록

create table if not exists guest_login_logs (
  id text primary key,
  username text not null default 'guest',
  user_id text not null,
  ip text,
  user_agent text,
  logged_at timestamptz not null default now()
);

create index if not exists idx_guest_login_logs_at on guest_login_logs (logged_at desc);

alter table guest_login_logs enable row level security;
drop policy if exists "service write guest_login_logs" on guest_login_logs;
create policy "service write guest_login_logs" on guest_login_logs
  for all using (true) with check (true);
