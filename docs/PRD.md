# vxTradeJournal — Product Requirements Document

Version: 1.9 · Status: Proposed · Date: 9 October 2026

## 1. Product purpose and scope

Responsive standalone website for independent users to record trades, document decisions, define trading strategies and review outcomes.

First release prioritizes accurate execution records, straightforward journaling and configurable instruments. Architecture must support future development without introducing unnecessary infrastructure.

**Core workflow:** configure account and instruments → define optional strategy → plan trade → record executions → review outcome.

### Included in first release

- Private user accounts and multiple trading accounts.
- Editable instrument catalogue per user.
- Single-instrument and multi-leg trades. New trades and leg additions have a shared website/CLI maximum of six legs, verified with atomic first-account locking, a strategy link and entry/exit history for every distinct instrument. Earlier larger records retain calculation, correction and removal access without expansion above this capacity. Do not weaken ownership rules or split creation into partial writes to increase capacity.
- Partial fills, scaled entries and partial exits.
- Long and short positions.
- Linear risk sizing and weighted-average realized P&L.
- Manual results for instruments outside supported calculation model.
- User-entered currency conversion rates.
- Strategy definitions and trade links.
- Notes, tags, search, filters, portable JSON export/import and user-scoped recovery.
- Full mobile and desktop functionality.

### Deferred

Broker integration, live prices, unrealized P&L, charts, advanced reporting, backtesting, AI, social features, screenshots, offline synchronization, automatic derivative lifecycle processing and tax reporting.

Broad instrument support means users can journal any instrument. Automatic calculations depend on configured and implemented calculation model.

## 2. Functional requirements

### Identity and trading accounts

- Support email/password registration, email verification, sign-in, sign-out and password reset.
- Require verified email before saving trading data.
- Each user’s records remain private and isolated.
- First-use setup creates trading account with name and reporting currency.
- Multiple accounts supported; each trade belongs to exactly one account.
- Account name editable. Reporting currency fixed once account contains trades.
- Archiving an account is reversible isolation: exclude it and all linked trades from ordinary journal history, search/tag suggestions, account selectors, overview profit/loss and open/closed/incomplete counts, strategy-linked history and instrument recency. Restore before viewing or editing its trades; direct links show an archived-account explanation. Shared monetary precision and historical source records remain unchanged.
- Accounts management has labelled Active/Archived tabs with counts, defaults to Active on normal navigation and supports keyboard tab selection. Active cards offer Edit/Archive; archived cards offer Restore/Delete and do not display monetary metrics. An explicit archived-management link may select Archived. Controls retain 44px targets and wrap at mobile/intermediate/desktop widths.
- Archive clears a matching default-account reference atomically. Existing archived defaults restored from older backups have no operational effect; ordinary preference reads treat them as no default. New trade defaults and preserved journal account filters resolve only active accounts.
- Permanently delete archived accounts and all linked trades, legs, executions, adjustments, corrections and operation receipts only after a fresh accepted preview and explicit confirmation showing account name and trade count. Reject active/non-owned accounts, stale previews and conflicting operation IDs. Do not delete shared instruments/strategies or rewrite unrelated records/revisions.
- Account deletion reuses renewable fenced journal-transfer ownership, staged integrity manifests, atomic per-record checkpoints and verified completion. Capture the full journal manifest for verification while applying only scoped removals and any matching default-reference cleanup. Ordinary writes and partial-journal reads remain unavailable during application; explicit recovery resumes deletion or cancels and restores removed source. No second lock subsystem is introduced. After verified live removal, purge temporary recovery rows before releasing transfer ownership; retain only diagnostic operation metadata. Failed cleanup reports confirmed deletion separately and supports explicit cleanup retry through startup recovery. Keep ownership through cleanup so later transfers cannot hide unfinished purging. A terminal deletion in cleanup exposes only permitted finish-cleanup/status actions, never rollback. Success is reported after cleanup and ownership release.
- Website and CLI share archive/deletion semantics. `accounts list` defaults to active; `--archived true|all` explicitly exposes management records, and `accounts get` remains a management read. `accounts archive`/`unarchive` suppress/restore history and reporting. `accounts delete --preview` (or `--dry-run`) returns count, document paths and fingerprint; application requires original revision, `--accept-preview`, stable `--operation-id` and `--yes`. Existing `import status/resume/rollback` and doctor expose operation kind and supported recovery, including `finish_cleanup` for completed deletion with remaining staging.
- Portable exports and separate retained recovery backups intentionally include archived accounts and history for preservation. Successful live deletion removes them from subsequent live exports; previously downloaded files and independent retained backups remain unchanged. Export/import source contracts, database schema and calculation versions do not change. Transfer-session kind/target/cleanup metadata is additive; database rules must accompany the updated client.
- Archive/deletion acceptance covers active monetary/count scope, default clearing, deep-link/write restrictions, tabs/focus/responsive layout, exact cascade scope, preservation of unrelated revisions, confirmation/duplicate guards, stale previews, competing ownership, interruption/resume/rollback, completed cleanup retry and website/CLI/backup parity. Select automated acceptance through the verification matrix and acceptance ledger. Pre-change financial/ownership failure proof was deferred by explicit instruction during implementation; later passing runs establish present behavior and do not retroactively establish expected failure.
- Display timezone configurable; timestamps stored as UTC.

### Instrument catalogue

Each user maintains private, reusable instrument definitions.

| Field | Purpose |
|---|---|
| Name, symbol, market, optional venue | Identification and filtering |
| Preset/type | Suggested defaults and relevant configuration fields |
| Calculation model | `linear` or `manual` |
| Quantity unit and increment | Quantity labels, validation and sizing |
| Point value | Monetary value of one full price-point move per selected quantity unit |
| P&L currency | Currency of instrument’s calculated or reported result |
| Price increment | Price validation and display precision |
| Optional quotation unit (`priceUnit`) | Trimmed text, up to 80 characters, for price labels (e.g. `USD/share`, `points`, `JPY/EUR`); display metadata only |
| Applicable contract details | Underlying, expiry, strike and option type |

Presets cover equities, forex, futures, options, spot crypto, crypto derivatives, CFDs and custom instruments. Presets supply editable defaults, not inferred authoritative specifications.

- Catalogue form reveals fields relevant to selected preset and calculation model.
- Quotation units are editable and optional. Presets leave them blank; missing metadata displays “Quote unit not configured.” and does not block use. Existing records need no backfill. Quantity units and account currencies remain explicit on relevant controls.
- Linear configuration requires valid point value, quantity increment, price increment and P&L currency.
- Manual configuration enables execution recording and reported results; automatic sizing/P&L unavailable.
- Incomplete definitions may be saved as drafts but cannot start new trades.
- Preview demonstrates quantity convention, monetary value of price movement and available features.
- Search supports name, symbol and contract details. Recent instruments appear first.
- Instrument can be created during trade entry without discarding trade draft.
- Catalogue edits affect new trades. Existing trade legs retain configuration snapshots.
- Refreshed website trade drafts reconcile unsaved legs with current catalogue definitions so sizing preview and save use the same configuration. Raw planning and disclosure state survive refresh; historical legs remain unchanged. Changed foreign currency pairs clear sizing rates; unavailable draft instruments remain selected with explicit blocking feedback. CLI new-leg operations use the same current-definition contract.
- Explicit snapshot correction previews recalculated outcome before saving. Changing snapshot P&L currency invalidates that leg's sizing and realized-result conversion rates; matching account currency sets rates to `1`, otherwise rates remain missing until supplied explicitly. Execution fee currencies/rates and other legs remain unchanged. Website and CLI previews, saves, replay and exports expose the same incomplete/complete outcomes. Existing leg instrument references cannot change; corrections edit the referenced instrument's snapshot only.
- Expiry metadata must be an existing calendar date in `YYYY-MM-DD` format or empty. Website and CLI use the same validation and retain entered data after rejection.
- Used instruments archived rather than deleted; existing open trades can receive further executions.

Symbol alone is not unique instrument identifier.

### Strategies and journal context

Strategy contains name, purpose, applicable markets, entry rules, exit rules and risk rules. Rules use simple structured text fields.

