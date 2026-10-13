import { correctionDiff, correctionReason } from '../application/corrections.js';
import { verifyExport } from '../application/portable.js';
import { PRESETS, normalizeAccount, normalizeInstrument, normalizeStrategy, validateSettings, calculateTrade, sizePosition, isCalendarDate } from "../domain/journal.js";
import { prepareTradeResult, filterJournal, journalOverview } from "../application/journal.js";
import { JournalTransfer } from '../persistence/transfer.js';
import { newTrade, editTrade, replaceLegs, editLeg, putExecution, putAdjustment, removeChild, correctSnapshot } from "../application/operations.js";
import { fingerprint } from "../application/fingerprint.js";
import { CliError } from "./errors.js";
import { recentInstruments } from "../application/instruments.js";

const normalizers = { accounts: normalizeAccount, instruments: normalizeInstrument, strategies: normalizeStrategy };
const required = (record, label = "Record") => {
  if (!record) throw new CliError("NOT_FOUND", `${label} not found for this user.`, 4);
  return record;
};
function revision(record, expected) {
  if ((record?.revision || 0) !== expected) throw new CliError("CONFLICT", "Record revision changed. Read current records and reconcile.", 5);
}
function instrumentDefaults(input) {
  const preset = PRESETS[input.preset];
  if (!preset) throw new CliError("VALIDATION", "Unknown instrument preset.");
  const { label: _label, ...defaults } = preset;
  return { ...defaults, ...input };
}
async function references(repo, trade) {
  const [account, instruments, strategy] = await Promise.all([
    repo.getEntity("accounts", trade.accountId),
    Promise.all([...new Set(trade.legs.map((l) => l.instrumentId))].map((id) => repo.getEntity("instruments", id))),
    trade.strategyId ? repo.getEntity("strategies", trade.strategyId) : null,
  ]);
  return { accounts: account ? [account] : [], instruments: instruments.filter(Boolean), strategies: strategy ? [strategy] : [] };
}
async function getTrade(repo, id) { return required(await repo.getTrade(id), "Trade"); }

async function entity({ repo, spec, options, input }) {
  const { type, action } = spec;
  if (action === "list") {
    let items = await repo.list(type);
    if (options.archived && options.archived !== "all") items = items.filter((i) => i.archived === (options.archived === "true"));
    if (options.search) {
      const q = options.search.toLowerCase();
      items = items.filter((i) => [i.name, i.symbol, i.market, i.venue, i.underlying, i.expiry, i.strike, i.optionType].filter(Boolean).join(" ").toLowerCase().includes(q));
    }
    if (type === "instruments") {
      const trades = await repo.list("trades");
      const linked = await Promise.all(trades.map(async (trade) => ({ ...trade, legs: await repo.listChildren(trade.id, "legs") })));
      items = recentInstruments(items, linked);
    }
    return items;
  }
  if (action === "get") return required(await repo.getEntity(type, options.id));
  const id = action === "create" ? input.id : options.id;
  const old = await repo.getEntity(type, id);
  if (action !== "create") required(old);
  revision(old, action === "create" ? 0 : options.revision);
  let value = { ...old, ...input, id, revision: old?.revision || 0 };
  if (type === "instruments" && action === "create") value = instrumentDefaults(value);
  if (action === "archive" || action === "unarchive") value.archived = action === "archive";
  value = normalizers[type](value);
  if (type === "accounts" && old?.hasTrades && value.currency !== old.currency) throw new CliError("VALIDATION", "Reporting currency is fixed after first trade.");
  if (options["dry-run"]) return { dryRun: true, record: value };
  return repo.saveEntity(type, value);
}

