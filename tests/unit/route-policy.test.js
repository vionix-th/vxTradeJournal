import { describe, expect, it } from "vitest";
import { routePolicies } from "../../src/ui/route-policy.js";

const destination = (route, arg = null) => ({ route, arg });
const retained = { session: { id: "trade-1", isExisting: true } };
const fresh = { session: { id: "draft-1", isExisting: false } };

describe("journal route policy", () => {
  it("declares presentation and navigation for every registered route", () => {
    const sections = {
      journal: "journal", accounts: "accounts", instruments: "instruments",
      strategies: "strategies", trade: "journal", accountEditor: "accounts",
      instrumentEditor: "instruments", strategyEditor: "strategies",
      tradeEditor: "journal", executionEditor: "journal",
      adjustmentEditor: "journal", snapshotEditor: "journal", settings: "settings",
    };
    expect(Object.keys(routePolicies).sort()).toEqual(Object.keys(sections).sort());
    for (const [route, section] of Object.entries(sections)) {
      expect(routePolicies[route].render, route).toBeTypeOf("function");
      expect(routePolicies[route].navigationSection, route).toBe(section);
      expect(routePolicies[route].refresh, route).toBeTypeOf("function");
    }
  });

  it("refreshes ordinary views without changing their selected record", () => {
    for (const route of ["journal", "accounts", "instruments", "strategies", "trade"])
      expect(routePolicies[route].refresh("selected-id")).toEqual(destination(route, "selected-id"));
  });

  it("owns account and catalogue completion and cancellation destinations", () => {
    expect(routePolicies.accountEditor.complete({ id: "account-1" }, { first: true })).toEqual(destination("journal"));
    expect(routePolicies.accountEditor.complete({ id: "account-1" }, null)).toEqual(destination("accounts"));
    expect(routePolicies.accountEditor.cancel(null)).toEqual(destination("accounts"));
    for (const [route, section] of [["instrumentEditor", "instruments"], ["strategyEditor", "strategies"]]) {
      expect(routePolicies[route].complete({ id: "saved-1" }, null)).toEqual(destination(section));
      expect(routePolicies[route].cancel({ id: "record-1" })).toEqual(destination(section));
    }
  });

  it("discards new composite drafts on refresh and returns retained edits to their trade", () => {
    const policy = routePolicies.tradeEditor;
    expect(policy.refresh(fresh)).toEqual(destination("tradeEditor"));
    expect(policy.cancel(fresh)).toEqual(destination("journal"));
    expect(policy.complete({ id: "saved-1" }, fresh)).toEqual(destination("trade", "saved-1"));
    expect(policy.refresh(retained)).toEqual(destination("trade", "trade-1"));
    expect(policy.cancel(retained)).toEqual(destination("trade", "trade-1"));
    expect(policy.complete({ id: "trade-1" }, retained)).toEqual(destination("trade", "trade-1"));
  });

  it("owns trade-child transitions and reopens cancelled snapshot context", () => {
    const arg = { tradeId: "trade-1", legId: "leg-1", executionId: "execution-1", adjustmentId: "adjustment-1" };
    for (const route of ["executionEditor", "adjustmentEditor", "snapshotEditor"]) {
      expect(routePolicies[route].refresh(arg)).toEqual(destination("trade", "trade-1"));
      expect(routePolicies[route].complete({ id: "trade-1" }, arg)).toEqual(destination("trade", "trade-1"));
    }
    expect(routePolicies.executionEditor.cancel(arg)).toEqual(destination("trade", "trade-1"));
    expect(routePolicies.adjustmentEditor.cancel(arg)).toEqual(destination("trade", "trade-1"));
    expect(routePolicies.snapshotEditor.cancel(arg)).toEqual(destination("trade", { id: "trade-1", reopenLegId: "leg-1" }));
  });

  it("owns settings destinations and identities used to retire completed editors", () => {
    expect(routePolicies.settings.cancel(null)).toEqual(destination("journal"));
    expect(routePolicies.settings.complete({}, null)).toEqual(destination("settings"));
    expect(routePolicies.settings.refresh(null)).toEqual(destination("settings"));
    expect(routePolicies.tradeEditor.identity(fresh)).toBe("draft-1");
    expect(routePolicies.tradeEditor.identity(retained)).toBe("trade-1");
    for (const route of ["accountEditor", "instrumentEditor", "strategyEditor"]) {
      expect(routePolicies[route].identity({ id: "record-1" })).toBe("record-1");
      expect(routePolicies[route].identity(null)).toBeNull();
    }
    expect(routePolicies.executionEditor.identity({ tradeId: "trade-1", executionId: "execution-1" })).toBe("trade-1:execution-1");
    expect(routePolicies.adjustmentEditor.identity({ tradeId: "trade-1", adjustmentId: "adjustment-1" })).toBe("trade-1:adjustment-1");
    expect(routePolicies.snapshotEditor.identity({ tradeId: "trade-1", legId: "leg-1" })).toBe("trade-1:leg-1");
  });
});
