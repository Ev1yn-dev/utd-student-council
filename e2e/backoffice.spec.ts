import { env } from "./env";
import { acceptNextDialog, approve, as, db, expect, fillDate, img, publicUrl, row, submitForm, test, uniq } from "./fixtures";

// Real Supabase: every flow creates -> edits -> reviews -> shows on the site (or is deleted), as the two test users.
test.describe.configure({ mode: "serial" });


test("announcement: create, edit while pending, approve, visible on the site", async ({ browser }) => {
  const title = uniq("ประกาศ");
  const council = await as(browser, "council");
  await council.goto("/th/dashboard/announcements/new");
  await council.locator('[name="title"]').fill(`${title} ร่าง`);
  await fillDate(council, "published_on", "2026-10-19");
  await council.locator('[name="body"]').fill("เนื้อหาทดสอบ");
  await council.locator('[name="link_url"]').fill("https://example.com/form");
  await submitForm(council);
  await expect(row(council, title)).toContainText("รออนุมัติ");

  await row(council, title).getByRole("link", { name: "แก้ไข" }).click();
  await council.locator('[name="title"]').fill(title);
  await submitForm(council);

  const admin = await as(browser, "admin");
  await approve(admin, "announcements", title);
  const pub = await browser.newPage();
  await pub.goto("/th");
  await expect(pub.getByText(title).first()).toBeVisible();
});

test("announcement: reject with a reason, author sees it, staff deletes", async ({ browser }) => {
  const title = uniq("ไม่ผ่าน");
  const council = await as(browser, "council");
  await council.goto("/th/dashboard/announcements/new");
  await council.locator('[name="title"]').fill(title);
  await fillDate(council, "published_on", "2026-10-18");
  await submitForm(council);

  const admin = await as(browser, "admin");
  await admin.goto("/th/dashboard/announcements");
  const r = row(admin, title);
  await r.getByRole("button", { name: "ไม่อนุมัติ" }).click();
  await r.locator("textarea").fill("ข้อมูลไม่ครบ");
  await r.getByRole("button", { name: "ยืนยันไม่อนุมัติ" }).click();
  await expect(r).toContainText("ข้อมูลไม่ครบ");

  await council.reload();
  await expect(row(council, title)).toContainText("ข้อมูลไม่ครบ");

  acceptNextDialog(admin);
  await row(admin, title).getByRole("button", { name: "ลบ" }).click();
  await expect(row(admin, title)).toHaveCount(0);
});

test("activity with photos: upload 2, approve publishes files, site shows them; hero; delete removes files", async ({ browser }) => {
  const title = uniq("กิจกรรม");
  const council = await as(browser, "council");
  await council.goto("/th/dashboard/activities/new");
  await council.locator('[name="title"]').fill(title);
  await fillDate(council, "event_date", "2026-10-10");
  await council.locator('[name="body"]').fill("ย่อหน้าหนึ่ง\n\nย่อหน้าสอง");
  await council.locator('input[type="file"]').setInputFiles([img(1), img(2)]);
  await expect(council.locator('input[type="hidden"][name="photos"]')).toHaveCount(2, { timeout: 60_000 });
  await submitForm(council);

  const { data: act } = await db().from("activities").select("id").eq("title", title).single();
  const { data: photos } = await db().from("photos").select("id,status").eq("activity_id", act!.id);
  expect(photos).toHaveLength(2);
  expect(photos!.every((p) => p.status === "pending")).toBe(true);
  expect((await fetch(publicUrl(`photos/${photos![0].id}/960.webp`))).status).not.toBe(200);

  const admin = await as(browser, "admin");
  await approve(admin, "activities", title);
  const { data: after } = await db().from("photos").select("id,status").eq("activity_id", act!.id).order("sort_order");
  expect(after!.every((p) => p.status === "approved")).toBe(true);
  const id = after![0].id;
  for (const w of [480, 960, 1920]) expect((await fetch(publicUrl(`photos/${id}/${w}.webp`))).status).toBe(200);

  const pub = await browser.newPage();
  await pub.goto("/th");
  await expect(pub.getByText(title).first()).toBeVisible();
  await expect(pub.locator(`img[src*="${id}"]`).first()).toBeAttached();

  await admin.goto("/th/dashboard/hero");
  const card = admin.locator("li", { has: admin.locator(`img[src*="${id}"]`) });
  await card.getByRole("checkbox").check();
  await card.getByRole("button", { name: "บันทึก" }).click();
  await expect(card).toContainText("บันทึกแล้ว");
  await pub.goto("/th");
  await expect(pub.locator(`section img[src*="${id}"]`).first()).toBeAttached();

  acceptNextDialog(admin);
  await card.getByRole("button", { name: "ลบรูป" }).click();
  await expect(admin.locator(`img[src*="${id}"]`)).toHaveCount(0);
  // check the bucket itself: the CDN may keep serving a cached copy of a public object for a while
  // the card disappears before the server confirms: wait for the bucket itself
  await expect.poll(async () => (await db().storage.from("public").list(`photos/${id}`)).data ?? [], { timeout: 15_000 }).toHaveLength(0);
  const { count } = await db().from("photos").select("id", { count: "exact", head: true }).eq("id", id);
  expect(count).toBe(0);
});

