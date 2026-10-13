import { test, expect } from "@playwright/test";
import { setup } from "./fixtures.js";
import { savedTrade } from "./audit-editor-fixtures.js";

test("unfilled trade appears in its creation-day journal filter", async ({ page, request }) => {
  await setup(page, request);
  await savedTrade(page);
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  const day = await page.evaluate(() => new Date().toLocaleDateString("en-CA"));
  await page.locator('[name="from"]').fill(day);
  await page.locator('[name="to"]').fill(day);
  await expect(page.getByText("AUDIT", { exact: true }).first()).toBeVisible();
});
