import { describe, it, expect } from 'vitest';
import { transferObservation } from '../../src/application/transfer-status.js';
const now = Date.parse('2026-10-13T00:00:00Z');
const control = (state, expiry = now + 120000) => ({ state, operationId: 'operation', phase: state === 'snapshot' ? 'preparing' : state === 'ready' ? 'complete' : 'applying', cursor: 7, checkpoint: 10, fence: 1, expiresAt: new Date(expiry).toISOString(), owner: 'must-not-leak' });
const session = (status) => ({ id: 'operation', status, uploadExpiresAt: new Date(now - 1000).toISOString() });

describe('read-only transfer observation', () => {
  it('recognizes pristine and explicitly ready journals without recovery actions', () => {
    for (const metadata of [null, control('ready')]) expect(transferObservation(metadata, null, { now })).toMatchObject({ reason: 'ready', actions: ['retry_export', 'check_status'] });
  });
  it('distinguishes live export from expired snapshot, including the exact expiry boundary', () => {
    expect(transferObservation(control('snapshot'), null, { now })).toMatchObject({ reason: 'active_export', actions: ['check_status'] });
    for (const expiry of [now, now - 86400000]) expect(transferObservation(control('snapshot', expiry), null, { now })).toMatchObject({ reason: 'expired_export', actions: ['retry_export', 'check_status'] });
  });
  it('keeps expired imports in recovery rather than treating lease expiry as completion', () => {
    expect(transferObservation(control('import'), session('applying'), { now })).toMatchObject({ reason: 'active_import', actions: ['check_status'] });
    expect(transferObservation(control('import', now), session('applying'), { now })).toMatchObject({ reason: 'interrupted_import', committedRecords: 7, actions: ['resume_import', 'rollback_import', 'check_status'] });
  });
  it('preserves existing same-owner recovery while leaving competing owners blocked', () => {
    expect(transferObservation(control('import'), session('applying'), { now, ownedByCaller: true }).actions).toEqual(['resume_import', 'rollback_import', 'check_status']);
  });
  it('does not offer recovery when import control contradicts a completed or missing operation', () => {
    for (const value of [null, session('complete'), { id: 'another', status: 'applying' }]) expect(transferObservation(control('import', now), value, { now })).toMatchObject({ reason: 'status_unavailable', actions: ['check_status'] });
  });
  it('offers cancellation but never resume for an interrupted incomplete upload', () => {
    expect(transferObservation(null, session('uploading'), { now, operationId: 'operation' })).toMatchObject({ reason: 'interrupted_import', actions: ['rollback_import', 'check_status'] });
  });
  it('does not offer recovery for terminal operations', () => {
    for (const status of ['complete', 'rolledBack', 'rejected']) expect(transferObservation(control('ready'), session(status), { now, operationId: 'operation' }).actions).toEqual(['retry_export', 'check_status']);
  });
  it('keeps incompatible recovery and missing requested metadata unavailable for mutation', () => {
    expect(transferObservation(control('import', now), session('applying'), { now, compatible: false }).actions).toEqual(['check_status']);
    expect(transferObservation(null, null, { now, operationId: 'missing' }).reason).toBe('status_unavailable');
  });
  it('rejects malformed state, expiry and checkpoint without inferring readiness', () => {
    for (const value of [{ ...control('ready'), state: 'invalid' }, { ...control('snapshot'), expiresAt: 'bad' }, { ...control('import'), cursor: -1 }]) expect(transferObservation(value, session('applying'), { now }).reason).toBe('status_unavailable');
  });
  it('exposes observation time and expiry while excluding internal ownership tokens', () => {
    const observed = transferObservation(control('snapshot'), null, { now });
    expect(observed.observedClientTime).toBe('2026-10-13T00:00:00.000Z');
    expect(observed.expiresAt).toBe('2026-10-13T00:02:00.000Z');
    expect(JSON.stringify(observed)).not.toContain('must-not-leak');
  });
});
