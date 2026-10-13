import { requireValue } from '../domain/journal.js';

/** Ordinary application scope; portable backup and account management keep the source. */
export function activeJournal(data) {
  const byId = new Map(data.accounts.map((account) => [account.id, account]));
  const trades = data.trades.filter((trade) => {
    const account = byId.get(trade.accountId);
    requireValue(account, 'Trade account not found');
    return !account.archived;
  });
  return { ...data, accounts: data.accounts.filter((account) => !account.archived), trades };
}

/** Fenced callers supply a consistent record snapshot. No unrelated revision changes. */
export function accountDeletionPlan(records, accountId, revision, now = new Date().toISOString()) {
  const account = records.find((record) => record.path === `accounts/${accountId}`)?.data;
  requireValue(account, 'Account not found');
  requireValue(account.archived, 'Archive account before deleting');
  requireValue(account.revision === revision, 'Account revision changed. Reload before deleting.');
  const trades = new Set(records.filter((record) => record.path.split('/').length === 2 && record.path.startsWith('trades/') && record.data.accountId === accountId).map((record) => record.path.split('/')[1]));
  const removed = (record) => record.path === `accounts/${accountId}` || record.path.startsWith('trades/') && trades.has(record.path.split('/')[1]);
  const deleted = records.filter(removed).map((record) => record.path);
  const target = records.filter((record) => !removed(record)).map((record) => record.path === 'settings/preferences' && record.data.defaultAccount === accountId
    ? { path: record.path, data: { ...record.data, defaultAccount: null, revision: record.data.revision + 1, updatedAt: now } }
    : record);
  return { accountId, accountName: account.name, revision, tradeCount: trades.size, deleted, target };
}
