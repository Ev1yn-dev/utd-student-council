import { expect, test } from "./fixtures";

// Council tab: the student committee by department (content/council-departments.json order) — database rows merged
// in the members table (roster seeded by migration 0020). Executives and teacher advisors are on the advisor tab. No vice-head role anywhere.
test("council: committee by department, no staff, no vice head", async ({ page }) => {
  await page.goto("/th?tab=council");
  const committee = page.locator("section[aria-labelledby=council-h]");
  const sections = committee.locator("section[aria-labelledby^=dept-]");
  await expect(sections.first()).toContainText("ฝ่ายบริหารสูงสุด");
  await expect(committee.getByText("รองหัวหน้า")).toHaveCount(0);
  await expect(committee.getByText("รอประกาศ")).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "ครูที่ปรึกษาสภานักเรียน" })).toHaveCount(0);

  // a roster card opens the popup with the full introduction card
  await committee.getByRole("button", { name: /นภัทร/ }).first().click();
  await expect(page.getByRole("dialog").locator("img").first()).toHaveAttribute("alt", /นภัทร/);
  await page.keyboard.press("Escape");

  const ig = committee.locator('a[href^="https://instagram.com/"]').first();
  await expect(ig).toHaveAttribute("target", "_blank");
});

// Advisor tab: ผู้บริหาร first, then ครูที่ปรึกษาสภานักเรียน, in the committee's portrait card.
test("advisors: executives then teacher advisors, committee card and popup", async ({ page }) => {
  await page.goto("/th?tab=advisor");
  const zone = page.locator("section[aria-labelledby=advisor-h]");
  await expect(zone.locator("h3").nth(0)).toHaveText("ผู้บริหาร");
  await expect(zone.locator("h3").nth(1)).toHaveText("ครูที่ปรึกษาสภานักเรียน");
  await expect(zone.locator('a[href^="https://instagram.com/"]')).toHaveCount(0);
  await zone.locator("h4 button").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
