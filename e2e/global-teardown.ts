// Removes everything the test users created (rows, photos + storage files, profiles) and the users themselves.
import { createClient } from "@supabase/supabase-js";
import { ADMIN, COUNCIL, env } from "./env";

export default async function globalTeardown() {
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  const users = (list?.users ?? []).filter((u) => u.email === ADMIN || u.email === COUNCIL);
  const ids = users.map((u) => u.id);
  const emails = [ADMIN, COUNCIL];
  if (!ids.length) return;
  for (const t of ["announcements", "activities", "policies", "members", "advisors"]) await db.from(t).delete().in("author_id", ids);
  const { data: photos } = await db.from("photos").select("id").in("uploaded_by", ids);
  const paths = (photos ?? []).flatMap((p) => [480, 960, 1920].map((w) => `photos/${p.id}/${w}.webp`));
  if (paths.length) await Promise.all([db.storage.from("public").remove(paths), db.storage.from("pending").remove(paths)]);
  await db.from("photos").delete().in("uploaded_by", ids);
  await db.from("academic_years").delete().gte("year", 2690); // test years only
  await db.from("admin_audit").delete().in("actor_email", emails);
  await db.from("admin_audit").delete().in("target", emails);
  await db.from("security_events").delete().in("user_id", ids);
  await db.from("profiles").delete().in("id", ids);
  await db.from("admin_users").delete().eq("created_by", "e2e");
  await db.from("admin_users").delete().eq("email", ADMIN).eq("created_by", "ADMIN_EMAILS"); // bootstrap owner of the test admin
  for (const id of ids) await db.auth.admin.deleteUser(id);
}
