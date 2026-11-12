-- Tighten PostgREST role grants (pentest 2026-11-12, docs/pentest/report.md).
--
-- Threat model: the app reads PUBLIC pages with the anon key (safe columns only) and everything else with the service
-- role. A signed-in Supabase user (role `authenticated`) is used ONLY for auth.getUser() — never as a data client for
-- reads or writes. So any table/column a non-service role can reach is attack surface with no legitimate use.

-- 1) members / advisors: anon keeps its column SELECT (no contact / instagram — 0009 / 0021). `authenticated` still
--    carried the default broad grant, exposing contact, instagram, author_id, reason, reviewed_by to ANY signed-up
--    account. The app never reads these as `authenticated`.
revoke all on public.members from authenticated;
revoke all on public.advisors from authenticated;

-- 2) voice tables: identities and message text. Never read with anon or authenticated (service role only).
revoke all on public.voice_messages from anon, authenticated;
revoke all on public.voice_replies from anon, authenticated;

-- 3) stray default grants: only RLS currently neutralises these (0 rows). Remove them so RLS is not the only thing
--    between the public anon key and admin emails / invite emails / the audit trail.
revoke all on public.profiles from anon, authenticated;
revoke all on public.role_invites from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

-- 4) photos: public images ARE read by anon, but select=* also returned uploaded_by / reviewed_by / reason. Keep only
--    the columns the public pages read (lib/content.ts IMG_COLS + hero / caption / alt / credit + embed FK columns).
revoke all on public.photos from anon, authenticated;
grant select (
  id, album_id, event_slug, activity_id, policy_id,
  caption, width, height, blur, sort_order,
  is_hero, hero_order, hero_start, hero_end, hero_seconds,
  static_path, credit, alt_th, alt_en, focal
) on public.photos to anon, authenticated;

-- 5) the anon key and authenticated accounts must be READ-ONLY on the public content tables: every write goes through
--    the service role. They held the default insert/update/delete grant (RLS blocked the writes, but the grant should
--    not exist). Also closes the legacy is_staff()/is_member() write path that bypassed the admin_users role model.
revoke insert, update, delete, truncate, references, trigger
  on public.members, public.advisors, public.academic_years, public.announcements,
     public.activities, public.policies, public.albums
  from anon, authenticated;
