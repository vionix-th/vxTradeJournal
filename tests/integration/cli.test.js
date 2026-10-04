import { readFileSync } from "node:fs";
import { mkdtemp, rm, chmod, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawn } from "node:child_process";
import { beforeAll, afterAll, it, expect } from "vitest";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { Repository } from "../../src/persistence/repository.js";

let env, root, email, uid;
const project = "demo-vxjournal-auto";
const executable = process.env.VXJ_CLI_EXECUTABLE || resolve("src/cli/index.js");
async function cli(command, input, extra = {}, directory = root) {
  const args = [...command.split(" "), "--profile", "auto"];
  for (const [key, value] of Object.entries(extra)) { args.push(`--${key}`); if (value !== true) args.push(String(value)); }
  if (input !== undefined) args.push("--input", "-");
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [executable, ...args], { cwd: tmpdir(), env: { ...process.env, VXJ_CONFIG_DIR: directory } });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => { try { done({ code, body: JSON.parse(stdout), stderr }); } catch { reject(new Error(`CLI returned invalid JSON (exit ${code}): ${stdout} ${stderr}`)); } });
    child.stdin.end(input === undefined ? "" : JSON.stringify(input));
  });
}
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "vxj-cli-"));
  env = await initializeTestEnvironment({ projectId: project, firestore: { host: "127.0.0.1", port: 8280, rules: readFileSync("firestore.rules", "utf8") } });
  await env.clearFirestore();
  email = `cli-${crypto.randomUUID()}@example.test`;
  const registered = await cli("auth register", { email, password: "Synthetic-test-123" });
  expect(registered.code).toBe(0);
  uid = registered.body.data.uid;
  const unverified = await cli("accounts create", { id: "blocked", name: "Blocked", currency: "USD" });
  expect(unverified.code).toBe(3);
  const response = await fetch(`http://127.0.0.1:9299/emulator/v1/projects/${project}/oobCodes`);
  const codes = await response.json();
  const code = codes.oobCodes.find((item) => item.email === email && item.requestType === "VERIFY_EMAIL");
  await fetch("http://127.0.0.1:9299/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ oobCode: code.oobCode }) });
}, 30000);
afterAll(async () => { await env?.cleanup(); await rm(root, { recursive: true, force: true }); });

it("uses renewable sessions across processes and protects credentials", async () => {
  const status = await cli("auth status");
  expect(status.body.data, JSON.stringify(status.body)).toMatchObject({ uid, emailVerified: true });
  expect(status.stderr).toBe("");
  expect(JSON.stringify(status.body)).not.toMatch(/refreshToken|idToken|Synthetic-test/);
  const session = await readFile(join(root, "auto.json"), "utf8");
  expect(session).not.toMatch(/password|idToken|Synthetic-test/);
  const otherRoot = await mkdtemp(join(tmpdir(), "vxj-other-"));
  try { expect((await cli("accounts list", undefined, {}, otherRoot)).code).toBe(3); }
  finally { await rm(otherRoot, { recursive: true, force: true }); }
});

it("records trades, calculations and corrections with revision and retry guarantees", async () => {
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
  const retry = await cli("trades create", input, { "operation-id": "create" });
  expect(retry.body.data.replayed).toBe(true);
  expect((await cli("trades create", { ...input, review: "Changed" }, { "operation-id": "create" })).code).toBe(5);
  expect((await cli("calculate size", undefined, { trade: "t", leg: "t-leg-1" })).body.data.quantity).toBe("250");
  const entry = { id: "e1", legId: "t-leg-1", kind: "entry", quantity: "2", price: "10", fees: "1", timestamp: "2026-01-01T00:00:00Z" };
  expect((await cli("executions add", entry, { trade: "t", revision: 1, "operation-id": "entry" })).code).toBe(0);
  const exit = { ...entry, id: "e2", kind: "exit", price: "12", fees: "0", timestamp: "2026-01-02T00:00:00Z" };
  expect((await cli("executions add", exit, { trade: "t", revision: 2, "operation-id": "exit" })).body.data.trade.summary.accountNet).toBe("3");
  expect((await cli("executions update", { quantity: "1" }, { trade: "t", id: "e1", revision: 3, "operation-id": "bad" })).code).toBe(2);
  expect((await cli("trades update", { review: "stale" }, { id: "t", revision: 1, "operation-id": "stale" })).code).toBe(5);
  const correction = { pointValue: "2" };
  const preview = await cli("legs correct-snapshot", correction, { trade: "t", id: "t-leg-1", revision: 3, preview: true });
  expect(preview.body.data.calculation.accountNet).toBe("7");
  const corrected = await cli("legs correct-snapshot", correction, { trade: "t", id: "t-leg-1", revision: 3, "operation-id": "correct", "accept-preview": preview.body.data.previewFingerprint });
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
  expect((await cli("trades delete", undefined, { id: "t", revision: 4, yes: true })).code).toBe(0);
  expect(await nativeRepo.listChildren("t", "operations")).toEqual([]);
}, 90000);

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
  saved = await cli("legs correct-snapshot", { currency: "EUR" }, { ...options, "operation-id": "fx-correction", "accept-preview": preview.body.data.previewFingerprint });
  expect(saved.code, JSON.stringify(saved.body)).toBe(0);
  expect(saved.body.data.trade.legs[0].planning.rate).toBeNull();
  expect(saved.body.data.trade.executions.map((e) => e.resultRate)).toEqual([null, null]);
  expect(saved.body.data.trade.executions[0]).toMatchObject({ feeCurrency: "USD", feeRate: "1" });
  saved = await cli("executions update", { resultRate: "0.8" }, { trade: "fx-trade", id: "fx-exit", revision: saved.body.data.trade.revision, "operation-id": "fx-explicit-rate" });
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

it("does not expose another user's records and rejects unsafe saved sessions", async () => {
  const other = await mkdtemp(join(tmpdir(), "vxj-user-"));
  try {
    await cli("auth register", { email: `other-${crypto.randomUUID()}@example.test`, password: "Synthetic-test-123" }, {}, other);
    const listed = await cli("accounts list", undefined, {}, other);
    expect(listed.body.data, JSON.stringify(listed.body)).toEqual([]);
    expect((await cli("accounts get", undefined, { id: "a" }, other)).code).toBe(4);
    await chmod(join(other, "auto.json"), 0o644);
    expect((await cli("auth status", undefined, {}, other)).code).toBe(2);
  } finally { await rm(other, { recursive: true, force: true }); }
});

it("covers archives, settings, multi-leg manual results and retained incomplete FX", async () => {
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
  saved = await cli("executions update", { resultRate: "0.8" }, { trade: "multi", id: "short-exit", revision: 5, "operation-id": "fx" });
  expect(saved.body.data.trade.summary.complete).toBe(false);
  saved = await cli("executions update", { manualGross: "3.25", manualSource: "broker-reported" }, { trade: "multi", id: "option-settle", revision: 6, "operation-id": "manual" });
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
