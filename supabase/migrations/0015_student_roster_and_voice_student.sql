-- Voice form requires a student ID, checked against an imported roster.
--
-- student_roster: one row per student (5-digit ID, grade 1–6 = ม.1–ม.6, active). Imported by an admin from CSV
-- (/admin/roster). Service role only: no token can read or list it.
--
-- voice_messages.student_id: the raw ID, kept ONLY when the sender did not tick "ไม่ระบุตัวตน" (anonymous). For an
-- anonymous message it is null and nothing on the row links it to a student.
-- Not granted to `authenticated`: council members reading messages through the API never see it; only admin
-- server code (service role) does.
--
-- voice_quota: per Bangkok day, an HMAC of the student ID (server secret) with that day's count and an HMAC of the
-- last message, for the 3-per-day limit and duplicate check. It has no reference to any message and no timestamp
-- finer than the day. Rows older than 2 days are removed.

create table if not exists public.student_roster (
  student_id text primary key check (student_id ~ '^[0-9]{5}$'),
  grade smallint not null check (grade between 1 and 6),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.student_roster enable row level security;
revoke all on public.student_roster from anon, authenticated;

alter table public.voice_messages
  add column if not exists student_id text check (student_id is null or student_id ~ '^[0-9]{5}$');
-- the column-level grant list of 0001/0014 does not include student_id, so authenticated cannot select it

create table if not exists public.voice_quota (
  day date not null,
  student_hash text not null,
  n smallint not null default 0,
  last_hash text,
  primary key (day, student_hash)
);
alter table public.voice_quota enable row level security;
revoke all on public.voice_quota from anon, authenticated;

-- Claims one submission for a student today: 'ok', 'limit' (already p_max today) or 'dup' (same message as last time).
create or replace function public.voice_claim(p_student_hash text, p_msg_hash text, p_max int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := (now() at time zone 'Asia/Bangkok')::date;
  cur public.voice_quota;
begin
  delete from voice_quota where day < d - 1;
  insert into voice_quota (day, student_hash, n) values (d, p_student_hash, 0) on conflict do nothing;
  select * into cur from voice_quota where day = d and student_hash = p_student_hash for update;
  if cur.last_hash = p_msg_hash then return 'dup'; end if;
  if cur.n >= p_max then return 'limit'; end if;
  update voice_quota set n = n + 1, last_hash = p_msg_hash where day = d and student_hash = p_student_hash;
  return 'ok';
end;
$$;

revoke all on function public.voice_claim(text, text, int) from public, anon, authenticated;
grant execute on function public.voice_claim(text, text, int) to service_role;
