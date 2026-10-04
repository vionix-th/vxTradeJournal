import { test, expect } from "@playwright/test";

async function componentFixture(page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const { el, button, decimalField, checkbox, details } = await import("/src/ui/components.js");
    const budget = decimalField("Risk budget", "budget", "125.50", {
      unit: "USD",
      help: "Planned amount before fees.",
      tooltip: "Budget used for the intended trade.",
      containerAttrs: { "data-container": "budget", class: "full" },
      controlAttrs: { required: true, placeholder: "Enter amount", "data-control": "budget" },
    });
    const archived = checkbox("Archived", "archived", true, {
      containerAttrs: { "data-container": "archived" },
      controlAttrs: { "data-control": "archived" },
    });
    const disclosure = details("Trade plan", budget, archived);
    disclosure.content.prepend(el("p", { class: "help" }, "Values survive visibility changes."));
    disclosure.setOpen(true);
    const output = el("output", { "aria-label": "Captured values" });
    const form = el("form", { class: "panel form-grid" }, disclosure,
      button("Show error", () => budget.setError("Risk budget must be positive.")),
      button("Clear error", () => budget.setError(null)),
      button("Hide budget", () => budget.setVisible(false)),
      button("Reveal budget", () => budget.setVisible(true)),
      button("Change unit", () => budget.setUnit("EUR")),
      button("Capture values", () => {
        const captured = Object.fromEntries(new FormData(form));
        output.textContent = JSON.stringify(captured);
      }), output);
    document.getElementById("app").replaceChildren(el("main", { class: "page-content" }, form));
  });
}

for (const width of [375, 800, 1280]) {
  test(`field and disclosure contracts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await componentFixture(page);
    const budget = page.getByLabel("Risk budget", { exact: true });
    await expect(budget).toHaveValue("125.50");
    await expect(budget).toHaveAccessibleDescription("USD Planned amount before fees.");
    await expect(budget).toHaveAttribute("required", "true");
    await expect(budget).toHaveAttribute("placeholder", "Enter amount");
    await expect(budget).toHaveAttribute("data-control", "budget");
    await expect(budget).not.toHaveAttribute("data-container");
    await expect(budget).not.toHaveAttribute("containerAttrs");
    await expect(budget).not.toHaveAttribute("controlAttrs");
    await expect(page.locator('[data-container="budget"]')).toHaveClass("field full");
    await expect(page.getByLabel("Archived", { exact: true })).toBeChecked();
    await expect(page.getByLabel("Archived", { exact: true })).toHaveAttribute("data-control", "archived");
    await expect(page.getByLabel("Archived", { exact: true })).not.toHaveAttribute("data-container");

    await page.getByRole("button", { name: "Show error", exact: true }).click();
    await expect(budget).toHaveAttribute("aria-invalid", "true");
    await expect(budget).toHaveAccessibleDescription("USD Planned amount before fees. Risk budget must be positive.");
    await page.getByRole("button", { name: "Clear error", exact: true }).click();
    await expect(budget).not.toHaveAttribute("aria-invalid");
    await expect(budget).toHaveAccessibleDescription("USD Planned amount before fees.");
    await page.getByRole("button", { name: "Change unit", exact: true }).click();
    await expect(budget).toHaveAccessibleDescription("EUR Planned amount before fees.");

    await page.getByRole("button", { name: "Hide budget", exact: true }).click();
    await expect(budget).not.toBeVisible();
    await page.getByRole("button", { name: "Reveal budget", exact: true }).click();
    await expect(budget).toHaveValue("125.50");
    await page.getByRole("button", { name: "Capture values", exact: true }).click();
    await expect(page.getByRole("status", { name: "Captured values" })).toHaveText('{"budget":"125.50","archived":"on"}');

    const summary = page.getByText("Trade plan", { exact: true });
    await summary.focus();
    await summary.press("Enter");
    await expect(budget).not.toBeVisible();
    await summary.press("Enter");
    await expect(budget).toBeVisible();
    await page.getByRole("button", { name: "About Risk budget", exact: true }).focus();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}
