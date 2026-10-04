import { test, expect } from "@playwright/test";
import { setup } from "./fixtures.js";

test("snapshot currency correction clears obsolete result and planning conversion", async ({ page, request }) => {
  await setup(page, request);
  await page.getByRole("button", { name: "Instruments", exact: true }).click();
  await page.getByRole("button", { name: "New instrument", exact: true }).click();
  await page.getByLabel("Instrument name", { exact: true }).fill("FX equity");
  await page.getByLabel("Symbol", { exact: true }).fill("FX");
  await page.getByRole("button", { name: "Save instrument", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Instruments", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await page.getByRole("button", { name: "New trade", exact: true }).click();
  const leg = page.getByRole("group", { name: "Leg 1", exact: true });
  await leg.locator("summary").filter({ hasText: /^Trade plan$/ }).click();
  await leg.getByLabel("Entry price", { exact: true }).fill("10");
  await leg.getByLabel("Stop price", { exact: true }).fill("8");
  await leg.locator("summary").filter({ hasText: /^Position sizing$/ }).click();
  await leg.getByLabel("Risk budget", { exact: true }).fill("500");
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit trade", exact: true })).toBeVisible();
  for (const [index, kind] of ["entry", "exit"].entries()) {
    await page.getByRole("button", { name: "Add execution", exact: true }).click();
    await page.getByLabel("Record type", { exact: true }).selectOption(kind);
    await page.getByLabel("Quantity", { exact: true }).fill("2");
    await page.getByLabel("Price", { exact: true }).fill(kind === "entry" ? "10" : "12");
    await page.getByLabel("Fees", { exact: true }).fill(kind === "entry" ? "1" : "0");
    await page.getByLabel("Timestamp (UTC)", { exact: true }).fill(`2026-01-0${index + 1}T00:00`);
    await page.getByRole("button", { name: "Save execution", exact: true }).click();
    await expect(page.getByRole("button", { name: "Edit trade", exact: true })).toBeVisible();
  }
  await expect(page.getByTestId("trade-result")).toContainText("3.00 USD");
  await page.getByText("Instrument snapshot and planning", { exact: true }).click();
  await page.getByRole("button", { name: "Correct snapshot", exact: true }).click();
  await page.getByLabel("P&L currency", { exact: true }).fill("EUR");
  await page.getByRole("button", { name: "Preview correction", exact: true }).click();
  await expect(page.getByText(/Before: .*3.00 USD. After: Unknown \/ incomplete USD/)).toBeVisible();
  await page.getByRole("button", { name: "Save instrument", exact: true }).click();
  await expect(page.getByTestId("trade-result")).toContainText("Unknown / incomplete USD");
  await page.getByRole("button", { name: "Edit execution 2", exact: true }).click();
  await expect(page.getByLabel("Result conversion rate", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Fee currency", { exact: true })).toHaveValue("USD");
  await expect(page.getByLabel("Fee conversion rate", { exact: true })).toHaveValue("1");
  await page.getByLabel("Result conversion rate", { exact: true }).fill("0.8");
  await page.getByRole("button", { name: "Save execution", exact: true }).click();
  await expect(page.getByTestId("trade-result")).toContainText("2.20 USD");
  await page.getByRole("button", { name: "Edit trade", exact: true }).click();
  if (!(await leg.getByLabel("Conversion rate", { exact: true }).isVisible()))
    await leg.locator("summary").filter({ hasText: /^Position sizing$/ }).click();
  await expect(leg.getByLabel("Conversion rate", { exact: true })).toHaveValue("");
  await expect(leg.getByRole("status")).toContainText("conversion rate");
  await page.screenshot({ path: "test-results/audit-fx-correction.png", fullPage: true });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Instruments", exact: true }).click();
  await page.getByRole("button", { name: "Edit instrument", exact: true }).click();
  await expect(page.getByLabel("P&L currency", { exact: true })).toHaveValue("USD");
});

test("instrument editor rejects nonexistent expiry without discarding entered fields", async ({ page, request }) => {
  await setup(page, request);
  await page.getByRole("button", { name: "Instruments", exact: true }).click();
  await page.getByRole("button", { name: "New instrument", exact: true }).click();
  await page.getByLabel("Instrument name", { exact: true }).fill("Expiry audit");
  await page.getByLabel("Symbol", { exact: true }).fill("EXPA");
  await page.getByLabel("Preset", { exact: true }).selectOption("options");
  // Browser date inputs reject some malformed strings themselves; inject the supplied
  // external value into FormData to exercise the shared normalization boundary.
  await page.evaluate(() => {
    document.querySelector("form").addEventListener("formdata", (event) => event.formData.set("expiry", "2026-02-30"));
  });
  await page.getByRole("button", { name: "Save instrument", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/Expiry/);
  await expect(page.getByLabel("Instrument name", { exact: true })).toHaveValue("Expiry audit");
});
