import { test, expect } from "@playwright/test";
import { setup } from "./fixtures.js";
test.use({ hasTouch: true });

async function checkLabels(form) {
  const labels = form.locator(".field label").filter({ visible: true });
  for (const label of await labels.all()) {
    const name = (await label.textContent()).trim();
    const hint = label.locator("..").getByRole("button", { name: `About ${name}`, exact: true });
    await expect(hint).toBeVisible();
    await expect(hint).toHaveAccessibleDescription(/\S/);
  }
}
for (const width of [1280, 375]) {
  test(`label help supports hover, keyboard and touch at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, request);
    await page.getByRole("button", { name: "Instruments", exact: true }).click();
    await page.getByRole("button", { name: "New instrument", exact: true }).click();
    const form = page.locator("form.editor-form");
    await checkLabels(form);
    await form.locator("label").filter({ hasText: /^Point value$/ }).hover();
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText("one full price point");
    await tooltip.hover();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tooltip).not.toBeVisible();
    await page.mouse.move(0, 0);
    const priceHelp = form.getByRole("button", { name: "About Price unit", exact: true });
    await priceHelp.focus();
    await expect(page.getByRole("tooltip")).toContainText("USD/share");
    await priceHelp.press("Escape");
    await expect(page.getByRole("tooltip")).not.toBeVisible();
    await priceHelp.tap();
    const target = await priceHelp.boundingBox();
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("tooltip")).toBeVisible();
    const bounds = await page.getByRole("tooltip").boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/instrument-tooltip-${width}.png`, fullPage: false });
    await priceHelp.press("Escape");
    await page.getByLabel("Preset", { exact: true }).selectOption("futures");
    await page.getByText("Contract details", { exact: true }).click();
    await checkLabels(form);
    await page.getByLabel("Instrument name", { exact: true }).fill("Tooltip future");
    await page.getByLabel("Symbol", { exact: true }).fill("HELP");
    await page.getByLabel("Price unit", { exact: true }).fill("points");
    await page.getByRole("button", { name: "Save instrument", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Instruments", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Journal", exact: true }).click();
    await page.getByRole("button", { name: "New trade", exact: true }).click();
    await checkLabels(form);
    const leg = page.getByRole("group", { name: "Leg 1", exact: true });
    await leg.getByText("Trade plan", { exact: true }).click();
    await leg.getByText("Position sizing", { exact: true }).click();
    await checkLabels(form);
    await expect(leg.getByLabel("Entry price", { exact: true })).toHaveAccessibleDescription("points");
    await leg.getByRole("button", { name: "About Risk budget", exact: true }).focus();
    await expect(page.getByRole("tooltip")).toContainText("account currency");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Add leg", exact: true }).click();
    await checkLabels(form);
    await page.getByRole("button", { name: "About Combined risk budget", exact: true }).click();
    await expect(page.getByRole("tooltip")).toContainText("manually");
    await page.keyboard.press("Escape");
    await leg.locator("label").filter({ hasText: /^Quantity$/ }).hover();
    await expect(page.getByRole("tooltip")).toContainText("Actual filled quantity");
    await page.screenshot({ path: `test-results/trade-tooltip-${width}.png`, fullPage: false });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

test("label tooltip matches dark theme at intermediate width", async ({ page, request }) => {
  await page.setViewportSize({ width: 996, height: 900 });
  await setup(page, request);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await page.getByRole("button", { name: "Save settings", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Save settings", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Instruments", exact: true }).click();
  await page.getByRole("button", { name: "New instrument", exact: true }).click();
  await page.locator("label").filter({ hasText: /^Preset$/ }).hover();
  await expect(page.getByRole("tooltip")).toContainText("Starting defaults");
  await page.screenshot({ path: "test-results/instrument-tooltip-dark-996.png" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).not.toBeVisible();
});
