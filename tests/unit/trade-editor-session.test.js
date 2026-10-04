import { describe, expect, it } from "vitest";
import { TradeEditorSession } from "../../src/ui/trade-editor-session.js";
import { planningFeedback } from "../../src/ui/planning.js";
import { newTrade, replaceLegs } from "../../src/application/operations.js";

const usd = { id: "usd-instrument", name: "Dollar equity", symbol: "USD", market: "Equities", preset: "equity", model: "linear", quantityUnit: "shares", quantityIncrement: "1", priceIncrement: "0.01", pointValue: "1", currency: "USD", priceUnit: "USD/share" };
const eur = { ...usd, id: "eur-instrument", name: "Euro equity", currency: "EUR", priceUnit: "EUR/share" };
const records = () => ({
  accounts: [{ id: "usd-account", name: "Dollar account", currency: "USD" }, { id: "eur-account", name: "Euro account", currency: "EUR" }],
  instruments: structuredClone([usd, eur]), strategies: [], settings: { defaultAccount: "usd-account" },
});
const retained = (planning = {}) => ({
  id: "retained-trade", revision: 3, accountId: "usd-account", accountCurrency: "USD",
  rationale: "Original", review: "", tags: [], strategyId: null, strategySnapshot: null, riskBudget: null,
  legs: [{ id: "historical-leg", instrumentId: usd.id, snapshot: structuredClone(usd), direction: "long", planning }],
  executions: [], adjustments: [],
});
function session(baseRecord = null, data = records()) {
  let next = 0;
  return new TradeEditorSession({ baseRecord, data, defaultInstrumentId: usd.id,
    id: "draft-trade", operationId: "retained-operation", createId: () => `new-leg-${++next}` });
}

