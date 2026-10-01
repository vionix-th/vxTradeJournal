# vxTradeJournal — Product Requirements Document

Version: 1.1 · Status: Proposed · Date: 1 October 2026

## 1. Product purpose and scope

Responsive standalone website for independent users to record trades, document decisions, define trading strategies and review outcomes.

First release prioritizes accurate execution records, straightforward journaling and configurable instruments. Architecture must support future development without introducing unnecessary infrastructure.

**Core workflow:** configure account and instruments → define optional strategy → plan trade → record executions → review outcome.

### Included in first release

- Private user accounts and multiple trading accounts.
- Editable instrument catalogue per user.
- Single-instrument and multi-leg trades.
- Partial fills, scaled entries and partial exits.
- Long and short positions.
- Linear risk sizing and weighted-average realized P&L.
- Manual results for instruments outside supported calculation model.
- User-entered currency conversion rates.
- Strategy definitions and trade links.
- Notes, tags, search, filters and JSON export.
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
- Used accounts can be archived; existing open trades remain editable.
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
| Applicable contract details | Underlying, expiry, strike and option type |

Presets cover equities, forex, futures, options, spot crypto, crypto derivatives, CFDs and custom instruments. Presets supply editable defaults, not inferred authoritative specifications.

- Catalogue form reveals fields relevant to selected preset and calculation model.
- Linear configuration requires valid point value, quantity increment, price increment and P&L currency.
- Manual configuration enables execution recording and reported results; automatic sizing/P&L unavailable.
- Incomplete definitions may be saved as drafts but cannot start new trades.
- Preview demonstrates quantity convention, monetary value of price movement and available features.
- Search supports name, symbol and contract details. Recent instruments appear first.
- Instrument can be created during trade entry without discarding trade draft.
- Catalogue edits affect new trades. Existing trade legs retain configuration snapshots.
- Explicit snapshot correction previews recalculated outcome before saving.
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

Trade represents one journalled trading idea. It contains one or more instrument legs and shared strategy/context.

- Single-leg trade is default. Additional legs added explicitly.
- Each leg has instrument snapshot and long/short direction.
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

- Automatic sizing applies to single-leg trades.
- Planned entry, adverse stop and positive risk budget required for sizing.
- Target optional; show planned reward/risk when provided.
- Sizing excludes fees and slippage; label result as planned risk at entered stop.
- Planned quantity stays separate from actual filled quantity.
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
- Planning stores supplied sizing rate.
- Each realized closing result stores its own conversion rate.
- Each fee or cash adjustment stores applicable conversion rate independently.
- Catalogue stores no live FX assumption.
- Missing rate permits saving native record but marks converted result incomplete.
- Aggregate complete account-currency results only; identify omitted/incomplete records.
- Native results grouped by currency. Cross-account monetary totals excluded.

### Journal and data management

Journal is home screen.

- Paginated list, newest trade activity first.
- Search instrument name/symbol.
- Filter account, market, status, strategy, tag and opening-date range.
- Desktop rows and mobile cards expose instrument(s), status, account, strategy and realized result.
- Opening trade reveals context, legs and execution history.
- Delete trade through explicit confirmation; retain no orphan child records.
- Export all user-owned accounts, catalogue definitions, strategies, trades, executions, snapshots and settings as versioned JSON.
- Export excludes authentication secrets. Import deferred.

## 3. UX and implementation foundation

### Design requirements

- Modern, restrained visual style; neutral surfaces, one accent colour, clear numeric hierarchy.
- Light and dark themes; system preference default.
- Mobile cards and full-page editors; desktop tables and wider detail views.
- Core workflows usable from 320 CSS pixels upward without horizontal page scrolling.
- Explicit labels, keyboard navigation, visible focus, accessible contrast and touch targets.
- Profit/loss communicated through text and symbols alongside colour.
- Optional fields progressively disclosed.
- Explicit Save action; unsaved-navigation warning.
- Failed save retains form content and supports retry.
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

## 4. TDD and acceptance criteria

Write failing behavior test before implementation, then implement and refactor.

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

## 5. Delivery and release defaults

Implement incrementally:

1. Domain calculations and tested entity contracts.
2. Authentication, account setup, ownership rules and catalogue.
3. Trade legs, execution recording, sizing and P&L.
4. Strategies, journal filters, responsive polish and export.
5. Emulator-backed end-to-end validation and staging release.

Use separate development, staging and production Firebase projects. Production release requires passing domain, security and critical browser tests.

No existing application or data migrations: workspace currently empty. Keep future migrations explicit through schema versions.

First release succeeds when independent users can configure instruments, record realistic execution sequences, link strategies, understand calculation sources and recover saved records reliably on mobile and desktop.

**Confirmed decisions:** multi-leg support, weighted-average accounting, linear calculations plus manual results, manual multi-leg sizing and user-entered FX rates.

**Chosen defaults:** email/password authentication, verified-email writes, JavaScript ES modules with JSDoc, system-selected light/dark theme, explicit saves, plain-text notes, JSON export and no offline synchronization.

**Framework selection:** Open within the compatibility and quality criteria above; specific frameworks remain to be evaluated and recorded before adoption.
