import { expect } from "@playwright/test";
import { trackRegisteredUser } from './fixtures.js';
const authPort = Number(process.env.VITE_AUTH_EMULATOR_PORT || 9299);
const project = process.env.GCLOUD_PROJECT || "demo-vxjournal-auto";
export async function registrationSetup(page, request) {
  const email = `trader-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Synthetic-password-123");
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Verify email" }),
  ).toBeVisible();
  const oob = await request.get(
    `http://127.0.0.1:${authPort}/emulator/v1/projects/${project}/oobCodes`,
  );
  const codes = (await oob.json()).oobCodes;
  const code = codes.find(
    (c) => c.email === email && c.requestType === "VERIFY_EMAIL",
  );
  expect(code).toBeTruthy();
  await request.post(
    `http://127.0.0.1:${authPort}/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-key`,
    { data: { oobCode: code.oobCode } },
  );
  await page
    .getByRole("button", { name: "Check verification", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "First account" }),
  ).toBeVisible();
  await page.getByLabel("Account name", { exact: true }).fill("Main");
  await page.getByRole("button", { name: "Save account", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Journal", exact: true }),
  ).toBeVisible();
  await trackRegisteredUser(page);
}