async function tradeWrite({ command, spec, repo, options, input }) {
  const id = spec.action === "create" ? input.id : options.trade || options.id;
  const reason = correctionReason(options["correction-reason"]);
  const requestHash = await fingerprint({ correctionReason: reason, command, tradeId: id, recordId: options.trade ? options.id || null : null, revision: options.revision ?? 0, input });
  const operationId = options["operation-id"];
  if (operationId && !options.preview && !options["dry-run"]) {
    const receipt = await repo.getOperation(id, operationId);
    if (receipt) {
      if (receipt.requestFingerprint !== requestHash) throw new CliError("OPERATION_MISMATCH", "Operation ID already used with different input.", 5);
      return { trade: await getTrade(repo, id), writeOutcome: { state: "applied" }, appliedRevision: receipt.revision, replayed: true };
    }
  }
  let next, data;
  if (spec.action === "create") {
    revision(await repo.getEntity("trades", id), 0);
    data = await references(repo, input);
    next = newTrade(input, data);
  } else {
    const old = await getTrade(repo, id);
    revision(old, options.revision);
    if (spec.type === "executions") next = spec.action === "delete" ? removeChild(old, "executions", options.id) : putExecution(old, { ...input, ...(spec.action === "update" ? { id: options.id } : {}) }, spec.action === "update");
    else if (spec.type === "adjustments") next = spec.action === "delete" ? removeChild(old, "adjustments", options.id) : putAdjustment(old, { ...input, ...(spec.action === "update" ? { id: options.id } : {}) }, spec.action === "update");
    else if (spec.type === "legs") {
      if (spec.action === "correct-snapshot") next = correctSnapshot(old, options.id, input);
      else if (spec.action === "delete") next = removeChild(old, "legs", options.id);
      else if (spec.action === "update") next = editLeg(old, options.id, input);
      else {
        if (old.legs.some((l) => l.id === input.id)) throw new CliError("VALIDATION", "Leg already exists.");
        const instrument = required(await repo.getEntity("instruments", input.instrumentId), "Instrument");
        next = replaceLegs(old, [...old.legs, input], { instruments: [instrument] });
      }
    } else {
      data = await references(repo, { ...old, strategyId: Object.hasOwn(input, "strategyId") ? input.strategyId : old.strategyId });
      next = editTrade(old, input, data);
    }
    data ||= await references(repo, next);
  }
  const previous = spec.action === "create" ? null : await getTrade(repo, id);
  if (previous) revision(previous, options.revision);
  const { trade: prepared, calculation } = prepareTradeResult(next, data, previous);
  const changes = correctionDiff(previous, prepared);
  let previewFingerprint;
  if (spec.action === "correct-snapshot") {
    previewFingerprint = await fingerprint({ tradeId: id, revision: options.revision, legId: options.id, snapshot: prepared.legs.find((l) => l.id === options.id).snapshot, calculation });
    if (!options.preview && !options["dry-run"] && options["accept-preview"] !== previewFingerprint) throw new CliError("PREVIEW_MISMATCH", "Correction or trade changed since preview. Generate and review a new preview.", 5);
  }
  if (options["dry-run"] || options.preview) return { dryRun: true, correctionRequired: changes.length > 0, corrections: changes, writeOutcome: { state: "not_applied" }, trade: prepared, calculation, ...(previewFingerprint ? { previewFingerprint } : {}) };
  correctionReason(reason, changes.length > 0);
  const trade = await repo.saveTrade(prepared, operationId, requestHash, { correctionReason: reason });
  let receipt;
  try { receipt = required(await repo.getOperation(id, operationId), "Operation receipt"); }
  catch (error) { error.writeOutcome = { state: 'applied' }; throw error; }
  return { trade, writeOutcome: { state: "applied" }, appliedRevision: receipt.revision, replayed: false };
}

