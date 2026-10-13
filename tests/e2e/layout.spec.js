import { readFile } from "node:fs/promises";
import { test, expect, setup } from "./fixtures.js";

for (const width of [320, 910, 1280]) {
  test(`settings journal data actions at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, request);
    const settings = page.getByRole("button", { name: "Settings", exact: true });
    if (!await settings.isVisible()) await page.getByRole("button", { name: "More", exact: true }).click();
    await settings.click();
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Journal data", exact: true })).toBeVisible();
    const actions = page.locator(".journal-data-actions");
    const exportButton = actions.getByRole("button", { name: "Export JSON", exact: true });
    const importButton = actions.getByRole("button", { name: "Import journal and recovery", exact: true });
    const saveButton = page.getByRole("button", { name: "Save settings", exact: true });
    await expect(actions.getByRole("button")).toHaveCount(2);
    await expect(exportButton).toBeVisible();
    await expect(importButton).toBeVisible();
    const layout = await actions.evaluate((group) => {
      const bounds = (node) => {
        const { top, bottom, left, right, height } = node.getBoundingClientRect();
        return { top, bottom, left, right, height };
      };
      const buttons = [...group.querySelectorAll("button")].map((node) => {
        const style = getComputedStyle(node);
        return {
          bounds: bounds(node),
          style: { background: style.backgroundColor, borderColor: style.borderColor, borderStyle: style.borderStyle, borderWidth: style.borderWidth },
        };
      });
      return { group: bounds(group), buttons };
    });
    const [exportLayout, importLayout] = layout.buttons;
    expect(exportLayout.style).toEqual(importLayout.style);
    expect(exportLayout.style.background).not.toBe(await saveButton.evaluate((node) => getComputedStyle(node).backgroundColor));
    expect(exportLayout.bounds.height).toBeGreaterThanOrEqual(44);
    expect(importLayout.bounds.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(exportLayout.bounds.height - importLayout.bounds.height)).toBeLessThanOrEqual(1);
    if (width > 320) {
      expect(Math.abs(exportLayout.bounds.top - importLayout.bounds.top)).toBeLessThanOrEqual(1);
      expect(importLayout.bounds.left).toBeGreaterThanOrEqual(exportLayout.bounds.right);
    } else {
      expect(importLayout.bounds.top).toBeGreaterThanOrEqual(exportLayout.bounds.bottom);
    }
    expect(Math.abs(importLayout.bounds.right - layout.group.right)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`test-results/settings-journal-data-${width}.png`.split("/").pop()), fullPage: true });

    await saveButton.focus();
    await page.keyboard.press("Tab");
    await expect(exportButton).toBeFocused();
    const download = page.waitForEvent("download");
    await page.keyboard.press("Enter");
    const file = JSON.parse(await readFile(await (await download).path(), "utf8"));
    expect(file.formatVersion).toBe(1);
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#settings$/);
    await page.keyboard.press("Tab");
    await expect(importButton).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Import journal", exact: true })).toBeVisible();
    await expect(page.getByLabel("Journal JSON file", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#importEditor$/);
  });
}

for (const width of [1280, 375]) {
  test(`catalogue spacing and section alignment at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, request);
    await page.getByRole("button", { name: "Instruments", exact: true }).click();
    for (const [name, symbol] of [
      ["Acme equity", "ACME"],
      ["An instrument with a longer descriptive name for layout coverage", "LONG"],
      ["Third instrument", "THIRD"],
    ]) {
      await page.getByRole("button", { name: "New instrument", exact: true }).click();
      await page.getByLabel("Instrument name", { exact: true }).fill(name);
      await page.getByLabel("Symbol", { exact: true }).fill(symbol);
      await page.getByLabel("Price unit", { exact: true }).fill("USD/share");
      await page.getByRole("button", { name: "Save instrument", exact: true }).click();
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    const cards = page.locator(".grid > section");
    await expect(cards).toHaveCount(3);
    const boxes = await cards.evaluateAll((elements) => elements.map((e) => {
      const r = e.getBoundingClientRect();
      const button = e.querySelector("button").getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, actionTop: button.top, contentTop: e.querySelector("p").getBoundingClientRect().top };
    }));
    if (width > 700) {
      expect(Math.abs(boxes[0].top - boxes[1].top), "cards in one row share a top edge").toBeLessThanOrEqual(1);
      expect(Math.abs(boxes[0].bottom - boxes[1].bottom), "cards in one row share a bottom edge").toBeLessThanOrEqual(1);
      expect(Math.abs(boxes[0].actionTop - boxes[1].actionTop), "edit actions align despite different title lengths").toBeLessThanOrEqual(1);
      expect(Math.abs(boxes[0].contentTop - boxes[1].contentTop), "metadata aligns even when one title wraps").toBeLessThanOrEqual(1);
      expect(boxes[2].top - boxes[0].bottom, "rows have intentional separation").toBeGreaterThanOrEqual(16);
    } else {
      expect(boxes[1].top - boxes[0].bottom).toBeGreaterThanOrEqual(16);
      expect(boxes[2].left).toBeCloseTo(boxes[0].left, 0);
    }
    const searchGap = await page.locator(".grid").evaluate((grid) => grid.getBoundingClientRect().top - grid.previousElementSibling.getBoundingClientRect().bottom);
    expect(searchGap, "search help and cards have intentional separation").toBeGreaterThanOrEqual(16);
    const widthCheck = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(widthCheck.scroll).toBeLessThanOrEqual(widthCheck.width);
    await page.screenshot({ path: test.info().outputPath(`test-results/catalogue-aligned-${width}.png`.split("/").pop()), fullPage: true });
    await page.getByRole("button", { name: "Strategies", exact: true }).click();
    await page.getByRole("button", { name: "New strategy", exact: true }).click();
    await page.getByLabel("Strategy name", { exact: true }).fill("Breakout");
    await page.getByRole("button", { name: "Save strategy", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Breakout", exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`test-results/strategy-aligned-${width}.png`.split("/").pop()), fullPage: true });
  });
}
