-- Trap (honeypot) sources and automatic IP blocks (proxy.ts, lib/trap.ts).
--
-- trap_hits: one row per trap hit (/.env, /.git, /wp-login.php, /_hp/... — lib/bots.ts TRAP_PATHS), with the FULL IP,
--   country, network (ASN + name), user agent and path, so the administrators can see where scans come from.
--   Only trap hits are stored this way; normal visitors are never recorded with their IP. Kept 30 days.
-- ip_blocks: an IP with 3+ trap hits in 10 minutes is blocked from the whole site for 24 hours.
-- Both are written only by the server (service role) and read only by the security page (owner / admin).
-- RLS on with no policies = invisible to anon / authenticated tokens.

create table if not exists public.trap_hits (
  id bigint generated always as identity primary key,
  ip text not null,
  country text,
  asn integer,
  as_org text,
  ua text,
  path text,
  created_at timestamptz not null default now()
);
create index if not exists trap_hits_ip_created_idx on public.trap_hits (ip, created_at desc);
create index if not exists trap_hits_created_idx on public.trap_hits (created_at);
alter table public.trap_hits enable row level security;
revoke all on public.trap_hits from anon, authenticated;

create table if not exists public.ip_blocks (
  ip text primary key,
  reason text not null default 'trap',
  hits integer not null default 0,
  blocked_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists ip_blocks_expires_idx on public.ip_blocks (expires_at);
alter table public.ip_blocks enable row level security;
revoke all on public.ip_blocks from anon, authenticated;

-- Records one trap hit and returns the block's expiry when the IP is (now) blocked, else null. Also deletes trap hits
-- older than 30 days and expired blocks, so retention holds even without pg_cron.
create or replace function public.record_trap_hit(p_ip text, p_country text, p_asn integer, p_as_org text, p_ua text, p_path text)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  n integer;
  until timestamptz;
begin
  delete from public.trap_hits where created_at < now() - interval '30 days';
  delete from public.ip_blocks where expires_at < now();
  insert into public.trap_hits (ip, country, asn, as_org, ua, path)
  values (left(p_ip, 64), left(p_country, 2), p_asn, left(p_as_org, 200), left(p_ua, 400), left(p_path, 300));
  select count(*) into n from public.trap_hits where ip = left(p_ip, 64) and created_at > now() - interval '10 minutes';
  if n < 3 then return null; end if;
  insert into public.ip_blocks (ip, reason, hits, expires_at)
  values (left(p_ip, 64), 'trap', n, now() + interval '24 hours')
  on conflict (ip) do update set hits = excluded.hits, expires_at = excluded.expires_at
  returning expires_at into until;
  return until;
end $$;
revoke all on function public.record_trap_hit(text, text, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.record_trap_hit(text, text, integer, text, text, text) to service_role;

-- Daily clean-up as well (quiet periods with no new hits), when pg_cron is available.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('prune-trap-hits', '17 3 * * *',
      $c$delete from public.trap_hits where created_at < now() - interval '30 days'; delete from public.ip_blocks where expires_at < now()$c$);
  end if;
end $$;
