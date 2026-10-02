import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporary = await mkdtemp(join(tmpdir(), "vxj-portable-skill-"));
function command(program, args, options = {}) {
  return new Promise((done, reject) => {
    const child = spawn(program, args, { cwd: root, stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? done() : reject(new Error(`${program} failed with exit ${code}`)));
  });
}
function cli(executable, args) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [executable, ...args], { cwd: tmpdir(), env: { ...process.env, VXJ_CONFIG_DIR: join(temporary, "session") } });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => { try { done({ code, stdout, stderr, body: JSON.parse(stdout) }); } catch { reject(new Error(`Invalid portable CLI JSON (exit ${code}, stdout ${JSON.stringify(stdout)}): ${stderr}`)); } });
    child.stdin.end();
  });
}
try {
  await command(process.execPath, [join(root, "scripts/build-skill.js")]);
  const installed = join(temporary, "vx-trade-journal");
  await cp(join(root, "dist-skill/vx-trade-journal"), installed, { recursive: true });
  await command("npm", ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: installed, env: { ...process.env, npm_config_cache: join(temporary, "npm-cache") } });
  const executable = join(installed, "scripts/vxjournal.mjs");
  const version = await cli(executable, ["version"]);
  assert.equal(version.code, 0);
  assert.equal(version.stderr, "");
  assert.equal(version.body.data.version, JSON.parse(await readFile(join(root, "package.json"))).version);
  const schema = await cli(executable, ["schema", "--command", "executions add"]);
  assert.equal(schema.body.data.input.properties.quantity.type, "string");
  const missing = await cli(executable, ["accounts", "list"]);
  assert.equal(missing.code, 2);
  assert.equal(missing.body.ok, false);
  const unauthenticated = await cli(executable, ["accounts", "list", "--profile", "auto"]);
  assert.equal(unauthenticated.code, 3);
  const skill = await readFile(join(installed, "SKILL.md"), "utf8");
  assert.match(skill, /^---\nname: vx-trade-journal\ndescription: .+\n---/);
  for (const reference of skill.matchAll(/\]\((references\/[^)]+)\)/g)) await readFile(join(installed, reference[1]));
  const manifest = JSON.parse(await readFile(join(installed, "package.json")));
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), ["decimal.js", "firebase"]);
  await command(process.execPath, [join(root, "scripts/test.js"), "cli"], { env: { ...process.env, VXJ_CLI_EXECUTABLE: executable } });
  console.log("Portable skill contracts, fresh dependency install, references and emulator workflows passed.");
} finally { await rm(temporary, { recursive: true, force: true }); }
