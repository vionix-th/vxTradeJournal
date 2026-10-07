import { afterEach, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const fixtures = [];
async function fixture(mode, script = "dev.js", stopDelay = 0) {
  const directory = await mkdtemp(join(tmpdir(), "vxj-dev-startup-"));
  const events = join(directory, "events.jsonl");
  await mkdir(join(directory, "scripts/database"), { recursive: true });
  await mkdir(join(directory, "bin"));
  await writeFile(events, "");
  await writeFile(join(directory, "package.json"), '{"type":"module"}');
  for (const name of ["dev.js", "emulators.js", "profiles.js"]) await copyFile(resolve(`scripts/${name}`), join(directory, "scripts", name));
  await writeFile(join(directory, "scripts/database/initialize.js"), `export async function initializeEmptyDatabase() {
    if (process.env.STARTUP_MODE === 'ready') return;
    const error = new Error('Nonempty database lacks metadata; use explicit schema baseline initialization.');
    error.code = process.env.STARTUP_MODE === 'baseline' ? 'DATABASE_BASELINE_REQUIRED' : 'INVALID_DATABASE';
    throw error;
  }`);
  await writeFile(join(directory, "ready.mjs"), `import { readFileSync } from 'node:fs'; globalThis.fetch = async () => {
    if (!readFileSync(process.env.STARTUP_EVENTS, 'utf8').includes('firebase')) throw new Error('Not ready');
    await new Promise(resolve => setTimeout(resolve, 20)); return {};
  };`);
  for (const name of ["firebase", "vite"]) {
    const path = join(directory, "bin", name);
    await writeFile(path, `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
const record = event => appendFileSync(process.env.STARTUP_EVENTS, JSON.stringify({ name: '${name}', event, pid: process.pid, args: process.argv.slice(2) }) + '\\n');
record('start');
setInterval(() => {}, 1000);
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { record('stop'); setTimeout(() => { record('exported'); process.exit(0); }, Number(process.env.STARTUP_STOP_DELAY)); });
`);
    await chmod(path, 0o755);
  }
  const child = spawn(process.execPath, [`scripts/${script}`], {
    cwd: directory,
    env: { ...process.env, PATH: `${join(directory, "bin")}:${process.env.PATH}`, VXJ_PROFILE: "dev", STARTUP_MODE: mode, STARTUP_STOP_DELAY: String(stopDelay), STARTUP_EVENTS: events, NODE_OPTIONS: `--import=${join(directory, "ready.mjs")}` },
  });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  const done = new Promise(resolve => child.once("close", (code, signal) => resolve({ code, signal, output })));
  fixtures.push({ directory, events, child, done });
  return { child, done, output: () => output, events: async () => (await readFile(events, "utf8")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line)) };
}
async function until(predicate) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("Startup event did not arrive.");
}
afterEach(async () => {
  for (const f of fixtures.splice(0)) {
    if (f.child.exitCode === null) f.child.kill("SIGTERM");
    await f.done;
    const events = (await readFile(f.events, "utf8")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
    for (const { pid } of events) { try { process.kill(pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; } }
    await rm(f.directory, { recursive: true, force: true });
  }
});

it("keeps dev services available for explicit retained database baseline initialization", async () => {
  const f = await fixture("baseline");
  await until(() => f.output().includes("Nonempty"));
  await new Promise(resolve => setTimeout(resolve, 150));
  expect(f.child.exitCode).toBeNull();
  expect(f.output()).toContain("npm run database:initialize -- --profile dev --bootstrap-schema 1");
  const events = await f.events();
  expect(events.filter(event => event.event === "start").map(event => event.name).sort()).toEqual(["firebase", "vite"]);
  expect(events.some(event => event.event === "stop")).toBe(false);
  expect(events.find(event => event.name === "firebase").args).toEqual(expect.arrayContaining(["--import=.local-emulators/dev", "--export-on-exit=.local-emulators/dev"]));
  f.child.kill("SIGTERM");
  expect((await f.done).code).toBe(0);
  expect((await f.events()).filter(event => event.event === "stop").map(event => event.name).sort()).toEqual(["firebase", "vite"]);
});

it("preserves initialization failure exit status after graceful Firebase shutdown", async () => {
  const f = await fixture("invalid");
  await until(() => f.child.exitCode !== null);
  expect((await f.done).code).toBe(1);
  expect((await f.events()).some(event => event.name === "vite" && event.event === "stop")).toBe(true);
});

it("keeps an initialized dev database running until operator interruption", async () => {
  const f = await fixture("ready");
  await until(async () => (await f.events()).filter(event => event.event === "start").length === 2);
  expect(f.child.exitCode).toBeNull();
  f.child.kill("SIGINT");
  expect((await f.done).code).toBe(0);
});

it.each(["dev.js", "emulators.js"])("awaits graceful export when %s receives repeated interrupts", async script => {
  const f = await fixture("ready", script, 150);
  await until(async () => (await f.events()).some(event => event.name === "firebase" && event.event === "start"));
  f.child.kill("SIGINT");
  await until(async () => (await f.events()).some(event => event.name === "firebase" && event.event === "stop"));
  f.child.kill("SIGINT");
  expect((await f.done).code).toBe(0);
  expect((await f.events()).some(event => event.name === "firebase" && event.event === "exported")).toBe(true);
});