export const handlers = {
  verifyExport: ({ input }) => verifyExport(input),
  corrections: async ({ repo, options }) => { required(await repo.getTrade(options.id), 'Trade'); return repo.getCorrections(options.id, options.page || 1, options['page-size'] || 12); },
  entity,
  tradeWrite,
  presets: async () => PRESETS,
  instrumentPreview: async ({ input }) => {
    const i = normalizeInstrument(instrumentDefaults(input));
    return { instrument: i, availableForNewTrades: !i.draft && !i.archived, automaticSizing: !i.draft && i.model === "linear", automaticPnl: !i.draft && i.model === "linear", quantityUnit: i.quantityUnit, quantityIncrement: i.quantityIncrement, pointValue: i.pointValue, currency: i.currency };
  },
  linkedTrades: async ({ repo, options }) => {
    required(await repo.getEntity("strategies", options.id), "Strategy");
    return (await repo.list("trades")).filter((t) => t.strategyId === options.id);
  },
  journal: async ({ repo, options }) => {
    for (const key of ["from", "to"]) if (options[key] && !isCalendarDate(options[key])) throw new CliError("VALIDATION", `Invalid --${key} date.`);
    if (options.from && options.to && options.from > options.to) throw new CliError("VALIDATION", "Opening-date range is reversed.");
    if (options.status && !["open", "closed"].includes(options.status)) throw new CliError("VALIDATION", "Status must be open or closed.");
    const settings = await repo.getSettings();
    return filterJournal(await repo.list("trades"), options, options.page || 1, options["page-size"] || 12, options.timezone || settings.timezone);
  },
  overview: async ({ repo, options }) => {
    const accounts = await repo.list("accounts");
    if (options.account) required(accounts.find((a) => a.id === options.account), "Account");
    return journalOverview(await repo.list("trades"), accounts, options.account);
  },
  tradeRead: async ({ repo, options }) => {
    const trade = await getTrade(repo, options.id);
    return { trade, calculation: calculateTrade(trade) };
  },
  childRead: async ({ repo, spec, options }) => {
    const trade = await getTrade(repo, options.trade);
    return spec.action === "list" ? trade[spec.type] : required(trade[spec.type].find((r) => r.id === options.id));
  },
  tradeDelete: async ({ repo, options }) => {
    const trade = await getTrade(repo, options.id);
    revision(trade, options.revision);
    if (options["dry-run"]) return { dryRun: true, id: trade.id, removed: { legs: trade.legs.length, executions: trade.executions.length, adjustments: trade.adjustments.length } };
    await repo.deleteTrade(trade);
    return { deleted: true, id: trade.id };
  },
  receipt: async ({ repo, options }) => required(await repo.getOperation(options.trade, options["operation-id"]), "Operation receipt"),
  size: async ({ repo, options }) => {
    const trade = await getTrade(repo, options.trade);
    if (trade.legs.length !== 1) throw new CliError("VALIDATION", "Automatic sizing applies only to single-leg linear trades.");
    return sizePosition(required(trade.legs.find((l) => l.id === options.leg), "Leg"), trade.accountCurrency);
  },
  settings: async ({ repo, spec, options, input }) => {
    const old = await repo.getSettings();
    if (spec.action === "get") return old;
    revision(old, options.revision);
    const value = validateSettings({ ...old, ...input, id: "preferences" });
    if (value.defaultAccount) required(await repo.getEntity("accounts", value.defaultAccount), "Default account");
    return options["dry-run"] ? { dryRun: true, record: value } : repo.saveEntity("settings", value);
  },
  export: async ({ repo }) => new JournalTransfer(repo).export(),
  import: async ({ repo, spec, options, input }) => {
    const transfer = new JournalTransfer(repo);
    const choice = { mode: options.mode, includeSettings: !!options['include-settings'], acceptPreview: options['accept-preview'], operationId: options['operation-id'], yes: !!options.yes };
    if (spec.action === 'preview') return transfer.preview(input, choice);
    if (spec.action === 'apply') return transfer.apply(input, choice);
    if (spec.action === 'status') return transfer.report(options['operation-id']);
    if (spec.action === 'resume') return transfer.resume(options['operation-id']);
    return transfer.rollback(options['operation-id'], options.yes);
  },
  backup: async ({ repo, spec, options }) => {
    const transfer = new JournalTransfer(repo);
    if (spec.action === 'list') return transfer.backups();
    if (spec.action === 'export') return transfer.backupExport(options['operation-id']);
    return transfer.deleteBackup(options['operation-id'], options.yes);
  },
};
