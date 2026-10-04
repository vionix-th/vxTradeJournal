import { test, expect } from "@playwright/test";
import { setup } from "./fixtures.js";
import { openTradeDraft } from "./audit-editor-fixtures.js";

async function failRefresh(page, method) {
  await page.evaluate(async (method) => {
    const { Repository } = await import("/src/persistence/repository.js");
    const write = Repository.prototype[method], load = Repository.prototype.load;
    window.recoveryWrites = 0;
    window.recoveryReads = 0;
    let failures = 0;
    Repository.prototype[method] = async function (...args) {
      const saved = await write.apply(this, args);
      window.recoveryWrites++;
      failures = 2;
      return saved;
    };
    Repository.prototype.load = async function (...args) {
      window.recoveryReads++;
      if (failures-- > 0) throw new Error("Synthetic refresh failure after confirmed write. Saved records remain committed; refresh the private journal before continuing with another operation.");
      return load.apply(this, args);
    };
  }, method);
}

async function expectRecovery(page) {
  await expect(page.getByRole("heading", { name: "Saved; refresh failed", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Save (instrument|trade)$/ })).toHaveCount(0);
  expect(await page.evaluate(() => window.recoveryWrites)).toBe(1);
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Saved; refresh failed", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retry refresh", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.recoveryReads)).toBe(2);
  await expect(page.getByRole("heading", { name: "Saved; refresh failed", exact: true })).toBeVisible();
}

for (const width of [375, 800, 1280]) test(`confirmed catalogue save retries only refresh at ${width}px`, async ({ page, request }) => {
  await page.setViewportSize({ width, height: 900 });
  await setup(page, request);
  await page.getByRole("button", { name: "Instruments", exact: true }).click();
  await page.getByRole("button", { name: "New instrument", exact: true }).click();
  await page.getByLabel("Instrument name", { exact: true }).fill("Confirmed instrument with a long descriptive name");
  await page.getByLabel("Symbol", { exact: true }).fill("CONFIRMED");
  await failRefresh(page, "saveEntity");
  await page.getByRole("button", { name: "Save instrument", exact: true }).click();
  await expectRecovery(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: `test-results/final-recovery-${width}.png`, fullPage: true });
  await page.getByRole("button", { name: "Retry refresh", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Confirmed instrument with a long descriptive name", exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.recoveryWrites)).toBe(1);
});

test("confirmed trade save survives failed refresh without another write", async ({ page, request }) => {
  await setup(page, request);
  await openTradeDraft(page);
  await page.getByLabel("Entry rationale", { exact: true }).fill("Confirmed rationale");
  await failRefresh(page, "saveTrade");
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await expectRecovery(page);
  await page.getByRole("button", { name: "Retry refresh", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit trade", exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.recoveryWrites)).toBe(1);
});

test("confirmed nested save refresh returns to its retained parent once", async ({ page, request }) => {
  await setup(page, request);
  await openTradeDraft(page);
  await page.getByLabel("Entry rationale", { exact: true }).fill("Parent raw draft");
  await page.getByRole("button", { name: "Create instrument", exact: true }).click();
  await page.getByLabel("Instrument name", { exact: true }).fill("Confirmed child");
  await page.getByLabel("Symbol", { exact: true }).fill("CHILD");
  await failRefresh(page, "saveEntity");
  await page.getByRole("button", { name: "Save instrument", exact: true }).click();
  await expectRecovery(page);
  await page.getByRole("button", { name: "Retry refresh", exact: true }).click();
  await expect(page.getByLabel("Entry rationale", { exact: true })).toHaveValue("Parent raw draft");
  expect(await page.evaluate(() => window.recoveryWrites)).toBe(1);
  await expect(page.getByRole("button", { name: "Create instrument", exact: true })).toBeFocused();
});

test("sign-out invalidates an in-flight confirmed-save refresh completion", async ({ page, request }) => {
  await setup(page, request);
  await openTradeDraft(page);
  await failRefresh(page, "saveTrade");
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await expectRecovery(page);
  await page.evaluate(async () => {
    const { Repository } = await import("/src/persistence/repository.js");
    const original = Repository.prototype.load;
    Repository.prototype.load = async function (...args) {
      const data = await original.apply(this, args);
      await new Promise((resolve) => { window.finishStaleRefresh = resolve; });
      return data;
    };
  });
  await page.getByRole("button", { name: "Retry refresh", exact: true }).click();
  await expect.poll(() => page.evaluate(() => typeof window.finishStaleRefresh)).toBe("function");
  await page.evaluate(async () => {
    const { auth } = await import("/src/persistence/firebase.js");
    await auth.signOut();
  });
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await page.evaluate(() => window.finishStaleRefresh());
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit trade", exact: true })).toHaveCount(0);
});

for (const accept of [false, true]) test(`recovery Sign out ${accept ? "accepts" : "rejects"} discard of a suspended parent`, async ({ page, request }) => {
  await setup(page, request);
  await openTradeDraft(page);
  await page.getByLabel("Entry rationale", { exact: true }).fill("Unsaved suspended rationale");
  await page.getByRole("button", { name: "Create instrument", exact: true }).click();
  await page.getByLabel("Instrument name", { exact: true }).fill("Saved child before sign-out");
  await page.getByLabel("Symbol", { exact: true }).fill("SIGNOUT");
  await failRefresh(page, "saveEntity");
  await page.getByRole("button", { name: "Save instrument", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Saved; refresh failed", exact: true })).toBeVisible();
  const pending = page.waitForEvent("dialog");
  const signingOut = page.getByRole("main").getByRole("button", { name: "Sign out", exact: true }).click();
  const dialog = await pending;
  expect(dialog.message()).toContain("Unsaved changes will be discarded");
  if (accept) await dialog.accept(); else await dialog.dismiss();
  await signingOut;
  if (accept) await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  else {
    await expect(page.getByRole("heading", { name: "Saved; refresh failed", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Retry refresh", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.recoveryReads)).toBe(2);
    await page.getByRole("button", { name: "Retry refresh", exact: true }).click();
    await expect(page.getByLabel("Entry rationale", { exact: true })).toHaveValue("Unsaved suspended rationale");
  }
  expect(await page.evaluate(() => window.recoveryWrites)).toBe(1);
});