- Create, edit and archive strategies.
- Each trade links to zero or one strategy.
- Linking stores strategy reference and snapshot of applicable definition.
- Later strategy edits preserve historical snapshots.
- Strategy detail lists linked trades.
- Trade context includes optional entry rationale, review notes and free-text tags.
- Plain text only; render user content safely.

### Trades, legs and executions

#### Source contracts and correction history

- Entered executions, signed adjustments, leg direction/planning and supplied historical FX/manual amounts are source facts. Instrument/strategy definitions captured on the trade are historical snapshots. Status, opening date, position basis, results and summary/search fields are derived projections. Revisions, operation receipts and transfer checkpoints are operational metadata.
- Replay identity is source records, historical snapshots, supplied conversions, timestamp/sequence/ID order and calculation version. Execution history describes trading events; correction history describes subsequent edits. Calculation version remains `1`; imported summaries must match replay and are never silently repaired. Projection leg arrays compare by leg identity and instrument caches compare as multisets; persistence query order does not invalidate equivalent projections or rewrite their stored presentation order.
- Schema `2` records changes/removals of saved executions and adjustments and changes/removals of saved leg snapshot, direction or planning. New records, unchanged financial sources, notes, tags and strategy links require no correction reason. Missing-to-known historical amounts/rates are corrections. Tracked changes require a trimmed 1–1,000-character explanation, shared by website and CLI.
- Each save correcting existing sources creates one append-only correction entry identified by operation ID, with reason, applied parent revision, recorded time, schema/calculation versions and the changed source fields' before/after values. Deletions retain the removed source values; unchanged fields and operational metadata are excluded. Snapshot-induced execution FX invalidations belong to the same entry. Source changes, history, parent revision and retry receipt commit atomically through the shared application operation. Identical retries add no history; changed explanations conflict.
- Firestore rules enforce ownership, basic entry structure and append-only history, allowing history deletion only with the trade or guarded recovery. They do not independently verify every history value against source documents or require evidence for a direct owner write. History describes application-recorded changes, not independently verified authorship. The application retains required reasons and source validation; no trusted mutation service is introduced. Six-leg saves/corrections remain atomic.
- Website trade detail and CLI `trades corrections` expose paginated history grouped by operation. Correction editors retain explanations through previews, failures and retries. Preview/dry-run disclose affected records and reason requirements without requiring an explanation until apply. CLI uses `--correction-reason` on affected saves. Deleting a trade deletes its correction history. Changes before schema-2 introduction cannot be reconstructed; imported evidence does not establish authorship.
- Portable exports, verified private backups, imports and rollback include correction history and preserve event times/revisions while rebinding ownership. Replacement restores supplied history; a verified destination backup preserves displaced history. Schema-1 imports convert to schema 2 with empty history, without fabricated events or recalculated results.
- Shared validation exposes stable rule identifiers, JSON-pointer paths, affected record IDs and bounded rejected scalar values; credentials, notes and large values are excluded. CLI retains existing envelope/error/exit contracts. Website associates field errors and preserves cross-record feedback.
- Mutation outcomes distinguish `not_applied`, `applied`, `unknown` and checkpointed-transfer `partial`, based on evidence. Calculation completeness is independent. Timeouts do not establish rejection; confirmed writes with failed refresh remain confirmed.
- Offline CLI `export verify --input <file>` checks portable integrity, versions, conversions and replay without journal writes, reporting counts, warnings and incomplete trades. Skill guidance begins with account/trade inspection and replay, then mutations. Backup guidance requires export, verification, private storage and an isolated restore drill comparing source records and independently specified results.

Trade represents one journalled trading idea. It contains one or more instrument legs and shared strategy/context.

- Single-leg trade is default. Additional legs added explicitly.
- Each leg has instrument snapshot and long/short direction.
- Website and CLI permit removing persisted legs when at least one leg remains and the removed leg has no executions. Website exposes disabled removal controls with the blocking prerequisite; shared operations and persistence reject invalid removal. Retained oversized trades can be reduced without adding legs above capacity.
- New/Edit trade groups each leg in an accessible fieldset with concise Instrument and Direction labels. Optional prices and quantity appear under native Trade plan disclosure with one explanation: “Intended prices and size. Record actual fills separately.”
- Empty plans start collapsed; saved plans containing values start open. Adding/removing legs and inline instrument creation preserve disclosure state and draft values. Catalogue edits do not rewrite historical quotation or quantity units.
- Executions record quantity, price, timestamp, fees, fee currency and optional order reference.
- Multiple executions may share order reference; order-management subsystem excluded.
- Entries increase position. Exits decrease position.
- Exit quantity cannot exceed remaining position. Reversal requires separate leg or trade.
- Execution history determines remaining quantity, average entry basis and realized result.
- Trade remains open while any leg has remaining position.
- Trade closes when all legs are closed. Closed trade corrections may reopen it if quantities change.
- Settlement closure can record closing quantity and reason without claiming exchange fill. Manual result required when settlement cannot use linear calculation.
- Editing or deleting earlier execution recomputes subsequent position history; reject corrections that make later exits invalid.
- Independent trades sharing instrument never merge automatically.

Display remaining quantity and realized-to-date result for partially closed trades. Do not estimate current market value.

### Risk sizing and P&L

**Confirmed accounting method:** weighted average.

For linear legs, additional entries update weighted average of remaining position. Partial exits retain that average for remaining quantity.

```text
Risk per unit in P&L currency =
    |planned entry − planned stop| × point value

Risk per unit in account currency =
    risk per unit × supplied conversion rate

Recommended quantity =
    risk budget ÷ risk per unit in account currency
    rounded down to quantity increment
```

- Automatic sizing applies to single-leg linear trades. Risk budget and foreign conversion appear inside nested Position sizing disclosure. Until required inputs exist, show neutral guidance; validate supplied values independently. Manual models and multi-leg trades keep quantities and combined risk budget manual.
- Price inputs display snapshot quotation units, quantities display snapshot quantity units, and budgets/results display account currency. Units have accessible descriptions while accessible labels stay concise.
- Foreign sizing conversion displays “1 EUR = [rate] USD” using instrument/account currencies. Same-currency conversion is automatic 1; changing currency pair clears foreign rates.
- Quotation metadata is optional in normalization, persistence and exports. Missing fields remain absent; schema and calculation versions stay unchanged.
- Planned entry, adverse stop and positive risk budget required for sizing.
- Target optional; show planned reward/risk when provided.
- Sizing excludes fees and slippage; label result as planned risk at entered stop.
- Planned quantity stays separate from actual filled quantity.
- Planned quantity must honor the leg snapshot's quantity increment, including manually entered single-leg and multi-leg plans. Website and CLI reject off-increment plans and snapshot corrections that invalidate retained planned quantities without saving source records or receipts. Empty planned quantities remain optional.
- Scaled entries update actual average entry and remaining position.
- Display remaining position’s planned risk at current recorded stop separately from realized loss.
- Multi-leg quantities and combined risk budget entered manually. No automatic portfolio maximum-loss calculation.
- Linear realized gross P&L uses closing quantity, remaining weighted-average entry, exit price, direction and point value.
- Fees recognized when recorded; net realized-to-date includes all incurred fees and signed cash adjustments.
- Manual legs require user-entered gross realized amounts for closing/settlement records. Recorded fees deducted separately.
- Label manual values with source: user-entered or broker-reported.
- Missing manual results remain unknown; never substitute zero.
- Signed linear prices permitted where instrument requires them. Quantities, increments, point values and exchange rates must be positive.

### Currency handling

Reporting currency belongs to trading account. Instrument results retain native currency.

Define every conversion rate consistently:

```text
Rate = account-currency units per one source-currency unit
Account-currency amount = source amount × rate
```

