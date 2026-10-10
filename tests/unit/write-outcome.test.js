import { it, expect } from 'vitest';
import { writeOutcome } from '../../src/application/write-outcome.js';
import { ValidationError } from '../../src/domain/validation.js';
it('distinguishes deterministic rejection, uncertain service errors and confirmed commits', () => {
  expect(writeOutcome(new ValidationError('Rejected'), { started: true })).toEqual({ state: 'not_applied' });
  expect(writeOutcome(Object.assign(new Error('Denied'), { code: 'permission-denied' }), { started: true })).toEqual({ state: 'not_applied' });
  expect(writeOutcome(Object.assign(new Error('Timeout'), { code: 'deadline-exceeded' }), { started: true })).toEqual({ state: 'unknown' });
  expect(writeOutcome(new Error('Preflight failed'))).toEqual({ state: 'not_applied' });
  expect(writeOutcome(new Error('Refresh failed'), { started: true, confirmed: true })).toEqual({ state: 'applied' });
  expect(writeOutcome(Object.assign(new Error('Checkpoint'), { writeOutcome: { state: 'partial' } }), { started: true })).toEqual({ state: 'partial' });
});
