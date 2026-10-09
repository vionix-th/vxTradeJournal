import { it, expect, vi } from 'vitest';
import { JournalTransfer } from '../../src/persistence/transfer.js';

it('retries rejected operations as errors without reopening their journal', async () => {
  const transfer = new JournalTransfer({ db: {}, uid: 'alice', verified: () => true });
  transfer.upload = vi.fn(async () => ({ status: 'rejected', rejectionCode: 'IMPORT_PREVIEW_CHANGED', conflicts: [] }));
  transfer.cleanup = vi.fn(async () => {});
  await expect(transfer.apply({}, { operationId: 'rejected' })).rejects.toMatchObject({ code: 'IMPORT_PREVIEW_CHANGED' });
  expect(transfer.cleanup).toHaveBeenCalledWith('rejected', false);
});
