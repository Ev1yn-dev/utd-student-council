import { expect, test } from "./fixtures";

// Council tab: the student committee by department (content/council-departments.json order) — database rows merged
// with src/data/council-members.json — then "ครูที่ปรึกษาและผู้บริหาร" (executives, advisors) in its own section.
// No vice-head role anywhere.
test("council: committee by department, separate staff section, no vice head", async ({ page }) => {
  await page.goto("/th?tab=council");
  const committee = page.locator("section[aria-labelledby=council-h]");
  const sections = committee.locator("section[aria-labelledby^=dept-]");
  await expect(sections.first()).toContainText("ฝ่ายบริหารสูงสุด");
  await expect(committee.getByText("รองหัวหน้า")).toHaveCount(0);
  await expect(committee.getByText("รอประกาศ")).toHaveCount(0);

  const staff = page.locator("section[aria-labelledby=staff-h]");
  await expect(staff.locator("h3").nth(0)).toHaveText("ผู้บริหาร");
  await expect(staff.locator("h3").nth(1)).toHaveText("ครูที่ปรึกษาสภานักเรียน");

  // a roster card opens the popup with the full introduction card
  await committee.getByRole("button", { name: /นภัทร/ }).first().click();
  await expect(page.getByRole("dialog").locator("img").first()).toHaveAttribute("alt", /นภัทร/);
  await page.keyboard.press("Escape");

  const ig = committee.locator('a[href^="https://instagram.com/"]').first();
  await expect(ig).toHaveAttribute("target", "_blank");
});
