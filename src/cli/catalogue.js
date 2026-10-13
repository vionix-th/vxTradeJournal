import { ValidationError } from '../domain/validation.js';
import { MAX_NEW_TRADE_LEGS } from "../domain/leg-capacity.js";
const string = (extra = {}) => ({ type: "string", ...extra });
const identifier = string({ pattern: "^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$" });
const decimal = string({ pattern: "^-?\\d+(\\.\\d+)?$", maxLength: 100 });
const nullable = (schema) => ({ anyOf: [schema, { type: "null" }] });
const boolean = { type: "boolean" };
const object = (properties = {}, required = []) => ({ type: "object", additionalProperties: false, properties, required });
const instant = string({ pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,3})?(Z|[+-]\\d{2}:\\d{2})$" });
const planning = object(Object.fromEntries(["entry", "stop", "target", "riskBudget", "rate", "quantity"].map((key) => [key, nullable(decimal)])));
const instrument = {
  name: string(), symbol: string(), market: string(), venue: string(), preset: string(), model: string({ enum: ["linear", "manual"] }),
  quantityUnit: string(), priceUnit: string(), quantityIncrement: nullable(decimal), priceIncrement: nullable(decimal), pointValue: nullable(decimal),
  currency: nullable(string()), underlying: string(), expiry: string(), strike: nullable(decimal), optionType: string({ enum: ["", "call", "put"] }),
  draft: boolean, archived: boolean,
};
const strategy = Object.fromEntries(["name", "purpose", "markets", "entryRules", "exitRules", "riskRules"].map((key) => [key, string()]));
strategy.archived = boolean;
const context = { strategyId: nullable(identifier), rationale: string(), review: string(), tags: { type: "array", items: string({ maxLength: 80 }), maxItems: 30 }, riskBudget: nullable(decimal) };
const leg = { id: identifier, instrumentId: identifier, direction: string({ enum: ["long", "short"] }), planning };
const execution = {
  id: identifier, legId: identifier, kind: string({ enum: ["entry", "exit", "settlement"] }), quantity: decimal, price: nullable(decimal), timestamp: instant,
  fees: decimal, feeCurrency: string(), feeRate: nullable(decimal), resultRate: nullable(decimal), manualGross: nullable(decimal),
  manualSource: string({ enum: ["user-entered", "broker-reported"] }), orderReference: string(), reason: string(), sequence: { type: "integer", minimum: 0 },
};
const adjustment = { id: identifier, amount: decimal, currency: string(), rate: nullable(decimal), timestamp: instant, reason: string() };
const entityFields = { accounts: { name: string(), currency: string(), archived: boolean }, instruments: instrument, strategies: strategy };
const mutationOptions = ["input", "dry-run"];
const tradeOptions = ["correction-reason", "revision", "operation-id", ...mutationOptions];
export const catalogue = {};
function add(command, handler, summary, { options = [], requiredOptions = [], input = object(), requiresInput = false, offline = false, ...rest } = {}) {
  catalogue[command] = { command, handler, summary, options: offline ? options : ["profile", ...options], requiredOptions: offline ? requiredOptions : ["profile", ...requiredOptions], input, requiresInput, offline, ...rest };
}
add("help", "help", "Discover command groups and options", { offline: true, options: ["command"] });
add("schema", "schema", "Machine-readable command contracts", { offline: true, options: ["command"] });
add("version", "version", "Application, CLI, schema and calculation versions", { offline: true });
add("ids", "ids", "Generate stable IDs before submitting creates", { offline: true, options: ["count"] });
add("doctor", "doctor", "Check runtime, project, saved authentication, database compatibility and journal transfer availability");
for (const action of ["login", "register", "reset"]) add(`auth ${action}`, "auth", `${action} a Firebase user session${action === "reset" ? "" : " using stdin or a hidden terminal prompt"}`, {
  action, options: ["input", "email"], input: object({ email: string(), ...(action === "reset" ? {} : { password: string() }) }),
});
for (const action of ["status", "verify", "logout"]) add(`auth ${action}`, "auth", `${action} the selected profile session`, { action });
for (const [type, fields] of Object.entries(entityFields)) {
  add(`${type} list`, "entity", type === 'accounts' ? 'List active accounts; explicitly select archived or all for management' : `List owned ${type}`, { type, action: "list", options: ["search", "archived"] });
  add(`${type} get`, "entity", `Get an owned ${type} record`, { type, action: "get", options: ["id"], requiredOptions: ["id"] });
  add(`${type} create`, "entity", `Create ${type} using a stable ID`, { type, action: "create", options: mutationOptions, input: object({ id: identifier, ...fields }, type === "accounts" ? ["id", "name", "currency"] : type === "instruments" ? ["id", "name", "preset"] : ["id", "name"]), requiresInput: true });
  for (const action of ["update", "archive", "unarchive"]) add(`${type} ${action}`, "entity", `${action} an owned ${type} record`, {
    type, action, options: ["id", "revision", ...mutationOptions], requiredOptions: ["id", "revision"], input: object(fields), requiresInput: action === "update",
  });
}
add('accounts delete', 'accountDelete', 'Preview or permanently delete an archived account and its linked history', { options: ['id', 'revision', 'preview', 'dry-run', 'accept-preview', 'operation-id', 'yes'], requiredOptions: ['id', 'revision'] });
add("instruments presets", "presets", "Inspect editable preset examples", { offline: true });
add("instruments preview", "instrumentPreview", "Validate instrument configuration and calculation capabilities", { options: ["input"], input: object(instrument, ["name", "preset"]), requiresInput: true });
add("strategies trades", "linkedTrades", "List trade summaries linked to a strategy", { options: ["id"], requiredOptions: ["id"] });
add("journal list", "journal", "Filter active-account journal summaries; sort by opened, closed or updated (default newest activity)", { options: ["search", "account", "market", "status", "strategy", "tag", "from", "to", "date-basis", "sort", "order", "page", "page-size", "timezone"] });
add("journal overview", "overview", "Active-account counts and complete realized results grouped by reporting currency", { options: ["account"] });
add("trades corrections", "corrections", "Read correction history grouped by operation", { options: ["id", "page", "page-size"], requiredOptions: ["id"] });
add("trades get", "tradeRead", "Read complete source records and current calculations", { options: ["id"], requiredOptions: ["id"] });
add("trades create", "tradeWrite", "Create a trade with up to six legs", {
  action: "create", options: ["operation-id", ...mutationOptions], requiredOptions: ["operation-id"], requiresInput: true,
  input: object({ id: identifier, accountId: identifier, legs: { type: "array", items: object(leg, ["instrumentId", "direction"]), minItems: 1, maxItems: MAX_NEW_TRADE_LEGS }, ...context }, ["id", "accountId", "legs"]),
});
add("trades update", "tradeWrite", "Edit context or link/unlink a strategy", { action: "update", options: ["id", ...tradeOptions], requiredOptions: ["id", "revision", "operation-id"], input: object(context), requiresInput: true });
add("trades delete", "tradeDelete", "Delete a trade and all children", { options: ["id", "revision", "yes", "dry-run"], requiredOptions: ["id", "revision", "yes"] });
for (const type of ["legs", "executions", "adjustments"]) {
  const fields = { legs: leg, executions: execution, adjustments: adjustment }[type];
  add(`${type} list`, "childRead", `List ${type} of a trade`, { type, action: "list", options: ["trade"], requiredOptions: ["trade"] });
  add(`${type} get`, "childRead", `Read a ${type} record`, { type, action: "get", options: ["trade", "id"], requiredOptions: ["trade", "id"] });
  add(`${type} add`, "tradeWrite", `Add a ${type} record and replay history`, {
    type, action: "add", options: ["trade", ...tradeOptions], requiredOptions: ["trade", "revision", "operation-id"], requiresInput: true,
    input: object(fields, { legs: ["id", "instrumentId", "direction"], executions: ["id", "legId", "kind", "quantity", "timestamp"], adjustments: ["id", "amount", "currency", "timestamp", "reason"] }[type]),
  });
  const editable = type === "legs" ? { direction: fields.direction, planning } : Object.fromEntries(Object.entries(fields).filter(([key]) => key !== "id" && key !== "legId"));
  add(`${type} update`, "tradeWrite", `Correct a ${type} record and replay history`, { type, action: "update", options: ["trade", "id", ...tradeOptions], requiredOptions: ["trade", "id", "revision", "operation-id"], input: object(editable), requiresInput: true });
  add(`${type} delete`, "tradeWrite", `Remove a ${type} record and replay history`, { type, action: "delete", options: ["trade", "id", "yes", ...tradeOptions], requiredOptions: ["trade", "id", "yes", "revision", "operation-id"] });
}
add("legs correct-snapshot", "tradeWrite", "Preview or apply a correction to one historical instrument snapshot", { type: "legs", action: "correct-snapshot", options: ["trade", "id", "preview", "accept-preview", ...tradeOptions], requiredOptions: ["trade", "id", "revision"], input: object(instrument), requiresInput: true });
add("operations get", "receipt", "Check whether a trade operation committed", { options: ["trade", "operation-id"], requiredOptions: ["trade", "operation-id"] });
add("calculate trade", "tradeRead", "Replay source history without changing persisted summaries", { options: ["id"], requiredOptions: ["id"] });
add("calculate size", "size", "Compute single-leg linear sizing with decimal arithmetic", { options: ["trade", "leg"], requiredOptions: ["trade", "leg"] });
add("settings get", "settings", "Read display preferences", { action: "get" });
add("settings update", "settings", "Update preferences and active owned default account", { action: "update", options: ["revision", ...mutationOptions], requiredOptions: ["revision"], input: object({ theme: string({ enum: ["system", "light", "dark"] }), timezone: string(), defaultAccount: nullable(identifier) }), requiresInput: true });
add("export", "export", "Export complete versioned journal source data", { options: ["output", "overwrite"] });
add('export verify', 'verifyExport', 'Verify portable integrity, versions and replay without journal writes', { offline: true, options: ['input'], requiresInput: true, input: { type: 'object', additionalProperties: true, properties: {} } });
const portableInput = { type: 'object', additionalProperties: true, properties: {} };
for (const action of ['preview', 'apply']) add(`import ${action}`, 'import', `${action} portable journal JSON with add-only or replacement mode`, {
  action, options: ['input', 'mode', 'include-settings', ...(action === 'apply' ? ['accept-preview', 'operation-id', 'yes'] : [])],
  requiredOptions: ['mode', ...(action === 'apply' ? ['accept-preview', 'operation-id'] : [])], requiresInput: true, input: portableInput,
});
for (const action of ['status', 'resume', 'rollback']) add(`import ${action}`, 'import', action === 'status' ? 'Inspect journal transfer availability and import/deletion recovery actions' : `${action} a durable journal import or account deletion`, { action, options: ['operation-id', ...(action === 'rollback' ? ['yes'] : [])], requiredOptions: action === 'status' ? [] : ['operation-id', ...(action === 'rollback' ? ['yes'] : [])] });
add('backup list', 'backup', 'List private retained journal recovery backups', { action: 'list' });
add('backup export', 'backup', 'Download recovery backup as portable journal JSON', { action: 'export', options: ['operation-id', 'output', 'overwrite'], requiredOptions: ['operation-id'] });
add('backup delete', 'backup', 'Permanently delete a completed recovery backup', { action: 'delete', options: ['operation-id', 'yes'], requiredOptions: ['operation-id', 'yes'] });

