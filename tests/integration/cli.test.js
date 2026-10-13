import { register as registerauth } from '../helpers/cli/auth.js';
import { register as registerreporting } from '../helpers/cli/reporting.js';
import { register as registerrecords } from '../helpers/cli/records.js';
import { register as registertransfer } from '../helpers/cli/transfer.js';
import { readyDatabase } from '../helpers/database.js';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { beforeAll, beforeEach, afterAll, expect } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Repository } from '../../src/persistence/repository.js';
import { SessionStore } from '../../src/cli/session-store.js';
import { PRESETS } from '../../src/domain/journal.js';

let env, root, email, uid, verifiedSession;
const project = "demo-vxjournal-auto";
const executable = process.env.VXJ_CLI_EXECUTABLE || resolve("src/cli/index.js");
async function cli(command, input, extra = {}, directory = root, profile = "auto") {
  const args = [...command.split(" "), ...(command === "export verify" ? [] : ["--profile", profile])];
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
  await readyDatabase(env);
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
  verifiedSession = await new SessionStore(root).read("auto");
}, 30000);
beforeEach(async () => {
  await env.clearFirestore();
  await readyDatabase(env);
  await new SessionStore(root).write("auto", verifiedSession);
});
afterAll(async () => { await env?.cleanup(); await rm(root, { recursive: true, force: true }); });

async function prerequisites({ instrument = false } = {}) {
  const repo = new Repository(env.authenticatedContext(uid, { email_verified: true }).firestore(), uid);
  await repo.saveEntity("accounts", { id: "a", name: "Main", currency: "USD" });
  if (instrument) {
    const { label: _label, ...defaults } = PRESETS.equity;
    await repo.saveEntity("instruments", { ...defaults, id: "i", name: "Acme", symbol: "ACME", preset: "equity", currency: "USD", priceUnit: "USD/share" });
  }
  return repo;
}

const context = { cli, prerequisites, get env() { return env; }, get root() { return root; }, get email() { return email; }, get uid() { return uid; }, get verifiedSession() { return verifiedSession; }, project };
registerauth(context);
registerreporting(context);
registerrecords(context);
registertransfer(context);