test("policy: create (TH+EN), approve, page renders, staff edits, delete -> 404", async ({ browser }) => {
  const title = uniq("นโยบาย");
  const slug = `e2e-${Date.now().toString(36)}`;
  const council = await as(browser, "council");
  await council.goto("/th/dashboard/policies/new");
  await council.locator('[name="title"]').fill(title);
  await council.locator('[name="slug"]').fill(slug);
  await council.locator('[name="summary"]').fill("สรุปทดสอบ");
  await council.locator('[name="progress"]').fill("40");
  await council.locator('[name="timeline"]').fill("2026-06-01 | เริ่มต้น\n2026-08-01 | ระยะที่ 1");
  await council.getByRole("tab", { name: "English" }).click();
  await council.locator('[name="title_en"]').fill("E2E policy");
  await submitForm(council);

  const admin = await as(browser, "admin");
  await approve(admin, "policies", title);
  const pub = await browser.newPage();
  await pub.goto(`/th/policies/${slug}`);
  await expect(pub.getByRole("heading", { level: 1 })).toContainText(title);
  await pub.goto(`/en/policies/${slug}`);
  await expect(pub.getByRole("heading", { level: 1 })).toContainText("E2E policy");

  await row(admin, title).getByRole("link", { name: "แก้ไข" }).click();
  await admin.locator('[name="progress"]').fill("80");
  await submitForm(admin);
  acceptNextDialog(admin);
  await row(admin, title).getByRole("button", { name: "ลบ" }).click();
  await expect(row(admin, title)).toHaveCount(0);
  expect((await pub.goto(`/th/policies/${slug}`))!.status()).toBe(404);
});

test("members + advisors: approved people appear; IG only with consent", async ({ browser }) => {
  const a = uniq("กรรมการยินยอม"), b = uniq("กรรมการไม่ยินยอม"), t = uniq("ครู");
  const council = await as(browser, "council");
  for (const [name, consent] of [[a, true], [b, false]] as const) {
    await council.goto("/th/dashboard/members/new");
    await council.locator('[name="name"]').fill(name);
    await council.locator('[name="role_title"]').fill("กรรมการ");
    await council.locator('[name="dept"]').fill("บริหาร");
    await council.locator('[name="instagram"]').fill("@e2e_test_ig");
    if (consent) await council.locator('[name="consent_public"]').check();
    await submitForm(council);
  }
  await council.goto("/th/dashboard/advisors/new");
  await council.locator('[name="name"]').fill(t);
  await council.locator('[name="role_label"]').fill("ครูที่ปรึกษา");
  await submitForm(council);

  const admin = await as(browser, "admin");
  await approve(admin, "members", a);
  await approve(admin, "members", b);
  await approve(admin, "advisors", t);

  const pub = await browser.newPage();
  await pub.goto("/th?tab=council");
  await pub.getByRole("button").filter({ hasText: a }).first().click();
  await expect(pub.getByRole("dialog")).toContainText("@e2e_test_ig");
  await pub.keyboard.press("Escape");
  await pub.getByRole("button").filter({ hasText: b }).first().click();
  await expect(pub.getByRole("dialog")).not.toContainText("@e2e_test_ig");
  await pub.keyboard.press("Escape");
  await pub.goto("/th?tab=advisor");
  await expect(pub.getByText(t).first()).toBeVisible();
});

test("academic years (admin): add with copy -> copies start pending", async ({ browser }) => {
  const admin = await as(browser, "admin");
  await admin.goto("/th/dashboard/years");
  await admin.locator('[name="year"]').fill("2690");
  await admin.getByRole("button", { name: "เพิ่มปีการศึกษา" }).click();
  await expect(admin.getByText("เพิ่มปีแล้ว")).toBeVisible();
  await admin.reload();
  await expect(admin.getByText("2690").first()).toBeVisible();
  const { data } = await db().from("members").select("status").eq("year", 2690);
  expect((data ?? []).every((m) => m.status === "pending")).toBe(true);
});

test("setup page: admin only, statuses without values", async ({ browser }) => {
  const admin = await as(browser, "admin");
  await admin.goto("/th/admin/setup");
  await expect(admin.getByRole("heading", { name: "ตั้งค่าระบบ" })).toBeVisible();
  const html = await admin.content();
  // none of the server secrets may reach the page (compared against the real values, which stay out of the repo)
  for (const k of ["SUPABASE_SERVICE_ROLE_KEY", "UPSTASH_REDIS_REST_TOKEN", "TURNSTILE_SECRET_KEY", "APP_SECRET"]) {
    if (env[k]) expect(html.includes(env[k]), k).toBe(false);
  }
  const council = await as(browser, "council");
  await council.goto("/th/admin/setup");
  await expect(council).toHaveURL(/denied=1/);
});

test("voice: public form submits and the code can be tracked", async ({ page }) => {
  await page.goto("/th/voice");
  await page.locator('[name="category"]').selectOption({ index: 1 });
  await page.locator('[name="studentId"]').fill(process.env.E2E_STUDENT_ID ?? "00000");
  await page.locator('[name="message"]').fill("ข้อความทดสอบจากระบบอัตโนมัติ E2E กรุณาไม่ต้องตอบกลับ");
  await page.waitForTimeout(3000); // the Turnstile test key solves itself
  await page.getByRole("button", { name: "ส่งความคิดเห็น" }).click();
  const text = await page.getByText(/UTD-[A-Z0-9]{6}/).first().textContent();
  const code = text!.match(/UTD-[A-Z0-9]{6}/)![0];
  await page.locator("#ref-code").fill(code);
  await page.getByRole("button", { name: "ตรวจสอบ" }).click();
  await expect(page.getByText("รับเรื่องแล้ว")).toBeVisible();
  await db().from("voice_messages").delete().eq("ref_code", code);
});
