import { MAX_NEW_TRADE_LEGS } from "../domain/leg-capacity.js";
import {
  PRESETS,
  normalizeInstrument,
  normalizeAccount,
  normalizeStrategy,
  validateSettings,
  calculateTrade,
  validateCombinedRiskBudget,
  requireValue,
  decimal,
  money,
} from "../domain/journal.js";
import { JournalTransfer } from '../persistence/transfer.js';
import { downloadJournal } from './import-editor.js';
import { newTrade, editTrade, replaceLegs, putExecution, putAdjustment, correctSnapshot } from "../application/operations.js";
import {
  el,
  append,
  button,
  field,
  decimalField,
  checkbox,
  values,
  section,
  notice,
  details,
  bindConversionRate,
} from "./components.js";
import { planningFeedback } from "./planning.js";
import { conversionState } from "./conversion-state.js";
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
      );
    },
  );
  append(form.body,
    field("Account name", "name", account?.name, {
      controlAttrs: { required: true, maxlength: 120 },
    }),
    field("Reporting currency", "currency", account?.currency || "USD", {
      controlAttrs: { required: true, disabled: account?.hasTrades || false,
        pattern: "[A-Z][A-Z0-9]{2,11}", maxlength: 12 },
    }),
    checkbox("Archived", "archived", account?.archived),
  );
  if (first) form.node.append(section('Existing journal', el('p', {}, 'Restore a portable journal export instead of creating the first account.'), button('Import journal', () => ui.go('importEditor'), 'button secondary')));
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
      );
    },
  );
  append(form.body,
    field("Strategy name", "name", strategy?.name, {
      controlAttrs: { required: true, maxlength: 120 },
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
  correction = null,
) {
  const fields = {};
  const inputField = (label, name, value, options = {}) => fields[name] = field(label, name, value, { ...options, tooltip: instrumentHelp[name] });
  const inputDecimal = (label, name, value, options = {}) => fields[name] = decimalField(label, name, value, { ...options, tooltip: instrumentHelp[name] });
  const inputCheckbox = (label, name, checked) => fields[name] = checkbox(label, name, checked, { tooltip: instrumentHelp[name] });
  const id = instrument?.id || crypto.randomUUID();
  const base = instrument || {
    preset: "equity",
    ...PRESETS.equity,
    currency: "USD",
  };
  let previewed = false;
  let form;
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
          null, { countsUsage: true },
        );
      } else
        await ui.commit(
          () => ui.repo.saveEntity("instruments", i),
        );
    },
  );
  const f = form.node;
  append(form.body,
    inputField("Instrument name", "name", base.name, {
      controlAttrs: { required: true, maxlength: 120 },
    }),
    inputField("Symbol", "symbol", base.symbol, { controlAttrs: { maxlength: 80 } }),
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
    inputField("Price unit", "priceUnit", base.priceUnit, { controlAttrs: { maxlength: 80, placeholder: "USD/share, points, JPY/EUR" } }),
    inputDecimal(
      "Quantity increment",
      "quantityIncrement",
      base.quantityIncrement,
    ),
    inputDecimal("Price increment", "priceIncrement", base.priceIncrement),
    inputDecimal("Point value", "pointValue", base.pointValue),
    inputField("P&L currency", "currency", base.currency, { controlAttrs: { maxlength: 12 } }),
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
  append(form.body, contract);
  const preview = el("div", { class: "notice full", role: "status" });
  append(form.body, preview);
  const update = () => {
    previewed = false;
    const v = values(f);
    fields.pointValue.setVisible(v.model === "linear");
    contract.setVisible(["futures", "options", "cryptoDerivative"].includes(v.preset));
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
  fields.preset.control.addEventListener("change", () => {
    if (correction) return;
    const p = PRESETS[fields.preset.control.value];
    for (const key of [
      "market",
      "model",
      "quantityUnit",
      "priceUnit",
      "quantityIncrement",
      "priceIncrement",
      "pointValue",
    ])
      fields[key].control.value = p[key] ?? "";
    update();
  });
  f.addEventListener("input", update);
  f.addEventListener("change", update);
  update();
  if (correction) {
    const out = el("div", { class: "full" });
    append(form.body,
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
export function tradeEditor(ui, session) {
  const inputField = (label, name, value, options = {}) => field(label, name, value, { ...options, tooltip: tradeHelp[name] });
  const inputDecimal = (label, name, value, options = {}) => decimalField(label, name, value, { ...options, tooltip: tradeHelp[name] });
  const draft = session.editableValues;
  const activeInstruments = ui.recentInstruments().filter((instrument) => !instrument.draft && !instrument.archived);
  const blocks = [];
  let addLegAction;
  const form = ui.form(
    session.isExisting ? "Edit trade" : "New trade",
    "Choose an instrument and direction. Add a trade plan when needed.",
    "Save trade",
    async () => {
      const input = session.toInput();
      requireValue(!input.legs.some((leg) => session.instrumentUnavailable(leg.id)), "Choose an available instrument before saving");
      const trade = session.isExisting
        ? replaceLegs(editTrade(session.baseRecord, input, ui.data), input.legs, ui.data)
        : newTrade(input, ui.data);
      await ui.commit(
        () => ui.repo.saveTrade(trade, session.operationId),
        null, { countsUsage: true },
      );
    },
    { operationId: session.operationId },
  );
  const bind = (input, update) => {
    const change = () => { update(input.control.value); updatePlanning(); };
    input.control.addEventListener("input", change);
    input.control.addEventListener("change", change);
  };
  const account = inputField("Account", "accountId", draft.accountId, {
    choices: choices(ui.data.accounts.filter((record) => !record.archived || record.id === draft.accountId)),
    controlAttrs: { disabled: session.isExisting },
  });
  const strategy = inputField("Strategy", "strategyId", draft.strategyId, {
    choices: [{ value: "", label: "No strategy" }, ...choices(ui.data.strategies.filter((record) => !record.archived || record.id === draft.strategyId))],
  });
  const rationale = inputField("Entry rationale", "rationale", draft.rationale, { type: "textarea" });
  const review = inputField("Review notes", "review", draft.review, { type: "textarea" });
  const tags = inputField("Tags", "tags", draft.tagsText, {
    help: "Comma-separated free-text tags.", containerAttrs: { class: "full" },
  });
  bind(account, (value) => session.setAccount(value));
  for (const [input, key] of [[strategy, "strategyId"], [rationale, "rationale"], [review, "review"], [tags, "tagsText"]])
    bind(input, (value) => session.setField(key, value));
  append(form.body, account, strategy, rationale, review, tags);
  const legArea = el("div", { class: "full" });
  const combined = inputDecimal("Combined risk budget", "combinedRiskBudget", draft.combinedRiskBudget, {
    unit: session.accountCurrency,
    help: "Multi-leg risk and quantities entered manually. No portfolio maximum-loss estimate.",
  });
  bind(combined, (value) => session.setField("combinedRiskBudget", value));
  append(form.body, combined, legArea);
  function renderLeg(leg) {
    const existingLeg = session.baseRecord?.legs.some((record) => record.id === leg.id);
    const legend = el("legend", {}, `Leg ${blocks.length + 1}`);
    const node = el("fieldset", { class: "leg-card" }, legend);
    const instrumentChoices = choices(ui.data.instruments.filter(
      (record) => (!record.archived && !record.draft) || record.id === leg.instrumentId));
    if (leg.instrumentId && !instrumentChoices.some((record) => record.value === leg.instrumentId))
      instrumentChoices.push({ value: leg.instrumentId, label: "Unavailable instrument" });
    const instrument = inputField("Instrument", "instrumentId", leg.instrumentId, {
      choices: [{ value: "", label: "Choose instrument" }, ...instrumentChoices],
      controlAttrs: { disabled: existingLeg },
    });
    const direction = inputField("Direction", "direction", leg.direction, {
      choices: [{ value: "long", label: "Long" }, { value: "short", label: "Short" }],
    });
    bind(instrument, (value) => session.setInstrument(leg.id, value));
    bind(direction, (value) => session.setDirection(leg.id, value));
    const grid = el("div", { class: "form-grid" }, instrument, direction);
    const priceFields = ["entry", "stop", "target"].map((key) =>
      inputDecimal({ entry: "Entry price", stop: "Stop price", target: "Target price" }[key], key, leg.planning[key], { unit: "" }));
    const quantity = inputDecimal("Quantity", "quantity", leg.planning.quantity, { unit: "" });
    const budget = inputDecimal("Risk budget", "riskBudget", leg.planning.riskBudget, { unit: "" });
    const rate = inputDecimal("Conversion rate", "rate", leg.planning.rate, { unit: "" });
    const planning = { entry: priceFields[0], stop: priceFields[1], target: priceFields[2], quantity, riskBudget: budget, rate };
    for (const [key, input] of Object.entries(planning)) bind(input, (value) => session.setPlanning(leg.id, key, value));
    rate.unit.classList.add("visually-hidden");
    const source = el("span");
    const destination = el("span");
    rate.node.append(el("div", { class: "conversion-equation" }, source, rate.control, destination));
    const sizing = el("div", { class: "planning-feedback full", role: "status" });
    const sizingDetails = details("Position sizing", budget, rate);
    sizingDetails.node.classList.add("full", "sizing-disclosure");
    const plan = details("Trade plan", ...priceFields, quantity, sizingDetails, sizing);
    plan.node.classList.add("trade-plan");
    const explanation = el("p", { class: "help full" }, "Intended prices and size. Record actual fills separately.");
    plan.content.prepend(explanation);
    const disclosure = session.disclosureFor(leg.id);
    plan.setOpen(disclosure.planOpen);
    sizingDetails.setOpen(disclosure.sizingOpen);
    const retainDisclosure = () => {
      if (!node.isConnected) return;
      session.setDisclosure(leg.id, { planOpen: plan.isOpen(), sizingOpen: sizingDetails.isOpen() });
      updatePlanExplanation();
    };
    plan.node.addEventListener("toggle", retainDisclosure);
    sizingDetails.node.addEventListener("toggle", retainDisclosure);
    append(node, grid, plan);
    const removalHelp = el("p", { class: "help", id: `leg-removal-${leg.id}` });
    const remove = button("Remove leg", () => {
      session.removeLeg(leg.id);
      blocks.splice(blocks.findIndex((block) => block.legId === leg.id), 1);
      node.remove();
      ui.dirty = true;
      updatePlanning();
    }, "button secondary small", { "aria-describedby": removalHelp.id });
    node.append(remove, removalHelp);
    blocks.push({ legId: leg.id, node, legend, instrument, plan, explanation, sizingDetails, sizing, priceFields, quantity, budget, rate, source, destination, remove, removalHelp, planning });
    legArea.append(node);
  }
  function updatePlanExplanation() {
    const firstOpen = blocks.find((block) => block.plan.isOpen());
    for (const block of blocks) block.explanation.hidden = block !== firstOpen;
  }
  function updatePlanning() {
    updatePlanExplanation();
    if (addLegAction) addLegAction.disabled = !session.canAddLeg;
    const combinedSupplied = draft.combinedRiskBudget !== "";
    combined.setVisible(draft.legs.length >= 2 || combinedSupplied);
    try {
      validateCombinedRiskBudget(draft.combinedRiskBudget);
      combined.setError(null);
    } catch (error) {
      combined.setError(error.message);
    }
    const input = session.toInput();
    combined.setUnit(input.accountCurrency);
    for (const [index, block] of blocks.entries()) {
      block.legend.textContent = `Leg ${index + 1}`;
      const removalReason = session.removalReason(block.legId);
      block.remove.disabled = !!removalReason;
      block.removalHelp.textContent = removalReason || "";
      block.removalHelp.hidden = !removalReason;
      const leg = input.legs.find((record) => record.id === block.legId);
      const instrument = leg.snapshot;
      block.instrument.setError(session.instrumentUnavailable(leg.id) ? "Choose an available instrument before saving" : null);
      const conversion = conversionState(`${instrument?.currency || ""}/${input.accountCurrency}`, instrument?.currency || "", input.accountCurrency, leg.planning.rate ?? "");
      block.rate.control.value = conversion.rate;
      block.rate.control.readOnly = conversion.automatic;
      block.rate.setVisible(!!instrument && !conversion.automatic);
      block.source.textContent = `1 ${instrument?.currency || ""} =`;
      block.destination.textContent = input.accountCurrency;
      block.rate.setUnit(`1 ${instrument?.currency || ""} = rate ${input.accountCurrency}`);
      for (const price of block.priceFields) price.setUnit(instrument?.priceUnit || "Quote unit not configured.");
      block.quantity.setUnit(instrument?.quantityUnit || "Quantity unit not configured.");
      block.budget.setUnit(input.accountCurrency);
      const feedback = planningFeedback(leg, input.accountCurrency, blocks.length);
      for (const planningField of Object.values(block.planning)) planningField.setError(null);
      const errorKey = feedback.path?.[3];
      const errorField = errorKey && block.planning?.[errorKey];
      errorField?.setError(feedback.kind === "error" ? feedback.message : null);
      const invalidSizing = feedback.kind === "error" && ["riskBudget", "rate", "quantity"].includes(errorKey);
      block.sizingDetails.setVisible((blocks.length === 1 && instrument?.model === "linear") || invalidSizing);
      block.sizing.classList.toggle("error", feedback.kind === "error");
      if (feedback.kind === "ready") {
        const result = feedback.result;
        block.sizing.textContent = `Recommended quantity ${result.quantity} ${instrument.quantityUnit}. Risk at stop ${money(result.plannedRisk, input.accountCurrency).replace(/^\+/, "")}; excludes fees and slippage.${result.rewardRisk ? ` Reward/risk ${result.rewardRisk}.` : ""}`;
      } else block.sizing.textContent = feedback.message;
    }
  }
  for (const leg of draft.legs) renderLeg(leg);
  addLegAction = button("Add leg", () => {
    renderLeg(session.addLeg(activeInstruments[0]?.id || ""));
    ui.dirty = true;
    updatePlanning();
  }, "button secondary");
  append(form.body,
    el("p", { class: "help full" }, `Maximum ${MAX_NEW_TRADE_LEGS} legs per new trade.`),
    el("div", { class: "actions full leg-actions" }, addLegAction,
      button("Create instrument", () => {
        ui.lifecycle.openChild("instrumentEditor", null, {
          onSaved: (instrument) => {
            session.setContext(ui.data);
            const last = draft.legs.at(-1);
            if (!last.instrumentId) session.setInstrument(last.id, instrument.id);
          },
        });
      }, "button secondary"),
    ),
  );
  updatePlanning();
  ui.show(form.node);
}
export function executionEditor(ui, trade, legId, existing = null) {
  const fields = {};
  const inputField = (label, name, value, options = {}) => fields[name] = field(label, name, value, options);
  const inputDecimal = (label, name, value, options = {}) => fields[name] = decimalField(label, name, value, options);
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
          null, { countsUsage: true },
      );
    },
  );
  append(form.body,
    inputField("Record type", "kind", record.kind, {
      choices: [
        { value: "entry", label: "Entry — increase position" },
        { value: "exit", label: "Exit — reduce position" },
        {
          value: "settlement",
          label: "Settlement — close without exchange fill",
        },
      ],
    }),
    inputDecimal("Quantity", "quantity", record.quantity, {
      controlAttrs: { required: true },
      help: `Increment ${i.quantityIncrement} ${i.quantityUnit}`,
    }),
    inputDecimal("Price", "price", record.price, {
      unit: i.priceUnit || "Quote unit not configured.",
      help: `Price increment ${i.priceIncrement}. Settlement may omit price and report manual result.`,
    }),
    inputField(
      "Timestamp (UTC)",
      "timestamp",
      record.timestamp.replace("Z", "").slice(0, 23),
      { type: "datetime-local", controlAttrs: { step: "0.001", required: true } },
    ),
    inputDecimal("Fees", "fees", record.fees, { controlAttrs: { required: true } }),
    inputField("Fee currency", "feeCurrency", record.feeCurrency, {
      controlAttrs: { required: true },
    }),
    inputDecimal("Fee conversion rate", "feeRate", record.feeRate, {
      help: `${trade.accountCurrency} per fee currency unit. Missing rate keeps conversion incomplete.`,
    }),
    inputDecimal("Result conversion rate", "resultRate", record.resultRate, {
      help: `${trade.accountCurrency} per ${i.currency}. Each closing result keeps its own historical rate.`,
    }),
    inputDecimal("Gross realized amount", "manualGross", record.manualGross, {
      help: "Manual result excludes fees. Empty means unknown.",
    }),
    inputField(
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
    inputField("Order reference", "orderReference", record.orderReference),
    inputField("Settlement reason", "reason", record.reason, { type: "textarea" }),
  );
  const update = () => {
    const f = form.node,
      v = values(f);
    const manual =
      v.kind !== "entry" &&
      (i.model === "manual" || (v.kind === "settlement" && !v.price));
    for (const key of ["manualGross", "manualSource"])
      fields[key].setVisible(manual);
    fields.reason.setVisible(v.kind === "settlement");
    fields.price.control.required = v.kind !== "settlement";
    const resultConversion = conversionState(`${i.currency}/${trade.accountCurrency}`, i.currency, trade.accountCurrency, fields.resultRate.control.value);
    fields.resultRate.control.value = resultConversion.rate;
    fields.resultRate.control.readOnly = resultConversion.automatic;
    let resultRateError = null;
    try { decimal(resultConversion.rate, "Result conversion rate", true, true); }
    catch (error) { resultRateError = error.message; }
    fields.resultRate.setError(resultRateError);
    fields.resultRate.setVisible(v.kind !== "entry" || !!resultRateError);
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
          null, { countsUsage: true },
      );
    },
  );
  append(form.body,
    decimalField("Signed amount", "amount", existing?.amount, {
      controlAttrs: { required: true },
    }),
    field("Currency", "currency", existing?.currency || trade.accountCurrency, {
      controlAttrs: { required: true },
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
      { type: "datetime-local", controlAttrs: { step: "0.001", required: true } },
    ),
    field("Reason", "reason", existing?.reason, {
      type: "textarea",
      controlAttrs: { required: true },
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
      );
    },
  );
  append(form.body,
    field("Display timezone", "timezone", s.timezone, {
      controlAttrs: { required: true },
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
      downloadJournal(await new JournalTransfer(ui.repo).export());
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
      button('Import journal and recovery', () => ui.go('importEditor'), 'button secondary'),
    ),
  );
  ui.show(form.node);
}
