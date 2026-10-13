import { afterEach, it, expect, vi } from 'vitest';
import { JournalTransfer } from '../../src/persistence/transfer.js';

afterEach(() => vi.useRealTimers());

it('renews the existing fenced control without changing its checkpoint', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  const transfer = new JournalTransfer({ db: {}, uid: 'synthetic' });
  const set = vi.fn(), reference = {};
  transfer.control = () => reference;
  transfer.fenced = async (operation) => operation({ set }, { state: 'snapshot', fence: 4, checkpoint: 7, owner: transfer.owner });
  const stop = transfer.heartbeat();
  await vi.advanceTimersByTimeAsync(30000);
  expect(set).toHaveBeenCalledOnce();
  const [target, control] = set.mock.calls[0];
  expect(target).toBe(reference);
  expect(control).toMatchObject({ state: 'snapshot', fence: 4, checkpoint: 7, owner: transfer.owner });
  expect(control.expiresAt.toMillis()).toBe(Date.now() + 120000);
  await stop();
});

it('does not overlap renewals and waits for the pending renewal during shutdown', async () => {
  vi.useFakeTimers();
  const transfer = new JournalTransfer({ db: {}, uid: 'synthetic' });
  let rejectRenewal;
  const renewal = vi.fn(() => new Promise((_resolve, reject) => { rejectRenewal = reject; }));
  transfer.fenced = renewal;
  const stop = transfer.heartbeat();
  await vi.advanceTimersByTimeAsync(60000);
  expect(renewal).toHaveBeenCalledOnce();
  let stopped = false;
  const pending = stop().then(() => { stopped = true; });
  await Promise.resolve(); expect(stopped).toBe(false);
  const failure = new Error('Lease renewal unavailable'); rejectRenewal(failure);
  await pending;
  expect(transfer.heartbeatError).toBe(failure);
  await vi.advanceTimersByTimeAsync(60000);
  expect(renewal).toHaveBeenCalledOnce();
});
