export { accountsView } from './accounts-view.js';
import { activeJournal } from '../application/accounts.js';
import { tagAutocomplete } from "./tag-autocomplete.js";
import { journalFilterState, journalFilterSession, journalDateErrors } from "./journal-filter-session.js";
import { icon } from "./icons.js";
import { calculateTrade, money } from "../domain/journal.js";
import { filterJournal, journalOverview } from "../application/journal.js";
import { deleteSource, correctionHistory } from './corrections.js';
import {
  el,
  button,
  field,
  header,
  section,
  recordCard,
  subsection,
  metric,
  notice,
  result,
  empty,
  details,
} from "./components.js";
const label = (ui, type, id) =>
  ui.data[type].find((i) => i.id === id)?.name || "—";
function journalHistory(ui, list, changePage) {
  const history = el("section", { class: "history-panel", "aria-label": "Trade history" },
    el("div", { class: "history-heading" }, el("h2", { tabindex: "-1" }, "Trade history", el("span", { class: "count-badge" }, String(list.total))),
      el("span", { class: "muted" }, "Latest activity first")));
  const identity = (t) => {
    const symbol = t.instruments.map((i) => i.symbol || i.name).join(" / ");
    return el("div", { class: "instrument-identity" }, el("span", { class: "instrument-avatar", "aria-hidden": "true" }, symbol.slice(0, 2).toUpperCase()),
      el("div", {}, el("strong", {}, symbol), el("span", { class: "instrument-context" }, label(ui, "accounts", t.accountId), t.tags.length ? ` · ${t.tags.join(" · ")}` : "")));
  };
  const status = (t) => el("span", { class: `badge status-${t.status}` }, t.status === "open" ? "Open" : "Closed");
  const activity = (t) => el("time", { datetime: t.updatedAt, title: ui.date(t.updatedAt), class: "activity-time" },
    new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: ui.data.settings.timezone }).format(new Date(t.updatedAt)),
    el("span", {}, new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone: ui.data.settings.timezone }).format(new Date(t.updatedAt))));
  if (!list.items.length) history.append(activeJournal(ui.data).trades.length ? empty("No matching trades", "Adjust filters to show records.") : empty("No trades yet", "Configure instruments, then record first trading idea."));
  else {
    const table = el("table", { class: "journal-table" }, el("thead", {}, el("tr", {},
      ["Instrument / idea", "Status", "Strategy", "Realized net", "Last activity", ""].map((title, i) => el("th", { scope: "col", class: i === 3 ? "numeric" : "" }, title)))));
    table.append(el("tbody", {}, list.items.map((t) => el("tr", {},
      el("td", {}, identity(t)), el("td", {}, status(t)), el("td", { class: "strategy-cell" }, t.strategySnapshot?.name || "—"),
      el("td", { class: "numeric net-cell" }, result(t.summary.accountNet, t.accountCurrency)), el("td", {}, activity(t)),
      el("td", { class: "row-action" }, button(icon("arrow", 18), () => ui.go("trade", t.id), "button quiet icon-button", { "aria-label": "Open trade" }))))));
    history.append(el("div", { class: "table-wrap desktop-table" }, table));
    history.append(el("div", { class: "mobile-cards" }, list.items.map((t) => el("article", { class: "trade-card" },
      el("div", { class: "split" }, identity(t), status(t)),
      el("div", { class: "trade-card-result" }, el("span", { class: "muted" }, "Realized net"), result(t.summary.accountNet, t.accountCurrency)),
      el("div", { class: "split trade-card-footer" }, el("div", {}, el("span", { class: "muted" }, t.strategySnapshot?.name || "No strategy"), activity(t)),
        button(["Open trade", icon("arrow", 16)], () => ui.go("trade", t.id), "button quiet"))))));
  }
  history.append(el("div", { class: "pagination" },
    el("span", { class: "muted" }, `${list.total} ${list.total === 1 ? "trade" : "trades"} · page ${list.page} of ${list.pages}`),
    el("div", { class: "actions" },
      button("Previous", () => changePage(list.page - 1), "button secondary", { disabled: list.page <= 1 ? true : null, "data-page-action": "previous" }),
      button("Next", () => changePage(list.page + 1), "button secondary", { disabled: list.page >= list.pages ? true : null, "data-page-action": "next" }))));
  return history;
}
function journalOverviewCards(ui, account) {
  const overview = journalOverview(ui.data.trades, ui.data.accounts, account);
  const summaryCard = (name, title, value, caption) => el("div", { class: "overview-card" },
    el("div", { class: "overview-label" }, title, el("span", { class: "overview-icon" }, icon(name, 18))),
    el("strong", { class: "overview-value" }, value), el("p", { class: "overview-caption" }, caption));
  const net = overview.currencyTotals.length > 1
    ? el("span", { class: "overview-currency-totals" }, overview.currencyTotals.map((total) => el("span", { class: "overview-currency-total" }, result(total.net, total.currency))))
    : overview.currency ? result(overview.net, overview.currency) : "—";
  const scope = account ? overview.account.name : "All accounts";
  const completeness = overview.incomplete ? `${overview.incomplete} incomplete ${overview.incomplete === 1 ? "trade" : "trades"} excluded` : "Complete results";
  const caption = overview.currencyTotals.length ? `${scope} · ${overview.currencyTotals.length > 1 ? "Totals by reporting currency · " : ""}${completeness}` : "No active accounts available";
  return [
    summaryCard("accounts", "Realized net", net, caption),
    summaryCard("activity", "Open trades", String(overview.open), "Trading ideas still in progress"),
    summaryCard("check", "Closed trades", String(overview.closed), `${overview.total} ${overview.total === 1 ? "trade" : "trades"} in ${overview.account ? overview.account.name : "your journal"}`),
  ];
}
export function journalView(ui) {
  ui.journalFilterView?.dispose();
  const visible = activeJournal(ui.data);
  const state = ui.journalFiltersState ||= journalFilterState(ui.filters);
  if (state.draft.account && !visible.accounts.some((account) => account.id === state.draft.account)) {
    state.draft.account = ""; state.applied.account = ""; ui.page = 1;
  }
  const draft = state.draft;
  const controls = {
    search: field("Search instruments", "search", draft.search, { type: "search", controlAttrs: { placeholder: "Search instruments…" } }),
    account: field("Account", "account", draft.account, { controlAttrs: { "aria-label": "Filter account" }, choices: [{ value: "", label: "All accounts" }, ...visible.accounts.map((a) => ({ value: a.id, label: a.name }))] }),
    status: field("Status", "status", draft.status, { controlAttrs: { "aria-label": "Filter status" }, choices: [{ value: "", label: "Any status" }, { value: "open", label: "Open" }, { value: "closed", label: "Closed" }] }),
    market: field("Market", "market", draft.market, { controlAttrs: { "aria-label": "Filter market" }, choices: [{ value: "", label: "All markets" }, ...[...new Set(ui.data.instruments.map((i) => i.market))].map((m) => ({ value: m, label: m }))] }),
    strategy: field("Strategy", "strategy", draft.strategy, { controlAttrs: { "aria-label": "Filter strategy" }, choices: [{ value: "", label: "All strategies" }, ...ui.data.strategies.map((s) => ({ value: s.id, label: s.name }))] }),
    tag: field("Tag", "tag", draft.tag, { controlAttrs: { "aria-label": "Filter tag" } }),
    from: field("Opening date from", "from", draft.from, { type: "date" }),
    to: field("Opening date to", "to", draft.to, { type: "date" }),
  };
  controls.search.node.classList.add("search-field");
  controls.search.node.append(icon("search", 18));
  const overview = el("div", { class: "overview-grid" }, journalOverviewCards(ui, state.applied.account));
  const history = el("div", { class: "journal-history" });
  const announcement = el("p", { class: "visually-hidden", role: "status", "aria-live": "polite", "aria-atomic": "true" });
  let overviewAccount = state.applied.account;
  let session, tagSuggestions;
  const clear = button("Clear filters", () => {
    tagSuggestions.close();
    session.clear();
    for (const [name, handle] of Object.entries(controls)) handle.control.value = state.draft[name];
    controls.search.control.focus({ preventScroll: true });
  }, "button quiet journal-filter-clear");
  const toolbar = el("form", { class: "journal-filters", novalidate: true, "aria-label": "Journal search and filters" },
    controls.search,
    el("div", { class: "journal-filter-band" }, controls.account, controls.status, controls.market, controls.strategy, controls.tag,
      el("fieldset", { class: "journal-date-range" }, el("legend", { class: "visually-hidden" }, "Opening date range"), controls.from, controls.to), clear));
  const box = el("div", { class: "journal-page" },
    header("Journal", "Your trading decisions, executions and realized outcomes.", button([icon("plus", 18), "New trade"], () => ui.go("tradeEditor"))),
    overview, toolbar, announcement, history);
  const captureScroll = () => ({ main: ui.main?.scrollTop || 0, window: window.scrollY });
  function restoreScroll(position) {
    if (ui.main) ui.main.scrollTop = position.main;
    window.scrollTo(0, position.window);
  }
  function renderResults(announce = true, position = captureScroll()) {
    const pageAction = history.contains(document.activeElement) ? document.activeElement.dataset.pageAction : null;
    const list = filterJournal(visible.trades, state.applied, ui.page, 12, ui.data.settings.timezone);
    ui.page = list.page;
    if (overviewAccount !== state.applied.account) {
      overview.replaceChildren(...journalOverviewCards(ui, state.applied.account));
      overviewAccount = state.applied.account;
    }
    history.replaceChildren(journalHistory(ui, list, (page) => { ui.page = page; renderResults(); }));
    if (announce) announcement.textContent = `${list.total} matching ${list.total === 1 ? "trade" : "trades"}. Page ${list.page} of ${list.pages}.`;
    if (pageAction) {
      const replacement = history.querySelector(`[data-page-action="${pageAction}"]:not(:disabled)`);
      (replacement || history.querySelector('h2')).focus({ preventScroll: true });
    }
    restoreScroll(position);
  }
  function feedback({ changed, resetPage, errors, active }) {
    const position = captureScroll();
    ui.filters = { ...state.applied };
    controls.from.setError(errors.from); controls.to.setError(errors.to);
    clear.hidden = !active;
    if (changed || resetPage) {
      ui.page = 1;
      if (box.isConnected) renderResults(true, position);
    }
    if (box.isConnected) restoreScroll(position);
  }
  session = journalFilterSession(state, feedback);
  for (const [name, handle] of Object.entries(controls)) {
    const control = handle.control;
    const update = (event, immediate = false) => session.update(name, control.value, { badInput: control.validity.badInput, composing: event.isComposing, immediate });
    if (name === 'search' || name === 'tag') {
      control.addEventListener('input', update);
      control.addEventListener('compositionend', update);
      if (name === 'search') control.addEventListener('search', (event) => update(event, true));
    } else {
      control.addEventListener('change', (event) => update(event, true));
      if (name === 'from' || name === 'to') control.addEventListener('input', (event) => update(event, true));
    }
  }
  tagSuggestions = tagAutocomplete(controls.tag, visible.trades, (tag) => session.update('tag', tag, { immediate: true }));
  ui.journalFilterView = { dispose() { tagSuggestions.dispose(); session.dispose(); } };
  toolbar.addEventListener('submit', (event) => { event.preventDefault(); session.flush(); });
  toolbar.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing && (event.target === controls.search.control || event.target === controls.tag.control)) { event.preventDefault(); session.flush(); }
  });
  feedback({ changed: false, resetPage: false, errors: journalDateErrors(state), active: Object.values(state.draft).some(Boolean) || Object.values(state.badDates).some(Boolean) });
  renderResults(false);
  ui.show(box);
  session.flush();
}
export function instrumentsView(ui) {
  const node = el(
    "div",
    {},
    header(
      "Instruments",
      "Private catalogue. Trade legs keep historical configuration snapshots.",
      button("New instrument", () => ui.go("instrumentEditor")),
    ),
  );
  const search = field("Search catalogue", "search", "", {
    type: "search",
    help: "Name, symbol, venue, underlying, expiry, strike and option type.",
  });
  const list = el("div", { class: "grid two" });
  node.append(search.node, list);
  const render = () => {
    list.replaceChildren();
    const q = search.control.value.toLowerCase().trim();
    for (const i of ui
      .recentInstruments()
      .filter((i) =>
        [
          i.name,
          i.symbol,
          i.venue,
          i.underlying,
          i.expiry,
          i.strike,
          i.optionType,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
      ))
      list.append(
        recordCard(
          i.name,
          button("Edit instrument", () => ui.go("instrumentEditor", i), "button secondary small"),
          el(
            "p",
            { class: "muted" },
            `${i.symbol || "No symbol"} · ${i.market} · ${i.model} · ${i.currency || "Currency missing"}`,
          ),
          el(
            "p",
            { class: "record-state" },
            i.archived
              ? "Archived"
              : i.draft
                ? "Draft — cannot start trades"
                : "Ready",
          ),
          i.underlying
            ? el(
                "p",
                {},
                `${i.underlying} ${i.expiry} ${i.strike || ""} ${i.optionType}`,
              )
            : null,
          el(
            "p",
            { class: "help" },
            `${i.quantityUnit} · quantity increment ${i.quantityIncrement || "missing"} · price increment ${i.priceIncrement || "missing"}`,
          ),
        ),
      );
    if (!list.childElementCount)
      list.append(
        empty("No instruments found", "Create instrument or change search."),
      );
  };
  search.control.addEventListener("input", render);
  render();
  ui.show(node);
}
export function strategiesView(ui) {
  const node = el(
    "div",
    {},
    header(
      "Strategies",
      "Define rules. Review linked ideas against original strategy snapshots.",
      button("New strategy", () => ui.go("strategyEditor")),
    ),
  );
  if (!ui.data.strategies.length)
    node.append(
      empty("No strategies yet", "Strategies optional. Add rules when needed."),
    );
  for (const s of ui.data.strategies) {
    const linked = activeJournal(ui.data).trades.filter((t) => t.strategyId === s.id);
    node.append(
      recordCard(
        s.name,
        button("Edit strategy", () => ui.go("strategyEditor", s), "button secondary small"),
        el("span", { class: "badge record-state" }, s.archived ? "Archived" : "Active"),
        s.purpose ? el("p", { class: "prose" }, s.purpose) : null,
        details(
          "Strategy definition",
          el(
            "div",
            { class: "full" },
            ...["markets", "entryRules", "exitRules", "riskRules"].map((k) =>
              el(
                "p",
                { class: "prose" },
                el(
                  "strong",
                  {},
                  `${{ markets: "Markets", entryRules: "Entry rules", exitRules: "Exit rules", riskRules: "Risk rules" }[k]}: `,
                ),
                s[k] || "—",
              ),
            ),
          ),
        ),
        subsection(`Linked trades (${linked.length})`,
        linked.length ? linked.map((t) =>
          el(
            "div",
            { class: "split linked-trade-row" },
            el(
              "span",
              {},
              `${t.instruments.map((i) => i.symbol).join(" / ")} · ${t.status}`,
            ),
            button(
              "Open trade",
              () => ui.go("trade", t.id),
              "button secondary small",
            ),
          ),
        ) : el("p", { class: "muted" }, "No linked trades yet.")),
      ),
    );
  }
  ui.show(node);
}
export function tradeView(ui, idOrArg) {
  const id = typeof idOrArg === "string" ? idOrArg : idOrArg?.id;
  const reopenLegId = typeof idOrArg === "string" ? null : idOrArg?.reopenLegId;
  const t = ui.data.trades.find((t) => t.id === id);
  if (!t) {
    ui.show(
      empty(
        "Trade unavailable",
        "Reload journal to see current records.",
        button("Journal", () => ui.go("journal")),
      ),
    );
    return;
  }
  if (ui.data.accounts.find((account) => account.id === t.accountId)?.archived) {
    ui.show(empty('Account archived', 'Restore the account from Archived accounts to view or edit this trade.', button('Manage archived accounts', () => ui.go('accounts', { archived: true }))));
    return;
  }
  const summary = calculateTrade(t);
  const node = el(
    "div",
    {},
    header(
      t.instruments.map((i) => i.symbol || i.name).join(" / "),
      `${label(ui, "accounts", t.accountId)} · opened ${ui.date(summary.openedAt)}`,
      button("Edit trade", () => ui.go("tradeEditor", t), "button secondary"),
      button(
        "Delete trade",
        async () => {
          if (
            !confirm(
              "Delete this trade and all its legs, executions and cash adjustments? This cannot be undone.",
            )
          )
            return;
          await ui.action(
            () => ui.repo.deleteTrade(t),
            () => ui.go("journal", null, true, { replace: true }),
          );
        },
        "button danger",
      ),
    ),
  );
  node.append(
    section(
      "Realized outcome",
      el(
        "div",
        { class: "metrics" },
        metric(
          "Status",
          el(
            "span",
            { "data-testid": "trade-status" },
            summary.status === "open" ? "Open" : "Closed",
          ),
        ),
        metric(
          "Net realized to date",
          result(summary.accountNet, t.accountCurrency, {
            "data-testid": "trade-result",
          }),
        ),
      ),
      el(
        "p",
        { class: "help" },
        "Weighted-average accounting. Includes all recorded fees and signed cash adjustments. Current market value and unrealized P&L excluded.",
      ),
      summary.complete
        ? null
        : notice(
            `Incomplete converted result. Known converted events: ${money(summary.knownAccountNet, t.accountCurrency)}. ${summary.incomplete.join("; ")}`,
          ),
      el(
        "div",
        { class: "inline" },
        ...Object.entries(summary.native).map(([c, a]) =>
          el(
            "span",
            { class: "badge" },
            `Native ${money(a, c)}${summary.nativeIncomplete.includes(c) ? " + unknown result" : ""}`,
          ),
        ),
      ),
    ),
  );
  node.append(
    section(
      "Journal context",
      subsection("Entry rationale", el("p", { class: "prose" }, t.rationale || "No entry rationale.")),
      subsection("Review notes", el("p", { class: "prose" }, t.review || "No review notes.")),
      el(
        "div",
        { class: "inline" },
        t.tags.map((tag) => el("span", { class: "tag" }, tag)),
      ),
      t.strategySnapshot
        ? details(
            `Strategy snapshot: ${t.strategySnapshot.name}`,
            el(
              "div",
              { class: "full" },
              ...[
                "purpose",
                "markets",
                "entryRules",
                "exitRules",
                "riskRules",
              ].map((k) =>
                el(
                  "p",
                  { class: "prose" },
                  el("strong", {}, `${k}: `),
                  t.strategySnapshot[k] || "—",
                ),
              ),
            ),
          )
        : el("p", { class: "muted" }, "No strategy linked."),
    ),
  );
  for (const l of t.legs) {
    const i = l.snapshot,
      r = summary.legs.find((r) => r.id === l.id);
    const snapshotDetails = details(
      "Instrument snapshot and planning",
      el(
        "div",
        { class: "full" },
        el("p", {}, `Point value ${i.pointValue ?? "manual"} · quantity increment ${i.quantityIncrement} · price increment ${i.priceIncrement} · P&L ${i.currency}`),
        el("p", {}, `Underlying ${i.underlying || "—"} · expiry ${i.expiry || "—"} · strike ${i.strike || "—"} · ${i.optionType || ""}`),
        el("p", {}, `Planned entry ${l.planning?.entry || "—"} · stop ${l.planning?.stop || "—"} · target ${l.planning?.target || "—"} · planned quantity ${l.planning?.quantity || "—"} · sizing rate ${l.planning?.rate || "—"}`),
        button("Correct snapshot", () => ui.go("snapshotEditor", { tradeId: t.id, legId: l.id }), "button secondary", { "data-focus-key": `snapshot:${t.id}:${l.id}:edit` }),
      ),
    );
    snapshotDetails.setOpen(l.id === reopenLegId);
    const panel = section(
      `${i.name} · ${l.direction}`,
      el(
        "p",
        { class: "muted" },
        `${i.symbol} · ${i.market} · ${i.model} calculation · snapshot revision ${i.revision || 1}`,
      ),
      el(
        "div",
        { class: "metrics" },
        metric("Remaining quantity", `${r.remaining} ${i.quantityUnit}`),
        metric("Average entry basis", r.averageEntry),
        metric("Realized gross", money(r.gross, i.currency)),
        metric(
          "Remaining planned stop risk",
          i.model === "manual"
            ? "Unavailable — manual"
            : r.remainingRisk == null
              ? "Stop / conversion missing"
              : money(r.remainingRisk, t.accountCurrency),
        ),
      ),
      el(
        "p",
        { class: "help" },
        "Remaining risk at recorded stop shown separately from realized gain/loss.",
      ),
      snapshotDetails,
      button("Add execution", () => ui.go("executionEditor", { tradeId: t.id, legId: l.id })),
    );
    const executions = t.executions
      .filter((e) => e.legId === l.id)
      .sort(
        (a, b) =>
          a.timestamp.localeCompare(b.timestamp) ||
          (a.sequence || 0) - (b.sequence || 0) ||
          a.id.localeCompare(b.id),
      );
    if (!executions.length)
      panel.append(el("p", { class: "muted" }, "No executions recorded."));
    for (const [index, e] of executions.entries()) {
      const h = r.history.find((h) => h.id === e.id);
      panel.append(
        el(
          "article",
          { class: "card" },
          el(
            "div",
            { class: "split" },
            el(
              "strong",
              {},
              `${e.kind === "settlement" ? "Settlement (no exchange fill)" : e.kind === "entry" ? "Entry" : "Exit"} · ${e.quantity} ${i.quantityUnit}${e.price != null ? ` @ ${e.price}` : ""}`,
            ),
            el("span", { class: "muted" }, ui.date(e.timestamp)),
          ),
          el(
            "p",
            {},
            `Remaining ${h.remaining} · basis ${h.averageEntry} · realized gross ${h.gross == null ? (e.kind === "entry" ? "—" : "Unknown") : money(h.gross, i.currency)}`,
          ),
          el(
            "p",
            { class: "muted" },
            `Fees ${e.fees} ${e.feeCurrency} · fee rate ${e.feeCurrency === t.accountCurrency ? "1" : e.feeRate || "missing"} · closing result rate ${i.currency === t.accountCurrency ? "1" : e.resultRate || "missing"} · order ${e.orderReference || "—"}`,
          ),
          i.model === "manual" || (e.kind === "settlement" && e.price == null)
            ? el(
                "p",
                {},
                `Manual result: ${e.manualSource || "user-entered"} · ${e.manualGross == null ? "Unknown" : money(e.manualGross, i.currency)}`,
              )
            : null,
          e.reason ? el("p", { class: "prose" }, e.reason) : null,
          el(
            "div",
            { class: "actions" },
            button(
              `Edit execution ${index + 1}`,
              () => ui.go("executionEditor", { tradeId: t.id, legId: l.id, executionId: e.id }),
              "button secondary small",
            ),
            button(
              `Delete execution ${index + 1}`,
              async () => {
                if (
                  !confirm("Delete execution and recompute subsequent history?")
                )
                  return;
                deleteSource(ui, t, 'executions', e.id, () => ui.go('trade', id, true, { replace: true }));
              },
              "button danger small",
            ),
          ),
        ),
      );
    }
    node.append(panel);
  }
  const adjustments = section(
    "Cash adjustments",
    button("New cash adjustment", () => ui.go("adjustmentEditor", { tradeId: t.id })),
  );
  for (const a of t.adjustments)
    adjustments.append(
      el(
        "article",
        { class: "card" },
        el(
          "p",
          { class: "prose" },
          `${a.reason} · ${money(a.amount, a.currency)} · rate ${a.currency === t.accountCurrency ? "1" : a.rate || "missing"} · ${ui.date(a.timestamp)}`,
        ),
        el(
          "div",
          { class: "actions" },
          button(
            "Edit adjustment",
            () => ui.go("adjustmentEditor", { tradeId: t.id, adjustmentId: a.id }),
            "button secondary small",
            { "data-focus-key": `adjustment:${a.id}:edit` },
          ),
          button(
            "Delete adjustment",
            async () => {
              if (!confirm("Delete cash adjustment?")) return;
              deleteSource(ui, t, 'adjustments', a.id, () => ui.go('trade', id, true, { replace: true }));
            },
            "button danger small",
          ),
        ),
      ),
    );
  node.append(adjustments, correctionHistory(ui, t));
  ui.show(node);
}
