import { describe, it, expect } from "vitest";
import { parseArguments, validateInput, catalogue } from "../../src/cli/catalogue.js";
describe("agent command contract", () => {
  it('accepts explicit journal chronology and rejects unsupported values', () => {
    expect(parseArguments(['journal', 'list', '--profile', 'dev', '--sort', 'closed', '--order', 'asc', '--date-basis', 'closed']).options)
      .toMatchObject({ sort: 'closed', order: 'asc', 'date-basis': 'closed' });
    for (const [key, value] of [['sort', 'created'], ['order', 'newest'], ['date-basis', 'updated']]) {
      expect(() => parseArguments(['journal', 'list', '--profile', 'dev', `--${key}`, value])).toThrow(`--${key}`);
    }
  });
  it("rejects new trade payloads above atomic six-leg capacity", () => {
    const input = { id: "t", accountId: "a", legs: Array.from({ length: 7 }, () => ({ instrumentId: "i", direction: "long" })) };
    expect(() => validateInput("trades create", input)).toThrow(/item count/i);
    expect(validateInput("trades create", { ...input, legs: input.legs.slice(0, 6) }).legs).toHaveLength(6);
  });
  it("requires explicit environments and rejects unexpected options", () => {
    expect(() => parseArguments(["accounts", "list"])).toThrow(/profile/i);
    expect(() => parseArguments(["accounts", "list", "--profile", "prod", "--uid", "someone-else"])).toThrow(/option/i);
    expect(parseArguments(["accounts", "list", "--profile", "auto"])).toMatchObject({ command: "accounts list", options: { profile: "auto" } });
    expect(parseArguments(["help"]).command).toBe("help");
  });
  it("requires revisions, durable operation ids and explicit deletion intent", () => {
    expect(parseArguments(['accounts', 'delete', '--profile', 'auto', '--id', 'archived', '--revision', '3', '--preview']).options).toMatchObject({ revision: 3, preview: true });
    expect(() => parseArguments(['accounts', 'delete', '--profile', 'auto', '--id', 'archived', '--preview'])).toThrow(/revision/i);
    expect(() => parseArguments(["executions", "add", "--profile", "auto", "--trade", "t", "--input", "-"])).toThrow(/revision/i);
    expect(() => parseArguments(["trades", "delete", "--profile", "auto", "--id", "t", "--revision", "2"])).toThrow(/yes/i);
    const parsed = parseArguments(["executions", "add", "--profile", "auto", "--trade", "t", "--revision", "2", "--operation-id", "op", "--input", "-"]);
    expect(parsed.options.revision).toBe(2);
  });
  it("validates decimal strings, nested planning and caller-owned fields", () => {
    expect(() => validateInput("executions add", { id: "e", legId: "l", kind: "entry", quantity: 2, price: "10", timestamp: "2026-01-01T00:00:00Z" })).toThrow(/quantity/i);
    expect(() => validateInput("trades update", { summary: {} })).toThrow(/summary/i);
    expect(() => validateInput("legs update", { planning: { entry: "10", madeUp: "1" } })).toThrow(/madeUp/i);
    expect(() => validateInput("accounts create", { id: "bad/path", name: "Main", currency: "USD" })).toThrow(/id/i);
    expect(() => validateInput("accounts create", { id: "a", name: "Main", currency: "USD", archived: "false" })).toThrow(/archived/i);
    expect(validateInput("trades create", { id: "t", accountId: "a", legs: [{ instrumentId: "i", direction: "long", planning: { entry: "10" } }] }).id).toBe("t");
  });
  it("provides machine-readable contracts for every dispatched workflow", () => {
    for (const command of ["auth login", "accounts create", "instruments preview", "strategies trades", "trades create", "legs correct-snapshot", "executions add", "adjustments delete", "settings update", "export", "calculate size"]) expect(catalogue[command]).toBeDefined();
    expect(catalogue["executions add"].input.properties.quantity.type).toBe("string");
  });
});
