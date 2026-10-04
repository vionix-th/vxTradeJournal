import { D, sizePosition, validatePlanning } from "../domain/journal.js";

const supplied = (value) => value != null && value !== "";
export function hasPlanValues(leg, accountCurrency) {
  const p = leg.planning || {};
  return ["entry", "stop", "target", "riskBudget", "quantity"].some((key) => supplied(p[key])) ||
    (leg.snapshot?.currency !== accountCurrency && supplied(p.rate));
}
export function planningFeedback(leg, accountCurrency, legCount) {
  if (!leg.snapshot) return { kind: "guidance", message: "Choose an instrument to plan this trade." };
  try {
    validatePlanning(leg);
    if (legCount > 1) return { kind: "guidance", message: "Enter quantities and combined risk manually." };
    if (leg.snapshot.model !== "linear") return { kind: "guidance", message: "Enter quantity manually. Automatic sizing is unavailable for this instrument." };
    const p = leg.planning || {};
    if (supplied(p.entry) && supplied(p.stop) &&
      !(leg.direction === "long" ? new D(p.stop).lt(p.entry) : new D(p.stop).gt(p.entry)))
      throw new Error("Stop must be adverse to entry");
    if (supplied(p.entry) && supplied(p.target) &&
      !(leg.direction === "long" ? new D(p.target).gt(p.entry) : new D(p.target).lt(p.entry)))
      throw new Error("Target must be favorable");
    if (!["entry", "stop", "riskBudget"].every((key) => supplied(p[key])))
      return { kind: "guidance", message: "Enter entry price, stop price and risk budget to calculate size." };
    if (leg.snapshot.currency !== accountCurrency && !supplied(p.rate))
      return { kind: "guidance", message: "Enter conversion rate to calculate size in account currency." };
    return { kind: "ready", result: sizePosition(leg, accountCurrency) };
  } catch (error) {
    return { kind: "error", message: error.message };
  }
}
