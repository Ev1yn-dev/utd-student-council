-- Admin statistics.
--
-- 1) voice_messages.grade: the sender's grade level (ม.1–ม.6 = 1–6). Required by the form from now on; older rows stay
--    null and show as "not specified". Statistics only ever read counts (voice_stats below), never rows.
-- 2) Privacy-friendly visit counts, one row per day + dimension + key. No cookies, no raw IP: a visitor is a
--    sha256(daily random salt || HMAC(ip + user agent)) kept only to count unique visitors per day. The salt of a day is
--    deleted once the day is over, so a stored hash can no longer be linked to an IP. Rows older than 90 days are dropped.
--    Days are Asia/Bangkok calendar days.

alter table public.voice_messages
  add column if not exists grade smallint check (grade is null or grade between 1 and 6);
grant select (grade) on public.voice_messages to authenticated;

create table if not exists public.visit_stats (
  day date not null,
  dim text not null check (dim in ('all', 'page', 'ref', 'device', 'country')),
  key text not null default '' check (length(key) <= 120),
  views integer not null default 0,
  uniques integer not null default 0, -- only filled for dim = 'all'
  primary key (day, dim, key)
);

create table if not exists public.visit_uniques (
  day date not null,
  hash text not null,
  primary key (day, hash)
);

create table if not exists public.visit_salts (
  day date primary key,
  salt text not null
);

alter table public.visit_stats enable row level security;
alter table public.visit_uniques enable row level security;
alter table public.visit_salts enable row level security;
revoke all on public.visit_stats, public.visit_uniques, public.visit_salts from anon, authenticated;

-- One page view. p_ident is already an HMAC of ip + user agent (computed by the app); the raw IP never reaches the DB.
create or replace function public.track_visit(p_ident text, p_path text, p_ref text, p_device text, p_country text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := (now() at time zone 'Asia/Bangkok')::date;
  s text;
  added integer;
begin
  select salt into s from visit_salts where day = d;
  if s is null then
    insert into visit_salts (day, salt) values (d, md5(gen_random_uuid()::text || clock_timestamp()::text) || md5(gen_random_uuid()::text))
      on conflict (day) do nothing;
    select salt into s from visit_salts where day = d;
    -- first view of a new day: forget older salts, drop data past the 90-day window
    delete from visit_salts where day < d;
    delete from visit_uniques where day < d - 90;
    delete from visit_stats where day < d - 90;
  end if;

  insert into visit_uniques (day, hash) values (d, encode(sha256(convert_to(s || p_ident, 'UTF8')), 'hex'))
    on conflict do nothing;
  get diagnostics added = row_count;

  insert into visit_stats (day, dim, key, views, uniques) values (d, 'all', '', 1, added)
    on conflict (day, dim, key) do update set views = visit_stats.views + 1, uniques = visit_stats.uniques + excluded.uniques;
  insert into visit_stats (day, dim, key, views)
    select d, x.dim, left(x.key, 120), 1
    from (values ('page', p_path), ('ref', p_ref), ('device', p_device), ('country', p_country)) as x(dim, key)
    where x.key is not null
    on conflict (day, dim, key) do update set views = visit_stats.views + 1;
end;
$$;

-- Report for the admin page: the daily series (dim 'all', one row per day) + per-dimension totals (day null, top 20).
create or replace function public.visit_report(p_since date)
returns table (dim text, key text, day date, views bigint, uniques bigint)
language sql
stable
security definer
set search_path = public
as $$
  select 'all', '', v.day, v.views::bigint, v.uniques::bigint from visit_stats v where v.dim = 'all' and v.day >= p_since
  union all
  select r.dim, r.key, null, r.views, 0 from (
    select v.dim, v.key, sum(v.views)::bigint as views,
           row_number() over (partition by v.dim order by sum(v.views) desc, v.key) as rn
    from visit_stats v where v.dim <> 'all' and v.day >= p_since
    group by v.dim, v.key
  ) r where r.rn <= 20;
$$;

-- Counts only (no message, no code, no hash): submissions per day, per grade and per category, as separate groups.
create or replace function public.voice_stats(p_since timestamptz)
returns table (dim text, key text, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select 'day', to_char((created_at at time zone 'Asia/Bangkok')::date, 'YYYY-MM-DD'), count(*) from voice_messages where created_at >= p_since group by 1, 2
  union all
  select 'grade', coalesce(grade::text, ''), count(*) from voice_messages where created_at >= p_since group by 1, 2
  union all
  select 'category', category, count(*) from voice_messages where created_at >= p_since group by 1, 2;
$$;

revoke all on function public.track_visit(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.visit_report(date) from public, anon, authenticated;
revoke all on function public.voice_stats(timestamptz) from public, anon, authenticated;
grant execute on function public.track_visit(text, text, text, text, text) to service_role;
grant execute on function public.visit_report(date) to service_role;
grant execute on function public.voice_stats(timestamptz) to service_role;
