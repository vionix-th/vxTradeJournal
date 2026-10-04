import Decimal from "decimal.js";
/** All monetary/quantity inputs and outputs remain decimal strings. */
export const D = Decimal.clone({ precision: 40, toExpNeg: -40, toExpPos: 40 });
export const SCHEMA_VERSION = 1;
export const CALCULATION_VERSION = 1;
export const PRESETS = {
  equity: {
    label: "Equities",
    market: "Equities",
    model: "linear",
    priceUnit: "",
    quantityUnit: "shares",
    quantityIncrement: "1",
    priceIncrement: "0.01",
    pointValue: "1",
  },
  forex: {
    label: "Forex",
    market: "Forex",
    model: "linear",
    priceUnit: "",
    quantityUnit: "base units",
    quantityIncrement: "1",
    priceIncrement: "0.00001",
    pointValue: "1",
  },
  futures: {
    label: "Futures",
    market: "Futures",
    model: "linear",
    priceUnit: "",
    quantityUnit: "contracts",
    quantityIncrement: "1",
    priceIncrement: "0.25",
    pointValue: "50",
  },
  options: {
    label: "Options",
    market: "Options",
    model: "manual",
    priceUnit: "",
    quantityUnit: "contracts",
    quantityIncrement: "1",
    priceIncrement: "0.01",
    pointValue: null,
  },
  crypto: {
    label: "Spot crypto",
    market: "Crypto",
    model: "linear",
    priceUnit: "",
    quantityUnit: "coins",
    quantityIncrement: "0.000001",
    priceIncrement: "0.01",
    pointValue: "1",
  },
  cryptoDerivative: {
    label: "Crypto derivatives",
    market: "Crypto derivatives",
    model: "manual",
    priceUnit: "",
    quantityUnit: "contracts",
    quantityIncrement: "1",
    priceIncrement: "0.01",
    pointValue: null,
  },
  cfd: {
    label: "CFDs",
    market: "CFDs",
    model: "linear",
    priceUnit: "",
    quantityUnit: "units",
    quantityIncrement: "1",
    priceIncrement: "0.01",
    pointValue: "1",
  },
  custom: {
    label: "Custom",
    market: "Custom",
    model: "manual",
    priceUnit: "",
    quantityUnit: "units",
    quantityIncrement: "1",
    priceIncrement: "0.01",
    pointValue: null,
  },
};
export function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
export function text(value, label, required = false, max = 10000) {
  const result = String(value ?? "").trim();
  requireValue(result.length <= max, `${label} is too long`);
  requireValue(!required || result.length > 0, `${label} is required`);
  return result;
}
export function decimal(
  value,
  label = "Amount",
  positive = false,
  optional = false,
) {
  if (optional && (value == null || value === "")) return null;
  requireValue(
    typeof value === "string" &&
      /^-?\d+(\.\d+)?$/.test(value) &&
      value.length <= 100,
    `${label} must be a decimal string`,
  );
  const d = new D(value);
  requireValue(
    d.isFinite() && (!positive || d.gt(0)),
    `${label} must be ${positive ? "positive" : "finite"}`,
  );
  return d.toFixed();
}
export function currency(value) {
  const result = text(value, "Currency", true, 12);
  requireValue(
    /^[A-Z][A-Z0-9]{2,11}$/.test(result),
    "Currency must be uppercase code (3–12 characters)",
  );
  return result;
}
export function isCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function timestamp(value) {
  requireValue(
    typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T/.test(value) &&
      Number.isFinite(Date.parse(value)),
    "Valid timestamp required",
  );
  const parts = value.match(
    /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/,
  );
  requireValue(
    parts &&
      Number(parts[1]) < 24 &&
      Number(parts[2]) < 60 &&
      Number(parts[3]) < 60 &&
      isCalendarDate(value.slice(0, 10)),
    "Valid timestamp required",
  );
  return new Date(value).toISOString();
}
export function normalizeAccount(a) {
  return {
    ...a,
    name: text(a.name, "Account name", true, 120),
    currency: currency(a.currency),
    archived: !!a.archived,
    hasTrades: !!a.hasTrades,
  };
}
export function normalizeInstrument(i) {
  requireValue(i.priceUnit === undefined || typeof i.priceUnit === "string", "Price unit must be text");
  requireValue(Object.hasOwn(PRESETS, i.preset), "Unknown instrument preset");
  requireValue(
    ["linear", "manual"].includes(i.model),
    "Unknown calculation model",
  );
  const draft = !!i.draft;
  const result = {
    ...i,
    name: text(i.name, "Instrument name", true, 120),
    symbol: text(i.symbol, "Symbol", !draft, 80),
    market: text(i.market, "Market", !draft, 120),
    venue: text(i.venue, "Venue", false, 120),
    preset: i.preset,
    model: i.model,
    quantityUnit: text(i.quantityUnit, "Quantity unit", !draft, 40),
    ...(i.priceUnit === undefined ? {} : { priceUnit: text(i.priceUnit, "Price unit", false, 80) }),
    quantityIncrement: decimal(
      i.quantityIncrement,
      "Quantity increment",
      true,
      draft,
    ),
    priceIncrement: decimal(i.priceIncrement, "Price increment", true, draft),
    pointValue: decimal(
      i.pointValue,
      "Point value",
      true,
      draft || i.model === "manual",
    ),
    currency: draft && !i.currency ? null : currency(i.currency),
    underlying: text(i.underlying, "Underlying", false, 120),
    expiry: text(i.expiry, "Expiry", false, 10),
    strike: decimal(i.strike, "Strike", false, true),
    optionType: text(i.optionType, "Option type", false, 10),
    draft,
    archived: !!i.archived,
    lastUsedAt: i.lastUsedAt || null,
  };
  requireValue(
    !result.expiry || isCalendarDate(result.expiry),
    "Expiry must be a date",
  );
  requireValue(
    ["", "call", "put"].includes(result.optionType),
    "Option type must be call or put",
  );
  return result;
}
export function normalizeStrategy(s) {
  return {
    ...s,
    name: text(s.name, "Strategy name", true, 120),
    purpose: text(s.purpose, "Purpose"),
    markets: text(s.markets, "Applicable markets", false, 1000),
    entryRules: text(s.entryRules, "Entry rules"),
    exitRules: text(s.exitRules, "Exit rules"),
    riskRules: text(s.riskRules, "Risk rules"),
    archived: !!s.archived,
  };
}
export function validateSettings(s) {
  requireValue(["system", "light", "dark"].includes(s.theme), "Unknown theme");
  try {
    new Intl.DateTimeFormat("en", { timeZone: s.timezone });
  } catch {
    throw new Error("Invalid display timezone");
  }
  return {
    ...s,
    theme: s.theme,
    timezone: s.timezone,
    defaultAccount: s.defaultAccount || null,
  };
}
/**
 * Construct one new leg from a catalogue instrument; historical legs are not rebuilt.
 * @param {{id: string, instrument: object, direction: "long"|"short", planning?: Record<string, string|null>}} input
 */
