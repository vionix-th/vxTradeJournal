import { test, expect, setup } from "./fixtures.js";
import { openTradeDraft, savedTrade } from "./audit-editor-fixtures.js";

for (const existing of [false, true]) test(`accepted Cancel reconstructs ${existing ? "existing" : "new"} trade on Back`, async ({ page, request }) => {
  await setup(page, request);
  if (existing) {
    await savedTrade(page);
    await page.getByRole("button", { name: "Edit trade", exact: true }).click();
  } else await openTradeDraft(page);
  await page.getByLabel("Entry rationale", { exact: true }).fill("Discard this rationale");
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.goBack();
  await expect(page.getByLabel("Entry rationale", { exact: true })).toHaveValue("");
});

test("accepted child sidebar departure retires its parent draft and history aliases", async ({ page, request }) => {
  await setup(page, request);
  await openTradeDraft(page);
  await page.getByLabel("Entry rationale", { exact: true }).fill("Discard suspended parent");
  await page.getByRole("button", { name: "Create instrument", exact: true }).click();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await page.goBack();
  await expect(page.getByLabel("Entry rationale", { exact: true })).toHaveValue("");
  await page.goBack();
  await expect(page.getByLabel("Entry rationale", { exact: true })).toHaveValue("");
});

test("reload discards aliases only after a successful read", async ({ page, request }) => {
  await setup(page, request);
  await openTradeDraft(page);
  await page.getByLabel("Entry rationale", { exact: true }).fill("Retained until read succeeds");
  await page.getByRole("button", { name: "Create instrument", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.evaluate(async () => {
    const { Repository } = await import("/src/persistence/repository.js");
    const load = Repository.prototype.load;
    Repository.prototype.load = async function (...args) {
      Repository.prototype.load = load;
      throw new Error(`Synthetic read failure ${args.length}`);
    };
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reload records", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Synthetic read failure");
  await expect(page.getByLabel("Entry rationale", { exact: true })).toHaveValue("Retained until read succeeds");
  await page.getByRole("button", { name: "Reload records", exact: true }).click();
  await expect(page.getByLabel("Entry rationale", { exact: true })).toHaveValue("");
  await page.goBack();
  await expect(page.getByLabel("Entry rationale", { exact: true })).toHaveValue("");
});
