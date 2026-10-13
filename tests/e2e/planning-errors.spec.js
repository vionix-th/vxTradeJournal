import { test, expect, setup } from "./fixtures.js";
import { openTradeDraft } from "./audit-editor-fixtures.js";

test("invalid combined budget stays reachable after removing the second leg", async ({ page, request }) => {
  await setup(page, request);
  await openTradeDraft(page);
  await page.getByRole("button", { name: "Add leg", exact: true }).click();
  const budget = page.getByLabel("Combined risk budget", { exact: true });
  await budget.fill("-1");
  await page.getByRole("group", { name: "Leg 2", exact: true }).getByRole("button", { name: "Remove leg", exact: true }).click();
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await expect(budget).toBeVisible();
  await expect(budget).toHaveValue("-1");
  await expect(budget).toHaveAttribute("aria-invalid", "true");
  await expect(budget).toHaveAccessibleDescription(/Combined risk budget must be positive/);
  await budget.fill("500");
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit trade", exact: true })).toBeVisible();
});

test("invalid per-leg budget stays reachable when automatic sizing becomes inapplicable", async ({ page, request }) => {
  await setup(page, request);
  await openTradeDraft(page);
  const first = page.getByRole("group", { name: "Leg 1", exact: true });
  await first.getByText("Trade plan", { exact: true }).click();
  await first.getByText("Position sizing", { exact: true }).click();
  const budget = first.getByLabel("Risk budget", { exact: true });
  await budget.fill("-1");
  await page.getByRole("button", { name: "Add leg", exact: true }).click();
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await expect(budget).toBeVisible();
  await expect(budget).toHaveValue("-1");
  await expect(budget).toHaveAttribute("aria-invalid", "true");
  await expect(budget).toHaveAccessibleDescription(/Risk budget must be positive/);
  await budget.fill("500");
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit trade", exact: true })).toBeVisible();
});
