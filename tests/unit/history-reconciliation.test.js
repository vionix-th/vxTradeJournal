import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorLifecycle } from "../../src/ui/editor-lifecycle.js";

let lifecycle, browserHistory, render, navigation;
beforeEach(() => {
  navigation = { currentEntry: { key: "native-editor" }, traverseTo: vi.fn() };
  vi.stubGlobal("window", { navigation, addEventListener: vi.fn() });
  vi.stubGlobal("document", { activeElement: null });
  vi.stubGlobal("location", { hash: "" });
  const write = (state, _title, url) => { browserHistory.state = state; location.hash = url; };
  browserHistory = { state: null, pushState: vi.fn(write), replaceState: vi.fn(write), go: vi.fn() };
  vi.stubGlobal("history", browserHistory);
  vi.stubGlobal("confirm", vi.fn(() => false));
  render = vi.fn();
  lifecycle = new EditorLifecycle({ contains: () => false, querySelectorAll: () => [] }, render, {});
  lifecycle.go("tradeEditor", { session: { id: "private-draft" } });
  lifecycle.dirty = true;
});
afterEach(() => {
  lifecycle.clearRecovery();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function foreignEntry() {
  browserHistory.state = null;
  location.hash = "#foreign-fragment";
  navigation.currentEntry = { key: "native-foreign" };
}

describe("browser history reconciliation", () => {
  it("returns to the native origin without rewriting a foreign entry or rendering", async () => {
    let finish;
    const pending = new Promise((resolve) => { finish = resolve; });
    navigation.traverseTo.mockReturnValue({ committed: pending, finished: pending });
    const origin = lifecycle.current;
    const originState = browserHistory.state;
    foreignEntry();
    lifecycle.hashChange();
    expect(navigation.traverseTo).toHaveBeenCalledWith("native-editor");
    expect(browserHistory.replaceState).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledTimes(1);
    lifecycle.hashChange();
    expect(confirm).toHaveBeenCalledTimes(1);
    browserHistory.state = originState;
    location.hash = "#tradeEditor";
    navigation.currentEntry = { key: "native-editor" };
    lifecycle.pop(originState);
    finish();
    await pending;
    expect(lifecycle.current).toBe(origin);
    expect(lifecycle.dirty).toBe(true);
    expect(render).toHaveBeenCalledTimes(1);
    expect(lifecycle.restoring).toBeFalsy();
  });

  it("rebases an unindexed classic entry with a fresh ledger and keeps the live parent draft", () => {
    window.navigation = undefined;
    const origin = lifecycle.current;
    const originState = browserHistory.state;
    origin.parent = { entry: {}, arg: { session: "parent" }, dirty: true };
    const parent = origin.parent;
    foreignEntry();
    lifecycle.hashChange();
    expect(lifecycle.current).toBe(origin);
    expect(origin.parent).toBe(parent);
    expect(browserHistory.state.journalNavigation.key).not.toBe(originState.journalNavigation.key);
    expect(browserHistory.state.journalNavigation.epoch).not.toBe(originState.journalNavigation.epoch);
    expect(browserHistory.state.journalNavigation.index).toBe(0);
    expect(lifecycle.entries.size).toBe(1);
    expect(browserHistory.go).not.toHaveBeenCalled();
    browserHistory.state = originState;
    lifecycle.pop(originState);
    expect(browserHistory.go).not.toHaveBeenCalledWith(0);
    expect(lifecycle.current).toBe(origin);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("handles native recovery rejection once and unlocks the retained editor", async () => {
    navigation.traverseTo.mockImplementation(() => ({
      committed: Promise.reject(new Error("Entry unavailable")),
      finished: Promise.reject(new Error("Entry unavailable")),
    }));
    foreignEntry();
    lifecycle.hashChange();
    expect(navigation.traverseTo).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(lifecycle.restoring).toBeFalsy());
    expect(browserHistory.replaceState).toHaveBeenCalledTimes(1);
    expect(lifecycle.dirty).toBe(true);
    expect(render).toHaveBeenCalledTimes(1);
    vi.mocked(confirm).mockReturnValue(true);
    expect(lifecycle.go("journal")).toBe(true);
  });

  it("ignores late recovery rejection after an authentication reset", async () => {
    let fail;
    const pending = new Promise((_resolve, reject) => { fail = reject; });
    navigation.traverseTo.mockReturnValue({ committed: pending, finished: pending });
    foreignEntry();
    lifecycle.hashChange();
    lifecycle.reset();
    lifecycle.go("journal", null, { force: true, replace: true });
    const state = browserHistory.state;
    fail(new Error("Old session recovery failed"));
    await Promise.allSettled([pending]);
    await Promise.resolve();
    expect(browserHistory.state).toBe(state);
    expect(lifecycle.current).toMatchObject({ route: "journal", arg: null, parent: null });
    expect(lifecycle.entries.size).toBe(1);
  });

  it("does not trust history indexes from another authentication session", () => {
    window.navigation = undefined;
    const state = { journalNavigation: { key: "foreign", index: 9000, session: "another-user" } };
    browserHistory.state = state;
    lifecycle.pop(state);
    expect(browserHistory.go).not.toHaveBeenCalled();
    expect(lifecycle.current.route).toBe("tradeEditor");
    expect(lifecycle.current.index).toBe(0);
    vi.mocked(confirm).mockReturnValue(true);
    browserHistory.state = state;
    lifecycle.pop(state);
    expect(lifecycle.current).toMatchObject({ route: "journal", arg: null, index: 0 });
  });

  it("uses a nonzero classic delta only for entries in the current ledger", () => {
    window.navigation = undefined;
    lifecycle.dirty = false;
    const previous = browserHistory.state;
    lifecycle.go("instrumentEditor");
    const origin = lifecycle.current;
    const originState = browserHistory.state;
    lifecycle.dirty = true;
    browserHistory.state = previous;
    lifecycle.pop();
    expect(browserHistory.go).toHaveBeenCalledExactlyOnceWith(1);
    expect(lifecycle.restoring).toBe(true);
    browserHistory.state = originState;
    lifecycle.pop();
    expect(lifecycle.restoring).toBe(false);
    expect(lifecycle.current).toBe(origin);
    expect(lifecycle.dirty).toBe(true);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("rebases on a synchronous native recovery failure", () => {
    navigation.traverseTo.mockImplementation(() => { throw new Error("Unavailable entry"); });
    const origin = lifecycle.current;
    foreignEntry();
    lifecycle.hashChange();
    expect(lifecycle.restoring).toBe(false);
    expect(lifecycle.current).toBe(origin);
    expect(browserHistory.go).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("repairs an unknown URL on the same physical slot without traversing", () => {
    browserHistory.state = null;
    location.hash = "#replaced-fragment";
    const origin = lifecycle.current;
    lifecycle.hashChange();
    expect(navigation.traverseTo).not.toHaveBeenCalled();
    expect(browserHistory.state.journalNavigation.key).toBe(origin.key);
    expect(location.hash).toBe("#tradeEditor");
    expect(lifecycle.restoring).toBe(false);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("corrects the landing slot after two queued classic Back traversals", () => {
    window.navigation = undefined;
    lifecycle.dirty = false;
    const first = browserHistory.state;
    lifecycle.go("journal");
    const second = browserHistory.state;
    lifecycle.go("instrumentEditor");
    const origin = browserHistory.state;
    lifecycle.dirty = true;
    browserHistory.state = second;
    lifecycle.pop();
    browserHistory.state = first;
    lifecycle.pop();
    expect(browserHistory.go).toHaveBeenCalledExactlyOnceWith(1);
    browserHistory.state = second;
    lifecycle.pop();
    expect(browserHistory.go).toHaveBeenCalledTimes(2);
    expect(browserHistory.go).toHaveBeenLastCalledWith(1);
    browserHistory.state = origin;
    lifecycle.pop();
    expect(lifecycle.restoring).toBe(false);
    expect(lifecycle.dirty).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(3);
  });

  it("bounds stalled classic recovery without releasing a pending save or rendering", async () => {
    vi.useFakeTimers();
    window.navigation = undefined;
    lifecycle.dirty = false;
    const previous = browserHistory.state;
    lifecycle.go("instrumentEditor");
    lifecycle.dirty = true;
    let fail;
    const operation = lifecycle.run(() => new Promise((_resolve, reject) => { fail = reject; }), vi.fn());
    browserHistory.state = previous;
    lifecycle.pop();
    expect(lifecycle.restoring).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(lifecycle.restoring).toBe(false);
    expect(lifecycle.busy).toBe(true);
    expect(lifecycle.dirty).toBe(true);
    expect(render).toHaveBeenCalledTimes(2);
    fail(new Error("Synthetic save failure"));
    await expect(operation).rejects.toThrow("Synthetic save failure");
    expect(lifecycle.busy).toBe(false);
  });
});
