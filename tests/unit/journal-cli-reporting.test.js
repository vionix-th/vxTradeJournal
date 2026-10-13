import { describe, expect, it, vi } from 'vitest';
import { handlers } from '../../src/cli/commands.js';

const parents = [
  { id: 'older', accountId: 'a', status: 'closed', openedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z' },
  { id: 'newer', accountId: 'a', status: 'closed', openedAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z' },
];
function repository() {
  return {
    getSettings: async () => ({ timezone: 'UTC' }),
    list: async (type) => type === 'accounts' ? [{ id: 'a', archived: false }] : parents,
    getEntity: async () => ({ id: 'a', archived: false }),
    getTrade: vi.fn(async (id) => ({ ...parents.find((trade) => trade.id === id), legs: [], adjustments: [], corrections: [],
      executions: [{ kind: 'entry', timestamp: id === 'older' ? '2026-01-01T00:00:00Z' : '2026-02-01T00:00:00Z' },
        { kind: 'exit', timestamp: id === 'older' ? '2026-02-10T00:00:00Z' : '2026-02-09T00:00:00Z' }] })),
  };
}
describe('CLI journal reporting compatibility', () => {
  it('keeps default activity ordering and parent-only payload without history reads', async () => {
    const repo = repository();
    expect(await handlers.journal({ repo, options: {} })).toEqual({ items: parents, total: 2, pages: 1, page: 1 });
    expect(repo.getTrade).not.toHaveBeenCalled();
    expect((await handlers.journal({ repo, options: { sort: 'opened', order: 'asc', from: '2026-01-01' } })).items).toEqual(parents);
    expect(repo.getTrade).not.toHaveBeenCalled();
  });
  it('hydrates before closing sort and pagination while retaining exact summary shape', async () => {
    const repo = repository();
    const result = await handlers.journal({ repo, options: { sort: 'closed', order: 'asc', 'page-size': 1 } });
    expect(repo.getTrade).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ items: [parents[1]], total: 2, page: 1, pages: 2 });
    expect(result.items[0]).not.toHaveProperty('closedAt');
    expect(result.items[0]).not.toHaveProperty('executions');
  });
  it('hydrates closing date filters and shares inclusive timezone matching', async () => {
    const repo = repository();
    const result = await handlers.journal({ repo, options: { 'date-basis': 'closed', from: '2026-02-09', to: '2026-02-09', timezone: 'America/New_York' } });
    expect(result.items).toEqual([parents[0]]);
    expect(repo.getTrade).toHaveBeenCalledTimes(2);
  });
  it('propagates revision-read failures instead of assuming an absent close date', async () => {
    const repo = repository(); const failure = new Error('Record revision changed');
    repo.getTrade.mockRejectedValue(failure);
    await expect(handlers.journal({ repo, options: { sort: 'closed' } })).rejects.toBe(failure);
  });
});
