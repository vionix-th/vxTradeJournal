import { describe, expect, it } from "vitest";
import {
  normalizeInstrument,
  normalizeAccount,
  normalizeStrategy,
  validateSettings,
  createTrade,
  calculateTrade,
  sizePosition,
  validateTrade,
  SCHEMA_VERSION,
  CALCULATION_VERSION,
} from "../../src/domain/journal.js";
const instrument = (overrides = {}) =>
  normalizeInstrument({
    id: "i",
    name: "Example",
    symbol: "EX",
    market: "Equities",
    preset: "equity",
    model: "linear",
    priceUnit: "USD/share",
    quantityUnit: "shares",
    quantityIncrement: "1",
    priceIncrement: "0.01",
    pointValue: "1",
    currency: "USD",
    ...overrides,
  });
const leg = (overrides = {}) => ({
  id: "l",
  instrumentId: "i",
  snapshot: instrument(),
  direction: "long",
  planning: {},
  ...overrides,
});
const trade = (legs = [leg()]) => ({
  id: "t",
  accountId: "a",
  accountCurrency: "USD",
  legs,
  executions: [],
  adjustments: [],
  tags: [],
});
const execution = (id, kind, quantity, price, extra = {}) => ({
  id,
  legId: "l",
  kind,
  quantity,
  price,
  timestamp: `2026-01-01T00:00:0${id}Z`,
  fees: "0",
  feeCurrency: "USD",
  orderReference: "order-1",
  ...extra,
});
describe("weighted average accounting and historical rates", () => {
  it("reproduces scaled entry fixture independently", () => {
    const t = trade();
    t.executions = [
      execution("1", "entry", "100", "10"),
      execution("2", "entry", "100", "12"),
      execution("3", "exit", "50", "13"),
    ];
    let r = calculateTrade(t);
    expect(r.legs[0]).toMatchObject({
      remaining: "150",
      averageEntry: "11",
      gross: "100",
    });
    t.executions.push(execution("4", "entry", "50", "10"));
    r = calculateTrade(t);
    expect(r.legs[0]).toMatchObject({
      remaining: "200",
      averageEntry: "10.75",
      gross: "100",
    });
    t.executions.push(execution("5", "exit", "200", "12"));
    r = calculateTrade(t);
    expect(r).toMatchObject({
      status: "closed",
      accountNet: "350",
      complete: true,
    });
    expect(r.legs[0].gross).toBe("350");
  });
  it("uses short direction", () => {
    const t = trade([leg({ direction: "short" })]);
    t.executions = [
      execution("1", "entry", "100", "20"),
      execution("2", "exit", "40", "22"),
      execution("3", "exit", "60", "18"),
    ];
    expect(calculateTrade(t).accountNet).toBe("40");
  });
  it("preserves fees, signed adjustments, separate historical conversion rates", () => {
    const t = trade([leg({ snapshot: instrument({ currency: "EUR" }) })]);
    t.executions = [
      execution("1", "entry", "10", "10", {
        fees: "2",
        feeCurrency: "GBP",
        feeRate: "1.2",
      }),
      execution("2", "exit", "5", "12", {
        resultRate: "0.8",
        fees: "1",
        feeCurrency: "EUR",
        feeRate: "0.9",
      }),
      execution("3", "exit", "5", "14", { resultRate: "0.7" }),
    ];
    t.adjustments = [
      {
        id: "adj",
        amount: "-3",
        currency: "USD",
        rate: null,
        timestamp: "2026-01-02T00:00:00Z",
        reason: "Interest",
      },
    ];
    expect(calculateTrade(t)).toMatchObject({
      accountNet: "15.7",
      complete: true,
      native: { EUR: "29", GBP: "-2", USD: "-3" },
    });
  });
  it("keeps missing manual result unknown and charges fees once", () => {
    const t = trade([
      leg({ snapshot: instrument({ model: "manual", pointValue: null }) }),
    ]);
    t.executions = [
      execution("1", "entry", "2", "10", { fees: "3" }),
      execution("2", "exit", "1", "20", {
        manualGross: null,
        manualSource: "broker-reported",
      }),
    ];
    let r = calculateTrade(t);
    expect(r.complete).toBe(false);
    expect(r.accountNet).toBeNull();
    expect(r.legs[0].gross).toBeNull();
    t.executions[1].manualGross = "10";
    r = calculateTrade(t);
    expect(r.accountNet).toBe("7");
    expect(r.status).toBe("open");
  });
  it("marks missing FX incomplete instead of zero, preserves native amount", () => {
    const t = trade([leg({ snapshot: instrument({ currency: "EUR" }) })]);
    t.executions = [
      execution("1", "entry", "1", "10"),
      execution("2", "exit", "1", "110"),
    ];
    expect(calculateTrade(t)).toMatchObject({
      accountNet: null,
      complete: false,
      native: { EUR: "100" },
      knownAccountNet: "0",
    });
    t.executions[1].resultRate = "0.8";
    expect(calculateTrade(t).accountNet).toBe("80");
  });
  it("closes multi-leg only after every leg closes and supports settlement", () => {
    const t = trade([leg(), leg({ id: "l2", direction: "short" })]);
    t.executions = [
      execution("1", "entry", "1", "10"),
      execution("2", "entry", "1", "20", { legId: "l2" }),
      execution("3", "exit", "1", "12"),
    ];
    expect(calculateTrade(t).status).toBe("open");
    t.executions.push(
      execution("4", "settlement", "1", "18", {
        legId: "l2",
        reason: "Expiry",
      }),
    );
    expect(calculateTrade(t)).toMatchObject({
      status: "closed",
      accountNet: "4",
    });
  });
  it("rejects correction causing later excess exit, allows reopening valid correction", () => {
    const t = trade();
    t.executions = [
      execution("1", "entry", "1", "10"),
      execution("2", "exit", "2", "12"),
    ];
    expect(() => calculateTrade(t)).toThrow(/remaining/);
    t.executions[0].quantity = "2";
    expect(calculateTrade(t).status).toBe("closed");
    t.executions[0].quantity = "3";
    expect(calculateTrade(t).status).toBe("open");
  });
  it("accepts signed linear prices, preserves decimal exactness and resets closed basis", () => {
    const t = trade([
      leg({ snapshot: instrument({ quantityIncrement: "0.1" }) }),
    ]);
    t.executions = [
      execution("1", "entry", "0.1", "-0.2"),
      execution("2", "exit", "0.1", "0.1"),
      execution("3", "entry", "0.2", "5"),
    ];
    expect(calculateTrade(t).legs[0]).toMatchObject({
      averageEntry: "5",
      gross: "0.03",
      remaining: "0.2",
    });
  });
  it("rejects invalid record types, increments, rates and timestamps", () => {
    for (const extra of [
      { quantity: "0" },
      { quantity: "1.1" },
      { price: "10.001" },
      { resultRate: "0" },
      { timestamp: "invalid" },
      { kind: "reverse" },
      { fees: "-1" },
    ]) {
      const t = trade();
      t.executions = [execution("1", "entry", "1", "10", extra)];
      expect(() => calculateTrade(t)).toThrow();
    }
  });
});

