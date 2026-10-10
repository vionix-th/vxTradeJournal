import { normalizeAccount, normalizeInstrument, normalizeStrategy, validateSettings, calculateTrade } from "./journal-v1.js";
const entityValidators = { accounts: normalizeAccount, instruments: normalizeInstrument, strategies: normalizeStrategy, settings: validateSettings };
export function validateSchema1(documents) {
  const map = new Map(documents.map((item) => [item.path, item.data]));
  for (const { path, data } of documents) {
    const parts = path.split("/");
    if (parts[0] !== "users" || parts.length % 2) throw new Error(`Invalid journal path: ${path}`);
    if (parts.length === 2) continue;
    const [, uid, type, id, child, childId] = parts;
    const managed = parts.length === 4 && (entityValidators[type] || type === "trades") || parts.length === 6 && type === "trades" && ["legs", "executions", "adjustments"].includes(child);
    if (managed && (data.uid !== uid || data.id !== (childId || id) || data.schemaVersion !== 1 || !Number.isInteger(data.revision) || data.revision < 1 || !Number.isFinite(Date.parse(data.createdAt)) || !Number.isFinite(Date.parse(data.updatedAt)))) throw new Error(`Invalid schema-1 metadata: ${path}`);
    if (parts.length === 4 && entityValidators[type]) entityValidators[type](structuredClone(data));
    if (parts.length === 4 && type === "trades") {
      const children = (name) => documents.filter((item) => item.path.startsWith(`${path}/${name}/`) && item.path.split("/").length === 6).map((item) => item.data);
      const trade = { ...data, legs: children("legs"), executions: children("executions"), adjustments: children("adjustments") };
      if (!map.has(`users/${uid}/accounts/${data.accountId}`)) throw new Error(`Missing trade account: ${path}`);
      for (const leg of trade.legs) {
        if (!map.has(`users/${uid}/instruments/${leg.instrumentId}`) || leg.snapshot?.uid !== uid) throw new Error(`Invalid leg reference: ${path}`);
        normalizeInstrument(leg.snapshot);
      }
      if (data.strategyId && (!map.has(`users/${uid}/strategies/${data.strategyId}`) || data.strategySnapshot?.uid !== uid)) throw new Error(`Invalid strategy reference: ${path}`);
      calculateTrade(trade); // Validation/replay only; never persist recalculated results.
    }
    if (parts.length === 6 && type === "trades" && !map.has(`users/${uid}/trades/${id}`)) throw new Error(`Orphan trade child: ${path}`);
    if (parts.length === 6 && child === "operations" && (data.uid !== uid || data.id !== childId)) throw new Error(`Invalid operation receipt: ${path}`);
  }
}