- Same-currency rate automatically equals `1`.
- Invalid supplied foreign execution result rates remain visible and associated with field errors even after switching to Entry. Empty or valid Entry rates may be hidden; domain validation still rejects invalid supplied rates in both website and CLI.
- Planning stores supplied sizing rate.
- Each realized closing result stores its own conversion rate.
- Each fee or cash adjustment stores applicable conversion rate independently.
- Catalogue stores no live FX assumption.
- Missing rate permits saving native record but marks converted result incomplete.
- Aggregate complete account-currency results only; identify omitted/incomplete records.
- Native results remain grouped by currency. Journal overview aggregates complete account-reporting-currency results across all active accounts when All accounts is selected, including existing complete realized components of open trades. Archived history contributes no results or counts. Accounts sharing a currency produce one exact total; different currencies remain separate without implicit FX conversion. Selected-account scope remains unchanged. Exclude incomplete trades and show omitted counts. Empty scoped currency groups show zero; no accounts yields no monetary unit. Other Journal filters narrow history only, not overview totals.
- Website Realized net and CLI `journal overview` share the same aggregation. Existing total/open/closed/account/net/incomplete fields remain; add `currency` and sorted `currencyTotals` entries with `{ currency, net, complete, incomplete }`. `net` is an exact decimal string only when one reporting currency is in scope, otherwise null; `currency` identifies its unit or is null. Each currency subtotal includes complete-trade and omitted-trade counts. Preserve the legacy single-active-account `account` projection; unknown explicit accounts and orphan records fail rather than broadening scope or omitting monetary source data. The website shows one amount for a single currency or vertically stacked labelled amounts for mixed currencies, with an All accounts/selected-account caption and excluded count. Account aggregation and currency-group aggregation use one Decimal summation implementation. Reporting output changes; trade calculation version, persisted summaries, export source values and database schema do not change, and no conversion is required. Acceptance coverage includes independent overview unit expectations, CLI same/mixed-currency reporting and journal currency-total browser checks.

### Journal and data management

Journal is home screen.

- Paginated trade history: website defaults to Opened, newest first; permanent Sort by (Opened, Closed, Last updated) and Order (Newest first, Oldest first) controls live beside the Trades heading/count. CLI retains newest activity by default. Both interfaces share explicit chronology, date matching and deterministic ordering.
- Search instrument name/symbol.
- Filter account, market, status, strategy, tag and opening/closing-date range.
- Website journal controls occupy two permanent bands: full-width instrument search followed by always-visible Account, Status, Market, Strategy, Tag and grouped Date basis (Opened/Closed, default Opened) and From/To fields. Filter columns have 160px minimum width and 12px gaps; date group spans three columns at 504px available width, two at 332px (basis above paired dates), and stacks below that width. Available toolbar width, including sidebar state, owns wrapping. No disclosure, Apply button, horizontal scrolling or duplicate chips; controls have visible filter labels and 44px minimum targets. Clear filters appears at the end only for non-default drafts, resets raw/applied filters including date basis, errors, timers and page, retains sorting, and returns focus to Search when it disappears.
- The journal Tag filter is an editable accessible combobox suggesting exact, deduplicated tags from all active-account journal trades independently of current history filters. Sort alphabetically with deterministic case ties; suggestion matching is case-insensitive substring matching, while actual tag filtering preserves exact case-sensitive values. Focus/input shows matching options in a themed native popover with 44px rows, long-text wrapping, viewport clamping and scrolling; Arrow Up/Down moves virtual focus, Enter commits the highlighted tag immediately, Escape/Tab/outside interaction dismisses without unintended selection. Free typing retains 250ms application; Enter without a highlighted option retains explicit text application. Empty catalogue shows No tags available; unmatched query shows No matching tags. Selection retains input focus and cancels pending text updates through the existing filter-session owner. Clear/navigation dispose the popup and its listeners; sidebar/viewport changes reposition it, including visual viewport changes. This is journal-filter presentation only; tag creation, CLI matching and persisted tag values are unchanged. Acceptance coverage adds tag-autocomplete unit cases and journal-filter browser keyboard/touch/dismissal scenarios.
- Search and Tag apply after 250ms typing pause; Enter, native search clearing, selectors and complete date changes apply immediately and flush pending text. Keep raw filter drafts separate from applied values. Invalid/incomplete dates preserve the last valid applied date basis and pair with associated inline explanation; unrelated filters continue applying. Clearing both dates removes restriction. Applied matching changes reset pagination to page 1; equivalent search text (trimmed/case-insensitive) preserves current page. Draft/applied state persists during authenticated navigation; departure/authentication change cancels mounted-view timers, and stale callbacks cannot update other screens. Returning applies the preserved latest draft, retaining last valid dates where needed. Authentication/reload establishes a fresh filter session.
- Live filtering, sorting and pagination replace only history rows/cards and pagination and, when account changes, account overview content. Keep the Trades heading/count and sort controls mounted; update count text in place. Keep toolbar DOM, focus, typing selection and scroll position (within the remaining scroll extent). Announce matching count/page politely; restore pagination focus to the corresponding enabled action or Trades heading. Empty journals retain the visible filter bands. Existing instrument/account/status/market/strategy/tag matching is unchanged; date basis extends the shared timezone-aware matching; overview remains scoped to account selection, with All accounts aggregation defined in the currency requirements above. Search/filter timing has no CLI command, export or persistence change. Acceptance coverage includes journal-filter-session unit tests, journal-filters browser checks and existing workflow/date checks at mobile, tablet and desktop widths with both sidebar states.

- An unfilled trade uses its repository-assigned creation timestamp as its opening date. Once an entry exists, the earliest entry timestamp takes precedence. Stored summaries, replay, website/CLI filtering and export agree; context edits and retries preserve creation metadata.
- Shared read-only timeline projection uses earliest entry (creation fallback above) for opening and final exit/settlement when current status is closed for closing. Partial closures and currently reopened trades have no closing time; a reclosed trade retains its first opening and reports its latest final closure. Descriptive edits, later adjustments and updatedAt do not move closure. Reuse current persisted/replayed status without a second position calculation. Reporting timeline stays outside persisted summaries, exported records and calculation JSON; no schema, rules or calculation-version change.
- Sort instants by opened/closed/updated ascending or descending before pagination; undated rows stay last in either direction, timestamp ties use trade ID ascending. Website sort choices persist with filter state across authenticated navigation and reset on authentication/reload. Sort changes flush pending text and reset page only when applied state changes; equivalent selections retain page. Sort choices do not make Clear filters visible.
- Date basis selects opening or closing calendar day in configured timezone, with inclusive From/To. Closed ranges exclude open/unfilled trades; Opened ranges preserve creation fallback. Invalid dates retain previous valid basis/range as one unit while other filters and sorting apply. Associated errors identify that applied basis/range; correcting or clearing drafts applies the current basis. Clearing both dates removes restriction.
- History desktop columns are Trade, Status, Opened, Closed, Realized net and Action. Identity prioritizes instrument/direction, then account/strategy and wrapping tags; multi-leg identities show combination and leg count. Unfilled opening cells identify Created and Not entered; absent closing time is an em dash. Show date and time in configured timezone, identified near history controls. Realized net includes currency; open rows say Realized so far; incomplete results say Incomplete with currency, never zero.
- History panel container width owns layout: table at 900px or wider, compact cards below, paired card dates stacking below 400px. Cards group identity/status, dates and result/action. No horizontal scroll or decorative initials; long labels/content wrap, visible controls/actions remain at least 44px. View details has visible wording and an accessible instrument/account-specific name in every row/card, retaining detail route, drafts, guards and focus restoration. Open/Closed remain position statuses; unfilled ideas remain included by Open status filtering.
- CLI journal list adds --sort opened|closed|updated, --order asc|desc and --date-basis opened|closed, defaulting to updated/desc/opened. Invalid values retain validation code/exit status. Existing item fields and pagination envelope remain unchanged; timelines are internal projections. Closing sort or closing range requests hydrate active candidate trades using existing revision-checked getTrade reads before matching/sorting/pagination, in bounded batches of eight. Read failures propagate rather than treating closure as absent. Default/opening requests retain summary-only reads; no database writes or indexes. Website-specific layout, debounce, focus and remembered sort remain intentional CLI exclusions.
- Chronology acceptance coverage includes journal-timeline and journal-cli-reporting unit cases, filter-session state, CLI catalogue/integration, journal-filters and journal-history browser checks. Cover creation fallback, partial/final/multi-leg/settlement/reopened trades, late edits, equal/missing/offset timestamps, timezone boundaries, basis errors, sort/page transitions and matching website/CLI expectations. Responsive checks cover 320/838/intermediate/desktop widths, both sidebar states, long identity/tag content, keyboard/status behavior and scroll/focus. Select executed checks through the verification matrix and record permanent coverage in ACCEPTANCE.md; native iPad/Safari behavior requires device confirmation.
- View details reveals context, legs and execution history.
- Delete trade through explicit confirmation; retain no orphan child records.
- Export all user-owned accounts, catalogue definitions, strategies, trades, executions, snapshots and settings as versioned JSON.
- Portable export format `1` adds independent format version, counts and canonical integrity checksum. Existing unversioned exports remain an explicitly validated legacy format. Export capture uses an expiring user-scoped read lease to prevent concurrent journal writes; it preserves all financial/source values and historical snapshots and excludes authentication, deployment controls, operational receipts and import staging.
- Journal-transfer feedback separates pending activity, the last request outcome and read-only journal availability. Website Export shows Preparing export immediately, prevents duplicate requests and uses the existing operation lifecycle to guard navigation and competing writes without saving/discarding Settings drafts. Feedback belongs beside Journal data actions, not Settings validation. Success means “Export file prepared. Download requested.”; download completion is not observable. New requests clear stale attempt feedback; detached/stale responses cannot update current screens. Status checks never start export, import, rollback or lock deletion.
- Shared read-only inspection classifies `ready`, `active_export`, `expired_export`, `active_import`, `interrupted_import` and `status_unavailable`, with phase, expiry, observed client time, record checkpoint and explicit available actions. No control document is the established pristine-journal state; a requested missing import or malformed/inconsistent recovery metadata is unavailable, never assumed safe. Matching-client recovery and existing same-owner/expired-lease admission determine actions; terminal imports expose no active recovery actions. Import expiry does not imply completed journal changes. Keep original request failures, reporting failed status inspection or cleanup separately. Active export offers Check again; uncertain state offers Check status; expired export enables explicit retry. Interrupted import explains possible partial changes and inspected checkpoints, with explicit supported resume/rollback and existing rollback confirmation. Operation IDs, raw errors and timestamps sit behind keyboard-accessible Details; progress is polite, errors accessible, controls at least 44px, and long content wraps. No percentage estimates or guaranteed expiry countdowns.
- Website, CLI `import status` and authenticated `doctor` share these diagnostic meanings. Existing error codes/exit statuses and successful export JSON remain unchanged; status/error objects add a `transfer` diagnostic and error objects may add `secondaryErrors` and export-preparation outcome. Persistence owner tokens are internal and omitted from public status. User-facing mutation outcomes remain separate from calculation completeness. No journal format/schema/rules change is required; the UI cleanup does not alter fencing, automatic expired-snapshot takeover or explicit import recovery. Targeted acceptance coverage includes transfer-status/lifecycle unit coverage, import integration, CLI status/errors and transfer-feedback browser workflows.

