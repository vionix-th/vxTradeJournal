import { test, expect } from "@playwright/test";
import { setup } from "./fixtures.js";

test("a retained trade draft completes one write after inline reconstruction and refresh recovery", async ({ page, request }) => {
  await setup(page, request);
  await page.getByRole("button", { name: "Instruments", exact: true }).click();
  await page.getByRole("button", { name: "New instrument", exact: true }).click();
  await page.getByLabel("Instrument name", { exact: true }).fill("Session equity");
  await page.getByLabel("Symbol", { exact: true }).fill("SESSION");
  await page.getByRole("button", { name: "Save instrument", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Instruments", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await page.getByRole("button", { name: "New trade", exact: true }).click();
  await page.getByLabel("Entry rationale", { exact: true }).fill("Retry this captured idea");
  const leg = page.getByRole("group", { name: "Leg 1", exact: true });
  await leg.getByText("Trade plan", { exact: true }).click();
  await leg.getByLabel("Entry price", { exact: true }).fill("10");
  await leg.getByLabel("Stop price", { exact: true }).fill("8");
  await leg.getByText("Position sizing", { exact: true }).click();
  await leg.getByLabel("Risk budget", { exact: true }).fill("500");
  await page.getByRole("button", { name: "Create instrument", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Entry rationale", { exact: true })).toHaveValue("Retry this captured idea");
  await expect(leg.getByLabel("Risk budget", { exact: true })).toHaveValue("500");
  await page.evaluate(async () => {
    const { Repository } = await import("/src/persistence/repository.js");
    const save = Repository.prototype.saveTrade;
    const load = Repository.prototype.load;
    let failNextLoad = false;
    window.sessionAuditOperations = [];
    Repository.prototype.saveTrade = async function (...args) {
      window.sessionAuditRepository = this;
      window.sessionAuditOperations.push({ tradeId: args[0].id, operationId: args[1] });
      const saved = await save.apply(this, args);
      if (window.sessionAuditOperations.length === 1) failNextLoad = true;
      return saved;
    };
    Repository.prototype.load = async function (...args) {
      if (failNextLoad) {
        failNextLoad = false;
        throw new Error("Synthetic reload failure after committed trade");
      }
      return load.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Synthetic reload failure after committed trade");
  await page.getByRole("button", { name: "Retry refresh", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.sessionAuditOperations.length)).toBe(1);
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem('vxTradeJournal.support-reminders'))?.count ?? 0,
  )).toBe(1);
  const operations = await page.evaluate(() => window.sessionAuditOperations);
  await expect(page.getByRole("button", { name: "Edit trade", exact: true })).toBeVisible();
  const persisted = await page.evaluate(async () => {
    const data = await window.sessionAuditRepository.load();
    return data.trades.map(({ id, rationale }) => ({ id, rationale }));
  });
  expect(persisted).toEqual([{ id: operations[0].tradeId, rationale: "Retry this captured idea" }]);
});
