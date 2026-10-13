import { el, button, empty } from './components.js';
import {
  accountEditor, instrumentEditor, strategyEditor, tradeEditor,
  executionEditor, adjustmentEditor, settingsEditor,
} from "./editors.js";
import { journalView, accountsView, instrumentsView, strategiesView, tradeView } from "./views.js";
import { TradeEditorSession } from "./trade-editor-session.js";
import { importEditor } from './import-editor.js';

const destination = (route, arg = null) => ({ route, arg });
const identity = (arg) => arg?.id || null;
const tradeSession = (arg) => arg?.session || null;
const currentEntity = (ui, type, record) => record?.id
  ? ui.data[type].find((item) => item.id === record.id) || record
  : record;
const withTrade = (ui, arg, render) => {
  const trade = ui.data.trades.find((item) => item.id === arg.tradeId);
  if (trade && !ui.data.accounts.find((account) => account.id === trade.accountId)?.archived) render(trade);
  else tradeView(ui, arg.tradeId);
};

const view = (navigationSection, route, render) => ({
  navigationSection,
  render,
  refresh: (arg) => destination(route, arg),
});

export const routePolicies = {
  importEditor: view('settings', 'importEditor', importEditor),
  journal: view("journal", "journal", journalView),
  accounts: view("accounts", "accounts", accountsView),
  instruments: view("instruments", "instruments", instrumentsView),
  strategies: view("strategies", "strategies", strategiesView),
  trade: view("journal", "trade", tradeView),
  accountEditor: {
    navigationSection: "accounts",
    render: (ui, arg) => accountEditor(ui, currentEntity(ui, "accounts", arg?.first ? null : arg), !!arg?.first && !ui.data.accounts.length),
    refresh: (arg) => destination("accounts", arg),
    cancel: () => destination("accounts"),
    complete: (_saved, arg) => destination(arg?.first ? "journal" : "accounts"),
    identity,
  },
  instrumentEditor: {
    navigationSection: "instruments",
    render: (ui, arg) => instrumentEditor(ui, currentEntity(ui, "instruments", arg)),
    refresh: () => destination("instruments"), cancel: () => destination("instruments"),
    complete: () => destination("instruments"), identity,
  },
  strategyEditor: {
    navigationSection: "strategies",
    render: (ui, arg) => strategyEditor(ui, currentEntity(ui, "strategies", arg)),
    refresh: () => destination("strategies"), cancel: () => destination("strategies"),
    complete: () => destination("strategies"), identity,
  },
  tradeEditor: {
    navigationSection: "journal",
    render: (ui, arg) => {
      const current = arg?.id ? ui.data.trades.find((record) => record.id === arg.id) : null;
      if (arg?.id && !current) return tradeView(ui, arg.id);
      const existing = current || ui.data.trades.find((record) => record.id === tradeSession(arg)?.id);
      if (existing && ui.data.accounts.find((account) => account.id === existing.accountId)?.archived) return tradeView(ui, existing.id);
      if (!existing && !ui.data.accounts.some((account) => !account.archived)) {
        ui.show(el('div', {}, empty('No active accounts', 'Create or restore an account before recording a trade.', button('Manage accounts', () => ui.go('accounts')))));
        return;
      }
      const session = tradeSession(arg) || new TradeEditorSession({
        baseRecord: current, data: ui.data,
        defaultInstrumentId: ui.recentInstruments().find((instrument) => !instrument.archived && !instrument.draft)?.id,
      });
      session.setContext(ui.data);
      ui.retainArg({ session });
      tradeEditor(ui, session);
    },
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
    draftIdentity: tradeSession,
    discard: (arg) => tradeSession(arg)?.isExisting
      ? destination("tradeEditor", { id: tradeSession(arg).id }) : destination("tradeEditor"),
  },
  executionEditor: {
    navigationSection: "journal",
    render: (ui, arg) => withTrade(ui, arg, (trade) => executionEditor(ui, trade, arg.legId, trade.executions.find((item) => item.id === arg.executionId))),
    refresh: (arg) => destination("trade", arg?.tradeId),
    cancel: (arg) => destination("trade", arg?.tradeId),
    complete: (_saved, arg) => destination("trade", arg?.tradeId),
    identity: (arg) => arg?.tradeId && arg?.executionId ? `${arg.tradeId}:${arg.executionId}` : null,
  },
  adjustmentEditor: {
    navigationSection: "journal",
    render: (ui, arg) => withTrade(ui, arg, (trade) => adjustmentEditor(ui, trade, trade.adjustments.find((item) => item.id === arg.adjustmentId))),
    refresh: (arg) => destination("trade", arg?.tradeId),
    cancel: (arg) => destination("trade", arg?.tradeId),
    complete: (_saved, arg) => destination("trade", arg?.tradeId),
    identity: (arg) => arg?.tradeId && arg?.adjustmentId ? `${arg.tradeId}:${arg.adjustmentId}` : null,
  },
  snapshotEditor: {
    navigationSection: "journal",
    render: (ui, arg) => withTrade(ui, arg, (trade) => instrumentEditor(ui,
      trade.legs.find((leg) => leg.id === arg.legId).snapshot, { trade, legId: arg.legId })),
    refresh: (arg) => destination("trade", arg?.tradeId),
    cancel: (arg) => destination("trade", { id: arg.tradeId, reopenLegId: arg.legId }),
    complete: (_saved, arg) => destination("trade", arg?.tradeId),
    identity: (arg) => arg?.tradeId && arg?.legId ? `${arg.tradeId}:${arg.legId}` : null,
  },
  settings: {
    navigationSection: "settings", render: settingsEditor,
    refresh: () => destination("settings"), cancel: () => destination("journal"),
    complete: () => destination("settings"), identity: () => null,
  },
};
