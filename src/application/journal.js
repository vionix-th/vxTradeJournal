import {
  normalizeStrategy,
  D,
  SCHEMA_VERSION,
  CALCULATION_VERSION,
  calculateTrade,
  requireValue,
  normalizeInstrument,
} from "../domain/journal.js";
/** The repository supplies only this user's records; references are checked again before persistence. */
export function prepareTrade(trade, data, previous = null) {
  const account = data.accounts.find((a) => a.id === trade.accountId);
  requireValue(account, "Trading account does not belong to user");
  requireValue(
    account.currency === trade.accountCurrency,
    "Reporting currency does not match account",
  );
  requireValue(
    previous || !account.archived,
    "Archived account cannot start trades",
  );
  requireValue(
    !previous || previous.accountId === trade.accountId,
    "Trade account cannot change",
  );
  if (trade.strategyId) {
    const s = data.strategies.find((s) => s.id === trade.strategyId);
    requireValue(s, "Strategy does not belong to user");
    requireValue(
      previous?.strategyId === s.id || !s.archived,
      "Archived strategy cannot link new trades",
    );
    if (previous?.strategyId === s.id) {
      requireValue(
        JSON.stringify(trade.strategySnapshot) ===
          JSON.stringify(previous.strategySnapshot),
        "Historical strategy snapshot cannot change",
      );
    } else
      trade = {
        ...trade,
        strategySnapshot: structuredClone(normalizeStrategy(s)),
      };
  } else trade = { ...trade, strategySnapshot: null };
  for (const l of trade.legs) {
    const i = data.instruments.find((i) => i.id === l.instrumentId);
    requireValue(i, "Instrument does not belong to user");
    const previousLeg = previous?.legs.find((p) => p.id === l.id);
    requireValue(
      !previousLeg || previousLeg.instrumentId === l.instrumentId,
      "Leg instrument cannot change",
    );
    if (!previousLeg) {
      requireValue(
        !i.archived && !i.draft,
        "Archived or draft instrument cannot start trades",
      );
      requireValue(
        JSON.stringify(normalizeInstrument(l.snapshot)) ===
          JSON.stringify(normalizeInstrument(i)),
        "New leg must use current instrument snapshot",
      );
    }
  }
  const calculated = calculateTrade(trade);
  const summary = {
    ...calculated,
    legs: calculated.legs.map(({ history: _history, ...leg }) => leg),
  };
  return {
    ...trade,
    schemaVersion: SCHEMA_VERSION,
    status: summary.status,
    summary,
    openedAt: summary.openedAt,
    instruments: trade.legs.map((l) => ({
      name: l.snapshot.name,
      symbol: l.snapshot.symbol,
      market: l.snapshot.market,
    })),
  };
}
export function filterJournal(
  trades,
  filters = {},
  page = 1,
  pageSize = 12,
  timezone = "UTC",
) {
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const openingDate = (t) => {
    if (!t.openedAt) return "";
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(t.openedAt))
        .map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const q = (filters.search || "").toLowerCase().trim();
  const items = trades
    .filter(
      (t) =>
        (!q ||
          (t.instruments || []).some((i) =>
            `${i.name} ${i.symbol}`.toLowerCase().includes(q),
          )) &&
        (!filters.account || t.accountId === filters.account) &&
        (!filters.market ||
          (t.instruments || []).some((i) => i.market === filters.market)) &&
        (!filters.status || t.status === filters.status) &&
        (!filters.strategy || t.strategyId === filters.strategy) &&
        (!filters.tag || (t.tags || []).includes(filters.tag)) &&
        ((!filters.from && !filters.to) || !!t.openedAt) &&
        (!filters.from || openingDate(t) >= filters.from) &&
        (!filters.to || openingDate(t) <= filters.to),
    )
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  page = Math.max(1, Math.min(page, pages));
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    pages,
    page,
  };
}
export function aggregateAccount(trades, accountId) {
  let total = new D(0),
    count = 0;
  const incomplete = [];
  for (const t of trades.filter((t) => t.accountId === accountId)) {
    if (t.summary.complete) {
      total = total.plus(t.summary.accountNet);
      count++;
    } else incomplete.push(t.id);
  }
  return { total: total.toFixed(), count, incomplete };
}
/** Overview money is scoped to one account; counts can span all accounts. */
export function journalOverview(trades, accounts, accountId = "") {
  const account = accountId
    ? accounts.find((a) => a.id === accountId) || null
    : accounts.length === 1 ? accounts[0] : null;
  const scoped = account ? trades.filter((t) => t.accountId === account.id) : trades;
  const aggregate = account ? aggregateAccount(scoped, account.id) : null;
  return {
    total: scoped.length,
    open: scoped.filter((t) => t.status === "open").length,
    closed: scoped.filter((t) => t.status === "closed").length,
    account,
    net: aggregate?.total ?? null,
    incomplete: scoped.filter((t) => !t.summary.complete).length,
  };
}
export function exportJournal(data, exportedAt = new Date().toISOString()) {
  return {
    format: "vxTradeJournal",
    schemaVersion: SCHEMA_VERSION,
    calculationVersion: CALCULATION_VERSION,
    exportedAt,
    accounts: structuredClone(data.accounts),
    instruments: structuredClone(data.instruments),
    strategies: structuredClone(data.strategies),
    trades: structuredClone(data.trades),
    settings: structuredClone(data.settings),
  };
}
