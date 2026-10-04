/** Return a new catalogue ordered by latest linked trade activity, then name. */
export function recentInstruments(instruments, trades) {
  const latest = new Map();
  for (const trade of trades) {
    for (const leg of trade.legs) {
      const activity = trade.updatedAt || "";
      if (activity > (latest.get(leg.instrumentId) || "")) latest.set(leg.instrumentId, activity);
    }
  }
  return [...instruments].sort((left, right) =>
    (latest.get(right.id) || "").localeCompare(latest.get(left.id) || "") || left.name.localeCompare(right.name));
}
