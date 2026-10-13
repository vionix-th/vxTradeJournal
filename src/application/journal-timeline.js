/** Read-only reporting dates. Current persisted status owns position state. */
export function journalTimeline(trade) {
  const instant = (value) => value ? new Date(value).toISOString() : null;
  const executions = trade.executions;
  const earliestEntry = executions?.filter((event) => event.kind === 'entry')
    .map((event) => instant(event.timestamp)).sort()[0] || null;
  const lastClose = trade.status === 'closed' ? executions?.filter((event) => event.kind === 'exit' || event.kind === 'settlement')
    .map((event) => instant(event.timestamp)).sort().at(-1) || null : null;
  return {
    openedAt: executions ? earliestEntry || instant(trade.createdAt) : instant(trade.openedAt || trade.createdAt),
    closedAt: lastClose,
    updatedAt: instant(trade.updatedAt),
    entered: executions ? !!earliestEntry : null,
  };
}