- Website and CLI import the same portable JSON contract, up to 32 MiB per input file. Both offer add-only and replacement, owner rebinding to the authenticated destination, preview before apply and optional source settings. Add-only skips identical records and rejects the entire plan on differing IDs; it does not merge trade aggregates. Replacement removes destination-only supported journal records after explicit confirmation and verified recovery capture. Preferences remain unchanged by default; clear an invalidated default-account selection with preview disclosure.
- Import preserves decimal strings, historical snapshots, creation/update timestamps and reference IDs. Validation checks historical calculations/caches without silently recalculating persisted results. Destination revisions advance beyond replaced/source revisions; receipts are newly generated rather than replayed. Archived catalogue references and larger retained trades can be restored without opening normal creation rules.
- Preview is write-free and binds source, destination, owner/project, mode/settings and conversion checksums. Reject changed previews before journal mutation. User imports share pure schema validators, bounded deterministic adjacent transformations and immutable build-generated checksums with deployment; they never use administrator access or alter global installed schema. Unsupported versions and absent paths fail explicitly; production migration registry has no fabricated transitions.
- Source upload completes durably before journal ownership. Incomplete upload leaves journal usable and may be cancelled. Application stages verified recovery data, uses renewable fenced user ownership and atomic checkpoints, and makes normal website/CLI operations unavailable until complete target verification or rollback. Reads of journal collections are denied during partial application; recovery controls/staging remain available. Initial journal chunks contain one record to remain within Firestore expression limits. Network uncertainty reports operation ID; explicit resume uses staged data without original input file. Rollback intent persists before restoration staging; original, target and restoration manifests have independently verified integrity hashes. Rollback restores financial/source content and receipts, removes import-created records and advances optimistic revisions. Retrying a rejected application retains its original error code.
- Successful replacement recovery snapshots remain private in destination Firestore until explicit user deletion. Website and CLI list, download as portable JSON and delete completed backups. Active recovery data cannot be deleted. User recovery covers supported journal collections and operation receipts; it does not replace privileged snapshots, traverse unknown administrator-created descendants or alter Firebase Authentication users. No cloud worker, billing change or administrator dependency is required.
- Import entry is available in Settings and first-account onboarding. Recovery is available after reload and exposes status, resume and confirmed rollback. Retain drafts after availability failures; stale saves conflict after replacement. Verify keyboard operation and 375/800/1280 px rendering.
- Schema-changing deployment closes new transfer admission under deployment ownership and rejects active imports before conversion. Compatible deployments may pause imports through global maintenance; explicit recovery resumes after reopening. Future schema transitions must explicitly handle import controls and retained backups, preserving original backup versions.

## 3. UX and implementation foundation

### Design requirements

