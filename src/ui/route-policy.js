const destination = (route, arg = null) => ({ route, arg });
const identity = (arg) => arg?.id || null;
const tradeSession = (arg) => arg?.session || null;

const view = (navigationSection, route) => ({
  navigationSection,
  render: () => {},
  refresh: (arg) => destination(route, arg),
  cancel: (arg) => destination(route, arg),
  complete: (_saved, arg) => destination(route, arg),
  identity: () => null,
});

export const routePolicies = {
  journal: view("journal", "journal"),
  accounts: view("accounts", "accounts"),
  instruments: view("instruments", "instruments"),
  strategies: view("strategies", "strategies"),
  trade: view("journal", "trade"),
  accountEditor: {
    navigationSection: "accounts", render: () => {},
    refresh: (arg) => destination("accounts", arg),
    cancel: () => destination("accounts"),
    complete: (_saved, arg) => destination(arg?.first ? "journal" : "accounts"),
    identity,
  },
  instrumentEditor: {
    navigationSection: "instruments", render: () => {},
    refresh: () => destination("instruments"), cancel: () => destination("instruments"),
    complete: () => destination("instruments"), identity,
  },
  strategyEditor: {
    navigationSection: "strategies", render: () => {},
    refresh: () => destination("strategies"), cancel: () => destination("strategies"),
    complete: () => destination("strategies"), identity,
  },
  tradeEditor: {
    navigationSection: "journal", render: () => {},
    refresh: (arg) => {
      const session = tradeSession(arg);
      return session?.isExisting ? destination("trade", session.id) : destination("tradeEditor");
    },
    cancel: (arg) => {
      const session = tradeSession(arg);
      return session?.isExisting ? destination("trade", session.id) : destination("journal");
    },
    complete: (saved) => destination("trade", saved?.id),
    identity: (arg) => tradeSession(arg)?.id || null,
  },
  executionEditor: {
    navigationSection: "journal", render: () => {},
    refresh: (arg) => destination("trade", arg?.tradeId),
    cancel: (arg) => destination("trade", arg?.tradeId),
    complete: (_saved, arg) => destination("trade", arg?.tradeId),
    identity: (arg) => arg?.tradeId && arg?.executionId ? `${arg.tradeId}:${arg.executionId}` : null,
  },
  adjustmentEditor: {
    navigationSection: "journal", render: () => {},
    refresh: (arg) => destination("trade", arg?.tradeId),
    cancel: (arg) => destination("trade", arg?.tradeId),
    complete: (_saved, arg) => destination("trade", arg?.tradeId),
    identity: (arg) => arg?.tradeId && arg?.adjustmentId ? `${arg.tradeId}:${arg.adjustmentId}` : null,
  },
  snapshotEditor: {
    navigationSection: "journal", render: () => {},
    refresh: (arg) => destination("trade", arg?.tradeId),
    // Preserved for the dedicated snapshot-cancel fix.
    cancel: () => destination("instruments"),
    complete: (_saved, arg) => destination("trade", arg?.tradeId),
    identity: (arg) => arg?.tradeId && arg?.legId ? `${arg.tradeId}:${arg.legId}` : null,
  },
  settings: {
    navigationSection: "settings", render: () => {},
    refresh: () => destination("settings"), cancel: () => destination("journal"),
    complete: () => destination("settings"), identity: () => null,
  },
};
