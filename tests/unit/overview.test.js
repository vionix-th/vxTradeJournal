import { describe, expect, it } from "vitest";
import { journalOverview } from "../../src/application/journal.js";

describe("journal overview presentation", () => {
  const accounts = [
    { id: "a", name: "Main", currency: "USD" },
    { id: "b", name: "Other", currency: "EUR" },
  ];
  const trades = [
    { id: "t1", accountId: "a", status: "closed", summary: { complete: true, accountNet: "350" } },
    { id: "t2", accountId: "a", status: "open", summary: { complete: false, accountNet: null } },
    { id: "t3", accountId: "b", status: "open", summary: { complete: true, accountNet: "100" } },
  ];

  it("shows selected account only and identifies incomplete trades", () => {
    expect(journalOverview(trades, accounts, "a")).toEqual({
      total: 2, open: 1, closed: 1, account: accounts[0], net: "350", incomplete: 1,
    });
  });
  it("avoids monetary totals across different accounts", () => {
    expect(journalOverview(trades, accounts, "")).toEqual({
      total: 3, open: 2, closed: 1, account: null, net: null, incomplete: 1,
    });
  });
  it("automatically scopes monetary display when only one account exists", () => {
    expect(journalOverview(trades.slice(0, 2), accounts.slice(0, 1), "").net).toBe("350");
  });
});
