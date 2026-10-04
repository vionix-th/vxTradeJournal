import { test, expect } from "@playwright/test";
import { setup } from "./fixtures.js";
import { openTradeDraft } from "./audit-editor-fixtures.js";

test("inline context refresh reconciles unsaved sizing with persisted snapshot", async ({ page, request }) => {
  await setup(page, request);
  await openTradeDraft(page);
  const leg = page.getByRole("group", { name: "Leg 1", exact: true });
  await leg.getByText("Trade plan", { exact: true }).click();
  await leg.getByLabel("Entry price", { exact: true }).fill("10");
  await leg.getByLabel("Stop price", { exact: true }).fill("8");
  await leg.getByText("Position sizing", { exact: true }).click();
  await leg.getByLabel("Risk budget", { exact: true }).fill("100");
  await expect(leg.getByRole("status")).toContainText("Recommended quantity 50");
  await page.evaluate(async () => {
    const { Repository } = await import("/src/persistence/repository.js");
    const { db, auth } = await import("/src/persistence/firebase.js");
    const repo = new Repository(db, auth.currentUser.uid);
    const instrument = (await repo.list("instruments"))[0];
    await repo.saveEntity("instruments", { ...instrument, pointValue: "10" });
  });
  await page.getByRole("button", { name: "Create instrument", exact: true }).click();
  await page.getByLabel("Instrument name", { exact: true }).fill("Context refresh");
  await page.getByLabel("Symbol", { exact: true }).fill("CONTEXT");
  await page.getByRole("button", { name: "Save instrument", exact: true }).click();
  await expect(leg.getByRole("status")).toContainText("Recommended quantity 5 shares.");
  await expect(leg.getByLabel("Risk budget", { exact: true })).toHaveValue("100");
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit trade", exact: true })).toBeVisible();
  const quantity = await page.evaluate(async () => {
    const { Repository } = await import("/src/persistence/repository.js");
    const { db, auth } = await import("/src/persistence/firebase.js");
    const { sizePosition } = await import("/src/domain/journal.js");
    const trade = (await new Repository(db, auth.currentUser.uid).load()).trades[0];
    return sizePosition(trade.legs[0], trade.accountCurrency).quantity;
  });
  expect(quantity).toBe("5");
});
