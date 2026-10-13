import { it, expect } from 'vitest';
import { normalizeInstrument, sizePosition } from '../../src/domain/journal.js';
import { ValidationError, validationContext } from '../../src/domain/validation.js';

it('sizes a short with favorable target independently and rejects adverse targets', () => {
  const snapshot = normalizeInstrument({ id: 'i', name: 'Share', symbol: 'S', market: 'Equities', preset: 'equity', model: 'linear', currency: 'USD', quantityUnit: 'shares', quantityIncrement: '1', priceIncrement: '0.01', pointValue: '1' });
  const leg = { direction: 'short', snapshot, planning: { entry: '20', stop: '22', target: '14', riskBudget: '100' } };
  expect(sizePosition(leg, 'USD')).toEqual({ quantity: '50', riskPerUnit: '2', plannedRisk: '100', rewardRisk: '3' });
  expect(() => sizePosition({ ...leg, planning: { ...leg.planning, target: '24' } }, 'USD')).toThrow('Target must be favorable');
});

it('preserves original failures and explicit record identity when adding validation context', () => {
  const capture = (operation) => { try { operation(); } catch (error) { return error; } };
  const original = new Error('Transport failure');
  expect(capture(() => validationContext(() => { throw original; }, '/executions/0', 'e'))).toBe(original);
  const domain = new ValidationError('Invalid amount', { path: '/amount', recordId: 'existing', rejectedValue: 'x'.repeat(121) });
  expect(capture(() => validationContext(() => { throw domain; }, '/adjustments/0', 'fallback'))).toBe(domain);
  expect(domain.details).toMatchObject({ path: '/adjustments/0/amount', recordId: 'existing' });
  expect(domain.details).not.toHaveProperty('rejectedValue');
});
