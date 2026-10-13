import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import { skillDownload } from "../src/config/skill.js";

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
  const packageVersion = JSON.parse(await readFile(join(root, "package.json"))).version;
  const entries = unzipSync(await readFile(join(root, "dist-skill", skillDownload(packageVersion).filename)));
  for (const [path, contents] of Object.entries(entries)) {
    assert.match(path, /^vx-trade-journal\//);
    assert.ok(!path.split("/").includes(".."));
    assert.ok(!path.includes("node_modules") && !path.includes(".env"));
    assert.ok(!path.includes("database/") && !path.endsWith("database.js"), "Operator tooling must not enter the installed skill");
    const destination = join(temporary, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, contents);
  }
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
  assert.ok(!String(await readFile(executable, "utf8")).includes("firebase-admin"), "Bundled CLI must remain user-scoped");
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), ["decimal.js", "firebase"]);
  // Installed CLI processes need behavioral acceptance, not coverage of the
  // repository-side fixture setup. Preserve the owning integration report.
  await command(process.execPath, [join(root, "scripts/test.js"), "cli"], { env: { ...process.env, VXJ_CLI_EXECUTABLE: executable, VXJ_COVERAGE: '0' } });
  console.log("Portable skill ZIP extraction, contracts, fresh dependency install, references and emulator workflows passed.");
} finally { await rm(temporary, { recursive: true, force: true }); }
