import { test, expect } from "@playwright/test";
import { setup } from "./fixtures.js";
import { savedTrade } from "./audit-editor-fixtures.js";

test("cancel restores the second adjustment action despite identical labels", async ({ page, request }) => {
  await setup(page, request);
  await savedTrade(page);
  for (const reason of ["First adjustment", "Second adjustment"]) {
    await page.getByRole("button", { name: "New cash adjustment", exact: true }).click();
    await page.getByLabel("Signed amount", { exact: true }).fill("1");
    await page.getByLabel("Reason", { exact: true }).fill(reason);
    await page.getByRole("button", { name: "Save adjustment", exact: true }).click();
    await expect(page.getByRole("button", { name: "New cash adjustment", exact: true })).toBeVisible();
  }
  const actions = page.getByRole("button", { name: "Edit adjustment", exact: true });
  const secondCard = page.locator("article").filter({ has: actions }).nth(1);
  const secondReason = (await secondCard.getByText(/^(First|Second) adjustment ·/).textContent()).split(" · ")[0];
  await actions.nth(1).click();
  await expect(page.getByLabel("Reason", { exact: true })).toHaveValue(secondReason);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(actions.nth(1)).toBeFocused();
});