const flags = new Set(["dry-run", "yes", "preview", "overwrite", 'include-settings']);
const numbers = new Set(["revision", "page", "page-size", "count"]);
export function parseArguments(args) {
  const words = [], options = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg.startsWith("--")) { words.push(arg); continue; }
    const key = arg.slice(2);
    if (Object.hasOwn(options, key)) throw new Error(`Duplicate option --${key}`);
    if (flags.has(key)) options[key] = true;
    else {
      const value = args[++index];
      if (value === undefined || value.startsWith("--")) throw new Error(`Value required for --${key}`);
      options[key] = value;
    }
  }
  const command = words.length ? words.join(" ") : "help", spec = catalogue[command];
  if (!spec) throw new Error(`Unknown command: ${command}`);
  for (const key of Object.keys(options)) if (!spec.options.includes(key)) throw new Error(`Unknown option --${key} for ${command}`);
  for (const key of spec.requiredOptions) if (options[key] === undefined) throw new Error(`Required option --${key}`);
  if (options.profile && !["dev", "test", "auto", "prod"].includes(options.profile)) throw new Error("Profile must be dev, test, auto, or prod");
  for (const key of numbers) if (options[key] !== undefined) {
    if (!/^\d+$/.test(options[key]) || !Number.isSafeInteger(Number(options[key]))) throw new Error(`--${key} must be an integer`);
    options[key] = Number(options[key]);
    if (key !== "revision" && options[key] < 1) throw new Error(`--${key} must be positive`);
    if (["page-size", "count"].includes(key) && options[key] > 100) throw new Error(`--${key} maximum is 100`);
  }
  for (const key of ["id", "trade", "leg", "operation-id", "account", "strategy"]) if (options[key] !== undefined && !new RegExp(identifier.pattern).test(options[key])) throw new Error(`Invalid --${key}`);
  if (options.archived !== undefined && !["true", "false", "all"].includes(options.archived)) throw new Error("--archived must be true, false, or all");
  for (const [key, values] of Object.entries({ sort: ['opened', 'closed', 'updated'], order: ['asc', 'desc'], 'date-basis': ['opened', 'closed'] })) {
    if (options[key] !== undefined && !values.includes(options[key])) throw new Error(`--${key} must be ${values.join(', ')}.`);
  }
  if (command === "legs correct-snapshot" && !options.preview && !options["dry-run"] && (!options["accept-preview"] || !options["operation-id"])) throw new Error("Snapshot correction requires --preview or --accept-preview and --operation-id");
  if (spec.requiresInput && !options.input) throw new Error("Required option --input");
  if (options["accept-preview"] && !/^[a-f0-9]{64}$/.test(options["accept-preview"])) throw new Error("Invalid preview fingerprint");
  if (spec.handler === 'import' && ['preview', 'apply'].includes(spec.action) && !['add', 'replace'].includes(options.mode)) throw new Error('--mode must be add or replace');
  if (command === 'import apply' && options.mode === 'replace' && !options.yes) throw new Error('Replacement requires --yes after reviewing the accepted preview');
  return { command, spec, options };
}

