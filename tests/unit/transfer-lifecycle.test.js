import { it, expect, vi } from 'vitest';
import { JournalTransfer } from '../../src/persistence/transfer.js';

it('retries rejected operations as errors without reopening their journal', async () => {
  const transfer = new JournalTransfer({ db: {}, uid: 'alice', verified: () => true });
  transfer.upload = vi.fn(async () => ({ status: 'rejected', rejectionCode: 'IMPORT_PREVIEW_CHANGED', conflicts: [] }));
  transfer.cleanup = vi.fn(async () => {});
  await expect(transfer.apply({}, { operationId: 'rejected' })).rejects.toMatchObject({ code: 'IMPORT_PREVIEW_CHANGED' });
  expect(transfer.cleanup).toHaveBeenCalledWith('rejected', false);
});

it('classifies transfer failures from durable checkpoints and keeps uncertainty explicit', async () => {
  const transfer = new JournalTransfer({ db: {}, uid: 'alice' });
  for (const [session, state] of [[{ status: 'uploading' }, 'not_applied'], [{ status: 'applying', active: true, cursor: 1 }, 'partial'], [{ status: 'complete' }, 'applied']]) {
    transfer.status = vi.fn(async () => session);
    await expect(transfer.outcome('op', async () => { throw new Error('Interruption'); })).rejects.toMatchObject({ writeOutcome: { state } });
  }
  transfer.status = vi.fn(async () => { throw new Error('Network unavailable'); });
  await expect(transfer.outcome('op', async () => { throw new Error('Timeout'); })).rejects.toMatchObject({ writeOutcome: { state: 'unknown' } });
});
