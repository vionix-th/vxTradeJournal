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

it('preserves original transfer failure and reports failed status inspection separately', async () => {
  const transfer = new JournalTransfer({ db: {}, uid: 'alice' });
  transfer.inspect = vi.fn(async () => { throw new Error('Secondary status outage'); });
  const original = new Error('Original request failure');
  original.code = 'permission-denied';
  expect(await transfer.diagnose(original)).toBe(original);
  expect(original).toMatchObject({ message: 'Original request failure', code: 'permission-denied', details: { transfer: { reason: 'status_unavailable' }, secondaryErrors: [{ stage: 'inspection', message: 'Secondary status outage' }] } });
});

it('adds inspection without masking cleanup failure or changing request error code', async () => {
  const transfer = new JournalTransfer({ db: {}, uid: 'alice' });
  transfer.inspect = vi.fn(async () => ({ reason: 'expired_export', actions: ['retry_export', 'check_status'] }));
  const original = new Error('Export interrupted'); original.code = 'IMPORT_RECOVERY_REQUIRED';
  original.details = { secondaryErrors: [{ stage: 'cleanup', message: 'Cleanup failed' }] };
  await transfer.diagnose(original);
  expect(original).toMatchObject({ code: 'IMPORT_RECOVERY_REQUIRED', details: { transfer: { reason: 'expired_export' }, secondaryErrors: [{ stage: 'cleanup', message: 'Cleanup failed' }] } });
});

it('export preserves collection failure while reporting failed fenced cleanup', async () => {
  const transfer = new JournalTransfer({ db: {}, uid: 'alice' });
  transfer.claim = vi.fn(async () => {});
  const stop = vi.fn(async () => {});
  transfer.heartbeat = () => stop;
  const original = new Error('Record collection unavailable'); original.code = 'unavailable';
  transfer.collect = vi.fn(async () => { throw original; });
  transfer.fenced = vi.fn(async () => { throw new Error('Cleanup unavailable'); });
  transfer.inspect = vi.fn(async () => ({ reason: 'active_export', actions: ['check_status'] }));
  await expect(transfer.export()).rejects.toBe(original);
  expect(stop).toHaveBeenCalledOnce();
  expect(original.details).toMatchObject({ export: { filePrepared: false, downloadRequested: false }, secondaryErrors: [{ stage: 'cleanup', message: 'Cleanup unavailable' }] });
});

it('a rejected export claim never attempts to release another transfer ownership', async () => {
  const transfer = new JournalTransfer({ db: {}, uid: 'alice' });
  const original = new Error('Busy'); original.code = 'IMPORT_BUSY';
  transfer.claim = vi.fn(async () => { throw original; });
  transfer.fenced = vi.fn();
  transfer.inspect = vi.fn(async () => ({ reason: 'active_export', actions: ['check_status'] }));
  await expect(transfer.export()).rejects.toBe(original);
  expect(transfer.fenced).not.toHaveBeenCalled();
});
