import { test, expect, setup } from "./fixtures.js";
import { openTradeDraft } from "./audit-editor-fixtures.js";

for (const fallback of [false, true]) {
  test(`rejected forward fragment preserves draft and subsequent history (${fallback ? "legacy fallback" : "native cursor"})`, async ({ page, request }) => {
    if (fallback) await page.addInitScript(() => Object.defineProperty(window, "navigation", { value: undefined, configurable: true }));
    await setup(page, request);
    await openTradeDraft(page);
    await page.getByRole("button", { name: "Create instrument", exact: true }).click();
    await page.getByLabel("Instrument name", { exact: true }).fill("Retained fragment draft");
    await page.getByLabel("Quantity increment", { exact: true }).fill("1e");
    await page.evaluate(() => {
      window.fragmentAuditSentinel = true;
      window.fragmentAuditInput = document.querySelector("input[name=name]");
    });
    const originKey = await page.evaluate(() => window.navigation?.currentEntry?.key);
    const originMarker = await page.evaluate(() => history.state.journalNavigation);
    const editorUrl = page.url();
    const fragmentDialog = page.waitForEvent("dialog");
    const fragment = page.evaluate(() => { location.hash = "#foreign-fragment"; });
    await (await fragmentDialog).dismiss();
    await fragment;
    await expect(page).toHaveURL(editorUrl);
    await expect(page.getByLabel("Instrument name", { exact: true })).toHaveValue("Retained fragment draft");
    expect(await page.evaluate(() => window.fragmentAuditInput === document.querySelector("input[name=name]"))).toBe(true);
    if (fallback) {
      const repaired = await page.evaluate(() => history.state.journalNavigation);
      expect(repaired.key).not.toBe(originMarker.key);
      expect(repaired.epoch).not.toBe(originMarker.epoch);
    } else {
      await expect.poll(() => page.evaluate(() => window.navigation.currentEntry.key)).toBe(originKey);
    }
    for (const direction of ["back", "forward"]) {
      const traversalDialog = page.waitForEvent("dialog");
      await page.evaluate((direction) => history[direction](), direction);
      expect((await traversalDialog).type()).toBe("confirm");
      await (await traversalDialog).dismiss();
      await expect(page).toHaveURL(editorUrl);
      await expect(page.getByLabel("Quantity increment", { exact: true })).toHaveValue("1e");
      expect(await page.evaluate(() => window.fragmentAuditInput === document.querySelector("input[name=name]"))).toBe(true);
      expect(await page.evaluate(() => window.fragmentAuditSentinel)).toBe(true);
      if (!fallback) await expect.poll(() => page.evaluate(() => window.navigation.currentEntry.key)).toBe(originKey);
    }
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
    await expect(page.getByRole("heading", { name: "New trade", exact: true })).toBeVisible();
    await expect(page.getByLabel("Entry rationale", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Instrument name", { exact: true })).toHaveCount(0);
    await page.evaluate(() => history.forward());
    await expect(page.getByRole("heading", { name: "Journal", exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.fragmentAuditSentinel)).toBe(true);
  });
}

test("foreign route fragment rejection retains raw parent plan and child cancel protection", async ({ page, request }) => {
  await setup(page, request);
  await openTradeDraft(page);
  const leg = page.getByRole("group", { name: "Leg 1", exact: true });
  await leg.getByText("Trade plan", { exact: true }).click();
  await leg.getByLabel("Entry price", { exact: true }).fill("1e");
  await leg.getByText("Position sizing", { exact: true }).click();
  await leg.getByLabel("Risk budget", { exact: true }).fill("500");
  await page.getByRole("button", { name: "Create instrument", exact: true }).click();
  const originKey = await page.evaluate(() => window.navigation.currentEntry.key);
  const dialog = page.waitForEvent("dialog");
  const fragment = page.evaluate(() => { location.hash = "#journal"; });
  await (await dialog).dismiss();
  await fragment;
  await expect.poll(() => page.evaluate(() => window.navigation.currentEntry.key)).toBe(originKey);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(leg.getByLabel("Entry price", { exact: true })).toHaveValue("1e");
  await expect(leg.getByLabel("Risk budget", { exact: true })).toBeVisible();
  await expect(leg.getByLabel("Risk budget", { exact: true })).toHaveValue("500");
  const leave = page.waitForEvent("dialog");
  const navigation = page.getByRole("button", { name: "Journal", exact: true }).click();
  await (await leave).dismiss();
  await navigation;
  await expect(leg.getByLabel("Entry price", { exact: true })).toHaveValue("1e");
});

test("queued classic Back traversals preserve the editor and release its guard", async ({ page, request }) => {
  await page.addInitScript(() => Object.defineProperty(window, "navigation", { value: undefined, configurable: true }));
  await setup(page, request);
  await openTradeDraft(page);
  await page.getByRole("button", { name: "Create instrument", exact: true }).click();
  await page.getByLabel("Instrument name", { exact: true }).fill("Queued history draft");
  await page.evaluate(() => { window.queuedHistoryInput = document.querySelector("input[name=name]"); });
  const url = page.url();
  const origin = await page.evaluate(() => history.state.journalNavigation);
  const dialogs = [];
  page.on("dialog", (dialog) => dialogs.push(dialog.type()));
  const dialog = page.waitForEvent("dialog");
  await page.evaluate(() => { history.back(); history.back(); });
  await (await dialog).dismiss();
  await expect(page).toHaveURL(url);
  await expect.poll(() => page.evaluate((origin) => {
    const marker = history.state.journalNavigation;
    return marker.key === origin.key || (marker.epoch !== origin.epoch && marker.index === 0);
  }, origin)).toBe(true);
  expect(dialogs).toEqual(["confirm"]);
  await expect(page.getByLabel("Instrument name", { exact: true })).toHaveValue("Queued history draft");
  expect(await page.evaluate(() => window.queuedHistoryInput === document.querySelector("input[name=name]"))).toBe(true);
  const leave = page.waitForEvent("dialog");
  const cancel = page.getByRole("button", { name: "Cancel", exact: true }).click();
  await (await leave).accept();
  await cancel;
  await expect(page.getByRole("heading", { name: "New trade", exact: true })).toBeVisible();
});
