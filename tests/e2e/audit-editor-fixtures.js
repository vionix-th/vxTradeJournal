import { expect } from "@playwright/test";

export async function openTradeDraft(page) {
  await page.getByRole("button", { name: "Instruments", exact: true }).click();
  await page.getByRole("button", { name: "New instrument", exact: true }).click();
  await page.getByLabel("Instrument name", { exact: true }).fill("Audit instrument");
  await page.getByLabel("Symbol", { exact: true }).fill("AUDIT");
  await page.getByRole("button", { name: "Save instrument", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Audit instrument", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await page.getByRole("button", { name: "New trade", exact: true }).click();
}
export async function savedTrade(page) {
  await openTradeDraft(page);
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit trade", exact: true })).toBeVisible();
}
