import {
  PRESETS,
  normalizeInstrument,
  normalizeAccount,
  normalizeStrategy,
  validateSettings,
  calculateTrade,
  requireValue,
  money,
} from "../domain/journal.js";
import { exportJournal } from "../application/journal.js";
import { newTrade, editTrade, replaceLegs, putExecution, putAdjustment, correctSnapshot } from "../application/operations.js";
import {
  el,
  button,
  field,
  decimalField,
  checkbox,
  values,
  section,
  notice,
  details,
  bindConversionRate,
  setFieldUnit,
} from "./components.js";
import { hasPlanValues, nextConversionRate, planningFeedback } from "./planning.js";
import { instrumentHelp, tradeHelp } from "./field-help.js";
const choices = (items) => items.map((i) => ({ value: i.id, label: i.name }));
const nullable = (v) => (v === "" ? null : v);
export function accountEditor(ui, account = null, first = false) {
  const id = account?.id || crypto.randomUUID();
  const form = ui.form(
    first ? "First account" : account ? "Edit account" : "New account",
    "Reporting currency locks after first trade.",
    "Save account",
    async (f) => {
      const v = values(f);
      await ui.commit(
        () =>
          ui.repo.saveEntity(
            "accounts",
            normalizeAccount({
              ...account,
              ...v,
              id,
              currency: account?.hasTrades ? account.currency : v.currency,
            }),
          ),
        () => ui.go(first ? "journal" : "accounts", null, true),
      );
    },
    () => ui.go("accounts"),
  );
  form.body.append(
    field("Account name", "name", account?.name, {
      required: true,
      maxlength: 120,
    }),
    field("Reporting currency", "currency", account?.currency || "USD", {
      required: true,
      disabled: account?.hasTrades || false,
      pattern: "[A-Z][A-Z0-9]{2,11}",
      maxlength: 12,
    }),
    checkbox("Archived", "archived", account?.archived),
  );
  ui.show(form.node);
}
export function strategyEditor(ui, strategy = null) {
  const id = strategy?.id || crypto.randomUUID();
  const form = ui.form(
    strategy ? "Edit strategy" : "New strategy",
    "Structured plain-text rules. Historical links keep original definition.",
    "Save strategy",
    async (f) => {
      await ui.commit(
        () =>
          ui.repo.saveEntity(
            "strategies",
            normalizeStrategy({ ...strategy, ...values(f), id }),
          ),
        () => ui.go("strategies", null, true),
      );
    },
    () => ui.go("strategies"),
  );
  form.body.append(
    field("Strategy name", "name", strategy?.name, {
      required: true,
      maxlength: 120,
    }),
    field("Purpose", "purpose", strategy?.purpose, { type: "textarea" }),
    field("Applicable markets", "markets", strategy?.markets),
    field("Entry rules", "entryRules", strategy?.entryRules, {
      type: "textarea",
    }),
    field("Exit rules", "exitRules", strategy?.exitRules, { type: "textarea" }),
    field("Risk rules", "riskRules", strategy?.riskRules, { type: "textarea" }),
    checkbox("Archived", "archived", strategy?.archived),
  );
  ui.show(form.node);
}
export function instrumentEditor(
  ui,
  instrument = null,
  onReturn = null,
  correction = null,
) {
  const inputField = (label, name, value, options = {}) => field(label, name, value, { ...options, tooltip: instrumentHelp[name] });
  const inputDecimal = (label, name, value, options = {}) => decimalField(label, name, value, { ...options, tooltip: instrumentHelp[name] });
  const inputCheckbox = (label, name, checked) => checkbox(label, name, checked, { tooltip: instrumentHelp[name] });
  const id = instrument?.id || crypto.randomUUID();
  const base = instrument || {
    preset: "equity",
    ...PRESETS.equity,
    currency: "USD",
  };
  let previewed = false;
  let form;
  const back = () => (onReturn ? onReturn(null) : ui.go("instruments"));
  form = ui.form(
    correction
      ? "Correct instrument snapshot"
      : instrument
        ? "Edit instrument"
        : "New instrument",
    correction
      ? "Correction changes this leg only. Preview recalculated history before saving."
      : "Presets supply editable examples. Confirm actual contract specifications.",
    "Save instrument",
    async (f) => {
      const i = normalizeInstrument({ ...instrument, ...values(f), id });
      if (correction) {
        requireValue(previewed, "Preview correction before saving");
        const next = correctSnapshot(correction.trade, correction.legId, i);
        await ui.commit(
          () => ui.repo.saveTrade(next, form.operationId),
          () => ui.go("trade", next.id, true),
        );
      } else
        await ui.commit(
          () => ui.repo.saveEntity("instruments", i),
          async (saved) => {
            if (onReturn) onReturn(saved);
            else ui.go("instruments", null, true);
          },
        );
    },
    back,
  );
  const f = form.node;
  form.body.append(
    inputField("Instrument name", "name", base.name, {
      required: true,
      maxlength: 120,
    }),
    inputField("Symbol", "symbol", base.symbol, { maxlength: 80 }),
    inputField("Preset", "preset", base.preset, {
      choices: Object.entries(PRESETS).map(([value, p]) => ({
        value,
        label: p.label,
      })),
    }),
    inputField("Market", "market", base.market),
    inputField("Venue", "venue", base.venue),
    inputField("Calculation model", "model", base.model, {
      choices: [
        { value: "linear", label: "Linear — automatic sizing and P&L" },
        { value: "manual", label: "Manual — reported closing results" },
      ],
    }),
    inputField("Quantity unit", "quantityUnit", base.quantityUnit),
    inputField("Price unit", "priceUnit", base.priceUnit, { maxlength: 80, placeholder: "USD/share, points, JPY/EUR" }),
    inputDecimal(
      "Quantity increment",
      "quantityIncrement",
      base.quantityIncrement,
    ),
    inputDecimal("Price increment", "priceIncrement", base.priceIncrement),
    inputDecimal("Point value", "pointValue", base.pointValue),
    inputField("P&L currency", "currency", base.currency, { maxlength: 12 }),
    inputCheckbox("Draft definition", "draft", base.draft),
    inputCheckbox("Archived", "archived", base.archived),
  );
  const contract = details(
    "Contract details",
    inputField("Underlying", "underlying", base.underlying),
    inputField("Expiry", "expiry", base.expiry, { type: "date" }),
    inputDecimal("Strike", "strike", base.strike),
    inputField("Option type", "optionType", base.optionType, {
      choices: [
        { value: "", label: "None" },
        { value: "call", label: "Call" },
        { value: "put", label: "Put" },
      ],
    }),
  );
  form.body.append(contract);
  const preview = el("div", { class: "notice full", role: "status" });
  form.body.append(preview);
  const update = () => {
    previewed = false;
    const v = values(f);
    f.elements.pointValue.closest(".field").hidden = v.model !== "linear";
    contract.hidden = !["futures", "options", "cryptoDerivative"].includes(
      v.preset,
    );
    try {
      const i = normalizeInstrument({ ...base, ...v, id });
      preview.textContent = i.draft
        ? "Draft: unavailable for new trades."
        : i.model === "manual"
          ? `${i.quantityUnit}, increment ${i.quantityIncrement}. Manual reported results; automatic sizing and P&L unavailable.`
          : `${i.quantityUnit}, increment ${i.quantityIncrement}. One full price point × one ${i.quantityUnit} = ${i.pointValue} ${i.currency}. Linear sizing and P&L available.`;
    } catch (e) {
      preview.textContent = e.message;
    }
  };
  f.elements.preset.addEventListener("change", () => {
    if (correction) return;
    const p = PRESETS[f.elements.preset.value];
    for (const key of [
      "market",
      "model",
      "quantityUnit",
      "priceUnit",
      "quantityIncrement",
      "priceIncrement",
      "pointValue",
    ])
      f.elements[key].value = p[key] ?? "";
    update();
  });
  f.addEventListener("input", update);
  f.addEventListener("change", update);
  update();
  if (correction) {
    const out = el("div", { class: "full" });
    form.body.append(
      button(
        "Preview correction",
        () => {
          try {
            const next = correctSnapshot(correction.trade, correction.legId,
              normalizeInstrument({ ...instrument, ...values(f), id }));
            const calc = calculateTrade(next);
            out.replaceChildren(
              notice(
                `Before: ${money(correction.trade.summary.accountNet, next.accountCurrency)}. After: ${money(calc.accountNet, next.accountCurrency)}. Status: ${calc.status}.`,
              ),
            );
            previewed = true;
          } catch (e) {
            out.replaceChildren(notice(e.message, "error"));
          }
        },
        "button secondary",
      ),
      out,
    );
  }
  ui.show(f);
}
export function tradeEditor(ui, original = null, disclosureState = new Map()) {
  const inputField = (label, name, value, options = {}) => field(label, name, value, { ...options, tooltip: tradeHelp[name] });
  const inputDecimal = (label, name, value, options = {}) => decimalField(label, name, value, { ...options, tooltip: tradeHelp[name] });
  const isExisting = !!original?.revision;
  const draft = original
    ? structuredClone(original)
    : {
        id: crypto.randomUUID(),
        revision: 0,
        schemaVersion: 1,
        accountId:
          ui.data.settings.defaultAccount ||
          ui.data.accounts.find((a) => !a.archived)?.id,
        strategyId: null,
        strategySnapshot: null,
        rationale: "",
        review: "",
        tags: [],
        riskBudget: null,
        legs: [],
        executions: [],
        adjustments: [],
      };
  const activeInstruments = ui
    .recentInstruments()
    .filter((i) => !i.draft && !i.archived);
  if (!draft.legs.length)
    draft.legs.push({
      id: crypto.randomUUID(),
      instrumentId: activeInstruments[0]?.id || "",
      snapshot: activeInstruments[0]
        ? structuredClone(activeInstruments[0])
        : null,
      direction: "long",
      planning: {},
    });
  const blocks = [];
  let form;
  const collect = () => {
    const v = values(form.node);
    const account = ui.data.accounts.find(
      (a) => a.id === (isExisting ? draft.accountId : v.accountId),
    );
    requireValue(account, "Trading account required");
    const sid = v.strategyId || null;
    const strategy = ui.data.strategies.find((s) => s.id === sid);
    const legs = blocks.map(({ leg, node }) => {
      const instrumentId = node.querySelector("[name=instrumentId]").value;
      const selected = ui.data.instruments.find((i) => i.id === instrumentId);
      return {
        ...leg,
        instrumentId,
        snapshot:
          leg.instrumentId === instrumentId && leg.snapshot
            ? leg.snapshot
            : structuredClone(selected),
        direction: node.querySelector("[name=direction]").value,
        planning: Object.fromEntries(
          ["entry", "stop", "target", "riskBudget", "rate", "quantity"].map(
            (k) => [k, nullable(node.querySelector(`[name=${k}]`).value)],
          ),
        ),
      };
    });
    return {
      ...draft,
      accountId: account.id,
      accountCurrency: account.currency,
      strategyId: sid,
      strategySnapshot:
        sid === draft.strategyId
          ? draft.strategySnapshot
          : strategy
            ? structuredClone(strategy)
            : null,
      rationale: v.rationale,
      review: v.review,
      tags: [
        ...new Set(
          v.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ],
      riskBudget: nullable(v.combinedRiskBudget),
      legs,
    };
  };
  form = ui.form(
    isExisting ? "Edit trade" : "New trade",
    "Choose an instrument and direction. Add a trade plan when needed.",
    "Save trade",
    async () => {
      const collected = collect();
      const t = isExisting
        ? replaceLegs(editTrade(draft, collected, ui.data), collected.legs, ui.data)
        : newTrade(collected, ui.data);
      await ui.commit(
        () => ui.repo.saveTrade(t, form.operationId),
        () => {
          ui.lifecycle.retireEditors("tradeEditor", (arg) => (arg?.draft || arg)?.id === t.id, "trade", t.id);
          ui.go("trade", t.id, true);
        },
      );
    },
    () => ui.go(isExisting ? "trade" : "journal", isExisting ? draft.id : null),
  );
  const tags = inputField("Tags", "tags", (draft.tags || []).join(", "), {
    help: "Comma-separated free-text tags.",
  });
  tags.classList.add("full");
  form.body.append(
    inputField("Account", "accountId", draft.accountId, {
      choices: choices(
        ui.data.accounts.filter((a) => !a.archived || a.id === draft.accountId),
      ),
      disabled: isExisting,
    }),
    inputField("Strategy", "strategyId", draft.strategyId, {
      choices: [
        { value: "", label: "No strategy" },
        ...choices(
          ui.data.strategies.filter(
            (s) => !s.archived || s.id === draft.strategyId,
          ),
        ),
      ],
    }),
    inputField("Entry rationale", "rationale", draft.rationale, {
      type: "textarea",
    }),
    inputField("Review notes", "review", draft.review, { type: "textarea" }),
    tags,
  );
  const legArea = el("div", { class: "full" });
  const initialCurrency = draft.accountCurrency || ui.data.accounts.find((a) => a.id === draft.accountId)?.currency;
  const combined = inputDecimal(
    "Combined risk budget",
    "combinedRiskBudget",
    draft.riskBudget,
    {
      unit: initialCurrency,
      help: "Multi-leg risk and quantities entered manually. No portfolio maximum-loss estimate.",
    },
  );
  form.body.append(combined, legArea);
  function addLeg(leg) {
    const index = blocks.length + 1;
    const existingLeg = isExisting && draft.legs.some((l) => l.id === leg.id);
    const node = el("fieldset", { class: "leg-card" }, el("legend", {}, `Leg ${index}`));
    const grid = el("div", { class: "form-grid" },
      inputField("Instrument", "instrumentId", leg.instrumentId, {
        choices: [{ value: "", label: "Choose instrument" }, ...choices(ui.data.instruments.filter(
          (i) => (!i.archived && !i.draft) || i.id === leg.instrumentId))],
        disabled: existingLeg,
      }),
      inputField("Direction", "direction", leg.direction, {
        choices: [{ value: "long", label: "Long" }, { value: "short", label: "Short" }],
      }));
    const priceFields = ["entry", "stop", "target"].map((key) =>
      inputDecimal({ entry: "Entry price", stop: "Stop price", target: "Target price" }[key], key, leg.planning?.[key], { unit: "" }));
    const quantity = inputDecimal("Quantity", "quantity", leg.planning?.quantity, { unit: "" });
    const budget = inputDecimal("Risk budget", "riskBudget", leg.planning?.riskBudget, { unit: "" });
    const rate = inputDecimal("Conversion rate", "rate", leg.planning?.rate, { unit: "" });
    rate.querySelector(".field-unit").classList.add("visually-hidden");
    const rateInput = rate.querySelector("input");
    const source = el("span");
    const destination = el("span");
    rate.append(el("div", { class: "conversion-equation" }, source, rateInput, destination));
    const sizing = el("div", { class: "planning-feedback full", role: "status" });
    const sizingDetails = details("Position sizing", budget, rate);
    sizingDetails.classList.add("full", "sizing-disclosure");
    const plan = details("Trade plan", ...priceFields, quantity, sizingDetails, sizing);
    plan.classList.add("trade-plan");
    const explanation = el("p", { class: "help full" }, "Intended prices and size. Record actual fills separately.");
    plan.lastElementChild.prepend(explanation);
    const savedState = disclosureState.get(leg.id);
    plan.open = savedState?.planOpen ?? hasPlanValues(leg, initialCurrency);
    sizingDetails.open = savedState?.sizingOpen ?? ["riskBudget", "rate"].some((key) =>
      leg.planning?.[key] != null && leg.planning[key] !== "" && (key !== "rate" || leg.snapshot?.currency !== initialCurrency));
    node.append(grid, plan);
    let remove;
    if (!existingLeg) {
      remove = button("Remove leg", () => {
        if (blocks.length === 1) return;
        blocks.splice(blocks.findIndex((b) => b.node === node), 1);
        node.remove();
        ui.dirty = true;
        updatePlanning();
      }, "button secondary small");
      node.append(remove);
    }
    blocks.push({ leg, node, plan, explanation, sizingDetails, sizing, priceFields, quantity, budget, rate, source, destination, remove,
      pair: `${leg.snapshot?.currency || ""}/${initialCurrency}` });
    plan.addEventListener("toggle", updatePlanExplanation);
    legArea.append(node);
  }
  function updatePlanExplanation() {
    const firstOpen = blocks.find((b) => b.plan.open);
    for (const b of blocks) b.explanation.hidden = b !== firstOpen;
  }
  function updatePlanning() {
    updatePlanExplanation();
    combined.hidden = blocks.length < 2;
    const t = collect();
    setFieldUnit(combined, t.accountCurrency);
    for (const [index, b] of blocks.entries()) {
      b.node.querySelector("legend").textContent = `Leg ${index + 1}`;
      if (b.remove) b.remove.disabled = blocks.length === 1;
      const l = t.legs[index];
      const instrument = l.snapshot;
      const pair = `${instrument?.currency || ""}/${t.accountCurrency}`;
      const input = b.rate.querySelector("input");
      input.value = nextConversionRate(b.pair, pair, input.value);
      b.pair = pair;
      input.readOnly = instrument?.currency === t.accountCurrency;
      l.planning.rate = nullable(input.value);
      b.rate.hidden = !instrument || input.readOnly;
      b.source.textContent = `1 ${instrument?.currency || ""} =`;
      b.destination.textContent = t.accountCurrency;
      setFieldUnit(b.rate, `1 ${instrument?.currency || ""} = rate ${t.accountCurrency}`);
      for (const price of b.priceFields) setFieldUnit(price, instrument?.priceUnit || "Quote unit not configured.");
      setFieldUnit(b.quantity, instrument?.quantityUnit || "Quantity unit not configured.");
      setFieldUnit(b.budget, t.accountCurrency);
      b.sizingDetails.hidden = blocks.length !== 1 || instrument?.model !== "linear";
      const feedback = planningFeedback(l, t.accountCurrency, blocks.length);
      b.sizing.classList.toggle("error", feedback.kind === "error");
      if (feedback.kind === "ready") {
        const result = feedback.result;
        b.sizing.textContent = `Recommended quantity ${result.quantity} ${instrument.quantityUnit}. Risk at stop ${money(result.plannedRisk, t.accountCurrency).replace(/^\+/, "")}; excludes fees and slippage.${result.rewardRisk ? ` Reward/risk ${result.rewardRisk}.` : ""}`;
      } else b.sizing.textContent = feedback.message;
    }
  }
  for (const l of draft.legs) addLeg(l);
  form.body.append(
    el("div", { class: "actions full leg-actions" },
    button(
      "Add leg",
      () => {
        addLeg({
          id: crypto.randomUUID(),
          instrumentId: activeInstruments[0]?.id || "",
          snapshot: activeInstruments[0]
            ? structuredClone(activeInstruments[0])
            : null,
          direction: "long",
          planning: {},
        });
        ui.dirty = true;
        updatePlanning();
      },
      "button secondary",
    ),
    button(
      "Create instrument",
      () => {
        const next = collect();
        const state = new Map(blocks.map((b) => [b.leg.id, { planOpen: b.plan.open, sizingOpen: b.sizingDetails.open }]));
        ui.lifecycle.openChild("instrumentEditor", null, {
          arg: { draft: next, disclosures: [...state] },
          onSaved: (i) => {
            const last = next.legs.at(-1);
            if (!last.instrumentId) {
              last.instrumentId = i.id;
              last.snapshot = i;
            }
          },
        });
      },
      "button secondary",
    ),
    ),
  );
  form.node.addEventListener("input", updatePlanning);
  form.node.addEventListener("change", updatePlanning);
  updatePlanning();
  ui.show(form.node);
}
export function executionEditor(ui, trade, legId, existing = null) {
  const leg = trade.legs.find((l) => l.id === legId),
    i = leg.snapshot;
  const id = existing?.id || crypto.randomUUID();
  const now = new Date().toISOString();
  const record = existing || {
    kind: "entry",
    quantity: "",
    price: "",
    timestamp: now,
    fees: "0",
    feeCurrency: i.currency,
    feeRate: i.currency === trade.accountCurrency ? "1" : null,
    resultRate: i.currency === trade.accountCurrency ? "1" : null,
    manualGross: null,
    manualSource: "user-entered",
    orderReference: "",
    reason: "",
    sequence: Math.max(0, ...trade.executions.map((e) => e.sequence || 0)) + 1,
  };
  const form = ui.form(
    existing ? "Edit execution" : "Record execution",
    `${i.name} · ${leg.direction} · quantities in ${i.quantityUnit}. Timestamps entered in UTC; journal displays configured timezone.`,
    "Save execution",
    async (f) => {
      const v = values(f);
      const e = {
        ...existing,
        ...v,
        id,
        legId,
        price: nullable(v.price),
        quantity: v.quantity,
        timestamp: new Date(`${v.timestamp}Z`).toISOString(),
        feeRate: nullable(v.feeRate),
        resultRate: nullable(v.resultRate),
        manualGross: nullable(v.manualGross),
        sequence: record.sequence,
      };
      const next = putExecution(trade, e, !!existing);
      await ui.commit(
        () => ui.repo.saveTrade(next, form.operationId),
        () => ui.go("trade", trade.id, true),
      );
    },
    () => ui.go("trade", trade.id),
  );
  form.body.append(
    field("Record type", "kind", record.kind, {
      choices: [
        { value: "entry", label: "Entry — increase position" },
        { value: "exit", label: "Exit — reduce position" },
        {
          value: "settlement",
          label: "Settlement — close without exchange fill",
        },
      ],
    }),
    decimalField("Quantity", "quantity", record.quantity, {
      required: true,
      help: `Increment ${i.quantityIncrement} ${i.quantityUnit}`,
    }),
    decimalField("Price", "price", record.price, {
      unit: i.priceUnit || "Quote unit not configured.",
      help: `Price increment ${i.priceIncrement}. Settlement may omit price and report manual result.`,
    }),
    field(
      "Timestamp (UTC)",
      "timestamp",
      record.timestamp.replace("Z", "").slice(0, 23),
      { type: "datetime-local", step: "0.001", required: true },
    ),
    decimalField("Fees", "fees", record.fees, { required: true }),
    field("Fee currency", "feeCurrency", record.feeCurrency, {
      required: true,
    }),
    decimalField("Fee conversion rate", "feeRate", record.feeRate, {
      help: `${trade.accountCurrency} per fee currency unit. Missing rate keeps conversion incomplete.`,
    }),
    decimalField("Result conversion rate", "resultRate", record.resultRate, {
      help: `${trade.accountCurrency} per ${i.currency}. Each closing result keeps its own historical rate.`,
    }),
    decimalField("Gross realized amount", "manualGross", record.manualGross, {
      help: "Manual result excludes fees. Empty means unknown.",
    }),
    field(
      "Manual result source",
      "manualSource",
      record.manualSource || "user-entered",
      {
        choices: [
          { value: "user-entered", label: "User-entered" },
          { value: "broker-reported", label: "Broker-reported" },
        ],
      },
    ),
    field("Order reference", "orderReference", record.orderReference),
    field("Settlement reason", "reason", record.reason, { type: "textarea" }),
  );
  const update = () => {
    const f = form.node,
      v = values(f);
    const manual =
      v.kind !== "entry" &&
      (i.model === "manual" || (v.kind === "settlement" && !v.price));
    for (const key of ["manualGross", "manualSource"])
      f.elements[key].closest(".field").hidden = !manual;
    f.elements.resultRate.closest(".field").hidden = v.kind === "entry";
    f.elements.reason.closest(".field").hidden = v.kind !== "settlement";
    f.elements.price.required = v.kind !== "settlement";
    if (i.currency === trade.accountCurrency) {
      f.elements.resultRate.value = "1";
      f.elements.resultRate.readOnly = true;
    }
  };
  bindConversionRate(
    form.node,
    "feeCurrency",
    "feeRate",
    trade.accountCurrency,
  );
  form.node.addEventListener("input", update);
  form.node.addEventListener("change", update);
  update();
  ui.show(form.node);
}
export function adjustmentEditor(ui, trade, existing = null) {
  const id = existing?.id || crypto.randomUUID();
  const form = ui.form(
    existing ? "Edit cash adjustment" : "New cash adjustment",
    "Signed monetary event: negative costs, positive credits. Fees on executions already counted.",
    "Save adjustment",
    async (f) => {
      const v = values(f);
      const a = {
        ...existing,
        ...v,
        id,
        rate: nullable(v.rate),
        timestamp: new Date(`${v.timestamp}Z`).toISOString(),
      };
      const next = putAdjustment(trade, a, !!existing);
      await ui.commit(
        () => ui.repo.saveTrade(next, form.operationId),
        () => ui.go("trade", trade.id, true),
      );
    },
    () => ui.go("trade", trade.id),
  );
  form.body.append(
    decimalField("Signed amount", "amount", existing?.amount, {
      required: true,
    }),
    field("Currency", "currency", existing?.currency || trade.accountCurrency, {
      required: true,
    }),
    decimalField("Conversion rate", "rate", existing ? existing.rate : "1", {
      help: `${trade.accountCurrency} units per one source currency unit.`,
    }),
    field(
      "Timestamp (UTC)",
      "timestamp",
      (existing?.timestamp || new Date().toISOString())
        .replace("Z", "")
        .slice(0, 23),
      { type: "datetime-local", step: "0.001", required: true },
    ),
    field("Reason", "reason", existing?.reason, {
      type: "textarea",
      required: true,
    }),
  );
  bindConversionRate(form.node, "currency", "rate", trade.accountCurrency);
  ui.show(form.node);
}
export function settingsEditor(ui) {
  const s = ui.data.settings;
  const form = ui.form(
    "Settings",
    "Display preferences and portable journal export.",
    "Save settings",
    async (f) => {
      await ui.commit(
        () =>
          ui.repo.saveEntity(
            "settings",
            validateSettings({ ...s, ...values(f), id: "preferences" }),
          ),
        () => ui.go("settings", null, true),
      );
    },
    () => ui.go("journal"),
  );
  form.body.append(
    field("Display timezone", "timezone", s.timezone, {
      required: true,
      help: "IANA timezone, e.g. Asia/Bangkok or UTC.",
    }),
    field("Theme", "theme", s.theme, {
      choices: [
        { value: "system", label: "System preference" },
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
      ],
    }),
    field("Default account", "defaultAccount", s.defaultAccount, {
      choices: [
        { value: "", label: "No default" },
        ...choices(ui.data.accounts.filter((a) => !a.archived)),
      ],
    }),
  );
  const exportButton = button("Export JSON", async () => {
    try {
      const fresh = await ui.repo.load();
      const blob = new Blob([JSON.stringify(exportJournal(fresh), null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = el("a", {
        href: url,
        download: `vxTradeJournal-${new Date().toISOString().slice(0, 10)}.json`,
      });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      form.errors.replaceChildren(notice(e.message, "error"));
    }
  });
  form.node.append(
    section(
      "Export journal",
      el(
        "p",
        { class: "muted" },
        "Versioned JSON includes all accounts, instruments, strategies, snapshots, executions, cash adjustments and settings. Authentication secrets excluded.",
      ),
      exportButton,
    ),
  );
  ui.show(form.node);
}
