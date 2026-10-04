import { test, expect } from "@playwright/test";
import { setup } from "./fixtures.js";
import { savedTrade } from "./audit-editor-fixtures.js";

test("snapshot cancellation returns to its trade disclosure and invoking action", async ({ page, request }) => {
  await setup(page, request);
  await savedTrade(page);
  await page.getByText("Instrument snapshot and planning", { exact: true }).click();
  await page.getByRole("button", { name: "Correct snapshot", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Correct instrument snapshot", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit trade", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Correct snapshot", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Correct snapshot", exact: true })).toBeFocused();
});
