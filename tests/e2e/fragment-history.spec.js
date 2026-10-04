import { test, expect } from "@playwright/test";
import { setup } from "./fixtures.js";
import { openTradeDraft } from "./audit-editor-fixtures.js";

for (const fallback of [false, true]) {
  test(`rejected forward fragment preserves draft and subsequent history (${fallback ? "legacy fallback" : "native cursor"})`, async ({ page, request }) => {
    if (fallback) await page.addInitScript(() => Object.defineProperty(window, "navigation", { value: undefined, configurable: true }));
    await setup(page, request);
    await openTradeDraft(page);
    await page.getByRole("button", { name: "Create instrument", exact: true }).click();
    await page.getByLabel("Instrument name", { exact: true }).fill("Retained fragment draft");
    await page.evaluate(() => {
      window.fragmentAuditSentinel = true;
      window.fragmentAuditInput = document.querySelector("input[name=name]");
    });
    const editorUrl = page.url();
    const fragmentDialog = page.waitForEvent("dialog");
    const fragment = page.evaluate(() => { location.hash = "#foreign-fragment"; });
    await (await fragmentDialog).dismiss();
    await fragment;
    await expect(page).toHaveURL(editorUrl);
    await expect(page.getByLabel("Instrument name", { exact: true })).toHaveValue("Retained fragment draft");
    expect(await page.evaluate(() => window.fragmentAuditInput === document.querySelector("input[name=name]"))).toBe(true);
    const rejected = page.waitForEvent("dialog");
    const leave = page.getByRole("button", { name: "Journal", exact: true }).click();
    await (await rejected).dismiss();
    await leave;
    await expect(page.getByLabel("Instrument name", { exact: true })).toHaveValue("Retained fragment draft");
    const accepted = page.waitForEvent("dialog");
    const finish = page.getByRole("button", { name: "Journal", exact: true }).click();
    await (await accepted).accept();
    await finish;
    await expect(page.getByRole("heading", { name: "Journal", exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.fragmentAuditSentinel)).toBe(true);
    await page.evaluate(() => history.back());
    await expect(page.getByRole("heading", { name: "New instrument", exact: true })).toBeVisible();
    await page.evaluate(() => history.forward());
    await expect(page.getByRole("heading", { name: "Journal", exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.fragmentAuditSentinel)).toBe(true);
  });
}
