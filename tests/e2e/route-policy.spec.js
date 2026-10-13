import { test, expect, setup } from "./fixtures.js";

async function openDraft(page, request) {
  await setup(page, request);
  await page.getByRole("button", { name: "Instruments", exact: true }).click();
  await page.getByRole("button", { name: "New instrument", exact: true }).click();
  await page.getByLabel("Instrument name", { exact: true }).fill("Refresh equity");
  await page.getByLabel("Symbol", { exact: true }).fill("REFRESH");
  await page.getByRole("button", { name: "Save instrument", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Instruments", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await page.getByRole("button", { name: "New trade", exact: true }).click();
}

async function acceptReload(page) {
  const dialogs = [];
  page.once("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Reload records", exact: true }).click();
  expect(dialogs).toHaveLength(1);
}

test("confirmed record reload creates a fresh new-trade session", async ({ page, request }) => {
  await openDraft(page, request);
  await page.getByLabel("Entry rationale", { exact: true }).fill("Discard this unsaved idea");
  await acceptReload(page);
  await expect(page.getByRole("heading", { name: "New trade", exact: true })).toBeVisible();
  await expect(page.getByLabel("Entry rationale", { exact: true })).toHaveValue("");
  await page.getByLabel("Entry rationale", { exact: true }).fill("Replacement idea");
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit trade", exact: true })).toBeVisible();
  await expect(page.getByText("Replacement idea", { exact: true })).toBeVisible();
});

test("confirmed retained-trade reload returns to the unchanged saved trade", async ({ page, request }) => {
  await openDraft(page, request);
  await page.getByLabel("Entry rationale", { exact: true }).fill("Persisted rationale");
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await page.getByRole("button", { name: "Edit trade", exact: true }).click();
  await page.getByLabel("Entry rationale", { exact: true }).fill("Discard this retained edit");
  await acceptReload(page);
  await expect(page.getByRole("button", { name: "Edit trade", exact: true })).toBeVisible();
  await expect(page.getByText("Persisted rationale", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit trade", exact: true }).click();
  await expect(page.getByLabel("Entry rationale", { exact: true })).toHaveValue("Persisted rationale");
});

test("catalogue completion retires earlier editor entries for that record", async ({ page, request }) => {
  await openDraft(page, request);
  await page.getByRole("button", { name: "Instruments", exact: true }).click();
  await page.getByRole("button", { name: "Edit instrument", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Edit instrument", exact: true }).click();
  await page.getByLabel("Instrument name", { exact: true }).fill("Completed catalogue record");
  await page.getByRole("button", { name: "Save instrument", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Instruments", exact: true })).toBeVisible();
  for (let step = 0; step < 2; step++) {
    await page.evaluate(() => new Promise((resolve) => {
      window.addEventListener("popstate", () => resolve(), { once: true });
      history.back();
    }));
  }
  await expect(page.getByRole("heading", { name: "Instruments", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Edit instrument", exact: true })).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Completed catalogue record", exact: true })).toBeVisible();
});
