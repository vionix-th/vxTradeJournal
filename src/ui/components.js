import { money } from "../domain/journal.js";
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
  for (const child of children.flat(Infinity)) {
    if (child != null)
      n.append(
        child instanceof Node ? child : document.createTextNode(String(child)),
      );
  }
  return n;
}
export function button(label, onClick, cls = "button", attrs = {}) {
  return el("button", { type: "button", class: cls, onClick, ...attrs }, label);
}
export function option(value, label) {
  return el("option", { value }, label);
}
export function field(label, name, value = "", options = {}) {
  const id = `field-${++nextId}`;
  const { choices, type = "text", help, unit, tooltip, required = false, ...rest } = options;
  const description = [rest["aria-describedby"], unit !== undefined ? `${id}-unit` : null, help ? `${id}-help` : null].filter(Boolean).join(" ");
  if (description) rest["aria-describedby"] = description;
  const input = choices
    ? el(
        "select",
        { id, name, required, ...rest },
        choices.map((c) => option(c.value, c.label)),
      )
    : type === "textarea"
      ? el("textarea", { id, name, rows: 4, required, ...rest })
      : el("input", { id, name, type, required, ...rest });
  input.value = value ?? "";
  const plainLabel = el("label", { for: id }, label);
  const labelNode = tooltip ? labelHelp(plainLabel, label, tooltip, id) : plainLabel;
  return el(
    "div",
    { class: "field" },
    unit === undefined ? labelNode : el("div", { class: "field-label" },
      labelNode, el("span", { id: `${id}-unit`, class: "field-unit" }, unit)),
    input,
    help ? el("p", { id: `${id}-help`, class: "help" }, help) : null,
  );
}
export function setFieldUnit(node, unit) {
  node.querySelector(".field-unit").textContent = unit;
}
export function checkbox(label, name, checked = false, options = {}) {
  const id = `field-${++nextId}`;
  const labelNode = el("label", { for: id, class: "inline" },
    el("input", { id, name, type: "checkbox", checked }), label);
  return el(
    "div",
    { class: "field" },
    options.tooltip ? labelHelp(labelNode, label, options.tooltip, id) : labelNode,
  );
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
  return el(
    "details",
    { class: "details" },
    el("summary", {}, title),
    el("div", { class: "form-grid" }, children),
  );
}
export function decimalField(label, name, value, options = {}) {
  return field(label, name, value, { inputmode: "decimal", ...options });
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
  let previous = source.value;
  const update = () => {
    if (source.value !== previous) {
      rate.value = source.value === accountCurrency ? "1" : "";
      previous = source.value;
    }
    rate.readOnly = source.value === accountCurrency;
    if (rate.readOnly) rate.value = "1";
  };
  source.addEventListener("input", update);
  source.addEventListener("change", update);
  update();
}
