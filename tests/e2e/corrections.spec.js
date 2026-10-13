import { test, expect, setup } from './fixtures.js';
import { savedTrade } from './audit-editor-fixtures.js';

for (const width of [800]) test(`financial correction reason and deletion history at ${width}px`, async ({ page, request }) => {
  await page.setViewportSize({ width, height: 900 });
  await setup(page, request); await savedTrade(page);
  await page.getByRole('button', { name: 'Add execution', exact: true }).click();
  await expect(page.getByLabel('Correction reason', { exact: true })).toHaveCount(0);
  await page.getByLabel('Quantity', { exact: true }).fill('2');
  await page.getByLabel('Price', { exact: true }).fill('10');
  await page.getByLabel('Fees', { exact: true }).fill('1');
  await page.getByLabel('Fee currency', { exact: true }).fill('EUR');
  await page.getByRole('button', { name: 'Save execution', exact: true }).click();
  await expect(page.getByTestId('trade-result')).toContainText('incomplete');
  await page.getByRole('button', { name: 'Edit execution 1', exact: true }).click();
  const reason = page.getByLabel('Correction reason', { exact: true });
  await expect(reason).toBeHidden();
  await page.getByLabel('Fee conversion rate', { exact: true }).fill('2');
  await expect(reason).toBeVisible();
  await reason.fill('   ');
  await page.getByRole('button', { name: 'Save execution', exact: true }).click();
  await expect(reason).toHaveAttribute('aria-invalid', 'true');
  await expect(reason).toHaveAccessibleDescription(/1–1,000/);
  await expect(page.getByLabel('Fee conversion rate', { exact: true })).toHaveValue('2');
  await reason.fill('Broker supplied historical fee conversion');
  await page.getByRole('button', { name: 'Save execution', exact: true }).click();
  await expect(page.getByTestId('trade-result')).toContainText('2.00 USD');
  await expect(page.getByText('Broker supplied historical fee conversion', { exact: true })).toBeVisible();
  const history = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Correction history', exact: true }) });
  await history.locator('summary').first().click();
  await expect(history.getByText('feeRate', { exact: true })).toBeVisible();
  await expect(history.getByText('Missing', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath(`test-results/corrections-${width}.png`.split("/").pop()), fullPage: true });
  await page.reload();
  await page.getByRole('button', { name: /^View details for / }).filter({ visible: true }).click();
  await expect(page.getByText('Broker supplied historical fee conversion', { exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  const remove = page.getByRole('button', { name: 'Delete execution 1', exact: true });
  await remove.click();
  const dialog = page.getByRole('dialog', { name: 'Delete saved record' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(remove).toBeFocused();
  page.once('dialog', (native) => native.accept()); await remove.click();
  await dialog.getByLabel('Correction reason', { exact: true }).fill('Remove duplicate broker fill');
  await dialog.getByRole('button', { name: 'Delete record', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit execution 1', exact: true })).toHaveCount(0);
  await expect(page.getByText('Remove duplicate broker fill', { exact: true })).toBeVisible();
});

test('history pagination and context edits do not require correction reasons', async ({ page, request }) => {
  await setup(page, request); await savedTrade(page);
  await page.getByRole('button', { name: 'New cash adjustment', exact: true }).click();
  await page.getByLabel('Signed amount', { exact: true }).fill('1');
  await page.getByLabel('Reason', { exact: true }).fill('Broker credit');
  await page.getByRole('button', { name: 'Save adjustment', exact: true }).click();
  for (let i = 1; i <= 13; i++) {
    await page.getByRole('button', { name: 'Edit adjustment', exact: true }).click();
    await page.getByLabel('Signed amount', { exact: true }).fill(String(i + 1));
    await page.getByLabel('Correction reason', { exact: true }).fill(`Broker correction ${i}`);
    await page.getByRole('button', { name: 'Save adjustment', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit trade', exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Next corrections', exact: true }).click();
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  await expect(page.getByText('Broker correction 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit trade', exact: true }).click();
  await page.getByLabel('Review notes', { exact: true }).fill('Ordinary review note');
  await expect(page.getByLabel('Correction reason', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Save trade', exact: true }).click();
  await expect(page.getByText('Ordinary review note', { exact: true })).toBeVisible();
});


test('uncertain correction retains reason and receipt-based retry creates one history event', async ({ page, request }) => {
  await setup(page, request); await savedTrade(page);
  await page.getByRole('button', { name: 'Add execution', exact: true }).click();
  await page.getByLabel('Quantity', { exact: true }).fill('2');
  await page.getByLabel('Price', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Save execution', exact: true }).click();
  await page.getByRole('button', { name: 'Edit execution 1', exact: true }).click();
  await page.getByLabel('Fees', { exact: true }).fill('1');
  await page.getByLabel('Correction reason', { exact: true }).fill('Broker corrected commission');
  await page.evaluate(async () => {
    const { Repository } = await import('/src/persistence/repository.js');
    const save = Repository.prototype.saveTrade;
    window.correctionOperations = [];
    Repository.prototype.saveTrade = async function (...args) {
      window.correctionOperations.push(args[1]);
      const result = await save.apply(this, args);
      if (window.correctionOperations.length === 1) throw Object.assign(new Error('Synthetic lost commit acknowledgement'), { writeOutcome: { state: 'unknown' } });
      return result;
    };
  });
  await page.getByRole('button', { name: 'Save execution', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Write status is unknown');
  await expect(page.getByLabel('Correction reason', { exact: true })).toHaveValue('Broker corrected commission');
  await expect(page.getByLabel('Fees', { exact: true })).toHaveValue('1');
  await page.getByRole('button', { name: 'Save execution', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('trade-result')).toContainText('-1.00 USD');
  await expect(page.getByText('Broker corrected commission', { exact: true })).toHaveCount(1);
  const operations = await page.evaluate(() => window.correctionOperations);
  expect(operations).toHaveLength(2); expect(operations[0]).toBe(operations[1]);
});
