#!/usr/bin/env node
import { readFile, writeFile, rename, unlink, lstat } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";
import web from "../../firebase.web.json" with { type: "json" };
import pkg from "../../package.json" with { type: "json" };
import { firebaseConfiguration } from "../config/firebase.js";
import { SCHEMA_VERSION, CALCULATION_VERSION } from "../domain/journal.js";
import { parseArguments, validateInput, catalogue } from "./catalogue.js";
import { handlers } from "./commands.js";
import { UserSession } from "./auth.js";
import { assertDatabaseReady, databaseStatus } from "../persistence/availability.js";
import { connectJournal } from "./firebase.js";
import { IMPORT_MAX_BYTES } from '../application/portable.js';
import { JournalTransfer } from '../persistence/transfer.js';
import { CliError, publicError } from "./errors.js";

const version = typeof __CLI_VERSION__ === "undefined" ? pkg.version : __CLI_VERSION__;
const commit = typeof __CLI_COMMIT__ === "undefined" ? "development" : __CLI_COMMIT__;
const credentialsCommands = new Set(["auth login", "auth register"]);
async function inputJson(path, limit = 1024 * 1024) {
  let text;
  if (path === "-") {
    const chunks = [];
    let size = 0;
    for await (const chunk of process.stdin) {
      size += Buffer.byteLength(chunk);
      if (size > limit) throw new CliError("INVALID_INPUT", `JSON input exceeds ${limit / 1024 / 1024} MiB.`);
      chunks.push(chunk);
    }
    text = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
  } else {
    if ((await lstat(path)).size > limit) throw new CliError("INVALID_INPUT", `JSON input exceeds ${limit / 1024 / 1024} MiB.`);
    text = await readFile(path, "utf8");
  }
  try { return JSON.parse(text); } catch { throw new CliError("INVALID_INPUT", "Invalid JSON input."); }
}
async function passwordPrompt() {
  process.stderr.write("Password: ");
  emitKeypressEvents(process.stdin);
  const raw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((done, reject) => {
    let value = "";
    const finish = (error) => {
      process.stdin.removeListener("keypress", keypress);
      process.stdin.setRawMode(raw || false);
      process.stdin.pause();
      process.stderr.write("\n");
      if (error) reject(error); else done(value);
    };
    const keypress = (text, key = {}) => {
      if (key.name === "return" || key.name === "enter") return finish();
      if (key.ctrl && ["c", "d"].includes(key.name)) return finish(new CliError("CANCELLED", "Login cancelled."));
      if (key.name === "backspace") value = Array.from(value).slice(0, -1).join("");
      else if (!key.ctrl && !key.meta && text && !text.startsWith("\u001b")) value += text;
    };
    process.stdin.on("keypress", keypress);
  });
}
async function loginInput(input, options) {
  const result = { ...input, email: input.email || options.email };
  if (result.email && result.password) return result;
  if (!process.stdin.isTTY || !process.stderr.isTTY) throw new CliError("INVALID_INPUT", "Supply email and password as JSON through --input - in noninteractive sessions.");
  if (!result.email) {
    const reader = createInterface({ input: process.stdin, output: process.stderr });
    try { result.email = await reader.question("Email: "); } finally { reader.close(); }
  }
  if (!result.password) result.password = await passwordPrompt();
  return result;
}
async function exportFile(path, data, overwrite) {
  const destination = resolve(path);
  let info;
  try { info = await lstat(destination); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (info && !overwrite) throw new CliError("OUTPUT_EXISTS", "Output already exists; use --overwrite to replace it.");
  if (info && (!info.isFile() || info.isSymbolicLink())) throw new CliError("INVALID_OUTPUT", "Export destination must be a regular file.");
  if (!overwrite) await writeFile(destination, `${JSON.stringify(data, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  else {
    const temp = join(dirname(destination), `.vxjournal-export-${crypto.randomUUID()}`);
    try {
      await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, { flag: "wx", mode: 0o600 });
      await rename(temp, destination);
    } finally { await unlink(temp).catch(() => {}); }
  }
  return { path: destination, schemaVersion: data.schemaVersion, calculationVersion: data.calculationVersion };
}

const isMutation = (spec) => ['tradeWrite', 'tradeDelete'].includes(spec.handler) || spec.handler === 'entity' && !['list', 'get'].includes(spec.action) || spec.handler === 'settings' && spec.action === 'update' || spec.handler === 'import' && ['apply', 'resume', 'rollback'].includes(spec.action) || spec.handler === 'backup' && spec.action === 'delete';
const optionsState = (parsed) => parsed.options['dry-run'] || parsed.options.preview ? 'not_applied' : 'applied';
export async function run(args = process.argv.slice(2)) {
  let parsed, config, connection;
  const context = {};
  let writing = false, writeStarted = false, confirmedOutcome = null;
  const emit = (body) => process.stdout.write(`${JSON.stringify({ cliContractVersion: 1, ...context, ...body })}\n`);
  const timeout = ['import', 'backup', 'export'].includes(args[0]) ? null : setTimeout(() => {
    if (process.stdin.isTTY && process.stdin.isRaw) process.stdin.setRawMode(false);
    emit({ ok: false, writeOutcome: { state: confirmedOutcome || (writeStarted ? 'unknown' : 'not_applied') }, error: { code: 'TIMEOUT', message: 'Command timed out. A write may have committed; check its record or receipt before retrying.' } });
    process.exit(7);
  }, 60000);
  timeout?.unref();
  try {
    parsed = parseArguments(args);
    const { command, spec, options } = parsed;
    writing = isMutation(spec);
    const [major, minor] = process.versions.node.split(".").map(Number);
    if (major < 22 || major === 22 && minor < 13) throw new CliError("UNSUPPORTED_RUNTIME", "Node.js 22.13 or newer is required.");
    if (credentialsCommands.has(command) && options.input && options.input !== "-")
      throw new CliError("INVALID_INPUT", "Credentials require stdin (--input -) or a hidden terminal prompt.");
    let input = options.input ? validateInput(command, await inputJson(options.input, ['import', 'verifyExport'].includes(spec.handler) ? IMPORT_MAX_BYTES : 1024 * 1024)) : {};
    let data;
    if (spec.offline) {
      if (command === "version") data = { version, commit, cliContractVersion: 1, schemaVersion: SCHEMA_VERSION, calculationVersion: CALCULATION_VERSION };
      else if (command === "ids") data = Array.from({ length: options.count || 1 }, () => crypto.randomUUID());
      else if (command === "help" || command === "schema") {
        if (options.command) {
          if (!catalogue[options.command]) throw new CliError("UNKNOWN_COMMAND", "Unknown command contract.");
          data = catalogue[options.command];
        } else data = command === "schema" ? Object.values(catalogue) : Object.values(catalogue).map(({ command, summary, requiredOptions }) => ({ command, summary, requiredOptions }));
      } else data = await handlers[spec.handler]({ command, spec, options, input });
    } else {
      config = firebaseConfiguration(options.profile, web);
      context.profile = options.profile; context.projectId = config.options.projectId;
      const session = new UserSession(options.profile, config);
      if (spec.handler === "auth") {
        if (credentialsCommands.has(command)) {
          input = await loginInput(input, options);
          data = await session.login(input.email, input.password, spec.action === "register");
        } else if (spec.action === "reset") data = await session.reset(input.email || options.email);
        else if (spec.action === "verify") data = await session.verify();
        else if (spec.action === "logout") data = await session.logout();
        else {
          const { idToken: _token, ...user } = await session.token(); data = user;
        }
      } else if (spec.handler === "doctor") {
        const saved = await session.store.read(options.profile);
        const user = saved ? await session.token() : null;
        let database = { compatible: null, status: "unchecked" };
        if (user) { connection = await connectJournal(config, user); database = await databaseStatus(connection.repo.db); }
        data = { database, journal: connection ? await new JournalTransfer(connection.repo).status() : { state: 'unchecked' }, node: process.versions.node, version, commit, useEmulators: config.useEmulators, sessionDirectory: session.store.root, session: user ? { uid: user.uid, email: user.email, emailVerified: user.emailVerified } : null };
      } else {
        const user = await session.token();

        if (writing && !user.emailVerified) throw new CliError("EMAIL_UNVERIFIED", "Verify email before saving journal records. Open the verification email and run auth status.", 3);
        connection = await connectJournal(config, user);
        await assertDatabaseReady(connection.repo.db);
        writeStarted = writing;
        data = await handlers[spec.handler]({ command, spec, options, input, repo: connection.repo });
        if (writing) confirmedOutcome = optionsState(parsed);
        if ((spec.handler === "export" || spec.handler === 'backup' && spec.action === 'export') && options.output) data = await exportFile(options.output, data, options.overwrite);
      }
    }
    if (connection) { await connection.close(); connection = null; }
    emit({ ok: true, ...(writing ? { writeOutcome: { state: optionsState(parsed) } } : {}), data });
    return 0;
  } catch (error) {
    const safe = publicError(error);
    const options = parsed?.options;
    const deterministic = ['VALIDATION', 'INVALID_INPUT', 'CONFLICT', 'OPERATION_MISMATCH', 'PREVIEW_MISMATCH', 'EMAIL_UNVERIFIED', 'NOT_FOUND', 'IMPORT_PREVIEW_CHANGED', 'IMPORT_CONFLICT', 'UNSUPPORTED_EXPORT_VERSION', 'INVALID_EXPORT'].includes(safe.code);
    const state = error.writeOutcome?.state || confirmedOutcome || (writeStarted && !deterministic ? 'unknown' : 'not_applied');
    emit({ ok: false, ...(writing || parsed?.spec.handler === 'tradeWrite' ? { writeOutcome: { state } } : {}), error: { code: safe.code, message: safe.message, ...safe.details, ...(options?.["operation-id"] ? { operationId: options["operation-id"], recovery: parsed?.spec.handler === 'import' ? 'Inspect import status, then explicitly resume or roll back the recorded operation.' : 'Read the operation receipt and current trade before retrying or reconciling.' } : {}) } });
    return safe.exitCode;
  } finally {
    clearTimeout(timeout);
    if (connection) await connection.close().catch(() => {});
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) process.exitCode = await run();
