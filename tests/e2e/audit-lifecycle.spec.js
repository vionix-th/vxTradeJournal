import { test, expect } from "@playwright/test";
import { setup } from "./fixtures.js";

async function instrument(page, name = "Acme", unit = "USD/share") {
  await page.getByRole("button", { name: "Instruments", exact: true }).click();
  await page.getByRole("button", { name: "New instrument", exact: true }).click();
  await page.getByLabel("Instrument name", { exact: true }).fill(name);
  await page.getByLabel("Symbol", { exact: true }).fill(name.toUpperCase());
  await page.getByLabel("Price unit", { exact: true }).fill(unit);
  await page.getByRole("button", { name: "Save instrument", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
const leg = (page) => page.getByRole("group", { name: "Leg 1", exact: true });

async function draft(page) {
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await page.getByRole("button", { name: "New trade", exact: true }).click();
  await page.getByLabel("Entry rationale", { exact: true }).fill("Preserve this rationale");
  await leg(page).getByText("Trade plan", { exact: true }).click();
  await leg(page).getByLabel("Entry price", { exact: true }).fill("10");
  await leg(page).getByLabel("Stop price", { exact: true }).fill("8");
  await leg(page).getByText("Position sizing", { exact: true }).click();
  await leg(page).getByLabel("Risk budget", { exact: true }).fill("500");
}
async function expectDraft(page) {
  await expect(page.getByLabel("Entry rationale", { exact: true })).toHaveValue("Preserve this rationale");
  await expect(leg(page).getByLabel("Entry price", { exact: true })).toHaveValue("10");
  await expect(leg(page).getByLabel("Stop price", { exact: true })).toHaveValue("8");
  await expect(leg(page).getByLabel("Risk budget", { exact: true })).toBeVisible();
  await expect(leg(page).getByLabel("Risk budget", { exact: true })).toHaveValue("500");
}
async function rejectDeparture(page, action, type = "confirm") {
  const pending = page.waitForEvent("dialog");
  const running = action();
  const dialog = await pending;
  expect(dialog.type()).toBe(type);
  await dialog.dismiss();
  await running;
}

test("pending save locks captured draft and navigation, then recovers after failure", async ({ page, request }) => {
  await setup(page, request);
  await page.getByRole("button", { name: "Instruments", exact: true }).click();
  await page.getByRole("button", { name: "New instrument", exact: true }).click();
  await page.getByLabel("Instrument name", { exact: true }).fill("Captured draft");
  await page.getByLabel("Symbol", { exact: true }).fill("CAPTURED");
  await page.evaluate(async () => {
    const { Repository } = await import("/src/persistence/repository.js");
    const original = Repository.prototype.saveEntity;
    Repository.prototype.saveEntity = async function (...args) {
      Repository.prototype.saveEntity = original;
      window.auditCapturedName = args[1].name;
      await new Promise((_resolve, reject) => { window.auditRejectSave = () => reject(new Error("Synthetic save failure")); });
    };
  });
  await page.getByRole("button", { name: "Save instrument", exact: true }).click();
  expect(await page.evaluate(() => window.auditCapturedName)).toBe("Captured draft");
  await expect(page.getByLabel("Instrument name", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Journal", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  const savingUrl = page.url();
  await page.evaluate(() => history.back());
  await expect(page.getByRole("heading", { name: "New instrument", exact: true })).toBeVisible();
  await expect(page).toHaveURL(savingUrl);
  await page.evaluate(() => { location.hash = "#foreign-save-fragment"; });
  await expect(page).toHaveURL(savingUrl);
  await expect(page.getByLabel("Instrument name", { exact: true })).toBeDisabled();
  await page.evaluate(() => window.auditRejectSave());
  await expect(page.getByRole("alert")).toContainText("Synthetic save failure");
  await expect(page.getByLabel("Instrument name", { exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Journal", exact: true })).toBeEnabled();
  await page.getByLabel("Instrument name", { exact: true }).fill("Recovered draft");
  await page.getByRole("button", { name: "Save instrument", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recovered draft", exact: true })).toBeVisible();
});

test("inline instrument editor protects parent draft through sidebar, reload, cancel and child save", async ({ page, request }) => {
  await setup(page, request);
  await instrument(page);
  await draft(page);
  await page.getByRole("button", { name: "Create instrument", exact: true }).click();
  await rejectDeparture(page, () => page.getByRole("button", { name: "Journal", exact: true }).click());
  await expect(page.getByRole("heading", { name: "New instrument", exact: true })).toBeVisible();
  await rejectDeparture(page, () => page.evaluate(() => location.reload()), "beforeunload");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expectDraft(page);
  await expect(page.getByRole("button", { name: "Create instrument", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Create instrument", exact: true }).click();
  await page.getByLabel("Instrument name", { exact: true }).fill("Inline saved");
  await page.getByLabel("Symbol", { exact: true }).fill("INLINE");
  await page.getByRole("button", { name: "Save instrument", exact: true }).click();
  await expectDraft(page);
  await rejectDeparture(page, () => page.getByRole("button", { name: "Journal", exact: true }).click());
  await expectDraft(page);
});

test("browser history owns direct editors, rejects dirty departure and restores cancel focus", async ({ page, request }) => {
  await setup(page, request);
  await instrument(page);
  await page.getByRole("button", { name: "Edit instrument", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Edit instrument", exact: true })).toBeVisible();
  await page.getByLabel("Instrument name", { exact: true }).fill("Unsaved rename");
  const editorUrl = page.url();
  await rejectDeparture(page, () => page.evaluate(() => history.back()));
  await expect(page).toHaveURL(editorUrl);
  await expect(page.getByLabel("Instrument name", { exact: true })).toHaveValue("Unsaved rename");
  const pending = page.waitForEvent("dialog");
  const cancel = page.getByRole("button", { name: "Cancel", exact: true }).click();
  await (await pending).accept();
  await cancel;
  await expect(page.getByRole("heading", { name: "Instruments", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit instrument", exact: true })).toBeFocused();
  await page.evaluate(() => history.back());
  await expect(page.getByRole("heading", { name: "Edit instrument", exact: true })).toBeVisible();
  await expect(page.getByLabel("Instrument name", { exact: true })).toHaveValue("Acme");
  await page.evaluate(() => history.forward());
  await expect(page.getByRole("heading", { name: "Instruments", exact: true })).toBeVisible();
});

test("saving trade retires suspended draft from browser history", async ({ page, request }) => {
  await setup(page, request);
  await instrument(page);
  await draft(page);
  await page.getByRole("button", { name: "Create instrument", exact: true }).click();
  await page.getByLabel("Instrument name", { exact: true }).fill("Inline catalogue addition");
  await page.getByLabel("Symbol", { exact: true }).fill("INLINE");
  await page.getByRole("button", { name: "Save instrument", exact: true }).click();
  await expectDraft(page);
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit trade", exact: true })).toBeVisible();
  await page.evaluate(() => new Promise((resolve) => {
    window.addEventListener("popstate", () => resolve(), { once: true });
    history.back();
  }));
  await expect(page.getByRole("button", { name: "Edit trade", exact: true })).toBeVisible();
  await expect(page.getByText("Preserve this rationale", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "New trade", exact: true })).not.toBeVisible();
});

test("execution prices describe historical quote units and missing unit guidance", async ({ page, request }) => {
  await setup(page, request);
  await instrument(page);
  await draft(page);
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add execution", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Instruments", exact: true }).click();
  await page.getByRole("button", { name: "Edit instrument", exact: true }).click();
  await page.getByLabel("Price unit", { exact: true }).fill("Changed unit");
  await page.getByRole("button", { name: "Save instrument", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Instruments", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await page.getByRole("button", { name: "Open trade", exact: true }).filter({ visible: true }).click();
  await page.getByRole("button", { name: "Add execution", exact: true }).click();
  await expect(page.getByLabel("Price", { exact: true })).toHaveAccessibleDescription(/^USD\/share Price increment/);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await instrument(page, "No unit", "");
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await page.getByRole("button", { name: "New trade", exact: true }).click();
  await leg(page).getByLabel("Instrument", { exact: true }).selectOption({ label: "No unit" });
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add execution", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add execution", exact: true }).click();
  await expect(page.getByLabel("Price", { exact: true })).toHaveAccessibleDescription(/^Quote unit not configured\. Price increment/);
});

for (const width of [375, 800, 1280]) {
  test(`journal preserves strategy and actions at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, request);
    await instrument(page);
    await page.getByRole("button", { name: "Strategies", exact: true }).click();
    await page.getByRole("button", { name: "New strategy", exact: true }).click();
    await page.getByLabel("Strategy name", { exact: true }).fill("Long descriptive breakout strategy");
    await page.getByRole("button", { name: "Save strategy", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Long descriptive breakout strategy", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Journal", exact: true }).click();
    await page.getByRole("button", { name: "New trade", exact: true }).click();
    await page.getByLabel("Strategy", { exact: true }).selectOption({ label: "Long descriptive breakout strategy" });
    await page.getByRole("button", { name: "Save trade", exact: true }).click();
    await expect(page.getByRole("button", { name: "Add execution", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Journal", exact: true }).click();
    await expect(page.getByText("Long descriptive breakout strategy", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open trade", exact: true }).filter({ visible: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: `test-results/audit-journal-${width}.png`, fullPage: true });
  });
}
