import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorLifecycle } from "../../src/ui/editor-lifecycle.js";
import { routePolicies } from "../../src/ui/route-policy.js";
import { accountEditor, tradeEditor } from "../../src/ui/editors.js";
import { journalView, tradeView } from "../../src/ui/views.js";

vi.mock("../../src/ui/editors.js", () => ({
  accountEditor: vi.fn(), instrumentEditor: vi.fn(), strategyEditor: vi.fn(),
  tradeEditor: vi.fn(), executionEditor: vi.fn(), adjustmentEditor: vi.fn(), settingsEditor: vi.fn(),
}));
vi.mock("../../src/ui/views.js", () => ({
  journalView: vi.fn(), accountsView: vi.fn(), instrumentsView: vi.fn(), strategiesView: vi.fn(), tradeView: vi.fn(),
}));

let lifecycle, browserHistory, render;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", { addEventListener: vi.fn() });
  vi.stubGlobal("document", { activeElement: null });
  vi.stubGlobal("location", { hash: "" });
  const write = (state, _title, url) => { browserHistory.state = state; location.hash = url; };
  browserHistory = { state: null, pushState: vi.fn(write), replaceState: vi.fn(write), go: vi.fn() };
  vi.stubGlobal("history", browserHistory);
  vi.stubGlobal("confirm", vi.fn(() => true));
  render = vi.fn();
  lifecycle = new EditorLifecycle({ contains: () => false, querySelectorAll: () => [] }, render, routePolicies);
});
afterEach(() => vi.unstubAllGlobals());

