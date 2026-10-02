import { icon } from "./icons.js";
import { calculateTrade, money } from "../domain/journal.js";
import { filterJournal, aggregateAccount, journalOverview } from "../application/journal.js";
import { removeChild } from "../application/operations.js";
import {
  accountEditor,
  instrumentEditor,
  strategyEditor,
  tradeEditor,
  executionEditor,
  adjustmentEditor,
} from "./editors.js";
import {
  el,
  button,
  field,
  values,
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
export function journalView(ui) {
  const filters = ui.filters;
  const overview = journalOverview(ui.data.trades, ui.data.accounts, filters.account);
  const summaryCard = (name, title, value, caption) => el("div", { class: "overview-card" },
    el("div", { class: "overview-label" }, title, el("span", { class: "overview-icon" }, icon(name, 18))),
    el("strong", { class: "overview-value" }, value), el("p", { class: "overview-caption" }, caption));
  const box = el("div", { class: "journal-page" },
    header("Journal", "Your trading decisions, executions and realized outcomes.",
      button([icon("plus", 18), "New trade"], () => ui.go("tradeEditor"))),
    el("div", { class: "overview-grid" },
      summaryCard("accounts", "Realized net", overview.account ? result(overview.net, overview.account.currency) : "—",
        overview.account ? `${overview.account.name} · ${overview.incomplete ? `${overview.incomplete} incomplete ${overview.incomplete === 1 ? "trade" : "trades"} excluded` : "Complete account results"}` : "Select an account to view monetary results"),
      summaryCard("activity", "Open trades", String(overview.open), "Trading ideas still in progress"),
      summaryCard("check", "Closed trades", String(overview.closed), `${overview.total} ${overview.total === 1 ? "trade" : "trades"} in ${overview.account ? overview.account.name : "your journal"}`)));
  if (!ui.data.trades.length) {
    box.append(empty("No trades yet", "Configure instruments, then record first trading idea."));
    ui.show(box);
    return;
  }
  const search = field("Search instruments", "search", filters.search, { type: "search", placeholder: "Search instruments…" });
  search.classList.add("search-field");
  search.append(icon("search", 18));
  const account = field("Filter account", "account", filters.account, {
    choices: [{ value: "", label: "All accounts" }, ...ui.data.accounts.map((a) => ({ value: a.id, label: a.name }))],
  });
  account.classList.add("account-filter");
  const more = details("More filters",
    field("Filter status", "status", filters.status, { choices: [{ value: "", label: "Any status" }, { value: "open", label: "Open" }, { value: "closed", label: "Closed" }] }),
    field("Filter market", "market", filters.market, { choices: [{ value: "", label: "All markets" }, ...[...new Set(ui.data.instruments.map((i) => i.market))].map((m) => ({ value: m, label: m }))] }),
    field("Filter strategy", "strategy", filters.strategy, { choices: [{ value: "", label: "All strategies" }, ...ui.data.strategies.map((s) => ({ value: s.id, label: s.name }))] }),
    field("Filter tag", "tag", filters.tag),
    field("Opening date from", "from", filters.from, { type: "date" }),
    field("Opening date to", "to", filters.to, { type: "date" }));
  more.open = ["status", "market", "strategy", "tag", "from", "to"].some((key) => !!filters[key]);
  const toolbar = el("form", { class: "journal-filters" }, search, account, more,
    el("div", { class: "filter-actions" },
      el("button", { type: "submit", class: "button secondary" }, "Apply filters"),
      button("Clear filters", () => { ui.filters = {}; ui.page = 1; journalView(ui); }, "button quiet")));
  toolbar.addEventListener("submit", (e) => {
    e.preventDefault(); ui.filters = values(toolbar); ui.page = 1; journalView(ui);
  });
  box.append(toolbar);
  const list = filterJournal(ui.data.trades, filters, ui.page, 12, ui.data.settings.timezone);
  const history = el("section", { class: "history-panel", "aria-label": "Trade history" },
    el("div", { class: "history-heading" }, el("h2", {}, "Trade history", el("span", { class: "count-badge" }, String(list.total))),
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
  if (!list.items.length) history.append(empty("No matching trades", "Adjust filters to show records."));
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
      button("Previous", () => { ui.page = list.page - 1; journalView(ui); }, "button secondary", { disabled: list.page <= 1 ? true : null }),
      button("Next", () => { ui.page = list.page + 1; journalView(ui); }, "button secondary", { disabled: list.page >= list.pages ? true : null }))));
  box.append(history);
  ui.show(box);
}
export function accountsView(ui) {
  const node = el(
    "div",
    {},
    header(
      "Accounts",
      "Separate reporting currencies. No cross-account monetary total.",
      button("New account", () => ui.go("accountEditor")),
    ),
  );
  for (const a of ui.data.accounts) {
    const aggregate = aggregateAccount(ui.data.trades, a.id);
    node.append(
      recordCard(
        a.name,
        button("Edit account", () => accountEditor(ui, a), "button secondary small"),
        el(
          "p",
          { class: "muted" },
          `${a.currency} · ${a.archived ? "Archived" : "Active"} · ${a.hasTrades ? "Reporting currency fixed" : "Reporting currency editable"}`,
        ),
        el(
          "div",
          { class: "metrics" },
          metric("Complete realized net", money(aggregate.total, a.currency)),
          metric(
            "Incomplete trades excluded",
            String(aggregate.incomplete.length),
          ),
        ),
      ),
    );
  }
  ui.show(node);
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
  node.append(search, list);
  const render = () => {
    list.replaceChildren();
    const q = search.querySelector("input").value.toLowerCase().trim();
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
          button("Edit instrument", () => instrumentEditor(ui, i), "button secondary small"),
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
  search.querySelector("input").addEventListener("input", render);
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
    const linked = ui.data.trades.filter((t) => t.strategyId === s.id);
    node.append(
      recordCard(
        s.name,
        button("Edit strategy", () => strategyEditor(ui, s), "button secondary small"),
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
export function tradeView(ui, id) {
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
  const summary = calculateTrade(t);
  const node = el(
    "div",
    {},
    header(
      t.instruments.map((i) => i.symbol || i.name).join(" / "),
      `${label(ui, "accounts", t.accountId)} · opened ${ui.date(summary.openedAt)}`,
      button("Edit trade", () => tradeEditor(ui, t), "button secondary"),
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
            () => ui.go("journal", null, true),
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
      details(
        "Instrument snapshot and planning",
        el(
          "div",
          { class: "full" },
          el(
            "p",
            {},
            `Point value ${i.pointValue ?? "manual"} · quantity increment ${i.quantityIncrement} · price increment ${i.priceIncrement} · P&L ${i.currency}`,
          ),
          el(
            "p",
            {},
            `Underlying ${i.underlying || "—"} · expiry ${i.expiry || "—"} · strike ${i.strike || "—"} · ${i.optionType || ""}`,
          ),
          el(
            "p",
            {},
            `Planned entry ${l.planning?.entry || "—"} · stop ${l.planning?.stop || "—"} · target ${l.planning?.target || "—"} · planned quantity ${l.planning?.quantity || "—"} · sizing rate ${l.planning?.rate || "—"}`,
          ),
          button(
            "Correct snapshot",
            () => instrumentEditor(ui, i, null, { trade: t, legId: l.id }),
            "button secondary",
          ),
        ),
      ),
      button("Add execution", () => executionEditor(ui, t, l.id)),
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
              () => executionEditor(ui, t, l.id, e),
              "button secondary small",
            ),
            button(
              `Delete execution ${index + 1}`,
              async () => {
                if (
                  !confirm("Delete execution and recompute subsequent history?")
                )
                  return;
                await ui.action(
                  () => ui.repo.saveTrade(removeChild(t, "executions", e.id)),
                  () => ui.go("trade", id, true),
                );
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
    button("New cash adjustment", () => adjustmentEditor(ui, t)),
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
            () => adjustmentEditor(ui, t, a),
            "button secondary small",
          ),
          button(
            "Delete adjustment",
            async () => {
              if (!confirm("Delete cash adjustment?")) return;
              await ui.action(
                () => ui.repo.saveTrade(removeChild(t, "adjustments", a.id)),
                () => ui.go("trade", id, true),
              );
            },
            "button danger small",
          ),
        ),
      ),
    );
  node.append(adjustments);
  ui.show(node);
}
