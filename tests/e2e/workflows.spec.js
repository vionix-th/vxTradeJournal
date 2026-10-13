import { test, expect } from "@playwright/test";
import { setup } from "./fixtures.js";
async function addInstrument(page) {
  await page.getByRole("button", { name: "Instruments", exact: true }).click();
  await page
    .getByRole("button", { name: "New instrument", exact: true })
    .click();
  await page.getByLabel("Instrument name", { exact: true }).fill("Acme equity");
  await page.getByLabel("Symbol", { exact: true }).fill("ACME");
  await page.getByLabel("Price unit", { exact: true }).fill("USD/share");
  await page
    .getByRole("button", { name: "Save instrument", exact: true })
    .click();
  await expect(
    page.getByText("Acme equity", { exact: true }).first(),
  ).toBeVisible();
}
async function record(page, kind, q, p) {
  await page
    .getByRole("button", { name: "Add execution", exact: true })
    .first()
    .click();
  await page.getByLabel("Record type", { exact: true }).selectOption(kind);
  await page.getByLabel("Quantity", { exact: true }).fill(q);
  await page.getByLabel("Price", { exact: true }).fill(p);
  await page
    .getByRole("button", { name: "Save execution", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Record execution" }),
  ).not.toBeVisible();
}
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
  { width: 320, height: 740 },
]) {
  test(`complete journal workflow at ${viewport.width}px`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize(viewport);
    await setup(page, request);
    await page.getByRole("button", { name: "Strategies", exact: true }).click();
    await page
      .getByRole("button", { name: "New strategy", exact: true })
      .click();
    await page.getByLabel("Strategy name", { exact: true }).fill("Breakout");
    await page
      .getByLabel("Entry rules", { exact: true })
      .fill("Close above resistance");
    await page
      .getByRole("button", { name: "Save strategy", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Strategies", exact: true }),
    ).toBeVisible();
    await addInstrument(page);
    await page.getByRole("button", { name: "Journal", exact: true }).click();
    await page.getByRole("button", { name: "New trade", exact: true }).click();
    await page
      .getByLabel("Strategy", { exact: true })
      .selectOption({ label: "Breakout" });
    await page
      .getByLabel("Entry rationale", { exact: true })
      .fill("<script>unsafe</script> breakout");
    await page.getByLabel("Tags", { exact: true }).fill("breakout, morning");
    await page.getByRole("button", { name: "Save trade", exact: true }).click();
    await record(page, "entry", "100", "10");
    await record(page, "entry", "100", "12");
    await record(page, "exit", "50", "13");
    await record(page, "entry", "50", "10");
    await record(page, "exit", "200", "12");
    await expect(page.getByTestId("trade-result")).toContainText("350.00 USD");
    await expect(page.getByTestId("trade-status")).toHaveText("Closed");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Journal", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /^View details for / }).filter({ visible: true })
      .first()
      .click();
    await expect(page.getByTestId("trade-result")).toContainText("350.00 USD");
    await expect(
      page.getByText("<script>unsafe</script> breakout", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Edit execution 1", exact: true })
      .click();
    await page.getByLabel("Quantity", { exact: true }).fill("150");
    await page.getByLabel("Correction reason", { exact: true }).fill("Broker corrected initial fill quantity");
    await page
      .getByRole("button", { name: "Save execution", exact: true })
      .click();
    await expect(page.getByTestId("trade-status")).toHaveText("Open");
    await page.getByRole("button", { name: "Journal", exact: true }).click();
    await page.getByRole("button", { name: "New trade", exact: true }).click();
    await page.getByRole("button", { name: "Add leg", exact: true }).click();
    await page.getByRole("button", { name: "Save trade", exact: true }).click();
    await record(page, "entry", "1", "10");
    await page
      .getByRole("button", { name: "Add execution", exact: true })
      .nth(1)
      .click();
    await page.getByLabel("Quantity", { exact: true }).fill("2");
    await page.getByLabel("Price", { exact: true }).fill("20");
    await page
      .getByRole("button", { name: "Save execution", exact: true })
      .click();
    await expect(page.getByTestId("trade-status")).toHaveText("Open");
    await page.getByRole("button", { name: "Journal", exact: true }).click();
    await page
      .getByLabel("Filter status", { exact: true })
      .selectOption("closed");
    await expect(
      page.getByRole("heading", { name: "No matching trades", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await page.screenshot({
      path: `test-results/journal-${viewport.width}.png`,
      fullPage: true,
    });
    if (viewport.width <= 700) await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export JSON", exact: true })
      .click();
    const file = await download;
    const stream = await file.createReadStream();
    let text = "";
    for await (const chunk of stream) text += chunk;
    const data = JSON.parse(text);
    expect(data.trades).toHaveLength(2);
    expect(data.trades[0].legs[0].snapshot.symbol).toBe("ACME");
    expect(data.trades.some((t) => t.executions.length === 5)).toBeTruthy();
    expect(text).not.toContain("Synthetic-password");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (viewport.width <= 700) await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
  });
}

test("manual results, historical FX, retained validation and snapshot preview", async ({
  page,
  request,
}) => {
  await setup(page, request);
  await page.getByRole("button", { name: "Instruments", exact: true }).click();
  await page
    .getByRole("button", { name: "New instrument", exact: true })
    .click();
  await page.getByLabel("Preset", { exact: true }).selectOption("options");
  await page
    .getByLabel("Instrument name", { exact: true })
    .fill("Reported option");
  await page.getByLabel("Symbol", { exact: true }).fill("OPT");
  await page.getByLabel("P&L currency", { exact: true }).fill("EUR");
  await page.getByLabel("Price unit", { exact: true }).fill("EUR/share");
  await page
    .getByRole("button", { name: "Save instrument", exact: true })
    .click();
  await expect(
    page.getByText("Reported option", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await page.getByRole("button", { name: "New trade", exact: true }).click();
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await page
    .getByRole("button", { name: "Add execution", exact: true })
    .click();
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByLabel("Price", { exact: true }).fill("10");
  await page.getByLabel("Fees", { exact: true }).fill("3");
  await page.getByLabel("Fee currency", { exact: true }).fill("USD");
  await page.getByLabel("Fee currency", { exact: true }).fill("GBP");
  await expect(
    page.getByLabel("Fee conversion rate", { exact: true }),
  ).toHaveValue("");
  await page.getByLabel("Fee currency", { exact: true }).fill("USD");
  await page
    .getByRole("button", { name: "Save execution", exact: true })
    .click();
  await expect(page.getByTestId("trade-result")).toContainText("-3.00 USD");
  await page
    .getByRole("button", { name: "Add execution", exact: true })
    .click();
  await page.getByLabel("Record type", { exact: true }).selectOption("exit");
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByLabel("Price", { exact: true }).fill("12");
  await page.getByLabel("Fees", { exact: true }).fill("2");
  await page.getByLabel("Fee currency", { exact: true }).fill("USD");
  await page
    .getByLabel("Manual result source", { exact: true })
    .selectOption("broker-reported");
  await page
    .getByRole("button", { name: "Save execution", exact: true })
    .click();
  await expect(page.getByTestId("trade-result")).toContainText("Unknown");
  await expect(
    page.getByText(/Manual result: broker-reported · Unknown/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit execution 2", exact: true })
    .click();
  await page.getByLabel("Gross realized amount", { exact: true }).fill("100");
  await page.getByLabel("Result conversion rate", { exact: true }).fill("0.8");
  await page.getByLabel("Correction reason", { exact: true }).fill("Broker supplied historical result and conversion");
  await page
    .getByRole("button", { name: "Save execution", exact: true })
    .click();
  await expect(page.getByTestId("trade-result")).toContainText("75.00 USD");
  await page
    .getByRole("button", { name: "Edit execution 1", exact: true })
    .click();
  await page.getByLabel("Quantity", { exact: true }).fill("1");
  await page.getByLabel("Correction reason", { exact: true }).fill("Correct earlier entry quantity");
  await page
    .getByRole("button", { name: "Save execution", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("remaining");
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("1");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByTestId("trade-result")).toContainText("75.00 USD");
  await page
    .getByText("Instrument snapshot and planning", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Correct snapshot", exact: true })
    .click();
  await page
    .getByLabel("Quantity unit", { exact: true })
    .fill("option contracts");
  await page.getByLabel("Correction reason", { exact: true }).fill("Correct historical quantity label");
  await page
    .getByRole("button", { name: "Preview correction", exact: true })
    .click();
  await expect(
    page.getByText(/Before: .*75.00 USD. After: .*75.00 USD/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save instrument", exact: true })
    .click();
  await expect(
    page.getByText("2 option contracts", { exact: false }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "New cash adjustment", exact: true })
    .click();
  await page.getByLabel("Signed amount", { exact: true }).fill("-10");
  await page.getByLabel("Currency", { exact: true }).fill("GBP");
  await expect(page.getByLabel("Conversion rate", { exact: true })).toHaveValue(
    "",
  );
  await page.getByLabel("Reason", { exact: true }).fill("Financing");
  await page
    .getByRole("button", { name: "Save adjustment", exact: true })
    .click();
  await expect(page.getByTestId("trade-result")).toContainText("Unknown");
  await page
    .getByRole("button", { name: "Edit adjustment", exact: true })
    .click();
  await expect(page.getByLabel("Conversion rate", { exact: true })).toHaveValue(
    "",
  );
  await page.getByLabel("Conversion rate", { exact: true }).fill("1.2");
  await page.getByLabel("Correction reason", { exact: true }).fill("Supply historical financing conversion");
  await page
    .getByRole("button", { name: "Save adjustment", exact: true })
    .click();
  await expect(page.getByTestId("trade-result")).toContainText("63.00 USD");
});

test("concurrent edits retain draft, reload reconciliation and explicit deletion", async ({
  page,
  context,
  request,
}) => {
  await setup(page, request);
  await addInstrument(page);
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await page.getByRole("button", { name: "New trade", exact: true }).click();
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await expect(page.getByTestId("trade-status")).toHaveText("Open");
  const other = await context.newPage();
  await other.goto("/");
  await expect(
    other.getByRole("heading", { name: "Journal", exact: true }),
  ).toBeVisible();
  await other
    .getByRole("button", { name: /^View details for / }).filter({ visible: true })
    .first()
    .click();
  await other.getByRole("button", { name: "Edit trade", exact: true }).click();
  await other
    .getByLabel("Review notes", { exact: true })
    .fill("Conflicting review");
  await page.getByRole("button", { name: "Edit trade", exact: true }).click();
  await page.getByLabel("Review notes", { exact: true }).fill("Saved review");
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await expect(page.getByText("Saved review", { exact: true })).toBeVisible();
  await other.getByRole("button", { name: "Save trade", exact: true }).click();
  await expect(other.getByRole("alert")).toContainText("Save conflict");
  await expect(other.getByLabel("Review notes", { exact: true })).toHaveValue(
    "Conflicting review",
  );
  other.once("dialog", (d) => d.accept());
  await other
    .getByRole("button", { name: "Reload current records", exact: true })
    .click();
  await expect(other.getByText("Saved review", { exact: true })).toBeVisible();
  await other.getByRole("button", { name: "Edit trade", exact: true }).click();
  await expect(other.getByLabel("Review notes", { exact: true })).toHaveValue(
    "Saved review",
  );
  await other.close();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete trade", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No trades yet" }),
  ).toBeVisible();
});

test("inline catalogue creation preserves draft and settings persist", async ({
  page,
  request,
}) => {
  await setup(page, request);
  await page.getByRole("button", { name: "New trade", exact: true }).click();
  await page
    .getByLabel("Entry rationale", { exact: true })
    .fill("Retain this plan");
  await page
    .getByRole("button", { name: "Create instrument", exact: true })
    .click();
  await page
    .getByLabel("Instrument name", { exact: true })
    .fill("Inline equity");
  await page.getByLabel("Symbol", { exact: true }).fill("INL");
  await page.getByLabel("Price unit", { exact: true }).fill("USD/share");
  await page
    .getByRole("button", { name: "Save instrument", exact: true })
    .click();
  await expect(page.getByLabel("Entry rationale", { exact: true })).toHaveValue(
    "Retain this plan",
  );
  const leg = page.getByRole("group", { name: "Leg 1", exact: true });
  await leg.locator("summary").filter({ hasText: /^Trade plan$/ }).click();
  await leg.getByLabel("Entry price", { exact: true }).fill("10");
  await leg.getByLabel("Stop price", { exact: true }).fill("8");
  await leg.locator("summary").filter({ hasText: /^Position sizing$/ }).click();
  await leg.getByLabel("Risk budget", { exact: true }).fill("500");
  await expect(leg.getByRole("status")).toContainText("Recommended quantity 250 shares");
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await expect(
    page.getByText("Retain this plan", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByLabel("Display timezone", { exact: true })
    .fill("Asia/Bangkok");
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Journal", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: "test-results/journal-dark.png", fullPage: true });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByLabel("Display timezone", { exact: true }),
  ).toHaveValue("Asia/Bangkok");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Forgot password", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill("nobody@example.test");
  await page
    .getByRole("button", { name: "Send reset email", exact: true })
    .click();
  await expect(page.getByText(/Reset email sent/)).toBeVisible();
});
