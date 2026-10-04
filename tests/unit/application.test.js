import { describe, expect, it } from "vitest";
import {
  filterJournal,
  aggregateAccount,
  exportJournal,
  prepareTrade,
} from "../../src/application/journal.js";
import * as journalApplication from "../../src/application/journal.js";
import {
  normalizeInstrument,
  normalizeAccount,
  createTrade,
} from "../../src/domain/journal.js";
const instrument = normalizeInstrument({
  id: "i",
  name: "Acme",
  symbol: "ACME",
  market: "Equities",
  preset: "equity",
  model: "linear",
  priceUnit: "USD/share",
    quantityUnit: "shares",
  quantityIncrement: "1",
  priceIncrement: "0.01",
  pointValue: "1",
  currency: "USD",
});
const account = normalizeAccount({ id: "a", name: "Main", currency: "USD" });
describe("application boundaries", () => {
  it("prepares a detached persistence projection and full calculation together", () => {
    const source = createTrade({ id: "prepared", account, instruments: [{ instrument, direction: "long" }] });
    source.executions = ["entry", "exit"].map((kind, index) => ({
      id: `e${index}`, legId: source.legs[0].id, kind, quantity: "1", price: index ? "12" : "10",
      timestamp: `2026-01-0${index + 1}T00:00:00Z`, fees: "0", feeCurrency: "USD",
    }));
    source.summary = { complete: true, accountNet: "999" };
    source.status = "open";
    const before = structuredClone(source);
    const result = journalApplication.prepareTradeResult(source, { accounts: [account], instruments: [instrument], strategies: [] });

    expect(result.trade).toMatchObject({ status: "closed", summary: { accountNet: "2", complete: true } });
    expect(result.calculation).toMatchObject({ status: "closed", accountNet: "2", complete: true });
    expect(result.calculation.legs[0].history).toHaveLength(2);
    expect(result.trade.summary.legs[0]).not.toHaveProperty("history");
    expect(result.trade.legs[0].snapshot).not.toBe(source.legs[0].snapshot);
    expect(source).toEqual(before);
    expect(prepareTrade(source, { accounts: [account], instruments: [instrument], strategies: [] })).toEqual(result.trade);
  });

  it("filters each dimension then paginates by newest activity", () => {
    const trades = Array.from({ length: 25 }, (_, i) => ({
      id: String(i),
      accountId: "a",
      status: "open",
      strategyId: "s",
      tags: ["breakout"],
      openedAt: "2026-01-01T00:00:00Z",
      updatedAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
      instruments: [{ name: "Acme", symbol: "ACME", market: "Equities" }],
    }));
    const f = {
      search: "acm",
      account: "a",
      market: "Equities",
      status: "open",
      strategy: "s",
      tag: "breakout",
      from: "2026-01-01",
      to: "2026-01-02",
    };
    expect(filterJournal(trades, f, 1, 10)).toMatchObject({
      total: 25,
      pages: 3,
    });
    expect(filterJournal(trades, f, 1, 10).items[0].id).toBe("24");
    expect(filterJournal(trades, { ...f, account: "b" }).total).toBe(0);
  });
  it("aggregates only one account and identifies incomplete results", () => {
    expect(
      aggregateAccount(
        [
          {
            id: "1",
            accountId: "a",
            summary: { complete: true, accountNet: "100" },
          },
          {
            id: "2",
            accountId: "a",
            summary: { complete: false, accountNet: null },
          },
          {
            id: "3",
            accountId: "b",
            summary: { complete: true, accountNet: "999" },
          },
        ],
        "a",
      ),
    ).toEqual({ total: "100", incomplete: ["2"], count: 1 });
  });
  it("exports reconstructible source records without auth secrets", () => {
    const data = {
      accounts: [account],
      instruments: [instrument],
      strategies: [],
      trades: [
        createTrade({
          id: "t",
          account,
          instruments: [{ instrument, direction: "long" }],
        }),
      ],
      settings: { theme: "system", timezone: "UTC", defaultAccount: "a" },
      password: "secret",
      token: "secret",
    };
    const result = exportJournal(data, "2026-01-01T00:00:00Z");
    expect(result.schemaVersion).toBe(1);
    expect(result.trades[0].legs[0].snapshot.symbol).toBe("ACME");
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("requires account and instrument ownership before new trade, snapshots active definitions", () => {
    const draft = createTrade({
      id: "t",
      account,
      instruments: [{ instrument, direction: "long" }],
    });
    expect(() =>
      prepareTrade(draft, {
        accounts: [],
        instruments: [instrument],
        strategies: [],
      }),
    ).toThrow(/account/);
    expect(() =>
      prepareTrade(
        { ...draft, legs: [{ ...draft.legs[0], instrumentId: "other" }] },
        { accounts: [account], instruments: [instrument], strategies: [] },
      ),
    ).toThrow(/instrument/i);
    expect(
      prepareTrade(draft, {
        accounts: [account],
        instruments: [instrument],
        strategies: [],
      }).summary.complete,
    ).toBe(true);
  });
});

describe("historical context boundaries", () => {
  it("rejects existing leg instrument replacement but permits snapshot correction", () => {
    const replacement = normalizeInstrument({ ...instrument, id: "other", pointValue: "10" });
    const data = { accounts: [account], instruments: [instrument, replacement], strategies: [] };
    const t = createTrade({ id: "t", account, instruments: [{ instrument, direction: "long" }] });
    t.executions = ["entry", "exit"].map((kind, index) => ({
      id: `e${index}`, legId: t.legs[0].id, kind, quantity: "1", price: index ? "12" : "10",
      timestamp: `2026-01-0${index + 1}T00:00:00Z`, fees: "0", feeCurrency: "USD",
    }));
    const previous = prepareTrade(t, data);
    expect(previous.summary.accountNet).toBe("2");
    const rebound = { ...previous, legs: [{ ...previous.legs[0], instrumentId: replacement.id, snapshot: replacement }] };
    expect(() => prepareTrade(rebound, data, previous)).toThrow(/leg instrument cannot change/i);
    const corrected = { ...previous, legs: [{ ...previous.legs[0], snapshot: { ...previous.legs[0].snapshot, pointValue: "10" } }] };
    expect(prepareTrade(corrected, data, previous).summary.accountNet).toBe("20");
    expect(previous.legs[0].snapshot.pointValue).toBe("1");
  });
  it("stores current strategy definition when newly linked and rejects silent snapshot changes", () => {
    const strategy = {
      id: "s",
      name: "Rules",
      entryRules: "Current",
      archived: false,
    };
    const data = {
      accounts: [account],
      instruments: [instrument],
      strategies: [strategy],
    };
    const t = createTrade({
      id: "t",
      account,
      instruments: [{ instrument, direction: "long" }],
    });
    t.strategyId = "s";
    t.strategySnapshot = { ...strategy, entryRules: "Forged" };
    const linked = prepareTrade(t, data);
    expect(linked.strategySnapshot.entryRules).toBe("Current");
    expect(() =>
      prepareTrade(
        {
          ...linked,
          strategySnapshot: {
            ...linked.strategySnapshot,
            entryRules: "Changed",
          },
        },
        data,
        linked,
      ),
    ).toThrow(/snapshot/i);
  });
  it("keeps execution history out of persisted summary cache", () => {
    const t = createTrade({
      id: "t",
      account,
      instruments: [{ instrument, direction: "long" }],
    });
    t.executions = [
      {
        id: "e",
        legId: t.legs[0].id,
        kind: "entry",
        quantity: "1",
        price: "10",
        timestamp: "2026-01-01T00:00:00Z",
        fees: "0",
        feeCurrency: "USD",
      },
    ];
    expect(
      prepareTrade(t, {
        accounts: [account],
        instruments: [instrument],
        strategies: [],
      }).summary.legs[0],
    ).not.toHaveProperty("history");
  });
});

describe("journal dates in display timezone", () => {
  it("filters by local opening day across UTC midnight", () => {
    const t = {
      id: "t",
      openedAt: "2026-01-01T23:30:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
      instruments: [],
      tags: [],
    };
    expect(
      filterJournal(
        [t],
        { from: "2026-01-02", to: "2026-01-02" },
        1,
        12,
        "Asia/Bangkok",
      ).total,
    ).toBe(1);
    expect(
      filterJournal(
        [t],
        { from: "2026-01-01", to: "2026-01-01" },
        1,
        12,
        "Asia/Bangkok",
      ).total,
    ).toBe(0);
  });
});
