-- Atomic roster import for /admin/roster: upserts every row of the CSV and marks students missing from it inactive
-- (they stay in the table, so a re-import can bring them back). p_rows: [{"student_id":"12345","grade":4,"active":true}].
create or replace function public.roster_import(p_rows jsonb)
returns table (upserted int, deactivated int)
language plpgsql
security definer
set search_path = public
as $$
declare
  u int;
  d int;
begin
  insert into student_roster (student_id, grade, active, updated_at)
    select r.student_id, r.grade, coalesce(r.active, true), now()
    from jsonb_to_recordset(p_rows) as r(student_id text, grade smallint, active boolean)
  on conflict (student_id) do update set grade = excluded.grade, active = excluded.active, updated_at = now();
  get diagnostics u = row_count;
  update student_roster set active = false, updated_at = now()
    where active and student_id not in (select r.student_id from jsonb_to_recordset(p_rows) as r(student_id text));
  get diagnostics d = row_count;
  return query select u, d;
end;
$$;

revoke all on function public.roster_import(jsonb) from public, anon, authenticated;
grant execute on function public.roster_import(jsonb) to service_role;
