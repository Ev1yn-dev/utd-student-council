-- One back office: admin_users (role + extra permissions per Google address) replaces allowed_users / ADMIN_EMAILS as
-- the source of back-office rights, admin_audit replaces audit_logs, and the statistics get an hour-of-week dimension
-- (visits) and a grade/room dimension (council voice).
--
-- Roles and what they may do live in lib/admin/permissions.ts (the app checks every page, action and API route).
-- These tables are read and written only with the service role: RLS on, no policies, no grants to anon/authenticated.

-- ───────────────────────── admin_users ─────────────────────────
create table if not exists public.admin_users (
  email text primary key check (email = lower(btrim(email)) and email like '%_@_%'),
  role text not null check (role in ('owner', 'admin', 'editor', 'moderator', 'viewer')),
  extra_permissions text[] not null default '{}' check (extra_permissions <@ array[
    'stats.view', 'messages.read', 'messages.identity.view', 'messages.delete', 'senders.block', 'roster.import',
    'content.edit', 'years.manage', 'banners.edit', 'consent.view', 'users.manage', 'data.export', 'data.reset.view',
    'security.view', 'settings.edit'
  ]::text[]),
  disabled boolean not null default false,
  -- an account several people sign in with (the council's own addresses); shown as a warning on the users page
  shared boolean not null default false,
  -- the academic year the top bar's selector last showed for this person
  pref_year integer,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

drop trigger if exists admin_users_touch on public.admin_users;
create trigger admin_users_touch before update on public.admin_users for each row execute function public.touch_updated_at();

-- Defence in depth for the rule the app enforces: the last active owner cannot be removed, demoted or disabled.
create or replace function public.admin_users_keep_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.role = 'owner' and not old.disabled
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.disabled)
     and not exists (select 1 from admin_users where role = 'owner' and not disabled and email <> old.email) then
    raise exception 'last owner' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists admin_users_keep_owner on public.admin_users;
create trigger admin_users_keep_owner before update or delete on public.admin_users
  for each row execute function public.admin_users_keep_owner();

-- Seed (no addresses in this file: they are copied from the database itself).
--   today's administrators (profiles.role = 'admin', i.e. ADMIN_EMAILS accounts that have signed in) -> owner
--   allowed_users rows (council / teacher)                                                          -> viewer
-- ADMIN_EMAILS addresses that never signed in become owner on their first sign-in (lib/auth.ts).
insert into public.admin_users (email, role, created_by)
  select lower(btrim(email)), 'owner', 'migration 0019' from public.profiles where role = 'admin' and email is not null
  on conflict (email) do nothing;
insert into public.admin_users (email, role, disabled, shared, created_by)
  select email, 'viewer', not active, shared, coalesce(created_by, 'migration 0019') from public.allowed_users
  on conflict (email) do nothing;

-- ───────────────────────── admin_audit ─────────────────────────
create table if not exists public.admin_audit (
  id bigserial primary key,
  actor_email text,
  action text not null,
  target text,
  details jsonb not null default '{}',
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on public.admin_audit (created_at desc);
create index if not exists admin_audit_action_idx on public.admin_audit (action, created_at desc);
create index if not exists admin_audit_actor_idx on public.admin_audit (actor_email, created_at desc);
alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;

-- history of the old log (audit_logs stays as it was, read-only from now on)
insert into public.admin_audit (actor_email, action, target, details, ip_hash, created_at)
  select actor_email, action, nullif(concat_ws(':', target_table, target_id), ''), coalesce(detail, '{}') - 'ip_hash', detail ->> 'ip_hash', created_at
  from public.audit_logs
  where not exists (select 1 from public.admin_audit);

-- profiles.role changes (kept in step with admin_users for RLS) are logged in the new table
create or replace function public.audit_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.role is null then return new; end if;
  if tg_op = 'UPDATE' and new.role is not distinct from old.role then return new; end if;
  insert into public.admin_audit (actor_email, action, target, details)
  values (
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', current_user),
    'role.sync', new.email,
    jsonb_build_object('from', case when tg_op = 'UPDATE' then old.role end, 'to', new.role)
  );
  return new;
end $$;

-- entries are kept one year (called by the security page; cheap with the created_at index)
create or replace function public.prune_admin_audit()
returns integer
language sql
security definer
set search_path = public
as $$
  with d as (delete from admin_audit where created_at < now() - interval '1 year' returning 1) select count(*)::integer from d;
$$;
revoke all on function public.prune_admin_audit() from public, anon, authenticated;
grant execute on function public.prune_admin_audit() to service_role;

-- ───────────────────────── statistics ─────────────────────────
-- visits: + dim 'hour', key "<ISO weekday 1-7>-<hour 00-23>" (Bangkok time), for the day x hour heatmap
create or replace function public.track_visit(p_ident text, p_path text, p_ref text, p_device text, p_country text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  local timestamp := now() at time zone 'Asia/Bangkok';
  d date := local::date;
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
    from (values ('page', p_path), ('ref', p_ref), ('device', p_device), ('country', p_country), ('hour', to_char(local, 'ID-HH24'))) as x(dim, key)
    where x.key is not null
    on conflict (day, dim, key) do update set views = visit_stats.views + 1;
end;
$$;

-- report: top 20 per dimension, except 'hour' (all 168 cells)
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
  ) r where r.rn <= 20 or r.dim = 'hour';
$$;

-- council voice: + dim 'room', key "<grade>/<room>" (rooms only; never names, IDs or text)
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
  select 'room', grade::text || '/' || sender_room, count(*) from voice_messages where created_at >= p_since and grade is not null and coalesce(sender_room, '') <> '' group by 1, 2
  union all
  select 'category', category, count(*) from voice_messages where created_at >= p_since group by 1, 2;
$$;

revoke all on function public.track_visit(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.visit_report(date) from public, anon, authenticated;
revoke all on function public.voice_stats(timestamptz) from public, anon, authenticated;
grant execute on function public.track_visit(text, text, text, text, text) to service_role;
grant execute on function public.visit_report(date) to service_role;
grant execute on function public.voice_stats(timestamptz) to service_role;
