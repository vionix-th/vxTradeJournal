import { afterEach, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const fixtures = [];
const childSource = `#!/usr/bin/env node
import { appendFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
const kind = process.argv[1].endsWith('emulators.js') ? 'emulator' : process.argv[1].endsWith('playwright') ? 'e2e' : args.includes('unit') ? 'unit' : 'integration';
const record = (event) => appendFileSync(process.env.RUNNER_EVENTS, JSON.stringify({ event, kind, args, pid: process.pid, profile: process.env.VXJ_PROFILE }) + '\\n');
record('start');
if (kind === 'emulator') {
  setInterval(() => {}, 1000);
  process.on('SIGTERM', () => { record('stop'); process.exit(0); });
} else {
  const output = args.find(arg => arg.startsWith('--outputFile.json='));
  if (output && !process.env.RUNNER_NO_REPORT) writeFileSync(output.split('=').slice(1).join('='), JSON.stringify({ numPassedTests: Number(process.env.RUNNER_MATCHES ?? 1), numFailedTests: 0 }));
  if (process.env.PLAYWRIGHT_JSON_OUTPUT_FILE && !process.env.RUNNER_NO_REPORT) writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE, JSON.stringify({ stats: { expected: Number(process.env.RUNNER_MATCHES ?? 1), unexpected: 0, flaky: 0, skipped: 1 } }));
  if (process.env.RUNNER_HOLD) setInterval(() => {}, 1000);
  else process.exit(Number(process.env['RUNNER_' + kind.toUpperCase() + '_CODE'] ?? 0));
  process.on('SIGTERM', () => { record('stop'); process.exit(0); });
}
`;

async function fixture(extraEnv = {}) {
  const directory = await mkdtemp(join(tmpdir(), "vxj-runner-test-"));
  fixtures.push(directory);
  await mkdir(join(directory, "scripts"));
  await mkdir(join(directory, "node_modules/.bin"), { recursive: true });
  await writeFile(join(directory, "package.json"), '{"type":"module"}');
  await copyFile(resolve("scripts/test.js"), join(directory, "scripts/test.js"));
  await copyFile(resolve("scripts/profiles.js"), join(directory, "scripts/profiles.js"));
  await symlink(resolve("node_modules/vitest"), join(directory, "node_modules/vitest"));
  const eventsPath = join(directory, "events.jsonl");
  await writeFile(eventsPath, "");
  await writeFile(join(directory, "ready.mjs"), `import { readFileSync } from 'node:fs'; globalThis.fetch = async () => { if (!readFileSync(process.env.RUNNER_EVENTS, 'utf8').includes('emulator')) throw new Error('Not ready'); return {}; };`);
  for (const path of ["scripts/emulators.js", "node_modules/.bin/vitest", "node_modules/.bin/playwright"]) {
    await writeFile(join(directory, path), childSource);
    await chmod(join(directory, path), 0o755);
  }
  async function events() {
    return (await readFile(eventsPath, "utf8")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
  }
  function run(args) {
    const child = spawn(process.execPath, ["scripts/test.js", ...args], {
      cwd: directory,
      env: { ...process.env, NODE_OPTIONS: `--import=${join(directory, "ready.mjs")}`, RUNNER_EVENTS: eventsPath, ...extraEnv },
    });
    let output = "";
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { output += chunk; });
    const done = new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => resolve({ code, signal, output }));
    });
    return { child, done };
  }
  return { directory, events, run };
}