describe("route policy lifecycle integration", () => {
  it("discards session aliases and descendants while preserving independent sessions", () => {
    const session = { id: "t", isExisting: true };
    lifecycle.go("tradeEditor", { session });
    const first = lifecycle.current;
    lifecycle.openChild("instrumentEditor", null, { onSaved: vi.fn() });
    const child = lifecycle.current;
    lifecycle.cancelEditor();
    const alias = lifecycle.current;
    const independent = { ...alias, key: "independent", arg: { session: { id: "t", isExisting: true } } };
    lifecycle.entries.set(independent.key, independent);
    lifecycle.dirty = true;
    lifecycle.go("journal");
    for (const entry of [first, child, alias]) expect(entry).toMatchObject({ route: "tradeEditor", arg: { id: "t" }, parent: null, dirty: false, returnFocus: null });
    expect(independent.arg.session.id).toBe("t");
  });

  it("discards clean new sessions on ordinary departure but not rejected departures", () => {
    lifecycle.go("tradeEditor", { session: { id: "new", isExisting: false } });
    const fresh = lifecycle.current;
    lifecycle.go("journal");
    expect(fresh.arg).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
    lifecycle.go("tradeEditor", { session: { id: "dirty", isExisting: false } });
    const dirty = lifecycle.current;
    lifecycle.dirty = true;
    confirm.mockReturnValue(false);
    expect(lifecycle.go("journal")).toBe(false);
    expect(lifecycle.current).toBe(dirty);
    expect(dirty.arg.session.id).toBe("dirty");
    expect(lifecycle.dirty).toBe(true);
  });

  it("top-level Cancel and accepted browser departure reconstruct discarded editors", () => {
    lifecycle.go("journal");
    const journal = lifecycle.current;
    lifecycle.go("tradeEditor", { session: { id: "new", isExisting: false } });
    const discarded = lifecycle.current;
    lifecycle.dirty = true;
    lifecycle.cancelEditor();
    expect(discarded.arg).toBeNull();
    lifecycle.go("tradeEditor", { session: { id: "existing", isExisting: true } });
    const editor = lifecycle.current;
    lifecycle.dirty = true;
    browserHistory.state = lifecycle.historyState(journal);
    lifecycle.pop();
    expect(editor.arg).toEqual({ id: "existing" });
    expect(lifecycle.current).toBe(journal);
  });

  it("child Back preserves its parent's draft and callbacks", () => {
    const arg = { session: { id: "new", isExisting: false } };
    lifecycle.go("tradeEditor", arg);
    const parent = lifecycle.current;
    lifecycle.dirty = true;
    lifecycle.openChild("instrumentEditor", null, { onSaved: vi.fn() });
    const child = lifecycle.current;
    browserHistory.state = lifecycle.historyState(parent);
    lifecycle.pop();
    expect(lifecycle.current.arg).toBe(arg);
    expect(lifecycle.dirty).toBe(true);
    expect(child.parent.onSaved).toBeTypeOf("function");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("reconstructs existing trade editors from current data and handles deleted records", () => {
    const latest = { id: "t", revision: 2, accountId: "a", accountCurrency: "USD", legs: [], executions: [], adjustments: [] };
    const ui = { data: { trades: [latest], accounts: [{ id: "a", currency: "USD" }], instruments: [], settings: {} }, retainArg: vi.fn(), recentInstruments: () => [] };
    routePolicies.tradeEditor.render(ui, { id: "t" });
    expect(tradeEditor.mock.calls.at(-1)[1].baseRecord.revision).toBe(2);
    ui.data.trades = [];
    routePolicies.tradeEditor.render(ui, { id: "t" });
    expect(tradeView).toHaveBeenCalledWith(ui, "t");
  });
  it("uses actual route renderers and resolves current catalogue records", () => {
    const latest = { id: "a", name: "Current account" };
    const ui = { data: { accounts: [latest] } };
    routePolicies.journal.render(ui, null);
    expect(journalView).toHaveBeenCalledWith(ui, null);
    routePolicies.accountEditor.render(ui, { id: "a", name: "Cached account" });
    expect(accountEditor).toHaveBeenCalledWith(ui, latest, false);
  });

  it("completes and retires matching trade sessions without retiring unrelated drafts", () => {
    lifecycle.go("tradeEditor", { session: { id: "t", isExisting: false } });
    const first = lifecycle.current;
    lifecycle.go("tradeEditor", { session: { id: "other", isExisting: false } }, { force: true });
    const unrelated = lifecycle.current;
    lifecycle.go("tradeEditor", { session: { id: "t", isExisting: false } }, { force: true });
    const completed = lifecycle.current;
    const pushes = browserHistory.pushState.mock.calls.length;
    lifecycle.completeEditor({ id: "t" });
    expect(lifecycle.current).toMatchObject({ route: "trade", arg: "t", parent: null, dirty: false });
    expect(first).toMatchObject({ route: "trade", arg: "t" });
    expect(completed).toMatchObject({ route: "trade", arg: "t" });
    expect(unrelated.route).toBe("tradeEditor");
    expect(browserHistory.pushState).toHaveBeenCalledTimes(pushes);
  });

  it("retires only the completed unsaved catalogue editor when identities are absent", () => {
    lifecycle.go("instrumentEditor");
    const other = lifecycle.current;
    lifecycle.go("instrumentEditor");
    const completed = lifecycle.current;
    lifecycle.completeEditor({ id: "saved" });
    expect(completed.route).toBe("instruments");
    expect(other.route).toBe("instrumentEditor");
  });

  it("returns from nested editors through the retained session and retires descendants on save", () => {
    const arg = { session: { id: "t", isExisting: false } };
    lifecycle.go("tradeEditor", arg);
    const parent = lifecycle.current;
    lifecycle.dirty = true;
    const onSaved = vi.fn();
    lifecycle.openChild("instrumentEditor", null, { onSaved });
    const child = lifecycle.current;
    expect(lifecycle.hasParent).toBe(true);
    lifecycle.completeEditor({ id: "i" });
    expect(onSaved).toHaveBeenCalledWith({ id: "i" });
    expect(lifecycle.current.arg).toBe(arg);
    expect(lifecycle.dirty).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    lifecycle.completeEditor({ id: "t" });
    expect(parent.route).toBe("trade");
    expect(child).toMatchObject({ route: "trade", parent: null });
  });

  it("cancels dirty editors through policy with one confirmation and reopens snapshot context", () => {
    lifecycle.go("snapshotEditor", { tradeId: "t", legId: "l" });
    lifecycle.dirty = true;
    lifecycle.cancelEditor();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(lifecycle.current).toMatchObject({ route: "trade", arg: { id: "t", reopenLegId: "l" } });
  });

  it("retains composite arguments through the lifecycle contract and selects refresh destinations", () => {
    lifecycle.go("tradeEditor");
    const arg = { session: { id: "t", isExisting: true } };
    lifecycle.retainArg(arg);
    expect(lifecycle.current.arg).toBe(arg);
    expect(lifecycle.refreshDestination()).toEqual({ route: "trade", arg: "t" });
    lifecycle.retainArg({ session: { id: "new", isExisting: false } });
    expect(lifecycle.refreshDestination()).toEqual({ route: "tradeEditor", arg: null });
  });
});