describe("trade leg construction", () => {
  it("retains caller leg IDs and detaches planning from input", () => {
    const planning = { entry: "10", stop: "8", quantity: "2" };
    const t = createTrade({
      id: "t",
      account: { id: "a", name: "Main", currency: "USD" },
      instruments: [{ id: "caller-leg", instrument: instrument(), direction: "long", planning }],
    });

    expect(t.legs[0].id).toBe("caller-leg");
    expect(t.legs[0].planning).toEqual({ entry: "10", stop: "8", quantity: "2" });
    expect(t.legs[0].planning).not.toBe(planning);
    planning.stop = "7";
    expect(t.legs[0].planning.stop).toBe("8");
  });

  it("keeps deterministic fallback IDs when caller IDs are absent", () => {
    const t = createTrade({
      id: "t",
      account: { id: "a", name: "Main", currency: "USD" },
      instruments: [
        { instrument: instrument(), direction: "long" },
        { instrument: instrument(), direction: "short" },
      ],
    });

    expect(t.legs.map((item) => item.id)).toEqual(["t-leg-1", "t-leg-2"]);
  });
});

describe("complete trade validation", () => {
  it("rejects exits beyond earlier entry quantity", () => {
    const t = trade();
    t.executions = [execution("1", "entry", "1", "10"), execution("2", "exit", "2", "12")];
    expect(() => validateTrade(t)).toThrow(/remaining/i);
  });

  it("rejects malformed adjustment records", () => {
    const t = trade();
    t.adjustments = [{ id: "a", amount: "invalid", currency: "USD", timestamp: "2026-01-01T00:00:00Z", reason: "Credit" }];
    expect(() => validateTrade(t)).toThrow(/decimal/i);
  });

  it("keeps valid source records unchanged", () => {
    const t = trade();
    t.executions = [execution("1", "entry", "1", "10"), execution("2", "exit", "1", "12")];
    const before = structuredClone(t);
    expect(validateTrade(t)).toBe(t);
    expect(t).toEqual(before);
  });
});
describe("sizing and contracts", () => {
  it("sizes five contracts and floors fractional increments", () => {
    const l = leg({
      snapshot: instrument({ pointValue: "50" }),
      planning: {
        entry: "10",
        stop: "8",
        riskBudget: "500",
        rate: "1",
        target: "14",
      },
    });
    expect(sizePosition(l, "USD")).toMatchObject({
      quantity: "5",
      riskPerUnit: "100",
      rewardRisk: "2",
      plannedRisk: "500",
    });
    l.snapshot.quantityIncrement = "0.25";
    l.planning.riskBudget = "523";
    expect(sizePosition(l, "USD").quantity).toBe("5");
  });
  it("uses conversion direction and adverse stop", () => {
    const l = leg({
      snapshot: instrument({ currency: "EUR" }),
      planning: { entry: "10", stop: "8", riskBudget: "10", rate: "0.8" },
    });
    expect(sizePosition(l, "USD").quantity).toBe("6");
    l.planning.stop = "12";
    expect(() => sizePosition(l, "USD")).toThrow(/adverse/);
    l.direction = "short";
    expect(sizePosition(l, "USD").quantity).toBe("6");
  });
  it("disables manual sizing, separates current stop risk", () => {
    expect(() =>
      sizePosition(leg({ snapshot: instrument({ model: "manual" }) }), "USD"),
    ).toThrow(/manual/i);
    const t = trade([leg({ planning: { stop: "8", rate: "1" } })]);
    t.executions = [
      execution("1", "entry", "10", "10"),
      execution("2", "exit", "2", "7"),
    ];
    expect(calculateTrade(t).legs[0]).toMatchObject({
      remainingRisk: "16",
      gross: "-6",
    });
  });
  it("validates instrument readiness and snapshots remain independent", () => {
    const i = instrument();
    const a = normalizeAccount({ id: "a", name: "Main", currency: "USD" });
    const s = normalizeStrategy({
      id: "s",
      name: "Trend",
      entryRules: "Breakout",
    });
    const t = createTrade({
      id: "t",
      account: a,
      instruments: [{ instrument: i, direction: "long" }],
      strategy: s,
    });
    i.pointValue = "100";
    s.entryRules = "Changed";
    expect(t.legs[0].snapshot.pointValue).toBe("1");
    expect(t.strategySnapshot.entryRules).toBe("Breakout");
    expect(t.schemaVersion).toBe(SCHEMA_VERSION);
    expect(calculateTrade(t).calculationVersion).toBe(CALCULATION_VERSION);
    expect(() =>
      createTrade({
        id: "t2",
        account: a,
        instruments: [
          { instrument: instrument({ draft: true }), direction: "long" },
        ],
      }),
    ).toThrow(/draft/);
    expect(() => normalizeInstrument({ ...i, pointValue: "0" })).toThrow();
    expect(() => normalizeAccount({ name: "", currency: "usd" })).toThrow();
  });
  it("validates ownership-independent trade references and settings", () => {
    expect(() => validateTrade({ ...trade(), legs: [] })).toThrow();
    expect(() => validateTrade({ ...trade(), legs: [leg(), leg()] })).toThrow();
    expect(() =>
      validateSettings({ timezone: "Mars", theme: "system" }),
    ).toThrow();
    expect(
      validateSettings({
        timezone: "Asia/Bangkok",
        theme: "dark",
        defaultAccount: "a",
      }).theme,
    ).toBe("dark");
  });
});