afterEach(async () => {
  for (const directory of fixtures.splice(0)) {
    const events = (await readFile(join(directory, "events.jsonl"), "utf8")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
    for (const { pid } of events) {
      try { process.kill(pid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") throw error; }
    }
    await rm(directory, { recursive: true, force: true });
  }
});

describe("test runner selection and lifecycle", () => {
  it.each(["integration", "e2e"])("forwards %s file and native name filters without losing isolation", async selected => {
    const f = await fixture();
    const filters = selected === "integration" ? ["tests/integration/repository.test.js", "-t", "opening dates"] : ["layout.spec.js", "--grep", "mobile"];
    expect((await f.run([selected, ...filters]).done).code).toBe(0);
    const events = await f.events();
    const command = events.find(event => event.kind !== "emulator");
    expect(command.args).toEqual(expect.arrayContaining(filters));
    expect(command.profile).toBe("auto");
    expect(events.some(event => event.kind === "emulator" && event.event === "stop")).toBe(true);
  });

  it("allows CLI name filters and executes only the CLI integration file", async () => {
    const f = await fixture();
    expect((await f.run(["cli", "-t", "off-increment plans"]).done).code).toBe(0);
    expect((await f.events()).find(event => event.kind === "integration").args).toEqual(expect.arrayContaining(["tests/integration/cli.test.js", "-t", "off-increment plans"]));
  });

  it("runs focused unit verification without services", async () => {
    const f = await fixture();
    expect((await f.run(["unit", "tests/unit/domain.test.js", "-t", "scaled"]).done).code).toBe(0);
    expect((await f.events()).map(event => event.kind)).toEqual(["unit"]);
  });

  it.each([
    ["all", "-t", "partial"],
    ["cli", "tests/integration/security.test.js"],
    ["cli", "--project", "unit"],
    ["cli", "--config=other.config.js"],
    ["integration", "--fileParallelism"],
    ["e2e", "--config=other.config.js"],
    ["e2e", "-cother.config.js"],
  ])("rejects scope-changing arguments before service startup: %j", async (...args) => {
    const f = await fixture();
    expect((await f.run(args).done).code).not.toBe(0);
    expect(await f.events()).toEqual([]);
  });

  it("runs unit tests before starting services in the complete run", async () => {
    const f = await fixture();
    expect((await f.run(["all"]).done).code).toBe(0);
    expect((await f.events()).filter(event => event.event === "start").map(event => event.kind)).toEqual(["unit", "emulator", "integration", "e2e"]);
  });

  it("preserves unit failures without starting services", async () => {
    const f = await fixture({ RUNNER_UNIT_CODE: "7" });
    expect((await f.run(["all"]).done).code).toBe(7);
    expect((await f.events()).map(event => event.kind)).toEqual(["unit"]);
  });

  it.each(["integration", "e2e"])("preserves %s failures and stops services", async selected => {
    const f = await fixture({ [`RUNNER_${selected.toUpperCase()}_CODE`]: "4" });
    expect((await f.run([selected]).done).code).toBe(4);
    expect((await f.events()).some(event => event.kind === "emulator" && event.event === "stop")).toBe(true);
  });

  it.each([{ RUNNER_MATCHES: "0" }, { RUNNER_NO_REPORT: "1" }])("rejects successful Vitest exits without executed-test evidence: %j", async env => {
    const f = await fixture(env);
    expect((await f.run(["cli", "-t", "missing"]).done).code).not.toBe(0);
    expect((await f.events()).some(event => event.kind === "emulator" && event.event === "stop")).toBe(true);
  });

  it.each(["unit", "e2e"])("rejects zero executed %s tests even when the native runner exits successfully", async selected => {
    const f = await fixture({ RUNNER_MATCHES: "0" });
    expect((await f.run([selected]).done).code).not.toBe(0);
  });

  it("stops services when a test executable cannot start", async () => {
    const f = await fixture();
    await rm(join(f.directory, "node_modules/.bin/vitest"));
    const result = await f.run(["integration"]).done;
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("ENOENT");
    expect((await f.events()).some(event => event.kind === "emulator" && event.event === "stop")).toBe(true);
  });

  it("stops the active test and emulator on interruption", async () => {
    const f = await fixture({ RUNNER_HOLD: "1" });
    const running = f.run(["integration"]);
    for (let attempts = 0; attempts < 300; attempts++) {
      if ((await f.events()).some(event => event.kind === "integration")) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect((await f.events()).some(event => event.kind === "integration")).toBe(true);
    running.child.kill("SIGTERM");
    const result = await running.done;
    expect(result.code).not.toBe(0);
    const stopped = (await f.events()).filter(event => event.event === "stop").map(event => event.kind).sort();
    expect(stopped).toEqual(["emulator", "integration"]);
  });
});
