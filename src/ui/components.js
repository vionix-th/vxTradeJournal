import { money } from "../domain/journal.js";
import { conversionState } from "./conversion-state.js";
let nextId = 0;
let activeHelp = null;
let helpEventsBound = false;
/** One shared tooltip lifecycle; field labels and unit descriptions stay unchanged. */
function labelHelp(labelNode, label, content, id) {
  const tip = el("span", { id: `${id}-tooltip`, class: "label-tooltip", role: "tooltip", hidden: true }, content);
  const trigger = button(el("span", { class: "help-mark", "aria-hidden": "true" }, "?"), () => {
    if (pinned && !tip.hidden) dismiss();
    else { dismissed = false; pinned = true; show(); }
  }, "label-help-button", { "aria-label": `About ${label}`, "aria-describedby": tip.id });
  const host = el("span", { class: "label-help" }, labelNode, trigger, tip);
  let hovered = false, focused = false, pinned = false, dismissed = false, hideTimer;
  const position = () => {
    const anchor = host.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    tip.style.left = `${Math.max(16, Math.min(anchor.left, window.innerWidth - box.width - 16))}px`;
    const below = anchor.bottom + 8;
    tip.style.top = `${Math.max(16, below + box.height <= window.innerHeight - 16 ? below : anchor.top - box.height - 8)}px`;
  };
  const controller = { host, dismiss, position };
  function dismiss() {
    clearTimeout(hideTimer);
    dismissed = true;
    pinned = false;
    tip.hidden = true;
    if (activeHelp === controller) activeHelp = null;
  }
  function show() {
    clearTimeout(hideTimer);
    if (dismissed) return;
    if (activeHelp && activeHelp !== controller) activeHelp.dismiss();
    tip.hidden = false;
    position();
    activeHelp = controller;
  }
  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!hovered && !focused && !pinned) dismiss();
    }, 150);
  }
  host.addEventListener("pointerenter", () => { hovered = true; dismissed = false; show(); });
  host.addEventListener("pointerleave", () => { hovered = false; scheduleHide(); });
  trigger.addEventListener("focus", () => { focused = true; dismissed = false; show(); });
  trigger.addEventListener("blur", () => { focused = false; pinned = false; scheduleHide(); });
  if (!helpEventsBound) {
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && activeHelp) activeHelp.dismiss();
    });
    document.addEventListener("click", (event) => {
      if (activeHelp && !activeHelp.host.contains(event.target)) activeHelp.dismiss();
    });
    window.addEventListener("scroll", () => activeHelp?.position(), { capture: true });
    window.addEventListener("resize", () => activeHelp?.position());
    helpEventsBound = true;
  }
  return host;
}
/** DOM-only rendering: user strings never enter HTML parsing. */
export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (
      value == null ||
      (value === false &&
        ["disabled", "required", "readonly", "hidden", "multiple"].includes(
          key,
        ))
    )
      continue;
    if (key.startsWith("on"))
      n.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "class") n.className = value;
    else if (key === "text") n.textContent = value;
    else if (key === "checked") n.checked = value;
    else n.setAttribute(key, String(value));
  }
  append(n, ...children);
  return n;
}
/** Compose native nodes, component handles and plain text without parsing HTML. */
export function append(parent, ...children) {
  for (const child of children.flat(Infinity)) {
    if (child == null) continue;
    const node = child instanceof Node ? child : child.node;
    parent.append(node instanceof Node ? node : document.createTextNode(String(child)));
  }
}
export function button(label, onClick, cls = "button", attrs = {}) {
  return el("button", { type: "button", class: cls, onClick, ...attrs }, label);
}
export function option(value, label) {
  return el("option", { value }, label);
}
/**
 * @typedef {object} FieldHandle
 * @property {HTMLElement} node Field container, for layout and composition.
 * @property {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} control Native form control.
 * @property {HTMLElement|null} unit Current unit description.
 * @property {(value: string) => void} setUnit Update the visible and accessible unit.
 * @property {(visible: boolean) => void} setVisible Hide/reveal without changing the control value.
 * @property {(message: string|null) => void} setError Own invalid state and its description.
 */
/** The field owns descriptions, visibility and errors; its control stays native. */
function fieldHandle(control, labelNode, { help, unit, containerAttrs = {} }) {
  const id = control.id;
  const externalDescription = control.getAttribute("aria-describedby");
  const label = el("div", { class: "field-label" }, labelNode);
  let unitNode = unit === undefined ? null : el("span", { id: `${id}-unit`, class: "field-unit" }, unit);
  if (unitNode) label.append(unitNode);
  const helpNode = help ? el("p", { id: `${id}-help`, class: "help" }, help) : null;
  const error = el("p", { id: `${id}-error`, class: "help field-error", hidden: true });
  const node = el("div", { ...containerAttrs, class: `field ${containerAttrs.class || ""}`.trim() },
    unitNode ? label : labelNode, control.type === "checkbox" ? null : control, helpNode, error);
  const describe = () => {
    const description = [externalDescription, unitNode?.id, helpNode?.id, error.hidden ? null : error.id].filter(Boolean).join(" ");
    if (description) control.setAttribute("aria-describedby", description);
    else control.removeAttribute("aria-describedby");
  };
  describe();
  return {
    node, control,
    get unit() { return unitNode; },
    setUnit(value) {
      if (!unitNode) {
        unitNode = el("span", { id: `${id}-unit`, class: "field-unit" });
        label.prepend(labelNode);
        label.append(unitNode);
        node.prepend(label);
      }
      unitNode.textContent = value;
      describe();
    },
    setVisible(visible) { node.hidden = !visible; },
    setError(message) {
      error.textContent = message || "";
      error.hidden = !message;
      if (message) control.setAttribute("aria-invalid", "true");
      else control.removeAttribute("aria-invalid");
      describe();
    },
  };
}
/**
 * Semantic options are type/choices/help/unit/tooltip. Attribute bags target their
 * named element: containerAttrs controls layout; controlAttrs controls the input.
 * @returns {FieldHandle}
 */
