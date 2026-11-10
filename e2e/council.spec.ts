import { expect, test } from "./fixtures";

// Council tab (src/data/council-members.json): executives, teacher advisors, then student members by department.
// No vice-head role anywhere. A card opens its full introduction card; IG opens in a new tab.
test("council roster: section order, no vice head, card popup, IG link", async ({ page }) => {
  await page.goto("/th?tab=council");
  const tab = page.locator("section[aria-labelledby=council-h]");
  const titles = tab.locator("h3");
  await expect(titles.nth(0)).toHaveText("คณะผู้บริหาร");
  await expect(titles.nth(1)).toHaveText("ครูที่ปรึกษาสภานักเรียน");
  await expect(titles.nth(2)).toHaveText("สมาชิกสภานักเรียน");
  await expect(tab.locator("h4").first()).toContainText("ฝ่าย");
  await expect(tab.getByText("รองหัวหน้า")).toHaveCount(0);
  await expect(tab.getByText(/^(null|—)$/)).toHaveCount(0);

  await tab.locator("li").first().getByRole("button").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("img")).toHaveAttribute("alt", /.+/);
  await page.keyboard.press("Escape");

  const ig = tab.locator('a[href^="https://www.instagram.com/"]').first();
  await expect(ig).toHaveAttribute("target", "_blank");
  await expect(ig).toHaveAttribute("rel", "noopener noreferrer");
});
