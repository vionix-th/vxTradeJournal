function focusTarget(root) {
  const control = document.activeElement;
  if (!root.contains(control) || control.tagName !== "BUTTON") return null;
  return {
    key: control.dataset.focusKey || null,
    text: control.textContent.trim(),
    label: control.getAttribute("aria-label"),
    context: control.closest(".record-panel, .section-panel, .leg-card")
      ?.querySelector("h2, legend")?.textContent,
  };
}

function restoreFocus(root, target) {
  if (!target) return;
  const control = [...root.querySelectorAll("button")].find((button) =>
    (target.key ? button.dataset.focusKey === target.key : button.textContent.trim() === target.text) &&
    button.getAttribute("aria-label") === target.label &&
    button.closest(".record-panel, .section-panel, .leg-card")
      ?.querySelector("h2, legend")?.textContent === target.context);
  control?.focus({ preventScroll: true });
}

/** Owns editor departure, suspended drafts, history and pending operation locks. */
export class EditorLifecycle {
  constructor(root, render, policies) {
    this.root = root;
    this.render = render;
    this.policies = policies;
    this.entries = new Map();
    this.reset();
    window.addEventListener("popstate", () => this.pop());
    window.addEventListener("hashchange", () => this.hashChange());
  }

  reset() {
    this.operation?.release();
    this.operation = null;
    this.entries.clear();
    this.current = null;
    this.editorDirty = false;
    this.session = crypto.randomUUID();
    this.epoch = crypto.randomUUID();
    this.position = 0;
    this.clearRecovery();
  }

  get busy() { return !!this.operation; }
  get restoring() { return !!this.recovery; }
  get hasParent() { return !!this.current?.parent; }
  get dirty() { return this.editorDirty || !!this.current?.parent?.dirty; }
  set dirty(value) { this.editorDirty = value; }

  canLeave(currentOnly = false) {
    if (this.busy || this.restoring) return false;
    return !(currentOnly ? this.editorDirty : this.dirty) ||
      confirm("Unsaved changes will be discarded. Continue?");
  }

  go(route, arg = null, { force = false, replace = false, parent = null, dirty = false, focus = null } = {}) {
    if (!force && !this.canLeave()) return false;
    this.clearRecovery();
    const entry = {
      key: crypto.randomUUID(),
      index: replace ? this.position : this.position + 1,
      route, arg, parent, dirty,
      returnFocus: focusTarget(this.root),
    };
    this.entries.set(entry.key, entry);
    history[replace ? "replaceState" : "pushState"](this.historyState(entry), "", `#${route}`);
    this.activate(entry, dirty, focus);
    return true;
  }

  activate(entry, dirty = false, focus = null) {
    this.current = entry;
    this.position = entry.index;
    this.editorDirty = dirty;
    if (location.hash !== `#${entry.route}`)
      history.replaceState(history.state, "", `#${entry.route}`);
    entry.nativeKey = window.navigation?.currentEntry?.key;
    this.render(entry.route, entry.arg);
    restoreFocus(this.root, focus);
  }

  historyState(entry) {
    return { journalNavigation: {
      key: entry.key, index: entry.index, session: this.session, epoch: this.epoch,
    } };
  }

  managedEntry(state) {
    const marker = state?.journalNavigation;
    if (marker?.session !== this.session || marker?.epoch !== this.epoch) return null;
    const entry = this.entries.get(marker.key);
    const nativeKey = window.navigation?.currentEntry?.key;
    return entry?.index === marker.index && (!nativeKey || entry.nativeKey === nativeKey) ? entry : null;
  }

  rebase() {
    // Classic history cannot locate an unindexed physical entry. Start a fresh
    // ledger on this slot without re-rendering or copying an existing marker.
    this.epoch = crypto.randomUUID();
    this.entries.clear();
    this.position = 0;
    this.clearRecovery();
    if (!this.current) return;
    this.current.key = crypto.randomUUID();
    this.current.index = 0;
    this.current.nativeKey = window.navigation?.currentEntry?.key;
    this.entries.set(this.current.key, this.current);
    history.replaceState(this.historyState(this.current), "", `#${this.current.route}`);
  }

  recoveryIsCurrent(recovery) {
    return this.recovery === recovery && recovery.session === this.session &&
      recovery.epoch === this.epoch && recovery.entry === this.current;
  }

  clearRecovery() {
    clearTimeout(this.recovery?.timer);
    this.recovery = null;
  }

