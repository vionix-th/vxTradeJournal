import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { checkSkillDocumentation } from "./skill-docs.js";
import { createSkillArchive } from "./skill-archive.js";
import { skillDownload } from "../src/config/skill.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
await checkSkillDocumentation(root);
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const packageLock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
const authoredSkill = join(root, "skills", "vx-trade-journal");
const output = join(root, "dist-skill", "vx-trade-journal");
const executable = join(root, "src", "cli", "index.js");

let commit = "unknown";
try {
  commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  if (execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim()) commit += "-dirty";
} catch { /* Builds outside a Git checkout remain usable and identify their source as unknown. */ }

try {
  await readFile(executable);
} catch {
  throw new Error("CLI entry src/cli/index.js is missing; finish the CLI implementation before building the skill.");
}

await rm(join(root, "dist-skill"), { recursive: true, force: true });
await mkdir(join(output, "scripts"), { recursive: true });
await cp(authoredSkill, output, { recursive: true });

await build({
  entryPoints: [executable],
  outfile: join(output, "scripts", "vxjournal.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  define: {
    __CLI_VERSION__: JSON.stringify(packageJson.version),
    __CLI_COMMIT__: JSON.stringify(commit),
  },
});

const runtimeDependencies = Object.fromEntries(["firebase", "decimal.js"].map((name) => {
  const version = packageLock.packages?.[`node_modules/${name}`]?.version;
  if (!version) throw new Error(`Root package-lock.json is missing the resolved runtime dependency ${name}`);
  return [name, version];
}));
const skillPackage = {
  name: "vx-trade-journal-agent-skill",
  version: packageJson.version,
  private: true,
  type: "module",
  engines: { node: ">=22.13.0" },
  dependencies: runtimeDependencies,
  overrides: packageJson.overrides ?? {},
};
await writeFile(join(output, "package.json"), `${JSON.stringify(skillPackage, null, 2)}\n`);

const cache = await mkdtemp(join(tmpdir(), "vxj-skill-npm-cache-"));
try {
  const lock = spawnSync("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund", "--prefix", output], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, npm_config_cache: cache },
  });
  if (lock.error) throw lock.error;
  if (lock.status !== 0) throw new Error(`Could not generate the portable skill lockfile (status ${lock.status})`);
} finally {
  await rm(cache, { recursive: true, force: true });
}

const archive = join(root, "dist-skill", skillDownload(packageJson.version).filename);
await createSkillArchive(output, archive);
console.log(`Built ${join("dist-skill", "vx-trade-journal")} and ${archive} for vxTradeJournal ${packageJson.version} (${commit}).`);
