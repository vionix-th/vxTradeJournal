import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import { setup } from "./fixtures.js";

for (const width of [375, 996, 1280]) {
  test(`agent skill download before and after sign-in at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const link = page.getByRole("link", { name: "Download agent skill (ZIP)", exact: true });
    await expect(link).toBeVisible();
    const downloadEvent = page.waitForEvent("download");
    await link.click();
    const download = await downloadEvent;
    const entries = unzipSync(await readFile(await download.path()));
    const manifest = JSON.parse(strFromU8(entries["vx-trade-journal/package.json"]));
    expect(download.suggestedFilename()).toBe(`vx-trade-journal-${manifest.version}.zip`);
    expect(entries["vx-trade-journal/SKILL.md"]).toBeTruthy();
    expect(entries["vx-trade-journal/scripts/vxjournal.mjs"]).toBeTruthy();
    expect(entries["vx-trade-journal/package-lock.json"]).toBeTruthy();
    await page.screenshot({ path: `test-results/skill-download-auth-${width}.png`, fullPage: true });
    await setup(page, request);
    if (width <= 700) await page.locator(".session-details > summary").click();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("download", download.suggestedFilename());
    await link.focus();
    await expect(link).toBeFocused();
    const keyboardDownload = page.waitForEvent("download");
    await page.keyboard.press("Enter");
    expect((await keyboardDownload).suggestedFilename()).toBe(download.suggestedFilename());
    await expect(page.getByRole("heading", { name: "Journal", exact: true })).toBeVisible();
    const bounds = await link.boundingBox();
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: `test-results/skill-download-journal-${width}.png`, fullPage: true });
  });
}
