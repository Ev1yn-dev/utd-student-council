-- Identified council voice + admin moderation.
--
-- * student_roster gains academic_year, room and the student's name (prefix, first, last). Still service role only.
-- * voice_messages: every NEW message keeps a snapshot of the sender (student_id is already there; prefix, names and
--   room are added; grade already exists). Messages sent while "anonymous" was offered are left as they are
--   (no backfill). None of these columns is granted to `authenticated`: only admin server code reads them.
-- * read_at (read / unread) and flagged ("ต้องตรวจ": matched the admin's word list; still delivered).
-- * voice_blocks: an admin can stop a student ID from sending (reason, optional end date, lifted_at when unblocked).
-- * voice_bad_words: the admin-editable word list for flagging.

alter table public.student_roster
  add column if not exists academic_year smallint,
  add column if not exists room text check (room is null or length(room) <= 10),
  add column if not exists prefix text check (prefix is null or length(prefix) <= 30),
  add column if not exists first_name text check (first_name is null or length(first_name) <= 100),
  add column if not exists last_name text check (last_name is null or length(last_name) <= 100);

alter table public.voice_messages
  add column if not exists sender_prefix text,
  add column if not exists sender_first_name text,
  add column if not exists sender_last_name text,
  add column if not exists sender_room text,
  add column if not exists read_at timestamptz,
  add column if not exists flagged boolean not null default false;
create index if not exists voice_messages_created_idx on public.voice_messages (created_at desc);
create index if not exists voice_messages_unread_idx on public.voice_messages (created_at) where read_at is null;

create table if not exists public.voice_blocks (
  id uuid primary key default gen_random_uuid(),
  student_id text not null check (student_id ~ '^[0-9]{5}$'),
  reason text not null check (length(reason) between 1 and 500),
  until timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by text
);
create index if not exists voice_blocks_active_idx on public.voice_blocks (student_id) where lifted_at is null;

create table if not exists public.voice_bad_words (
  word text primary key check (length(word) between 1 and 60),
  created_at timestamptz not null default now()
);

alter table public.voice_blocks enable row level security;
alter table public.voice_bad_words enable row level security;
revoke all on public.voice_blocks, public.voice_bad_words from anon, authenticated;

-- Roster import now carries the academic year, room and names. Students missing from the file become inactive.
drop function if exists public.roster_import(jsonb);
create or replace function public.roster_import(p_rows jsonb, p_year smallint default null)
returns table (upserted int, deactivated int)
language plpgsql
security definer
set search_path = public
as $$
declare
  u int;
  d int;
begin
  insert into student_roster (student_id, grade, active, academic_year, room, prefix, first_name, last_name, updated_at)
    select r.student_id, r.grade, coalesce(r.active, true), p_year, nullif(r.room, ''), nullif(r.prefix, ''), nullif(r.first_name, ''), nullif(r.last_name, ''), now()
    from jsonb_to_recordset(p_rows) as r(student_id text, grade smallint, active boolean, room text, prefix text, first_name text, last_name text)
  on conflict (student_id) do update set
    grade = excluded.grade, active = excluded.active, academic_year = coalesce(excluded.academic_year, student_roster.academic_year),
    room = excluded.room, prefix = excluded.prefix, first_name = excluded.first_name, last_name = excluded.last_name, updated_at = now();
  get diagnostics u = row_count;
  update student_roster set active = false, updated_at = now()
    where active and student_id not in (select r.student_id from jsonb_to_recordset(p_rows) as r(student_id text));
  get diagnostics d = row_count;
  return query select u, d;
end;
$$;

revoke all on function public.roster_import(jsonb, smallint) from public, anon, authenticated;
grant execute on function public.roster_import(jsonb, smallint) to service_role;
