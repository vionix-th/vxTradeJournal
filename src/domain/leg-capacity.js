/** Conservative capacity verified with strategy, first-account locking and all leg fills. */
export const MAX_NEW_TRADE_LEGS = 6;

/** Retained larger records remain editable; additions require returning below capacity. */
export function assertLegCapacity(legs, previousLegs = []) {
  const retained = legs.length <= previousLegs.length && legs.every((leg) => previousLegs.some((old) => old.id === leg.id));
  if (legs.length > MAX_NEW_TRADE_LEGS && !retained) throw new Error(`Maximum ${MAX_NEW_TRADE_LEGS} legs per trade`);
}
