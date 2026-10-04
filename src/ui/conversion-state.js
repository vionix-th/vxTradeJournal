/** A retained rate belongs to one currency pair; matching currencies always use one. */
export function conversionState(previousPair, source, account, rate) {
  const pair = `${source}/${account}`;
  const automatic = source === account;
  return { pair, automatic, rate: automatic ? "1" : previousPair === pair ? rate : "" };
}