describe("input and chronology boundaries", () => {
  it.each(["", "2028-02-29", "2000-02-29", "2026-04-30"])(
    "accepts empty or real instrument expiry %s",
    (expiry) => {
      expect(instrument({ expiry }).expiry).toBe(expiry);
    },
  );
  it.each(["2026-02-30", "2026-13-01", "2026-02-29", "1900-02-29", "2026-04-31", "2026-00-01", "2026-1-01"])(
    "rejects nonexistent or malformed instrument expiry %s",
    (expiry) => {
      expect(() => instrument({ expiry })).toThrow(/expiry.*date/i);
    },
  );
  it("requires positive explicitly supplied same-currency rates", () => {
    const l = leg({
      planning: { entry: "10", stop: "8", riskBudget: "500", rate: "0" },
    });
    expect(() => sizePosition(l, "USD")).toThrow(/positive/);
  });
  it("rejects impossible dates and snapshot identity mismatch", () => {
    const t = trade();
    t.executions = [
      execution("1", "entry", "1", "10", { timestamp: "2026-02-30T00:00:00Z" }),
    ];
    expect(() => calculateTrade(t)).toThrow(/timestamp/i);
    expect(() =>
      validateTrade(trade([leg({ instrumentId: "other" })])),
    ).toThrow(/snapshot/i);
  });
  it("limits order references and requires safe integer sequence", () => {
    const t = trade();
    t.executions = [
      execution("1", "entry", "1", "10", {
        orderReference: "x".repeat(1001),
        sequence: 1.5,
      }),
    ];
    expect(() => calculateTrade(t)).toThrow();
  });
});