export function createLeg({ id, instrument, direction, planning = {} }) {
  const snapshot = normalizeInstrument(instrument);
  requireValue(
    !snapshot.draft && !snapshot.archived,
    "Archived or draft instrument cannot start trades",
  );
  return {
    id,
    instrumentId: snapshot.id,
    snapshot: structuredClone(snapshot),
    direction,
    planning: structuredClone(planning),
  };
}
/** Snapshot copies and editable plans are detached from their inputs. */
export function createTrade({ id, account, instruments, strategy = null }) {
  const a = normalizeAccount(account);
  requireValue(!a.archived, "Archived account cannot start trades");
  requireValue(instruments?.length > 0, "At least one leg required");
  const legs = instruments.map(
    ({ id: legId, instrument, direction, planning }, index) => createLeg({
      id: legId || `${id}-leg-${index + 1}`,
      instrument,
      direction,
      planning,
    }),
  );
  requireValue(!strategy?.archived, "Archived strategy cannot link new trades");
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    revision: 0,
    accountId: a.id,
    accountCurrency: a.currency,
    strategyId: strategy?.id || null,
    strategySnapshot: strategy
      ? structuredClone(normalizeStrategy(strategy))
      : null,
    rationale: "",
    review: "",
    tags: [],
    riskBudget: null,
    legs,
    executions: [],
    adjustments: [],
  };
}
function increment(value, step, label) {
  requireValue(
    new D(value).mod(step).eq(0),
    `${label} must match increment ${step}`,
  );
}
export function conversionRate(source, account, rate) {
  const supplied = decimal(rate, "Conversion rate", true, true);
  return source === account ? "1" : supplied;
}
/** Sizing excludes fees/slippage and uses adverse stop, never absolute favorable distance. */
export function sizePosition(leg, accountCurrency) {
  const i = normalizeInstrument(leg.snapshot);
  requireValue(i.model === "linear", "Manual model has no automatic sizing");
  requireValue(!i.draft, "Draft instrument has no sizing");
  const p = leg.planning || {};
  const entry = decimal(p.entry, "Entry price");
  const stop = decimal(p.stop, "Stop price");
  increment(entry, i.priceIncrement, "Entry price");
  increment(stop, i.priceIncrement, "Stop price");
  requireValue(
    leg.direction === "long" ? new D(stop).lt(entry) : new D(stop).gt(entry),
    "Stop must be adverse to entry",
  );
  const budget = decimal(p.riskBudget, "Risk budget", true);
  const rate = conversionRate(i.currency, accountCurrency, p.rate);
  requireValue(rate, "Sizing conversion rate required");
  const risk = new D(entry).minus(stop).abs().times(i.pointValue).times(rate);
  const q = new D(budget)
    .div(risk)
    .div(i.quantityIncrement)
    .floor()
    .times(i.quantityIncrement);
  let rewardRisk = null;
  if (p.target != null && p.target !== "") {
    const target = decimal(p.target, "Target");
    increment(target, i.priceIncrement, "Target");
    requireValue(
      leg.direction === "long"
        ? new D(target).gt(entry)
        : new D(target).lt(entry),
      "Target must be favorable",
    );
    rewardRisk = new D(target)
      .minus(entry)
      .abs()
      .div(new D(entry).minus(stop).abs())
      .toFixed();
  }
  return {
    quantity: q.toFixed(),
    riskPerUnit: risk.toFixed(),
    plannedRisk: q.times(risk).toFixed(),
    rewardRisk,
  };
}
/** Validate supplied plan values independently of whether sizing inputs are complete. */
export function validatePlanning(leg) {
  const p = leg.planning || {};
  for (const [key, label] of Object.entries({ entry: "Entry price", stop: "Stop price", target: "Target price" })) {
    if (p[key] != null && p[key] !== "") {
      const value = decimal(p[key], label);
      increment(value, leg.snapshot.priceIncrement, label);
    }
  }
  for (const [key, label] of Object.entries({ rate: "Conversion rate", riskBudget: "Risk budget", quantity: "Quantity" }))
    decimal(p[key], label, true, true);
}
/** Structural prerequisites for replay; record and position validation happen during replay. */
function validateTradeStructure(t) {
  requireValue(t.id && t.accountId, "Trade and account IDs required");
  currency(t.accountCurrency);
  requireValue(
    Array.isArray(t.legs) && t.legs.length > 0,
    "At least one leg required",
  );
  requireValue(t.legs.length <= 20, "Maximum 20 legs per trade");
  const ids = new Set();
  for (const l of t.legs) {
    requireValue(l.id && !ids.has(l.id), "Unique leg IDs required");
    ids.add(l.id);
    requireValue(l.instrumentId, "Instrument reference required");
    normalizeInstrument(l.snapshot);
    requireValue(
      l.snapshot.id === l.instrumentId,
      "Instrument snapshot must match reference",
    );
    requireValue(!l.snapshot.draft, "Draft instrument cannot start trades");
    requireValue(
      ["long", "short"].includes(l.direction),
      "Direction must be long or short",
    );
    validatePlanning(l);
  }
  requireValue(
    Array.isArray(t.executions) && Array.isArray(t.adjustments),
    "Record arrays required",
  );
  requireValue(
    Array.isArray(t.tags) &&
      t.tags.length <= 30 &&
      t.tags.every((tag) => typeof tag === "string" && tag.length <= 80),
    "Maximum 30 text tags (80 characters each)",
  );
  text(t.rationale, "Rationale");
  text(t.review, "Review");
  decimal(t.riskBudget, "Combined risk budget", true, true);
  return t;
}
/** Validate the complete source history without modifying it or retaining a derived cache. */
export function validateTrade(t) {
  calculateTrade(t);
  return t;
}
/** Pure deterministic replay. Timestamp, sequence, ID define reproducible event order. */
export function calculateTrade(t) {
  validateTradeStructure(t);
  const native = {};
  const nativeIncomplete = new Set();
  const incomplete = [];
  let known = new D(0);
  const event = (amount, source, rate, label) => {
    currency(source);
    if (amount == null) {
      incomplete.push(`${label}: result missing`);
      nativeIncomplete.add(source);
      return;
    }
    const n = new D(amount);
    native[source] = new D(native[source] || 0).plus(n).toFixed();
    if (n.eq(0)) return;
    const r = conversionRate(source, t.accountCurrency, rate);
    if (r == null) incomplete.push(`${label}: ${source} conversion missing`);
    else known = known.plus(n.times(r));
  };
  const seen = new Set();
  const ordered = t.executions
    .map((e) => {
      requireValue(e.id && !seen.has(e.id), "Unique execution IDs required");
      seen.add(e.id);
      text(e.orderReference, "Order reference", false, 1000);
      text(e.reason, "Settlement reason", false, 1000);
      requireValue(
        e.sequence == null ||
          (Number.isSafeInteger(e.sequence) && e.sequence >= 0),
        "Sequence must be a non-negative safe integer",
      );
      requireValue(
        t.legs.some((l) => l.id === e.legId),
        "Execution leg does not exist",
      );
      return { ...e, timestamp: timestamp(e.timestamp) };
    })
    .sort(
      (a, b) =>
        a.timestamp.localeCompare(b.timestamp) ||
        (a.sequence || 0) - (b.sequence || 0) ||
        a.id.localeCompare(b.id),
    );
  const legs = t.legs.map((l) => {
    const i = normalizeInstrument(l.snapshot);
    let remaining = new D(0),
      average = new D(0),
      gross = new D(0),
      unknown = false;
    const history = [];
    for (const e of ordered.filter((e) => e.legId === l.id)) {
      requireValue(
        ["entry", "exit", "settlement"].includes(e.kind),
        "Unknown record type",
      );
      const q = new D(decimal(e.quantity, "Quantity", true));
      increment(q, i.quantityIncrement, "Quantity");
      const price = decimal(e.price, "Price", false, e.kind === "settlement");
      if (price != null) increment(price, i.priceIncrement, "Price");
      const fee = decimal(e.fees ?? "0", "Fees");
      requireValue(new D(fee).gte(0), "Fees cannot be negative");
      currency(e.feeCurrency || i.currency);
      decimal(e.resultRate, "Result conversion rate", true, true);
      decimal(e.feeRate, "Fee conversion rate", true, true);
      let result = null;
      if (e.kind === "entry") {
        requireValue(price != null, "Entry price required");
        average = remaining
          .times(average)
          .plus(q.times(price))
          .div(remaining.plus(q));
        remaining = remaining.plus(q);
      } else {
        requireValue(
          q.lte(remaining),
          "Closing quantity exceeds remaining position",
        );
        if (e.kind === "settlement")
          text(e.reason, "Settlement reason", true, 1000);
        if (i.model === "linear" && price != null)
          result = q
            .times(new D(price).minus(average))
            .times(l.direction === "long" ? 1 : -1)
            .times(i.pointValue)
            .toFixed();
        else {
          result = decimal(e.manualGross, "Gross realized result", false, true);
          requireValue(
            ["user-entered", "broker-reported"].includes(e.manualSource),
            "Manual result source required",
          );
        }
        if (result == null) unknown = true;
        else gross = gross.plus(result);
        event(result, i.currency, e.resultRate, `Record ${e.id}`);
        remaining = remaining.minus(q);
        if (remaining.eq(0)) average = new D(0);
      }
      event(
        new D(fee).neg().toFixed(),
        e.feeCurrency || i.currency,
        e.feeRate,
        `Fee ${e.id}`,
      );
      history.push({
        id: e.id,
        remaining: remaining.toFixed(),
        averageEntry: average.toFixed(),
        gross: result,
      });
    }
    let remainingRisk = null;
    if (
      i.model === "linear" &&
      l.planning?.stop != null &&
      l.planning.stop !== ""
    ) {
      const stop = new D(l.planning.stop);
      const distance =
        l.direction === "long" ? average.minus(stop) : stop.minus(average);
      const rate = conversionRate(
        i.currency,
        t.accountCurrency,
        l.planning.rate,
      );
      if (rate != null)
        remainingRisk = D.max(0, distance)
          .times(remaining)
          .times(i.pointValue)
          .times(rate)
          .toFixed();
    }
    return {
      id: l.id,
      remaining: remaining.toFixed(),
      averageEntry: average.toFixed(),
      gross: unknown ? null : gross.toFixed(),
      currency: i.currency,
      remainingRisk,
      history,
    };
  });
  const adjIds = new Set();
  for (const a of t.adjustments) {
    requireValue(a.id && !adjIds.has(a.id), "Unique adjustment IDs required");
    adjIds.add(a.id);
    timestamp(a.timestamp);
    text(a.reason, "Adjustment reason", true, 1000);
    decimal(a.rate, "Adjustment conversion rate", true, true);
    event(
      decimal(a.amount, "Adjustment amount"),
      currency(a.currency),
      a.rate,
      `Adjustment ${a.id}`,
    );
  }
  const complete = incomplete.length === 0;
  return {
    calculationVersion: CALCULATION_VERSION,
    status:
      ordered.length > 0 && legs.every((l) => new D(l.remaining).eq(0))
        ? "closed"
        : "open",
    legs,
    native,
    nativeIncomplete: [...nativeIncomplete],
    complete,
    incomplete,
    knownAccountNet: known.toFixed(),
    accountNet: complete ? known.toFixed() : null,
    openedAt:
      ordered.find((e) => e.kind === "entry")?.timestamp || t.createdAt || null,
  };
}
export function money(value, code) {
  if (value == null) return `Unknown / incomplete ${code}`;
  const d = new D(value);
  return `${d.gt(0) ? "+" : ""}${d.toFixed(2)} ${code}`;
}
