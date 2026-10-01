import { test, expect } from "@playwright/test";
import { setup } from "./fixtures.js";

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
    await page.screenshot({ path: `test-results/catalogue-aligned-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Strategies", exact: true }).click();
    await page.getByRole("button", { name: "New strategy", exact: true }).click();
    await page.getByLabel("Strategy name", { exact: true }).fill("Breakout");
    await page.getByRole("button", { name: "Save strategy", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Breakout", exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/strategy-aligned-${width}.png`, fullPage: true });
  });
}