- Modern, restrained visual style; neutral surfaces, one accent colour, clear numeric hierarchy.
- Settings groups Export JSON and Import journal and recovery under Journal data as matching secondary actions, aligned right with responsive wrapping. Save settings remains primary. This website-only presentation preserves export/import behavior and CLI contracts.
- Show the website application version in About; omit version and commit metadata from the signed-in Session sidebar. CLI and build metadata contracts remain unchanged.
- Support offers Cash and Crypto tabs inside the existing 480px native dialog, with a decorative banknote/coin icon beside each label and Cash selected on each opening. Cash opens the existing Ko-fi checkout. The header and method controls stay outside the scrollable payment area. Switching methods preserves the mounted Ko-fi checkout and selected network; closing removes both. Crypto uses one persistent Network selector with an icon in both the selected value and every dropdown row. Bitcoin and Ethereum Mainnet stay first; all remaining entries sort alphabetically by displayed name. Order is Bitcoin, Ethereum Mainnet, Arbitrum One, Base, BNB Smart Chain, Dogecoin, Monero, Optimism, Polygon PoS, Solana, TRON, Zcash Shielded, Zcash Transparent. A themed select-only combobox uses the existing native popover pattern, explicit selected state, arrow/Home/End navigation, typeahead, Enter/Space selection, Escape cancellation and outside dismissal. The menu fits the viewport independently of the dialog scroll area. Supported EVM networks are Ethereum Mainnet, Base, Arbitrum One, Optimism, Polygon PoS and BNB Smart Chain; asset captions are nonexclusive hints: BTC for Bitcoin, ZEC for both Zcash choices, DOGE for Dogecoin and XMR for Monero; Solana and EVM networks show the native asset, USDC, USDT and other tokens; TRON shows TRX, USDT and other tokens. The wallet owner handles tokens received on supported networks. Omit the “Accepts:” prefix, token standards, bridge and variant terminology. All network rows are uniform, with no separator after Solana. Public receiving addresses and supported networks belong in `src/ui/donation-config.js`. Show one full, wrapping address, primary Copy address action, local address-only QR. The address is an underlined native wallet link using `bitcoin:<address>`, `solana:<address>`, `zcash:<address>`, `monero:<address>`, `dogecoin:<address>` or `ethereum:<address>@<chainId>` for the selected network. TRON uses the owner-approved, wallet-specific `trust://send?asset=c195&address=<address>` handoff to Trust Wallet, without amount or HTTPS fallback. Copy and QR work independently of that wallet. Both Zcash choices use `zcash:`: Transparent uses the maintained `t1` address and Shielded uses the supplied `u1` Unified Address. EVM chain IDs are Ethereum 1, Base 8453, Arbitrum One 42161, Optimism 10, Polygon PoS 137 and BNB Smart Chain 56. Displayed text, clipboard contents and QR payload remain the raw receiving address. Links specify no amount; EVM, Solana and TRON links request the native asset, while token donors can use Copy address. Opening depends on the installed wallet and browser; the app does not submit or confirm a transaction. Payment links follow [Bitcoin BIP 321](https://github.com/bitcoin/bips/blob/master/bip-0321.mediawiki), [ERC-681](https://eips.ethereum.org/EIPS/eip-681), [Solana Pay](https://docs.solanapay.com/spec), [Zcash ZIP 321](https://zips.z.cash/zip-0321), [Dogecoin payment URI](https://github.com/dogecoin/dogecoin/blob/master/src/qt/guiutil.cpp), [Trust Wallet deep links](https://developer.trustwallet.com/developer/develop-for-trust/deeplinking) and [Monero payment URI](https://www.getmonero.org/resources/developer-guides/wallet-rpc.html#make_uri) formats. The default crypto panel ends at the receiving-address card without a footer instruction. QR generation uses bundled code with no external service; at widths up to 420px or heights up to 720px it starts behind a keyboard-accessible Show QR code disclosure. After clipboard completion, the copy button shows “Copied” for two seconds before returning to “Copy address”; status announcements remain visually hidden so feedback does not resize the dialog. Denied/unavailable clipboard access selects the address and changes the button to “Copy manually”, with detailed recovery text announced to screen readers. New copy attempts, destination changes and closing clear the feedback timer; destination changes discard stale clipboard results. Use 24px desktop/16px mobile outer padding and consistent 16px section gaps. The selector field uses 8px gaps; the concise asset caption below it reserves one line. Group the receiving label and address with a 4px gap and separate Copy address by 12px. Reserve three address lines on desktop and at viewport widths up to 480px, and four up to 360px so full Monero and shielded Zcash addresses wrap without network-switch movement. The support header and method tabs use 8px vertical padding. Keep the QR at 180px. Tabs and the network selector are keyboard operable, use theme tokens and 44px minimum targets, and preserve existing route, drafts and close/focus behavior. The receiving-address flow performs no wallet connection, transaction submission, balance lookup or payment confirmation. This is website-only support presentation; CLI, schema and financial calculations remain unchanged.
- Product identity remains vxTradeJournal. Sign-in and authenticated workspace show a single linked publisher identity block: the locally bundled Vionix logo occupies a dedicated column, vertically centred beside the vxTradeJournal name and “By Vionix Consulting” subtitle. The entire block opens https://vionix.cloud. A native About modal presents publisher identity, a concise purpose, icon-led project/contact resources, and a separate version/support footer. It provides package version, the intended `vionix-th/vxTradeJournal` GitHub project and issue tracker, and Vionix contact. Links open a new tab with `noopener noreferrer`; publisher attribution does not change the app palette. Public GitHub access depends on repository publication. The repository currently has no declared license; attribution does not invent one or claim open-source licensing. This dialog is website-only presentation; CLI operations and contracts are unchanged. Sign-in and desktop workspace expose a compact About/Support action row with consistent decorative icons and equal-width controls; desktop workspace project actions sit with the sidebar footer, outside primary navigation. About also offers Support. A native dialog embeds the official Ko-fi Tip Panel for vionixconsulting only after a support action and removes it on close. Optional one-time/monthly contributions support this and other free Vionix projects without app privileges. The dialog has a fixed close area and a centred checkout iframe with symmetric responsive margins and a compact, scrollable viewport without redundant introductory copy. App CSS controls the iframe box, while Ko-fi owns its internal card layout and height; cross-origin content cannot be automatically measured or repositioned without provider cooperation. A ten-second delayed-loading notice exposes an external recovery link only while loading is delayed. It preserves route, unsaved editors and journal data. Ko-fi receives no journal/account data or referrer. Frame load/close events never establish payment success. Support is website-only presentation, with no CLI, schema or financial calculation change.
- Above 700px, the authenticated website shell owns the dynamic viewport height (`100dvh`, with `100vh` fallback) and safe-area padding. Its Grid row permits children to shrink; the sidebar stretches naturally without a fixed height or sticky positioning. Main (workspace bar plus content) and sidebar scroll independently; footer controls retain their touch sizes and remain reachable on short screens. Route rendering resets the active scroll container. An explicit sidebar toggle sits before the workspace breadcrumb in the existing 70px main workspace bar, uses a 44px touch target and adds no sidebar row. It changes expanded width 224px to collapsed width 64px without rebuilding editors, changing routes or losing drafts, focus or scroll position. Collapse defaults off and persists locally under `vxTradeJournal.sidebar-collapsed`; unavailable storage retains an in-memory preference. Collapsed presentation shows publisher logo and navigation/footer action icons, hides identity/captions, preserves accessible names and active indication, and provides viewport-clamped hover/keyboard-focus tooltips dismissed on Escape, blur, scrolling and layout changes. Controls have 44px minimum targets. At widths up to 700px, retain compact horizontal navigation and document scrolling, hide the collapse toggle and remember the preference for wider layouts. Breakpoint changes transfer content scroll position and restore visible focus. This is website-only presentation; CLI, exports, financial behavior and persistence contracts are unchanged. Acceptance coverage: `tests/e2e/workspace-shell.spec.js` plus existing compact navigation and editor lifecycle coverage.
- At website widths of 700px or less, keep Journal, Instruments, Strategies and Accounts directly available and replace the Settings navigation slot with More. Its dismissible disclosure orders Settings, Reload records, About and Support, followed by a Session section with workspace identity, Sign out and Download agent skill (ZIP). Reload returns to its existing position in the Session footer on desktop. There is no separate Session disclosure or project-action row on compact screens. All actions support keyboard access and 44px minimum targets; More stays within the viewport and scrolls on short screens. Reload and sign-out retain unsaved-draft guards and close More when invoked; rejecting a departure preserves the draft and returns focus to More. Escape and outside clicks close More. Settings retains the existing navigation/draft guard and marks More active. About/Support preserve route and drafts, close More and restore focus to the visible More trigger; resizing restores desktop controls without duplicate actions or stranded focus. This is website-only navigation; CLI commands, data and financial behavior are unchanged.
- Light and dark themes; system preference default.
- Mobile cards and full-page editors; desktop tables and wider detail views.
- Core workflows usable from 320 CSS pixels upward without horizontal page scrolling.
- Normalize browser automatic text inflation to authored sizing while keeping user zoom available. This website-only presentation behavior does not affect CLI workflows.
- Explicit labels, keyboard navigation, visible focus, accessible contrast and touch targets.
- Instrument and trade editor labels offer concise explanatory tooltips on hover, keyboard focus and tap. Help remains visible while hovered, supports Escape dismissal and fits the viewport. Short accessible field labels and unit descriptions remain unchanged.
- Profit/loss communicated through text and symbols alongside colour.
- Optional fields progressively disclosed.
- Explicit Save action; unsaved-navigation warning. Captured saves lock editing and departure until completion, restoring controls after failure. Nested instrument creation retains the parent trade draft, disclosure state and unsaved protection through child save/cancel. Browser Back/Forward uses the same navigation guard; rejected departures preserve live controls, raw input, dirty state and suspended drafts. Native navigation entry keys restore the original physical history position; classic History uses trusted managed indexes with bounded recovery for queued traversals. For unindexed entries without native traversal (or when history recovery fails), rebase the active draft onto the selected physical slot with a fresh history ledger; the original physical position cannot be guaranteed, but subsequent managed navigation must work without reload or duplicate markers. Authentication resets invalidate prior history and recovery callbacks. Successful editor saves retire matching cached drafts and nested callbacks so history cannot reopen a pre-save editor. Cancel restores focus to the invoking action where available. These browser lifecycle behaviors are presentation-specific; CLI retains its revision, retry and dry-run contracts.
- Failed save retains form content and supports retry.
- A confirmed website write followed by a failed refresh remains confirmed. Show a recovery state with Retry refresh and Sign out; prevent editing or another journal operation until refresh succeeds. Recovery retries only the read and completes the original destination or nested parent return once. Recovery Sign out still confirms discarding an unsaved suspended parent; rejection retains pending completion. Authentication changes invalidate pending completion. CLI trade receipts continue to resolve uncertain write outcomes.
- Ordinary website departures and top-level Cancel discard their composite editor branch, including clean drafts. Back/Forward reconstructs existing editors from current persisted records and new editors with fresh identities. Explicit child suspension/return preserves the parent. Confirmed Reload records discards only after a successful read; rejected departures and failed reloads preserve draft state. These history transitions are website-only.
- Empty, loading, validation, incomplete-calculation and save-conflict states designed explicitly.

### Technology and boundaries

- Semantic HTML, native CSS and JavaScript ES modules with JSDoc.
- Vite development/build tooling.
- Firebase Authentication, Cloud Firestore and Firebase Hosting.
- Compatible UI, component, styling and supporting frameworks permitted when they improve reuse, accessibility, maintainability or architectural coherence.
- Framework selection considers browser/static-hosting compatibility, Firebase integration, testability, runtime cost and long-term support. Evaluate leanness through total implementation and maintenance complexity.
- Initial deployment remains a static browser application; server-side services require a separate architecture decision.
- Decimal arithmetic through [decimal.js](https://mikemcl.github.io/decimal.js/); financial inputs persisted as decimal strings.
- Calculation precision: 40 significant digits. Round recommended quantities down; round monetary displays only.
- Separate UI, application actions, pure domain calculations and Firebase persistence adapters.
- Centralized design tokens and reusable form primitives.
- Version stored data and calculation outputs.

### Local environments and routine commands

Initial development runs entirely locally: Vite serves the application, and Firebase Authentication and Firestore use the Local Emulator Suite with demo project IDs. A registered Firebase project is unnecessary for this phase. See [Firebase emulator project guidance](https://firebase.google.com/docs/emulator-suite/connect_firestore#choose_a_firebase_project).

Provide local development and test profiles with separate emulator project IDs and ports. Npm scripts select the profile directly; switching profiles preserves configuration files. Automated tests manage their own service lifecycle so the development environment can remain running.

Install tooling as project dependencies and expose routine tasks through `package.json`:

| Command | Behavior |
|---|---|
| `npm run dev` | Start application and development emulators; automatically validate and upgrade retained schema without clearing data |
| `npm run dev:test` | Start application and test-profile emulators for interactive debugging |
| `npm run emulators` | Start development emulators separately and automatically preserve/upgrade their schema |
| `npm run test` | Execute complete test suite once; units precede service startup; reject extra selectors |
| `npm run test:unit` | Execute domain/application unit tests without emulators; forward file/name filters and reject zero executed tests |
| `npm run test:integration` | Execute persistence, security and source CLI tests with isolated emulators; forward file/name filters |
| `npm run test:cli` | Execute only source CLI integration scenarios; forward native name filters |
| `npm run test:e2e` | Execute browser workflows with local application and isolated emulators |
| `npm run test:watch` | Watch unit tests during development |
| `npm run lint` | Check source quality using selected project's lint tooling |
| `npm run build` | Produce optimized local application bundle; building is separate from deployment |
| `npm run preview` | Serve built bundle locally against development emulators |
| `npm run data:seed` | Load representative synthetic records into development emulators |
| `npm run data:reset` | Destructively clear development Firestore records and Auth users, then restore sample records |
| `npm run database:upgrade` | Operator-only emulator schema upgrade preserving retained records; startup runs it automatically |
| `npm run check` | Complete integration/release gate: source/documentation checks, test suite, build and packaged-skill verification |

Verification follows the risk-based selection and execution policy in [AGENTS.md](../AGENTS.md#quality). Local profiles connect explicitly to emulated services. Production uses project `vionixtradejournal` (display name `vionix-trade-journal`, number `389058969816`) on Spark with email/password Auth, default Firestore in `asia-east1`, and static Firebase Hosting. `npm run build:prod` produces a separate `dist-prod/` artifact with hosted Firebase configuration and no emulator connections. `npm run preview:prod` previews that artifact using online services; `npm run deploy:prod` builds and verifies release inputs, checks database compatibility, runs required adjacent migrations under guarded maintenance and publishes matching Hosting/rules to the explicit production project. Production preparation and publication are separate operations. Local seed/reset scripts never target production. No server-side or billing-required services are added by this setup.

### Agent CLI and skill

Provide a supported Node.js CLI and an installable `vx-trade-journal` agent skill for authorized access to the same user-owned journal workflows exposed by the website. The CLI reuses the application/domain calculations and Firebase repository; a generated, portable skill distribution bundles project-owned JavaScript without introducing a second financial implementation.

- Run repository commands with `npm run cli -- ...`; `npm run skill:build` produces `dist-skill/vx-trade-journal`. Install by copying that folder into the agent's skill directory and running `npm ci --omit=dev` there. The package supports Node.js 22.13+ on macOS and Linux and works outside the repository.
- Build the portable skill before every local or hosted website build. Generate `dist-skill/vx-trade-journal-<version>.zip` containing the installable `vx-trade-journal/` folder, bundled CLI, guidance, package manifest and locked runtime dependencies manifest. Include that exact archive at `/downloads/vx-trade-journal-<version>.zip` in each website artifact. Development serving also prepares the archive. Provide an accessible ZIP download link on the sign-in screen and in the signed-in Session area. Show runtime requirements and extraction/dependency-installation instructions on the sign-in screen; keep the signed-in Session area limited to the download link. Serve downloads with revalidation to avoid stale copies.
- Require `--profile dev|test|auto|prod` for every network command. Local profiles target their configured demo emulator projects; `prod` targets the hosted project. Offline discovery commands include `help`, `schema`, `version` and `ids`.
- Accept structured command data through `--input <file>` or `--input -`; reject unknown fields. Financial values are decimal strings and timestamps include a timezone. CLI responses use a versioned JSON envelope with stable error codes and process exit codes.
- Persist only profile-separated Firebase refresh sessions in a private user configuration directory (`VXJ_CONFIG_DIR`, then `XDG_CONFIG_HOME`, then `~/.config/vx-trade-journal`). Do not persist passwords or ID tokens. Login and registration read credentials from stdin (`--input -`) or a hidden terminal prompt, never from command-line arguments or credential files. Reject credential-file input before filesystem access with `INVALID_INPUT`; other commands retain JSON file input. Logout removes only the local saved session. Unsafe ownership, permissions, symlinks or stale locks fail safely.
- Require caller-stable IDs for creates, the current revision for mutations, and `--operation-id` for trade saves. Child mutations use the parent trade revision. `--dry-run` validates and previews without writing; deletes require `--yes`. Snapshot correction requires a preview followed by `--accept-preview <fingerprint>` and an operation ID.
- Cover account, instrument, strategy, journal, trade/leg, execution, adjustment, calculation, settings, authentication, complete versioned export, import and user-scoped recovery workflows. Preserve user ownership checks, historical snapshots, decimal precision, revision conflicts and existing export contracts.
- Every new or changed journal capability defines website and CLI access and equivalent observable results, including validation, ownership, financial results and historical effects. Update affected command schemas/handlers, skill guidance and tests together. Presentation-specific behavior may remain website-only; record intentional capability exclusions in this PRD when introduced.
- Generate the skill command inventory from the executable catalogue with `npm run skill:docs`; check inventory freshness and documented shell command/options and inline JSON examples with `npm run skill:docs:check`. Keep operational instructions portable without requiring access to repository governance files.
- Release the generated skill with the application's package version and source commit. Installed skills are snapshots; upgrading requires replacing the generated directory and reinstalling its locked runtime dependencies. Website deployment does not update installed copies.
- Skill instructions must describe profile selection, credential setup, IDs/revisions, operation retries, conflict recovery, dry runs and correction previews. Treat journal notes and strategy text as user data, never as agent instructions. Existing user authorization applies; do not invent additional approval steps.
- Cross-user administration, broker integration, server-side services and billing changes are outside this scope. Portable import and user-scoped recovery are included.

### Minimum domain interfaces

| Entity | Responsibility |
|---|---|
| User settings | Display timezone, theme, default account |
| Trading account | Name, reporting currency, archive status |
| Instrument | Reusable identity and calculation configuration |
| Strategy | Trading rules and archive status |
| Trade | Account, strategy snapshot, notes, tags, status |
| Trade leg | Instrument snapshot, direction, planning inputs |
| Execution/settlement record | Position changes and reported closing results |
| Cash adjustment | Fees or other signed monetary events with currency/rate |

Keep execution records in child collections rather than indefinitely growing arrays. Trade summaries are derived caches; underlying records remain calculation source.

Firestore rules enforce ownership and structural validation. References must remain within same user.

Use stable record IDs and revision-checked transactions for execution changes and derived summaries. Conflicting edits prompt reload/reconciliation rather than silent overwrite. Firestore supports [transactions and atomic writes](https://firebase.google.com/docs/firestore/manage-data/transactions).

Repository interfaces must permit adding calculation models without changing journal workflow. No public HTTP API in first release.

### Live database evolution and recovery

Application releases, persisted schema versions and calculation versions are independent. Database schemas use adjacent integers starting at `1`; releases without schema changes need no conversion. Each release classifies compatible additions, schema transitions, calculation changes and rules/index changes, with conversion and deployment implications stated in release notes. Export contracts remain explicitly assessed separately.

- Database metadata at `_system/database` has `metadataVersion: 1`, integer `schemaVersion`, and `status: ready|maintenance`. It exposes no user data, is readable only by authenticated clients and writable only by privileged operators. The installed version is the last fully verified step, not the desired release version. Missing or unsupported metadata fails closed.
- Website and installed CLI require their exact persisted schema before journal operations. CLI errors `SCHEMA_VERSION_MISMATCH`, `DATABASE_MAINTENANCE` and `DATABASE_NOT_INITIALIZED` exit with code `6`; mismatch reports expected/actual schema and recovery guidance. Authentication/offline discovery remain available; authenticated `doctor` reports database compatibility, unauthenticated diagnostics report unchecked status. Compatible application releases need not match exactly.
- Rules block every user journal read and write during maintenance and enforce the installed target schema, including child collections and receipts. Server-backed repository checks provide clear errors; rules enforce races at commit. Website initial loading exposes Retry loading and Sign out; failed editor operations preserve drafts. Reloading the website obtains the deployed client; no extended old-browser compatibility layer is maintained.
- Every schema increment provides one immutable adjacent migration, with identifier, checksum, source/target validation and deterministic bounded transformation. Deployment composes the full chain; it never adds direct paths for each previous version. Applied checksum drift, missing paths, unknown schemas and downgrades fail preflight. Transformation/checkpoint writes are atomic and safely resumable; global schema and completion evidence advance only after full verification.
- Conversion preserves IDs, ownership, financial decimal strings and historical facts. Snapshot representations, operation receipts and derived caches need explicit per-transition treatment. Historical calculation changes require declared policy rather than silent replay/persistence.
- Production administration uses Application Default Credentials and a deployment-only server SDK. Explicit production target is `vionixtradejournal`; emulator targets are loopback demo profiles. Production rejects emulator overrides. Transaction-fenced leases and heartbeats serialize deployment/recovery. Expired production runs require explicit resume with matching build and migration identity; no implicit unlock or version reset. Emulator startup may automatically resume its own recorded upgrade with matching project, target and migration checksums after lease expiry. A handled emulator failure expires its fenced lease while retaining checkpoints and maintenance; competing live owners still block startup.
- Build website and skill before maintenance; release manifest identifies application version, commit, target schema and artifact/rules hashes. For bootstrap, conversions and changed rules, activate maintenance, publish guarded rules, await the ten-minute rules-propagation barrier when rules change, then back up/convert where required. Publish prepared Hosting, verify hosted manifest/skill bytes and record release success before reopening. Failures after maintenance starts leave it active. Unchanged-schema/rules deployments need neither conversion backup nor maintenance.
- First production baseline requires `npm run deploy:prod -- --register-existing-schema 1`; capture a verified snapshot and validate existing schema-1 records without clearing them, then apply registered adjacent transitions. Current schema is `2`; calculation version remains `1`. Transition `1→2` updates managed and snapshot schema metadata, retaining financial values, historical identities/times/revisions and cached results. It fabricates no correction events. Development and interactive test startup automatically prepare emulator schemas: genuinely empty databases receive the required current schema; retained data lacking metadata is backed up under maintenance and must pass schema-1 validation before registration and any adjacent conversions. Known older schemas follow the same adjacent migration registry as production. Unknown/newer schemas, invalid source records, missing paths or changed checksums fail safely without resetting data. Current ready databases require no backup or conversion. Startup interruption checkpoints the current bounded work before Firebase exports; restarting resumes matching expired upgrade runs. Other upgrade failures leave maintenance active and return a nonzero exit code. `database:upgrade` names the optional preserving operator action; `data:reset` is the separate destructive operation. Isolated resets seed ready metadata.
- Private local snapshots are distinct from user exports. They include journal paths, losslessly encoded values, missing-parent descendants, receipts, counts, hashes, project/database identity, source schema and active migration evidence. Unsupported values fail rather than lose information. Spark remains supported without managed export or cloud storage. Restore under exclusive maintenance replaces journal contents, removes conversion-created records, verifies exact recovery and leaves maintenance active until matching release/rules are deployed. Auth users remain unchanged.
- Operator scripts provide deployment dry run/resume, status and explicit snapshot restore. Administrative operations intentionally have no website or installed user-CLI equivalent. Old skill binaries lack this guard and must be replaced before the first schema transition; deployment cannot retrofit preflight into installed copies.

See [database operations](DATABASE.md) for authentication, commands, deployment failures and recovery. Release acceptance covers synthetic adjacent chains, malformed metadata, maintenance/isolation, interruption/fencing, snapshot integrity/restore, CLI no-write/no-output failure and website draft/retry behavior. Production records are never automated fixtures.

## 4. Verification and acceptance criteria

Use risk-based verification under [project governance](../AGENTS.md#quality) and the selection rules below. Acceptance requirements remain unchanged.

Permanent acceptance mapping and verification limits are recorded in [ACCEPTANCE.md](ACCEPTANCE.md).
Layer ownership, fixture boundaries, selectors and coverage interpretation are specified in [TESTING.md](TESTING.md). Browser component/layout contracts run without emulators and in parallel; complete application journeys and global maintenance cases run sequentially. Maintenance checks execute after ordinary browser cases even when those fail. Automatic browser retries are disabled. Coverage reports remain separate from CLI subprocess and rendered-browser evidence; no global percentage target replaces acceptance contracts.

| Area | Required acceptance |
|---|---|
| User isolation | Unauthenticated and cross-user reads/writes denied, including child records |
| Catalogue | Configuration controls enabled features; incomplete definitions blocked from new trades |
| Historical settings | Catalogue and strategy edits preserve existing snapshots |
| Quantity sizing | Correct point value, FX conversion and downward increment rounding |
| Partial fills | Multiple fills preserve order references and update position correctly |
| Scaling | Entry → partial exit → new entry → final exit recalculates correctly |
| Short positions | Average basis and realized gain/loss use correct direction |
| Multi-leg trades | Legs remain independent; trade closes only when all legs closed |
| Manual results | Clearly labelled; missing amounts remain unknown; fees counted once |
| Currencies | Correct rate direction; historical rates retained; incomplete conversion visible |
| Corrections | Earlier edits recompute history; invalid later exits rejected |
| Reliability | Retried save creates no duplicate; concurrent edits detected |
| Mobile/desktop | Same workflow completes at mobile and desktop viewport sizes |
| Export | JSON includes source records and snapshots required to reconstruct journal |

Concrete calculation fixtures, excluding fees:

- Buy `100 @ 10`, buy `100 @ 12`: average entry `11`.
- Sell `50 @ 13`: realized gross `100`, remaining quantity `150`.
- Buy `50 @ 10`: remaining quantity `200`, average entry `10.75`.
- Sell `200 @ 12`: additional gross `250`; final total `350`, position zero.
- Short `100 @ 20`, cover `40 @ 22`, cover `60 @ 18`: final gross `40`.
- Risk budget `500`, stop distance `2`, point value `50`, FX `1`, quantity increment `1`: recommended quantity `5`.
- Source amount `100`, conversion rate `0.8`: account amount `80`.

Use Vitest for domain/application tests, Firebase Emulator Suite for persistence and security rules, and Playwright for complete browser workflows. Cover registration/setup, strategy creation, instrument configuration, scaled trade, multi-leg trade, corrections, export and reload persistence.

CLI acceptance additionally requires isolated-emulator coverage of authentication/session refresh, profile isolation, user ownership, command input validation, stable IDs, revisions, idempotent trade retries, correction fingerprints, dry runs, and export. Build and install the generated skill in a temporary directory; invoke it from an unrelated working directory and verify its command schema, JSON/error contract and representative complete workflows. Do not use production records for automated tests.

For each affected capability, verify website and CLI outcomes against the same independently specified domain expectations using synthetic records. Extend focused interface-specific coverage where necessary; shared domain tests alone do not establish that both interfaces expose the capability. `npm run check` includes documentation-contract checks and `npm run test:skill`. Fresh packaged-skill verification is required for packaging, runtime dependency and installation-guidance changes, and at complete verification checkpoints. Ordinary CLI/shared behavior changes use source/interface tests and applicable documentation checks without repeating portable installation. Each application release still requires packaged-skill verification and a successful production build.

### Verification selection and checkpoints

Execute focused unit and documentation checks directly. A `worker-m` executes emulator, browser, packaged-skill and complete verification; reuse one worker across related sequential runs. The orchestrator retains command selection, test design, implementation and result evaluation. Select explicit commands and explain their coverage; selection does not use an automatic Git-based algorithm or persistent result cache.

| Change | Required routine verification |
|---|---|
| Documentation/copy | Content and reference checks; skill documentation checks when applicable |
| Local styling | Affected rendered screens at relevant widths |
| UI interaction | Focused regression and related interaction tests |
| Shared UI primitives | Component contracts and affected responsive/keyboard interactions |
| Calculations/shared operations | Related unit tests and focused website/CLI outcome coverage |
| Persistence/security | Related repository/security tests and affected interface coverage |
| CLI behavior/contracts | Related unit and source CLI integration tests; documentation-contract checks |
| Packaging/runtime dependencies/install guidance | Complete packaged-skill verification |

For bug fixes, execute the smallest regression against unfixed behavior and confirm the intended failure. Before implementing changes to financial calculations, ownership enforcement or migration invariants, establish focused failing coverage. Syntax, fixture and environment failures do not establish failure proof. Other features, mechanical refactors, documentation, copy and styling do not require pre-implementation tests. Reuse existing coverage and add tests only for observable coverage gaps; verify affected outcomes after implementation.

Verify focused affected coverage against the final implementation. An existing passing run covering that implementation satisfies completion; no separate completion rerun is required. Subsequent edits invalidate only checks whose tested inputs are affected. Start with named tests or affected files; expand when dependencies, failures or identified unknowns show wider impact, stating the concrete reason and coverage boundary. Change size alone does not determine risk. The acceptance ledger maps permanent evidence, not a requirement to execute every mapped test for every change.

Run `npm run check` once before merging an accumulated batch into the main branch and for releases. Routine changes require complete verification only when identified impact spans suites and narrower checks cannot establish acceptance. Releases also require a production build against release inputs. Integration results may be reused only when source, tests, configuration, dependencies and packaged artifacts remain unchanged; regenerate commit-bearing build metadata when the release revision changes. This policy does not reduce financial precision, ownership, persistence, interface-parity or release acceptance requirements.

Focused commands forward native runner options without changing the automated profile or suite boundary. CLI selection remains restricted to its integration file; conflicting config/project/root overrides and non-executing options are rejected. Zero executed tests are unsuccessful verification, even when a native runner reports a successful exit. Test processes and emulators stop on failure or interruption; integration files remain sequential because they clear shared Firestore data. CLI scenarios reset Firestore and restore a private authenticated session, and prepare their own prerequisite records without depending on earlier scenarios.

Representative command plans:

- UI-only correction: `npm run test:unit -- tests/unit/trade-editor-session.test.js -t "removable-leg"` and `npm run test:e2e -- final-removal.spec.js`, plus rendered/accessibility checks of the affected states; no CLI or packaged installation.
- Shared calculation correction: `npm run test:unit -- tests/unit/planning.test.js`, `npm run test:cli -- -t "reproduces PRD sizing"` and `npm run test:e2e -- trade-plan.spec.js`; no fresh skill installation.
- Packaging change: related archive/docs tests and `npm run test:skill`.
- Persistence correction: `npm run test:integration -- tests/integration/repository.test.js -t "opening dates"`, plus affected unit/interface checks.

These examples illustrate selection, not universal per-change commands. Do not repeat a passing command unless an intervening edit affects its tested inputs. Report commands, executed-test counts, outcomes, elapsed time, material omissions and expected-failure confirmation where required. Cap routine output and retain actionable failure excerpts; full delegated test output stays in worker context. Shorter logs or faster execution do not establish measured token savings or an account-allowance reduction percentage.

Skill distribution acceptance verifies archive contents and version, byte-for-byte inclusion of the generated ZIP in each local and hosted website artifact, downloads before and after sign-in at mobile/intermediate/desktop widths, keyboard operation and no page overflow. Extract the ZIP for portable-install acceptance rather than copying its unarchived source folder.

## 5. Delivery and release defaults

Implement incrementally:

1. Domain calculations and tested entity contracts.
2. Authentication, account setup, ownership rules and catalogue.
3. Trade legs, execution recording, sizing and P&L.
4. Strategies, journal filters, responsive polish and export.
5. Complete local end-to-end validation and prototype review.

Initial work delivers a locally runnable prototype. Hosted environment setup and release publication follow local prototype review as separate work. Release procedures follow [project governance](../AGENTS.md).

First release succeeds when independent users can configure instruments, record realistic execution sequences, link strategies, understand calculation sources and recover saved records reliably on mobile and desktop.

**Confirmed decisions:** multi-leg support, weighted-average accounting, linear calculations plus manual results, manual multi-leg sizing and user-entered FX rates.

**Chosen defaults:** email/password authentication, verified-email writes, JavaScript ES modules with JSDoc, system-selected light/dark theme, explicit saves, plain-text notes, JSON export and no offline synchronization.

**Framework selection:** Open within the compatibility and quality criteria above; specific frameworks remain to be evaluated and recorded before adoption.

### Usage-based support reminders (website only)

A persistent floating secondary notice offers Support, Not now and Don’t remind me. Track only confirmed website trade, execution and adjustment creation/update, including explicit trade snapshot correction. Each captured user write counts once before refresh; failed writes, cancelled editors, refresh retries, catalogue/settings changes, deletion, imports, synchronization and CLI operations do not count. Initial eligibility requires ten writes, 72 elapsed hours after first qualifying write, and activity on three distinct local dates. Further cycles require ten renewed writes and 28 elapsed days. Activity during cooldown counts.

Showing consumes the cycle, resets the count and starts cooldown. Not now and manual donation-dialog opening reset count/cooldown without re-enabling permanent per-app/browser opt-out. Cards do not auto-hide; reload ends session presentation. Only a focused, visible, clean, idle authenticated workspace can present. Editing, pending writes/refresh, dialogs and operational errors suspend the same card; keyboard-focused controls are never removed unexpectedly. Use responsive opaque theme surfaces, wrapping 44px actions and polite announcements without focus movement. Explicit Support opens the existing payment dialog and its close restores focus to a persistent visible Support control.

UI-local policy owns injected clock/storage/lock dependencies and version-1 `vxTradeJournal.support-reminders` metadata: bounded counter, three usage dates, first-use/cooldown timestamps and opt-out. App-specific Web Locks serialize updates/claims and recheck foreground safety inside the lock. Corrupt/unavailable storage or unsupported coordination disables automatic reminders while preserving manual Support and journal operations. Metadata is excluded from journal exports; no data is reconstructed from existing records. Financial/domain calculations, Firebase repositories/schema and CLI access/contracts are unchanged. Policy boundaries and workflow counting have deterministic tests; isolated browser checks cover persistence, suspension, actions, drafts, focus, themes and responsive layout, with Ko-fi intercepted.