export function field(label, name, value = "", options = {}) {
  const id = `field-${++nextId}`;
  const { choices, type = "text", help, unit, tooltip, controlAttrs = {}, containerAttrs = {} } = options;
  const control = choices
    ? el("select", { ...controlAttrs, id, name }, choices.map((c) => option(c.value, c.label)))
    : type === "textarea"
      ? el("textarea", { rows: 4, ...controlAttrs, id, name })
      : el("input", { ...controlAttrs, id, name, type });
  control.value = value ?? "";
  const plainLabel = el("label", { for: id }, label);
  return fieldHandle(control, tooltip ? labelHelp(plainLabel, label, tooltip, id) : plainLabel,
    { help, unit, containerAttrs });
}
export function checkbox(label, name, checked = false, options = {}) {
  const id = `field-${++nextId}`;
  const control = el("input", { ...options.controlAttrs, id, name, type: "checkbox", checked });
  const labelNode = el("label", { for: id, class: "inline" }, control, label);
  return fieldHandle(control, options.tooltip ? labelHelp(labelNode, label, options.tooltip, id) : labelNode, options);
}
export function values(form) {
  const data = Object.fromEntries(new FormData(form));
  for (const check of form.querySelectorAll("input[type=checkbox]"))
    data[check.name] = check.checked;
  return data;
}
export function notice(message, type = "notice") {
  return el(
    "div",
    { class: `notice ${type}`, role: type === "error" ? "alert" : "status" },
    message,
  );
}
export function metric(label, value) {
  return el(
    "div",
    { class: "metric" },
    el("span", { class: "muted" }, label),
    el("strong", {}, value),
  );
}
export function result(value, currency, attrs = {}) {
  return el(
    "span",
    {
      class:
        value == null
          ? "muted"
          : Number(value) > 0
            ? "positive"
            : Number(value) < 0
              ? "negative"
              : "",
      ...attrs,
    },
    money(value, currency),
  );
}
export function header(title, description, ...actions) {
  return el(
    "div",
    { class: "page-header" },
    el(
      "div",
      {},
      el("h1", { tabindex: "-1" }, title),
      description ? el("p", { class: "muted" }, description) : null,
    ),
    el("div", { class: "actions" }, actions),
  );
}
export function section(title, ...children) {
  return el(
    "section",
    { class: "panel section-panel" },
    el("div", { class: "section-heading" }, el("h2", {}, title)),
    el("div", { class: "section-body" }, children),
  );
}
/** Catalogue cards share a heading/action row and a spaced content body. */
export function recordCard(title, action, ...children) {
  const card = section(title, ...children);
  card.classList.add("record-panel");
  card.firstElementChild.append(el("div", { class: "actions" }, action));
  return card;
}
export function subsection(title, ...children) {
  return el("div", { class: "subsection" }, el("h3", {}, title),
    el("div", { class: "subsection-body" }, children));
}
export function empty(title, text, action) {
  return el(
    "div",
    { class: "empty" },
    el("h2", {}, title),
    el("p", { class: "muted" }, text),
    action,
  );
}
export function details(title, ...children) {
  const summary = el("summary", {}, title);
  const content = el("div", { class: "form-grid" }, children);
  const node = el("details", { class: "details" }, summary, content);
  return {
    node, summary, content,
    isOpen() { return node.open; },
    setOpen(open) { node.open = open; },
    setVisible(visible) { node.hidden = !visible; },
  };
}
export function decimalField(label, name, value, options = {}) {
  return field(label, name, value, { ...options, controlAttrs: { inputmode: "decimal", ...options.controlAttrs } });
}

/** A rate belongs to its source currency. Never carry an automatic 1 into foreign currency. */
export function bindConversionRate(
  form,
  sourceName,
  rateName,
  accountCurrency,
) {
  const source = form.elements[sourceName];
  const rate = form.elements[rateName];
  let previousPair = `${source.value}/${accountCurrency}`;
  const update = () => {
    const state = conversionState(previousPair, source.value, accountCurrency, rate.value);
    rate.value = state.rate;
    rate.readOnly = state.automatic;
    previousPair = state.pair;
  };
  source.addEventListener("input", update);
  source.addEventListener("change", update);
  update();
}