  recover(entry) {
    const recovery = { session: this.session, epoch: this.epoch, entry: this.current, nativeKey: this.current.nativeKey };
    this.recovery = recovery;
    const fallback = () => { if (this.recoveryIsCurrent(recovery)) this.rebase(); };
    const navigation = window.navigation;
    if (recovery.nativeKey && navigation?.currentEntry?.key === recovery.nativeKey) {
      history.replaceState(this.historyState(this.current), "", `#${this.current.route}`);
      this.clearRecovery();
    } else if (recovery.nativeKey && navigation?.traverseTo) {
      try {
        const { committed, finished } = navigation.traverseTo(recovery.nativeKey);
        Promise.all([committed, finished]).then(() => {
          if (!this.recoveryIsCurrent(recovery)) return;
          if (navigation.currentEntry?.key === recovery.nativeKey) this.clearRecovery();
          else fallback();
        }, fallback);
      } catch {
        fallback();
      }
    } else if (entry && this.position !== entry.index) {
      recovery.classic = { lastIndex: entry.index, corrections: 1 };
      // Concurrent traversals can change the cursor before a relative return
      // runs. One corrective return is allowed; a stalled return rebases.
      recovery.timer = setTimeout(fallback, 1000);
      history.go(this.position - entry.index);
    } else fallback();
  }

  hashChange() {
    this.pop();
  }

  retainArg(arg) {
    this.current.arg = arg;
  }

  refreshDestination() {
    return this.policies[this.current.route].refresh(this.current.arg);
  }

  openChild(route, arg, { onSaved }) {
    const entry = this.current;
    entry.dirty = this.dirty;
    this.go(route, arg, { force: true, parent: {
      entry, route: entry.route, arg: entry.arg, dirty: entry.dirty, onSaved,
    } });
  }

  returnParent(saved = null) {
    const parent = this.current.parent;
    const focus = this.current.returnFocus;
    if (saved) parent.onSaved?.(saved);
    this.go(parent.route, parent.arg, { force: true, replace: true, dirty: parent.dirty || !!saved, focus });
  }

  completeEditor(saved) {
    if (this.hasParent) return this.returnParent(saved);
    const current = this.current;
    const policy = this.policies[current.route];
    const destination = policy.complete(saved, current.arg);
    const identity = policy.identity(current.arg);
    const retired = new Set([current]);
    if (identity != null) {
      for (const entry of this.entries.values()) {
        if (entry.route === current.route && policy.identity(entry.arg) === identity) retired.add(entry);
      }
    }
    const affected = [...this.entries.values()].filter((entry) => {
      let ancestor = entry;
      while (ancestor && !retired.has(ancestor)) ancestor = ancestor.parent?.entry;
      return !!ancestor;
    });
    for (const entry of affected) {
      entry.route = destination.route;
      entry.arg = destination.arg;
      entry.dirty = false;
      entry.parent = null;
      entry.returnFocus = null;
    }
    return this.go(destination.route, destination.arg, { force: true, replace: true });
  }

  cancelEditor() {
    if (!this.canLeave(this.hasParent)) return;
    const focus = this.current?.returnFocus;
    this.editorDirty = false;
    if (this.hasParent) return this.returnParent();
    const destination = this.policies[this.current.route].cancel(this.current.arg);
    return this.go(destination.route, destination.arg, { force: true, focus });
  }

  pop() {
    if (!this.current) return;
    // Both events reconcile the actual cursor. A queued hashchange can describe
    // a departure that has already been repaired by an intervening popstate.
    const entry = this.managedEntry(history.state);
    if (this.restoring) {
      if (entry === this.current) this.clearRecovery();
      else if (this.recovery.classic && entry) {
        const classic = this.recovery.classic;
        const previousDistance = Math.abs(this.position - classic.lastIndex);
        const distance = Math.abs(this.position - entry.index);
        classic.lastIndex = entry.index;
        if (!distance) {
          this.rebase();
          return;
        }
        // A queued user traversal moved away from the origin. Wait for the
        // already-issued return before correcting its actual landing slot.
        if (distance >= previousDistance) return;
        if (classic.corrections-- > 0) history.go(this.position - entry.index);
        else this.rebase();
      }
      return;
    }
    if (entry === this.current) {
      if (location.hash !== `#${entry.route}`)
        history.replaceState(this.historyState(entry), "", `#${entry.route}`);
      return;
    }
    const returning = entry && this.current.parent?.entry === entry;
    if (!this.canLeave(!!returning)) {
      this.recover(entry);
      return;
    }
    if (entry) {
      const focus = returning ? this.current.returnFocus : null;
      this.activate(entry, entry.dirty, focus);
    } else {
      // History from a previous signed-in session must never restore private drafts.
      this.current = null;
      this.rebase();
      this.go("journal", null, { force: true, replace: true });
    }
  }

  async run(action, after) {
    if (this.busy) throw new Error("Journal operation already in progress.");
    // Capture FormData before disabling controls, which excludes them from FormData.
    const pending = action();
    const controls = [...this.root.querySelectorAll("button, input, select, textarea")]
      .map((control) => ({ control, disabled: control.disabled }));
    const operation = { release: () => {
      for (const { control, disabled } of controls) control.disabled = disabled;
    } };
    this.operation = operation;
    for (const { control } of controls) control.disabled = true;
    try {
      const saved = await pending;
      await after(saved);
      return saved;
    } finally {
      operation.release();
      if (this.operation === operation) this.operation = null;
    }
  }
}
