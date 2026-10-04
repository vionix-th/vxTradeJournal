import { MAX_NEW_TRADE_LEGS } from "../domain/leg-capacity.js";
import { normalizeInstrument } from "../domain/journal.js";
import { conversionState } from "./conversion-state.js";
import { hasPlanValues } from "./planning.js";

const copy = (value) => structuredClone(value);
const raw = (value) => value ?? "";
const nullable = (value) => value === "" ? null : value;
function immutable(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

/** Owns one composite editor's values, historical base, disclosures and retry identity. */
export class TradeEditorSession {
  constructor({ baseRecord = null, data, defaultInstrumentId = "", id = crypto.randomUUID(), operationId = crypto.randomUUID(), createId = () => crypto.randomUUID() }) {
    this.baseRecord = baseRecord ? immutable(copy(baseRecord)) : null;
    this.operationId = operationId;
    this.createId = createId;
    this.data = data;
    this.disclosures = new Map();
    this.editableValues = {
      id: baseRecord?.id || id,
      accountId: baseRecord?.accountId || data.settings.defaultAccount || data.accounts.find((account) => !account.archived)?.id,
      strategyId: baseRecord?.strategyId || "",
      rationale: raw(baseRecord?.rationale),
      review: raw(baseRecord?.review),
      tagsText: (baseRecord?.tags || []).join(", "),
      combinedRiskBudget: raw(baseRecord?.riskBudget),
      legs: (baseRecord?.legs || []).map((leg) => ({
        id: leg.id, instrumentId: leg.instrumentId, snapshot: immutable(copy(leg.snapshot)), direction: leg.direction,
        planning: Object.fromEntries(Object.entries(leg.planning || {}).map(([key, value]) => [key, raw(value)])),
      })),
    };
    if (!this.editableValues.legs.length) this.addLeg(defaultInstrumentId);
  }

  get id() { return this.editableValues.id; }
  get isExisting() { return !!this.baseRecord?.revision; }
  get canAddLeg() { return this.editableValues.legs.length < MAX_NEW_TRADE_LEGS; }
  get accountCurrency() {
    if (this.isExisting) return this.baseRecord.accountCurrency;
    const account = this.data.accounts.find((record) => record.id === this.editableValues.accountId);
    if (!account) throw new Error("Trading account required");
    return account.currency;
  }

  setContext(data) {
    const previousCurrency = this.accountCurrency;
    this.data = data;
    for (const leg of this.editableValues.legs) {
      const previousPair = `${leg.snapshot?.currency || ""}/${previousCurrency}`;
      if (!this.baseRecord?.legs.some((record) => record.id === leg.id)) {
        const instrument = data.instruments.find((record) => record.id === leg.instrumentId);
        leg.snapshot = instrument ? immutable(normalizeInstrument(copy(instrument))) : null;
      }
      if (previousPair !== `${leg.snapshot?.currency || ""}/${this.accountCurrency}`)
        this.changePair(leg, previousPair);
    }
  }
  setField(name, value) { this.editableValues[name] = value; }
  leg(id) {
    const leg = this.editableValues.legs.find((record) => record.id === id);
    if (!leg) throw new Error("Trade leg not found");
    return leg;
  }
  instrumentUnavailable(legId) {
    const leg = this.leg(legId);
    if (this.baseRecord?.legs.some((record) => record.id === legId)) return false;
    const instrument = this.data.instruments.find((record) => record.id === leg.instrumentId);
    return !!leg.instrumentId && (!instrument || instrument.archived || instrument.draft);
  }
  setAccount(accountId) {
    if (accountId === this.editableValues.accountId) return;
    if (this.isExisting) throw new Error("Existing trade account cannot change");
    const previousCurrency = this.accountCurrency;
    this.editableValues.accountId = accountId;
    for (const leg of this.editableValues.legs)
      this.changePair(leg, `${leg.snapshot?.currency || ""}/${previousCurrency}`);
  }
  setInstrument(legId, instrumentId) {
    const leg = this.leg(legId);
    if (instrumentId === leg.instrumentId) return;
    if (this.baseRecord?.legs.some((record) => record.id === legId))
      throw new Error("Existing leg instrument cannot change");
    const previousPair = `${leg.snapshot?.currency || ""}/${this.accountCurrency}`;
    const instrument = this.data.instruments.find((record) => record.id === instrumentId);
    leg.instrumentId = instrumentId;
    leg.snapshot = instrument ? immutable(copy(instrument)) : null;
    this.changePair(leg, previousPair);
  }
  changePair(leg, previousPair) {
    const next = conversionState(previousPair, leg.snapshot?.currency || "", this.accountCurrency, raw(leg.planning.rate));
    leg.planning.rate = next.rate;
  }
  setDirection(legId, direction) { this.leg(legId).direction = direction; }
  setPlanning(legId, key, value) {
    const planning = this.leg(legId).planning;
    // Untouched empty controls must not expand retained sparse planning records.
    if (value === "" && !Object.hasOwn(planning, key)) return;
    planning[key] = value;
  }

  addLeg(instrumentId = "") {
    if (!this.canAddLeg) throw new Error(`Maximum ${MAX_NEW_TRADE_LEGS} legs per trade`);
    const instrument = this.data.instruments.find((record) => record.id === instrumentId);
    const leg = { id: this.createId(), instrumentId, snapshot: instrument ? immutable(copy(instrument)) : null, direction: "long", planning: {} };
    this.editableValues.legs.push(leg);
    return leg;
  }
  removeLeg(legId) {
    const reason = this.removalReason(legId);
    if (reason) throw new Error(reason);
    const leg = this.leg(legId);
    this.editableValues.legs.splice(this.editableValues.legs.indexOf(leg), 1);
    this.disclosures.delete(legId);
  }
  removalReason(legId) {
    this.leg(legId);
    if (this.editableValues.legs.length === 1) return "At least one leg is required";
    if (this.baseRecord?.executions.some((execution) => execution.legId === legId))
      return "Remove leg executions before removing its leg";
    return null;
  }
  disclosureFor(legId) {
    if (!this.disclosures.has(legId)) {
      const leg = this.leg(legId);
      this.disclosures.set(legId, {
        planOpen: hasPlanValues(leg, this.accountCurrency),
        sizingOpen: ["riskBudget", "rate"].some((key) => leg.planning[key] != null && leg.planning[key] !== "" && (key !== "rate" || leg.snapshot?.currency !== this.accountCurrency)),
      });
    }
    return this.disclosures.get(legId);
  }
  setDisclosure(legId, state) {
    this.disclosures.set(legId, { ...this.disclosureFor(legId), ...state });
  }

  /** Capture only editable input; application operations create persisted source metadata. */
  toInput() {
    return {
      id: this.id,
      accountId: this.editableValues.accountId,
      accountCurrency: this.accountCurrency,
      strategyId: this.editableValues.strategyId || null,
      rationale: this.editableValues.rationale,
      review: this.editableValues.review,
      tags: [...new Set(this.editableValues.tagsText.split(",").map((tag) => tag.trim()).filter(Boolean))],
      riskBudget: nullable(this.editableValues.combinedRiskBudget),
      legs: this.editableValues.legs.map((leg) => ({
        id: leg.id, instrumentId: leg.instrumentId, snapshot: leg.snapshot ? copy(leg.snapshot) : null, direction: leg.direction,
        planning: Object.fromEntries(Object.entries(leg.planning).map(([key, value]) => [key, nullable(value)])),
      })),
    };
  }
}