function validate(value, schema, path) {
  try { return validateSchemaValue(value, schema, path); }
  catch (error) {
    if (error instanceof ValidationError && !error.details.path) {
      error.details.rule = 'INPUT_SCHEMA';
      error.details.path = '/' + path.replace(/^input[.]?/, '').replace(/\[(\d+)\]/g, '/$1').replaceAll('.', '/');
      if (value === null || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string' && value.length <= 120 && !/password|email|rationale|review|reason|Rules|purpose/i.test(path)) error.details.rejectedValue = value;
    }
    throw error;
  }
}
function validateSchemaValue(value, schema, path) {
  if (schema.anyOf) {
    if (schema.anyOf.some((choice) => { try { validate(value, choice, path); return true; } catch { return false; } })) return;
    throw new ValidationError(`${path} has an invalid value or type`);
  }
  const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  if (schema.type === "integer" ? !Number.isSafeInteger(value) : type !== schema.type) throw new ValidationError(`${path} must be ${schema.type}`);
  if (schema.enum && !schema.enum.includes(value)) throw new ValidationError(`${path} has an unsupported value`);
  if (schema.pattern && !new RegExp(schema.pattern).test(value)) throw new ValidationError(`${path} has an invalid format`);
  if (schema.maxLength && value.length > schema.maxLength) throw new ValidationError(`${path} is too long`);
  if (schema.minimum !== undefined && value < schema.minimum) throw new ValidationError(`${path} is below minimum`);
  if (type === "object") {
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(schema.properties, key)) { if (schema.additionalProperties === true) continue; throw new ValidationError(`Unknown input field ${path}.${key}`); }
      validate(value[key], schema.properties[key], `${path}.${key}`);
    }
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) throw new ValidationError(`${path}.${key} is required`);
  }
  if (type === "array") {
    if (schema.minItems && value.length < schema.minItems || schema.maxItems && value.length > schema.maxItems) throw new ValidationError(`${path} has invalid item count`);
    value.forEach((item, index) => validate(item, schema.items, `${path}[${index}]`));
  }
}
export function validateInput(command, input) {
  validate(input, catalogue[command].input, "input");
  return input;
}
