import { test, expect } from "@playwright/test";
import { setup } from "./fixtures.js";
import { connectAdmin } from "../../scripts/database/admin.js";
import { metadata } from "../../scripts/database/schema.js";
// Global database state requires this project to run after ordinary browser coverage.
for (const width of [375, 800, 1280]) test(`maintenance preserves editor draft and reload recovery at ${width}px`, async ({ page, request }) => {
  const admin = connectAdmin("auto");
  try {
    await admin.db.doc("_system/database").set(metadata());
    await page.setViewportSize({ width, height: 900 });
    await setup(page, request);
    await page.getByRole("button", { name: "Accounts", exact: true }).click();
    await page.getByRole("button", { name: "New account", exact: true }).click();
    await page.getByLabel("Account name", { exact: true }).fill("Retained draft");
    await admin.db.doc("_system/database").set(metadata(1, "maintenance"));
    await page.getByRole("button", { name: "Save account", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("database maintenance");
    await expect(page.getByLabel("Account name", { exact: true })).toHaveValue("Retained draft");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: `test-results/database-draft-${width}.png`, fullPage: true });
    await admin.db.doc("_system/database").set(metadata());
    await page.getByRole("button", { name: "Save account", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Accounts", exact: true })).toBeVisible();
    await expect(page.getByText("Retained draft", { exact: true })).toBeVisible();
    await admin.db.doc("_system/database").set(metadata(1, "maintenance"));
    await page.reload();
    await expect(page.getByRole("heading", { name: "Journal unavailable" })).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("database maintenance");
    await page.screenshot({ path: `test-results/database-unavailable-${width}.png`, fullPage: true });
    await admin.db.doc("_system/database").set(metadata(2));
    await page.getByRole("button", { name: "Retry loading", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("schemas differ");
    await admin.db.doc("_system/database").set(metadata());
    const retry = page.getByRole("button", { name: "Retry loading", exact: true });
    await retry.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Journal", exact: true })).toBeVisible();
  } finally { await admin.db.doc("_system/database").set(metadata()); await admin.close(); }
});
