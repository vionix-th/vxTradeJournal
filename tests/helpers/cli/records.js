import { createTrade } from '../../../src/domain/journal.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { it, expect } from 'vitest';
import { Repository } from '../../../src/persistence/repository.js';
export function register(context) {
 const { cli, prerequisites } = context;
it("creates trades with dry-run, canonical dates and idempotent receipts", async () => {
  const a = await cli("accounts create", { id: "a", name: "Main", currency: "USD" });
  expect(a.code, JSON.stringify(a.body)).toBe(0);
  const i = await cli("instruments create", { id: "i", name: "Acme", symbol: "ACME", preset: "equity", currency: "USD", priceUnit: "USD/share" });
  expect(i.code).toBe(0);
  expect((await cli("strategies create", { id: "s", name: "Rules", entryRules: "Original" })).code).toBe(0);
  const input = { id: "t", accountId: "a", strategyId: "s", legs: [{ instrumentId: "i", direction: "long", planning: { entry: "10", stop: "8", riskBudget: "500" } }] };
  const dry = await cli("trades create", input, { "operation-id": "create", "dry-run": true });
  expect(dry.body.data.dryRun).toBe(true);
  expect((await cli("trades get", undefined, { id: "t" })).code).toBe(4);
  const created = await cli("trades create", input, { "operation-id": "create" });
  expect(created.code).toBe(0);
  expect(created.body.data.trade.revision).toBe(1);
  const createdDate = created.body.data.trade.createdAt;
  expect(created.body.data.trade.openedAt).toBe(createdDate);
  expect(created.body.data.trade.summary.openedAt).toBe(createdDate);
  expect((await cli("calculate trade", undefined, { id: "t" })).body.data.calculation.openedAt).toBe(createdDate);
  expect((await cli("journal list", undefined, { from: createdDate.slice(0, 10), to: createdDate.slice(0, 10), timezone: "UTC" })).body.data.total).toBe(1);
  expect((await cli("export")).body.data.trades.find((trade) => trade.id === "t").openedAt).toBe(createdDate);
  const retry = await cli("trades create", input, { "operation-id": "create" });
  expect(retry.body.data.replayed).toBe(true);
  expect((await cli("operations get", undefined, { trade: "t", "operation-id": "create" })).body.data.revision).toBe(1);
  expect((await cli("trades create", { ...input, review: "Changed" }, { "operation-id": "create" })).code).toBe(5);
  expect((await cli("calculate size", undefined, { trade: "t", leg: "t-leg-1" })).body.data.quantity).toBe("250");

}, 60000);

it("records fills and rejects invalid earlier edits and stale revisions", async () => {
  const a = await cli("accounts create", { id: "a", name: "Main", currency: "USD" });
  expect(a.code, JSON.stringify(a.body)).toBe(0);
  const i = await cli("instruments create", { id: "i", name: "Acme", symbol: "ACME", preset: "equity", currency: "USD", priceUnit: "USD/share" });
  expect(i.code).toBe(0);
  expect((await cli("strategies create", { id: "s", name: "Rules", entryRules: "Original" })).code).toBe(0);
  const input = { id: "t", accountId: "a", strategyId: "s", legs: [{ instrumentId: "i", direction: "long", planning: { entry: "10", stop: "8", riskBudget: "500" } }] };

  expect((await cli("trades create", input, {"operation-id":"create"})).code).toBe(0);
  const entry = { id: "e1", legId: "t-leg-1", kind: "entry", quantity: "2", price: "10", fees: "1", timestamp: "2026-01-01T00:00:00Z" };
  expect((await cli("executions add", entry, { trade: "t", revision: 1, "operation-id": "entry" })).code).toBe(0);
  const exit = { ...entry, id: "e2", kind: "exit", price: "12", fees: "0", timestamp: "2026-01-02T00:00:00Z" };
  expect((await cli("executions add", exit, { trade: "t", revision: 2, "operation-id": "exit" })).body.data.trade.summary.accountNet).toBe("3");
  expect((await cli("executions update", { quantity: "1" }, { trade: "t", id: "e1", revision: 3, "operation-id": "bad" })).code).toBe(2);
  expect((await cli("trades update", { review: "stale" }, { id: "t", revision: 1, "operation-id": "stale" })).code).toBe(5);

}, 60000);

it("previews historical corrections, preserves catalogue and exports exact source", async () => {
 const {env,uid} = context;
 const native = await prerequisites({instrument:true});
 const account=await native.getEntity('accounts','a'), instrument=await native.getEntity('instruments','i');
 const strategy=await native.saveEntity('strategies',{id:'s',name:'Rules',entryRules:'Original'});
 const trade=createTrade({id:'t',account,strategy,instruments:[{instrument,direction:'long'}]});
 trade.executions=['entry','exit'].map((kind,index)=>({id:'e'+(index+1),legId:trade.legs[0].id,kind,quantity:'2',price:index?'12':'10',fees:index?'0':'1',feeCurrency:'USD',timestamp:'2026-01-0'+(index+1)+'T00:00:00Z'}));
 const saved=await native.saveTrade(trade,'seed');
  const correction = { pointValue: "2" };
  const preview = await cli("legs correct-snapshot", correction, { trade: "t", id: "t-leg-1", revision: saved.revision, preview: true });
  expect(preview.body.data.calculation.accountNet).toBe("7");
  const mismatched = await cli("legs correct-snapshot", { pointValue: "3" }, { trade: "t", id: "t-leg-1", revision: saved.revision, "operation-id": "wrong-preview", "correction-reason": "Correct historical broker data", "accept-preview": preview.body.data.previewFingerprint });
  expect(mismatched.body.error.code).toBe("PREVIEW_MISMATCH");
  expect((await cli("trades get", undefined, { id: "t" })).body.data.trade.revision).toBe(saved.revision);
  const corrected = await cli("legs correct-snapshot", correction, { trade: "t", id: "t-leg-1", revision: saved.revision, "operation-id": "correct", "correction-reason": "Correct historical broker data", "accept-preview": preview.body.data.previewFingerprint });
  expect(corrected.code).toBe(0);
  expect(corrected.body.data.trade.summary.accountNet).toBe("7");
  const nativeRepo = new Repository(env.authenticatedContext(uid, { email_verified: true }).firestore(), uid);
  expect((await nativeRepo.getTrade("t")).summary.accountNet).toBe("7");
  expect((await cli("instruments get", undefined, { id: "i" })).body.data.pointValue).toBe("1");
  expect((await cli("strategies trades", undefined, { id: "s" })).body.data).toHaveLength(1);
  expect((await cli("journal list", undefined, { account: "a", status: "closed" })).body.data.total).toBe(1);
  const exported = await cli("export");
  expect(exported.body.data.format).toBe("vxTradeJournal");
  expect(exported.body.data.trades[0].executions).toHaveLength(2);
  expect((await cli("accounts update", { currency: "EUR" }, { id: "a", revision: 2 })).code).toBe(2);
  expect((await cli("trades delete", undefined, { id: "t", revision: corrected.body.data.trade.revision, yes: true })).code).toBe(0);
  expect(await nativeRepo.listChildren("t", "operations")).toEqual([]);

}, 60000);

it("invalidates snapshot FX in correction previews and saved records, then accepts explicit historical rates", async () => {

  expect((await cli("accounts create", { id: "fx-account", name: "FX audit", currency: "USD" })).code).toBe(0);
  expect((await cli("instruments create", { id: "fx-instrument", name: "FX equity", symbol: "FX", preset: "equity", currency: "USD" })).code).toBe(0);
  let saved = await cli("trades create", { id: "fx-trade", accountId: "fx-account", legs: [{ id: "fx-leg", instrumentId: "fx-instrument", direction: "long", planning: { entry: "10", stop: "8", rate: "1" } }] }, { "operation-id": "fx-create" });
  expect(saved.code).toBe(0);
  for (const [index, kind] of ["entry", "exit"].entries()) {
    saved = await cli("executions add", { id: `fx-${kind}`, legId: "fx-leg", kind, quantity: "2", price: kind === "entry" ? "10" : "12", fees: kind === "entry" ? "1" : "0", timestamp: `2026-01-0${index + 1}T00:00:00Z` }, { trade: "fx-trade", revision: saved.body.data.trade.revision, "operation-id": `fx-${kind}` });
    expect(saved.code, JSON.stringify(saved.body)).toBe(0);
  }
  expect(saved.body.data.trade.summary.accountNet).toBe("3");
  const options = { trade: "fx-trade", id: "fx-leg", revision: saved.body.data.trade.revision };
  const preview = await cli("legs correct-snapshot", { currency: "EUR" }, { ...options, preview: true });
  expect(preview.code).toBe(0);
  expect(preview.body.data.calculation).toMatchObject({ complete: false, accountNet: null, knownAccountNet: "-1", native: { EUR: "4", USD: "-1" } });
  expect((await cli("trades get", undefined, { id: "fx-trade" })).body.data.trade.summary.accountNet).toBe("3");
  saved = await cli("legs correct-snapshot", { currency: "EUR" }, { ...options, "operation-id": "fx-correction", "correction-reason": "Correct historical broker data", "accept-preview": preview.body.data.previewFingerprint });
  expect(saved.code, JSON.stringify(saved.body)).toBe(0);
  expect(saved.body.data.trade.legs[0].planning.rate).toBeNull();
  expect(saved.body.data.trade.executions.map((e) => e.resultRate)).toEqual([null, null]);
  expect(saved.body.data.trade.executions[0]).toMatchObject({ feeCurrency: "USD", feeRate: "1" });
  saved = await cli("executions update", { resultRate: "0.8" }, { trade: "fx-trade", id: "fx-exit", revision: saved.body.data.trade.revision, "operation-id": "fx-explicit-rate", "correction-reason": "Correct historical source record" });
  expect(saved.code).toBe(0);
  expect(saved.body.data.trade.summary.accountNet).toBe("2.2");
  const exported = await cli("export");
  expect(exported.body.data.trades.find((t) => t.id === "fx-trade").summary.accountNet).toBe("2.2");
  expect((await cli("instruments get", undefined, { id: "fx-instrument" })).body.data.currency).toBe("USD");
  expect((await cli("trades delete", undefined, { id: "fx-trade", revision: saved.body.data.trade.revision, yes: true })).code).toBe(0);
}, 90000);

it("rejects impossible instrument expiry dates through the CLI", async () => {

  const input = { id: "invalid-expiry", name: "Expiry audit", symbol: "EXPA", preset: "options", currency: "USD", expiry: "2026-02-30" };
  const rejected = await cli("instruments create", input);
  expect(rejected.code).toBe(2);
  expect(rejected.body.error.message).toMatch(/expiry.*date/i);
  expect((await cli("instruments get", undefined, { id: input.id })).code).toBe(4);
  const preview = await cli("instruments preview", { name: input.name, symbol: input.symbol, preset: input.preset, currency: input.currency, expiry: "2028-02-29" });
  expect(preview.code, JSON.stringify(preview.body)).toBe(0);
  expect(preview.body.data.instrument.expiry).toBe("2028-02-29");
});

it("rejects off-increment plans before saving and preserves records after rejected edits", async () => {
    const { env, uid } = context;

  expect((await cli("accounts create", { id: "plan-account", name: "Plan increments", currency: "USD" })).code).toBe(0);
  expect((await cli("instruments create", { id: "plan-whole", name: "Whole contracts", symbol: "WHOLE", preset: "futures", currency: "USD" })).code).toBe(0);
  const nativeRepo = new Repository(env.authenticatedContext(uid, { email_verified: true }).firestore(), uid);
  const invalid = await cli("trades create", { id: "invalid-plan", accountId: "plan-account", legs: [
    { instrumentId: "plan-whole", direction: "long", planning: { quantity: "1.5" } },
  ] }, { "operation-id": "invalid-plan-create" });
  expect(invalid.code).toBe(2);
  expect(invalid.body.error.message).toMatch(/quantity.*increment/i);
  expect(await nativeRepo.getTrade("invalid-plan")).toBeNull();
  expect(await nativeRepo.getOperation("invalid-plan", "invalid-plan-create")).toBeNull();

  expect((await cli("instruments create", { id: "plan-fractional", name: "Fractional units", symbol: "FRAC", preset: "equity", currency: "USD", quantityIncrement: "0.25" })).code).toBe(0);
  const created = await cli("trades create", { id: "fractional-plan", accountId: "plan-account", legs: [
    { id: "fractional-leg", instrumentId: "plan-fractional", direction: "long", planning: { quantity: "1.5" } },
  ] }, { "operation-id": "fractional-plan-create" });
  expect(created.code, JSON.stringify(created.body)).toBe(0);
  const before = await nativeRepo.getTrade("fractional-plan");
  const edited = await cli("legs update", { planning: { quantity: "1.3" } }, {
    trade: "fractional-plan", id: "fractional-leg", revision: 1, "operation-id": "invalid-plan-edit",
  });
  expect(edited.code).toBe(2);
  expect(edited.body.error.message).toMatch(/quantity.*increment/i);
  expect(await nativeRepo.getTrade("fractional-plan")).toEqual(before);
  expect(await nativeRepo.getOperation("fractional-plan", "invalid-plan-edit")).toBeNull();
  expect((await cli("trades delete", undefined, { id: "fractional-plan", revision: 1, yes: true })).code).toBe(0);
}, 60000);

it("removes eligible persisted legs and preserves executed legs and the final leg", async () => {

  await cli("accounts create", { id: "removal-account", name: "Removal", currency: "USD" });
  await cli("instruments create", { id: "removal-instrument", name: "Removal equity", symbol: "REMOVE", preset: "equity", currency: "USD" });
  let saved = await cli("trades create", { id: "removal", accountId: "removal-account", legs: ["protected", "eligible"].map((id) => ({ id, instrumentId: "removal-instrument", direction: "long" })) }, { "operation-id": "removal-create" });
  expect(saved.code).toBe(0);
  saved = await cli("executions add", { id: "removal-entry", legId: "protected", kind: "entry", quantity: "1", price: "10", timestamp: "2026-01-01T00:00:00Z" }, { trade: "removal", revision: 1, "operation-id": "removal-entry" });
  expect(saved.code).toBe(0);
  expect((await cli("legs delete", undefined, { trade: "removal", id: "protected", revision: 2, "operation-id": "protected-delete", yes: true })).code).toBe(2);
  saved = await cli("legs delete", undefined, { trade: "removal", id: "eligible", revision: 2, "operation-id": "eligible-delete", "correction-reason": "Correct historical source record", yes: true });
  expect(saved.body.data.trade.legs).toHaveLength(1);
  expect(saved.body.data.trade.executions).toHaveLength(1);
  expect((await cli("legs delete", undefined, { trade: "removal", id: "protected", revision: 3, "operation-id": "last-delete", yes: true })).code).toBe(2);
  expect((await cli("executions delete", undefined, { trade: "removal", id: "removal-entry", revision: 3, "operation-id": "remove-entry", "correction-reason": "Correct historical source record", yes: true })).code).toBe(0);
  expect((await cli("legs delete", undefined, { trade: "removal", id: "protected", revision: 4, "operation-id": "empty-delete", yes: true })).code).toBe(2);
}, 60000);

it("rejects invalid supplied Entry result rates and accepts corrected retained rates", async () => {

  await cli("accounts create", { id: "rate-account", name: "Rates", currency: "USD" });
  await cli("instruments create", { id: "rate-instrument", name: "Foreign equity", symbol: "RATE", preset: "equity", currency: "EUR" });
  const created = await cli("trades create", { id: "rates", accountId: "rate-account", legs: [{ id: "rate-leg", instrumentId: "rate-instrument", direction: "long" }] }, { "operation-id": "rates-create" });
  expect(created.code).toBe(0);
  const entry = { id: "rate-entry", legId: "rate-leg", kind: "entry", quantity: "1", price: "10", feeCurrency: "USD", timestamp: "2026-01-01T00:00:00Z", resultRate: "-1" };
  expect((await cli("executions add", entry, { trade: "rates", revision: 1, "operation-id": "invalid-rate" })).code).toBe(2);
  expect((await cli("trades get", undefined, { id: "rates" })).body.data.trade.executions).toHaveLength(0);
  const saved = await cli("executions add", { ...entry, resultRate: "0.8" }, { trade: "rates", revision: 1, "operation-id": "valid-rate" });
  expect(saved.body.data.trade.executions[0].resultRate).toBe("0.8");
}, 60000);

it("blocks draft catalogue definitions from starting trades through the CLI", async () => {

  await prerequisites();
  const definition = { id: "draft-definition", name: "Draft", symbol: "DRAFT", preset: "equity", draft: true };
  expect((await cli("instruments create", definition)).code).toBe(0);
  expect((await cli("instruments preview", { name: definition.name, symbol: definition.symbol, preset: definition.preset, draft: true })).body.data.availableForNewTrades).toBe(false);
  const rejected = await cli("trades create", { id: "draft-blocked", accountId: "a", legs: [{ instrumentId: definition.id, direction: "long" }] }, { "operation-id": "draft-blocked" });
  expect(rejected.code).toBe(2);
  expect((await cli("trades get", undefined, { id: "draft-blocked" })).code).toBe(4);
});

it("covers archives, settings, multi-leg manual results and retained incomplete FX", async () => {
    const { root, email } = context;

  await prerequisites({ instrument: true });
  expect((await cli("accounts create", { id: "eur", name: "Euro", currency: "EUR" })).code).toBe(0);
  expect((await cli("settings update", { theme: "dark", timezone: "Asia/Bangkok", defaultAccount: "eur" }, { revision: 0 })).code).toBe(0);
  expect((await cli("settings get")).body.data.defaultAccount).toBe("eur");
  expect((await cli("accounts archive", undefined, { id: "eur", revision: 1 })).body.data.archived).toBe(true);
  const planned = { id: "multi", accountId: "eur", legs: [{ id: "linear-leg", instrumentId: "i", direction: "short" }, { id: "manual-leg", instrumentId: "option", direction: "long" }] };
  expect((await cli("instruments create", { id: "option", name: "Option", symbol: "OPT", preset: "options", currency: "EUR" })).code).toBe(0);
  expect((await cli("trades create", planned, { "operation-id": "archived-create" })).code).toBe(2);
  expect((await cli("accounts unarchive", undefined, { id: "eur", revision: 2 })).code).toBe(0);
  let saved = await cli("trades create", planned, { "operation-id": "multi-create" });
  expect(saved.code, JSON.stringify(saved.body)).toBe(0);
  const fills = [
    { id: "short-entry", legId: "linear-leg", kind: "entry", quantity: "2", price: "20" },
    { id: "short-exit", legId: "linear-leg", kind: "exit", quantity: "2", price: "18" },
    { id: "option-entry", legId: "manual-leg", kind: "entry", quantity: "1", price: "1" },
    { id: "option-settle", legId: "manual-leg", kind: "settlement", quantity: "1", price: null, reason: "Expiry", manualGross: null },
  ];
  for (const [index, fill] of fills.entries()) {
    saved = await cli("executions add", { ...fill, timestamp: `2026-01-0${index + 1}T00:00:00Z` }, { trade: "multi", revision: saved.body.data.trade.revision, "operation-id": fill.id });
    expect(saved.code, JSON.stringify(saved.body)).toBe(0);
  }
  expect(saved.body.data.trade.summary).toMatchObject({ complete: false, accountNet: null, status: "closed" });
  expect((await cli("calculate size", undefined, { trade: "multi", leg: "linear-leg" })).code).toBe(2);
  saved = await cli("executions update", { resultRate: "0.8" }, { trade: "multi", id: "short-exit", revision: 5, "operation-id": "fx", "correction-reason": "Correct historical source record" });
  expect(saved.body.data.trade.summary.complete).toBe(false);
  saved = await cli("executions update", { manualGross: "3.25", manualSource: "broker-reported" }, { trade: "multi", id: "option-settle", revision: 6, "operation-id": "manual", "correction-reason": "Correct historical source record" });
  // Short gross 2*(20-18)=4 USD -> 3.2 EUR; manual gross 3.25 EUR.
  expect(saved.body.data.trade.summary.accountNet).toBe("6.45");
  saved = await cli("adjustments add", { id: "credit", amount: "0.05", currency: "EUR", timestamp: "2026-01-05T00:00:00Z", reason: "Credit" }, { trade: "multi", revision: 7, "operation-id": "credit" });
  expect(saved.body.data.trade.summary.accountNet).toBe("6.5");
  expect((await cli("adjustments get", undefined, { trade: "multi", id: "credit" })).body.data.amount).toBe("0.05");
  expect((await cli("executions list", undefined, { trade: "multi" })).body.data).toHaveLength(4);
  expect((await cli("legs get", undefined, { trade: "multi", id: "manual-leg" })).body.data.snapshot.model).toBe("manual");
  expect((await cli("journal overview", undefined, { account: "eur" })).body.data.net).toBe("6.5");
  const output = join(root, "export.json");
  expect((await cli("export", undefined, { output })).code).toBe(0);
  expect(JSON.parse(await readFile(output, "utf8")).trades.find((t) => t.id === "multi").summary.accountNet).toBe("6.5");
  expect((await cli("export", undefined, { output })).code).toBe(2);
  expect((await cli("export", undefined, { output, overwrite: true })).code).toBe(0);
  expect((await cli("auth logout")).body.data.scope).toBe("local");
  expect((await cli("auth status")).code).toBe(3);
  expect((await cli("auth login", { email, password: "Synthetic-test-123" })).code).toBe(0);
}, 90000);
}
