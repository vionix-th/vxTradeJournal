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
  constructor(root, render) {
    this.root = root;
    this.render = render;
    this.position = history.state?.journalNavigation?.index ?? 0;
    this.entries = new Map();
    this.reset();
    window.addEventListener("popstate", (event) => this.pop(event.state));
  }

  reset() {
    this.operation?.release();
    this.operation = null;
    this.entries.clear();
    this.current = null;
    this.editorDirty = false;
    this.session = crypto.randomUUID();
    this.restoring = false;
  }

  get busy() { return !!this.operation; }
  get dirty() { return this.editorDirty || !!this.current?.parent?.dirty; }
  set dirty(value) { this.editorDirty = value; }

  canLeave(currentOnly = false) {
    if (this.busy || this.restoring) return false;
    return !(currentOnly ? this.editorDirty : this.dirty) ||
      confirm("Unsaved changes will be discarded. Continue?");
  }

  go(route, arg = null, { force = false, replace = this.busy, parent = null, dirty = false, focus = null } = {}) {
    if (!force && !this.canLeave()) return false;
    const entry = {
      key: crypto.randomUUID(),
      index: replace ? this.position : this.position + 1,
      route, arg, parent, dirty,
      returnFocus: focusTarget(this.root),
    };
    this.entries.set(entry.key, entry);
    const state = { journalNavigation: { key: entry.key, index: entry.index, session: this.session } };
    history[replace ? "replaceState" : "pushState"](state, "", `#${route}`);
    this.activate(entry, dirty, focus);
    return true;
  }

  activate(entry, dirty = false, focus = null) {
    this.current = entry;
    this.position = entry.index;
    this.editorDirty = dirty;
    if (location.hash !== `#${entry.route}`)
      history.replaceState(history.state, "", `#${entry.route}`);
    this.render(entry.route, entry.arg);
    restoreFocus(this.root, focus);
  }

  openChild(route, arg, { arg: parentArg, onSaved }) {
    const entry = this.current;
    entry.arg = parentArg;
    entry.dirty = this.dirty;
    this.go(route, arg, { force: true, parent: {
      entry, route: entry.route, arg: parentArg, dirty: entry.dirty, onSaved,
    } });
  }

  returnParent(saved = null) {
    const parent = this.current.parent;
    const focus = this.current.returnFocus;
    if (saved) parent.onSaved?.(saved);
    this.go(parent.route, parent.arg, { force: true, dirty: parent.dirty || !!saved, focus });
  }

  retireEditors(route, matches, destination, arg) {
    const retired = new Set([...this.entries.values()]
      .filter((entry) => entry.route === route && matches(entry.arg)));
    for (const entry of this.entries.values()) {
      if (!retired.has(entry) && !retired.has(entry.parent?.entry)) continue;
      entry.route = destination;
      entry.arg = arg;
      entry.dirty = false;
      entry.parent = null;
      entry.returnFocus = null;
    }
  }

  cancel(onCancel) {
    if (!this.canLeave(!!this.current?.parent)) return;
    const focus = this.current?.returnFocus;
    this.editorDirty = false;
    onCancel();
    restoreFocus(this.root, focus);
  }

  pop(state) {
    const target = state?.journalNavigation;
    if (!this.current) {
      this.position = target?.index ?? this.position;
      return;
    }
    if (this.restoring && target?.key === this.current.key) {
      this.restoring = false;
      return;
    }
    const entry = target?.session === this.session ? this.entries.get(target.key) : null;
    const returning = entry && this.current.parent?.entry === entry;
    if (!this.canLeave(!!returning)) {
      this.restoring = true;
      history.go(this.position - (target?.index ?? this.position - 1));
      return;
    }
    if (entry) {
      const focus = returning ? this.current.returnFocus : null;
      this.activate(entry, entry.dirty, focus);
    } else {
      // History from a previous signed-in session must never restore private drafts.
      this.position = target?.index ?? this.position;
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
