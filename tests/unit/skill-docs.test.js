import { describe, expect, it } from "vitest";
import { catalogue } from "../../src/cli/catalogue.js";
import { renderCommandInventory, updateCommandInventory, validateShellExamples } from "../../scripts/skill-docs.js";

describe("skill documentation contracts", () => {
  it("includes every command and its required options, including newly added commands", () => {
    const inventory = renderCommandInventory({ ...catalogue, "future read": { command: "future read", summary: "Read future data", requiredOptions: ["profile", "id"] } });
    for (const spec of Object.values(catalogue)) {
      const row = inventory.split("\n").find((line) => line.startsWith(`| \`${spec.command}\` |`));
      expect(row, spec.command).toBeDefined();
      for (const option of spec.requiredOptions) expect(row).toContain(`\`--${option}\``);
      if (spec.requiresInput) expect(row).toContain("`--input`");
    }
    expect(inventory).toContain("| `future read` | Read future data | `--profile`, `--id` |");
  });

  it("replaces only the generated inventory and rejects missing boundaries", () => {
    const source = "Before\n<!-- command-inventory:start -->\nold\n<!-- command-inventory:end -->\nAfter\n";
    const updated = updateCommandInventory(source);
    expect(updated).toMatch(/^Before\n<!-- command-inventory:start -->/);
    expect(updated).toMatch(/<!-- command-inventory:end -->\nAfter\n$/);
    expect(updateCommandInventory(updated)).toBe(updated);
    expect(() => updateCommandInventory("No markers")).toThrow(/inventory/);
  });

  it("validates quoted discovery and multiline mutation examples with JSON input", () => {
    const source = "```sh\nnode /path/vxjournal.mjs schema --command 'trades create'\nnode /path/vxjournal.mjs accounts create \\\n  --profile dev --input - <<'JSON'\n{\"id\":\"example\",\"name\":\"Example\",\"currency\":\"USD\"}\nJSON\n```";
    expect(validateShellExamples(source)).toBe(2);
  });

  it.each([
    ["accounts missing --profile dev", "Unknown command"],
    ["accounts list --profile dev --obsolete true", "Unknown option"],
    ["accounts get --profile dev", "Required option --id"],
    ["schema --command 'future missing'", "Unknown schema command"],
  ])("rejects stale example %s", (args, error) => {
    expect(() => validateShellExamples(`\`\`\`sh\nnode /path/vxjournal.mjs ${args}\n\`\`\``)).toThrow(error);
  });

  it("rejects obsolete JSON fields in heredoc examples", () => {
    const source = "```sh\nnode /path/vxjournal.mjs accounts create --profile dev --input - <<'JSON'\n{\"id\":\"example\",\"name\":\"Example\",\"currency\":\"USD\",\"obsolete\":true}\nJSON\n```";
    expect(() => validateShellExamples(source)).toThrow(/Unknown input field/);
  });
});