describe("composite trade editor session", () => {
  it("refreshes only unsaved leg snapshots and keeps preview and save consistent", () => {
    for (const base of [null, retained()]) {
      const draft = session(base);
      const leg = base ? draft.addLeg(usd.id) : draft.editableValues.legs[0];
      for (const [key, value] of Object.entries({ entry: "10", stop: "8", riskBudget: "100" })) draft.setPlanning(leg.id, key, value);
      draft.setDisclosure(leg.id, { planOpen: true, sizingOpen: true });
      expect(planningFeedback(leg, "USD", 1).result.quantity).toBe("50");
      const changed = records();
      changed.instruments[0].pointValue = "10";
      draft.setContext(changed);
      expect(planningFeedback(leg, "USD", 1).result.quantity).toBe("5");
      const input = draft.toInput();
      const saved = base ? replaceLegs(base, input.legs, changed) : newTrade(input, changed);
      expect(saved.legs.find((item) => item.id === leg.id).snapshot.pointValue).toBe("10");
      if (base) expect(saved.legs[0].snapshot.pointValue).toBe("1");
      expect(draft.disclosureFor(leg.id)).toEqual({ planOpen: true, sizingOpen: true });
    }
  });

  it("reconciles refreshed draft currencies without losing raw planning or historical snapshots", () => {
    const draft = session();
    const leg = draft.editableValues.legs[0];
    draft.setPlanning(leg.id, "entry", "-.");
    const data = records();
    data.instruments[0].currency = "EUR";
    draft.setContext(data);
    expect(leg.planning.rate).toBe("");
    draft.setPlanning(leg.id, "rate", "0.8");
    draft.setContext(structuredClone(data));
    expect(leg.planning.rate).toBe("0.8");
    data.instruments[0].currency = "USD";
    draft.setContext(data);
    expect(leg.planning.rate).toBe("1");
    expect(leg.planning.entry).toBe("-.");
    draft.setContext({ ...data, instruments: [] });
    expect(leg.instrumentId).toBe(usd.id);
    expect(leg.snapshot).toBeNull();
  });
  it("retains raw invalid values, trade identity and save identity through editable transitions", () => {
    const draft = session();
    const id = draft.id;
    const legId = draft.editableValues.legs[0].id;
    draft.setPlanning(legId, "riskBudget", "-.");
    draft.setField("rationale", "Changed draft");
    draft.setField("tagsText", "review, review, later");
    draft.setField("combinedRiskBudget", "-1");
    draft.setDisclosure(legId, { planOpen: true, sizingOpen: true });
    draft.setContext(records());
    expect(draft.toInput()).toMatchObject({ id, rationale: "Changed draft", tags: ["review", "later"], riskBudget: "-1", legs: [{ id: legId, planning: { riskBudget: "-." } }] });
    expect(draft.id).toBe("draft-trade");
    expect(draft.operationId).toBe("retained-operation");
    expect(draft.disclosureFor(legId)).toEqual({ planOpen: true, sizingOpen: true });
    expect(draft.toInput()).not.toHaveProperty("schemaVersion");
    expect(draft.toInput()).not.toHaveProperty("executions");
  });

  it("detaches historical data and keeps its base and snapshots immutable", () => {
    const original = retained({ entry: "10" });
    const before = structuredClone(original);
    const data = records();
    const draft = session(original, data);
    draft.setField("rationale", "New rationale");
    draft.setPlanning("historical-leg", "entry", "12");
    data.instruments[0].priceUnit = "Catalogue edit";
    original.legs[0].snapshot.priceUnit = "External edit";
    draft.setContext(data);
    expect(draft.baseRecord).toEqual(before);
    expect(draft.toInput().legs[0].snapshot).toEqual(before.legs[0].snapshot);
    expect(draft.baseRecord).not.toBe(original);
    expect(() => { draft.baseRecord.legs[0].snapshot.priceUnit = "Accidental mutation"; }).toThrow(TypeError);
    expect(() => draft.setInstrument("historical-leg", eur.id)).toThrow(/existing leg instrument/i);
    expect(draft.operationId).toBe("retained-operation");
  });

  it("owns account and instrument currency-pair transitions", () => {
    const draft = session();
    const legId = draft.editableValues.legs[0].id;
    draft.setInstrument(legId, eur.id);
    expect(draft.toInput().legs[0].planning.rate).toBeNull();
    draft.setPlanning(legId, "rate", "0.8");
    draft.setAccount("eur-account");
    expect(draft.toInput()).toMatchObject({ accountCurrency: "EUR", legs: [{ planning: { rate: "1" } }] });
    draft.setAccount("usd-account");
    expect(draft.toInput().legs[0].planning.rate).toBeNull();
    draft.setPlanning(legId, "rate", "0.9");
    draft.setInstrument(legId, usd.id);
    expect(draft.toInput().legs[0].planning.rate).toBe("1");
    draft.setInstrument(legId, eur.id);
    expect(draft.toInput().legs[0].planning.rate).toBeNull();
  });

  it("preserves leg identities and disclosure state while adding and removing legs", () => {
    const draft = session();
    const first = draft.editableValues.legs[0].id;
    draft.setDisclosure(first, { planOpen: true, sizingOpen: true });
    draft.setPlanning(first, "entry", "10");
    const second = draft.addLeg(eur.id);
    draft.setDisclosure(second.id, { planOpen: true, sizingOpen: false });
    draft.removeLeg(second.id);
    expect(draft.toInput().legs).toMatchObject([{ id: first, planning: { entry: "10" } }]);
    expect(draft.disclosureFor(first)).toEqual({ planOpen: true, sizingOpen: true });
    expect(draft.disclosures.has(second.id)).toBe(false);
    expect(draft.addLeg(usd.id).id).not.toBe(second.id);
  });

  it("preserves absent retained planning keys and emits null when a present value is cleared", () => {
    const empty = session(retained());
    empty.setField("review", "Context-only correction");
    empty.setContext(records());
    expect(empty.toInput().legs[0].planning).toEqual({});
    const draft = session(retained({ entry: "10", stop: null }));
    draft.setPlanning("historical-leg", "entry", "");
    expect(draft.toInput().legs[0].planning).toEqual({ entry: null, stop: null });
    expect(draft.baseRecord.legs[0].planning).toEqual({ entry: "10", stop: null });
  });

  it("retains larger historical trades without permitting new leg expansion", () => {
    const original = retained();
    original.legs = Array.from({ length: 7 }, (_, index) => ({ ...structuredClone(original.legs[0]), id: `retained-leg-${index}` }));
    const draft = session(original);
    draft.setField("review", "Retained context");
    expect(draft.toInput().legs).toHaveLength(7);
    expect(draft.toInput().legs.every((leg) => Object.keys(leg.planning).length === 0)).toBe(true);
    expect(draft.canAddLeg).toBe(false);
    expect(() => draft.addLeg(usd.id)).toThrow(/maximum 6 legs/i);
  });
});
