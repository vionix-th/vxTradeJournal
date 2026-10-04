import { createTrade, normalizeInstrument, calculateTrade, timestamp, requireValue } from "../domain/journal.js";

const copy = (value) => structuredClone(value);
const find = (records, id, label) => {
  const record = records.find((item) => item.id === id);
  requireValue(record, `${label} not found`);
  return record;
};

/** Construct source records from user-owned references, never caller-supplied snapshots. */
export function newTrade(input, data) {
  const account = find(data.accounts, input.accountId, "Account");
  const strategy = input.strategyId ? find(data.strategies, input.strategyId, "Strategy") : null;
  const trade = createTrade({
    id: input.id, account, strategy,
    instruments: input.legs.map((leg) => ({ ...leg, instrument: find(data.instruments, leg.instrumentId, "Instrument") })),
  });
  trade.legs = trade.legs.map((leg, index) => ({ ...leg, id: input.legs[index].id || leg.id }));
  return editTrade(trade, input, data);
}

/** Editable context is separate from derived caches and immutable account identity. */
export function editTrade(trade, patch, data) {
  const next = copy(trade);
  for (const key of ["rationale", "review", "tags", "riskBudget"])
    if (Object.hasOwn(patch, key)) next[key] = copy(patch[key]);
  if (Object.hasOwn(patch, "strategyId") && patch.strategyId !== trade.strategyId) {
    const strategy = patch.strategyId ? find(data.strategies, patch.strategyId, "Strategy") : null;
    requireValue(!strategy?.archived, "Archived strategy cannot link new trades");
    next.strategyId = strategy?.id || null;
    next.strategySnapshot = strategy ? copy(strategy) : null;
  }
  return next;
}

export function replaceLegs(trade, legs, data) {
  const next = copy(trade);
  next.legs = legs.map((leg) => {
    const old = trade.legs.find((item) => item.id === leg.id);
    if (old) {
      requireValue(old.instrumentId === leg.instrumentId, "Existing leg instrument cannot change; correct its snapshot explicitly");
      return { ...copy(old), direction: leg.direction, planning: copy(leg.planning || {}) };
    }
    const instrument = find(data.instruments, leg.instrumentId, "Instrument");
    requireValue(!instrument.archived && !instrument.draft, "Archived or draft instrument cannot start trades");
    return { id: leg.id, instrumentId: instrument.id, snapshot: copy(instrument), direction: leg.direction, planning: copy(leg.planning || {}) };
  });
  calculateTrade(next);
  return next;
}

export function editLeg(trade, id, patch) {
  const next = copy(trade), leg = find(next.legs, id, "Leg");
  if (Object.hasOwn(patch, "direction")) leg.direction = patch.direction;
  if (Object.hasOwn(patch, "planning")) leg.planning = { ...leg.planning, ...copy(patch.planning) };
  calculateTrade(next);
  return next;
}

/** Browser and CLI share defaults, UTC normalization and replay ordering. */
export function putExecution(trade, input, editing = false) {
  const leg = find(trade.legs, input.legId || trade.executions.find((e) => e.id === input.id)?.legId, "Leg");
  const old = trade.executions.find((e) => e.id === input.id);
  requireValue(editing ? !!old : !old, editing ? "Execution not found" : "Execution already exists");
  const record = {
    fees: "0", feeCurrency: leg.snapshot.currency,
    feeRate: null, resultRate: null, manualGross: null, manualSource: "user-entered",
    orderReference: "", reason: "",
    sequence: Math.max(0, ...trade.executions.map((e) => e.sequence || 0)) + 1,
    ...copy(old || {}), ...copy(input), legId: leg.id,
  };
  record.timestamp = timestamp(record.timestamp);
  record.price = record.price ?? null;
  if (old && old.feeCurrency !== record.feeCurrency && !Object.hasOwn(input, "feeRate")) record.feeRate = null;
  if (record.feeCurrency === trade.accountCurrency) record.feeRate = "1";
  if (leg.snapshot.currency === trade.accountCurrency) record.resultRate = "1";
  const next = copy(trade);
  if (editing) next.executions[next.executions.findIndex((e) => e.id === record.id)] = record;
  else next.executions.push(record);
  calculateTrade(next);
  return next;
}

export function putAdjustment(trade, input, editing = false) {
  const old = trade.adjustments.find((a) => a.id === input.id);
  requireValue(editing ? !!old : !old, editing ? "Adjustment not found" : "Adjustment already exists");
  const record = { rate: null, ...copy(old || {}), ...copy(input) };
  record.timestamp = timestamp(record.timestamp);
  if (old && old.currency !== record.currency && !Object.hasOwn(input, "rate")) record.rate = null;
  if (record.currency === trade.accountCurrency) record.rate = "1";
  const next = copy(trade);
  if (editing) next.adjustments[next.adjustments.findIndex((a) => a.id === record.id)] = record;
  else next.adjustments.push(record);
  calculateTrade(next);
  return next;
}

export function removeChild(trade, type, id) {
  requireValue(["legs", "executions", "adjustments"].includes(type), "Unknown trade child type");
  find(trade[type], id, "Record");
  if (type === "legs") requireValue(!trade.executions.some((e) => e.legId === id), "Remove leg executions before removing its leg");
  const next = copy(trade);
  next[type] = next[type].filter((r) => r.id !== id);
  calculateTrade(next);
  return next;
}

export function correctSnapshot(trade, legId, patch) {
  const next = copy(trade), leg = find(next.legs, legId, "Leg");
  const previousCurrency = leg.snapshot.currency;
  leg.snapshot = normalizeInstrument({ ...leg.snapshot, ...copy(patch), id: leg.instrumentId });
  if (leg.snapshot.currency !== previousCurrency) {
    const rate = leg.snapshot.currency === next.accountCurrency ? "1" : null;
    leg.planning = { ...leg.planning, rate };
    for (const execution of next.executions)
      if (execution.legId === legId) execution.resultRate = rate;
  }
  calculateTrade(next);
  return next;
}
