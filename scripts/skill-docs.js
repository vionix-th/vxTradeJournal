import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogue, parseArguments, validateInput } from "../src/cli/catalogue.js";

const start = "<!-- command-inventory:start -->";
const end = "<!-- command-inventory:end -->";

export function renderCommandInventory(commands = catalogue) {
  const rows = Object.values(commands).map((spec) => {
    const required = [...new Set([...spec.requiredOptions, ...(spec.requiresInput ? ["input"] : [])])];
    return `| \`${spec.command}\` | ${spec.summary.replaceAll("|", "\\|")} | ${required.map((option) => `\`--${option}\``).join(", ") || "None"} |`;
  });
  return ["| Command | Purpose | Required options |", "|---|---|---|", ...rows].join("\n");
}

export function updateCommandInventory(source) {
  const first = source.indexOf(start), last = source.indexOf(end);
  if (first < 0 || last <= first || source.indexOf(start, first + start.length) !== -1 || source.indexOf(end, last + end.length) !== -1) {
    throw new Error("Command inventory requires one ordered pair of generation markers");
  }
  return source.slice(0, first + start.length) + "\n" + renderCommandInventory() + "\n" + source.slice(last);
}

// Authored examples use literal arguments, line continuations and optional JSON heredocs.
// Parse this bounded documentation format only; never execute shell examples.
export function validateShellExamples(source) {
  let count = 0;
  for (const block of source.matchAll(/```sh\n([\s\S]*?)```/g)) {
    const lines = block[1].replace(/\\\r?\n\s*/g, " ").split("\n");
    for (let index = 0; index < lines.length; index++) {
      const invocation = lines[index].match(/^\s*node\s+\S*vxjournal\.mjs\s+(.+)$/);
      if (!invocation) continue;
      let args = invocation[1];
      const heredoc = args.match(/\s+<<'([A-Za-z0-9_]+)'\s*$/);
      if (heredoc) args = args.slice(0, heredoc.index);
      const tokens = args.match(/'[^']*'|"[^"]*"|[^\s'"<>;&|]+/g) ?? [];
      if (tokens.join(" ") !== args.trim().replace(/\s+/g, " ")) throw new Error("Unsupported shell syntax in CLI example");
      const parsed = parseArguments(tokens.map((token) => /^["']/.test(token) ? token.slice(1, -1) : token));
      if (["schema", "help"].includes(parsed.command) && parsed.options.command && !Object.hasOwn(catalogue, parsed.options.command)) {
        throw new Error(`Unknown schema command ${parsed.options.command}`);
      }
      if (heredoc) {
        const input = [];
        while (++index < lines.length && lines[index] !== heredoc[1]) input.push(lines[index]);
        if (index === lines.length) throw new Error("Unterminated JSON heredoc in CLI example");
        if (parsed.options.input !== "-") throw new Error("JSON heredoc example requires --input -");
        validateInput(parsed.command, JSON.parse(input.join("\n")));
      }
      count++;
    }
  }
  return count;
}

export async function checkSkillDocumentation(root, { write = false } = {}) {
  const skill = join(root, "skills", "vx-trade-journal");
  const inventoryPath = join(skill, "references", "commands.md");
  const source = await readFile(inventoryPath, "utf8");
  const generated = updateCommandInventory(source);
  if (write) await writeFile(inventoryPath, generated);
  else if (source !== generated) throw new Error("Skill command inventory is stale; run npm run skill:docs");
  const references = (await readdir(join(skill, "references"))).filter((name) => name.endsWith(".md"));
  let examples = 0;
  for (const path of [join(skill, "SKILL.md"), ...references.map((name) => join(skill, "references", name))]) {
    try { examples += validateShellExamples(await readFile(path, "utf8")); }
    catch (error) { throw new Error(`${path}: ${error.message}`, { cause: error }); }
  }
  return examples;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const examples = await checkSkillDocumentation(root, { write: !process.argv.includes("--check") });
  console.log(`Skill command inventory and ${examples} shell examples verified.`);
}
