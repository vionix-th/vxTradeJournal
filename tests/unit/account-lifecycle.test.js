import { describe, it, expect } from 'vitest';
import { activeJournal, accountDeletionPlan } from '../../src/application/accounts.js';

describe('account lifecycle', () => {
  const accounts = [{ id: 'active', currency: 'USD' }, { id: 'archived', currency: 'EUR', archived: true }];
  it('excludes archived history while leaving source data intact', () => {
    const trades = [{ id: 'one', accountId: 'active' }, { id: 'two', accountId: 'archived' }];
    expect(activeJournal({ accounts, trades })).toEqual({ accounts: [accounts[0]], trades: [trades[0]] });
    expect(trades).toHaveLength(2);
    expect(() => activeJournal({ accounts, trades: [{ accountId: 'missing' }] })).toThrow('Trade account not found');
  });
  const records = [
    { path: 'accounts/active', data: accounts[0] },
    { path: 'accounts/archived', data: { ...accounts[1], revision: 3 } },
    { path: 'trades/a', data: { accountId: 'archived' } },
    ...['legs', 'executions', 'adjustments', 'corrections', 'operations'].map((type) => ({ path: `trades/a/${type}/child`, data: { id: 'child' } })),
    { path: 'trades/b', data: { accountId: 'active', revision: 9 } },
    { path: 'settings/preferences', data: { defaultAccount: 'archived', revision: 2 } },
    { path: 'instruments/i', data: { revision: 7 } },
  ];
  it('removes precisely account and linked history; clears its default', () => {
    const plan = accountDeletionPlan(records, 'archived', 3);
    expect(plan.tradeCount).toBe(1);
    expect(plan.deleted).toHaveLength(7);
    expect(plan.target.map((r) => r.path)).toEqual(['accounts/active', 'trades/b', 'settings/preferences', 'instruments/i']);
    expect(plan.target.find((r) => r.path === 'settings/preferences').data).toMatchObject({ defaultAccount: null, revision: 3 });
    expect(plan.target.find((r) => r.path === 'trades/b')).toBe(records[8]);
    expect(records[9].data.defaultAccount).toBe('archived');
  });
  it('requires archived state and exact revision before planning deletion', () => {
    expect(() => accountDeletionPlan(records, 'active', 1)).toThrow('Archive account before deleting');
    expect(() => accountDeletionPlan(records, 'archived', 2)).toThrow('Account revision changed');
    expect(() => accountDeletionPlan(records, 'missing', 1)).toThrow('Account not found');
  });
});
