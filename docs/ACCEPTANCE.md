# Acceptance evidence

This ledger maps the PRD acceptance criteria to permanent evidence. Test names describe observable outcomes; final command results belong in the delivery report. Automated environments contain synthetic data only. Browser lifecycle mechanics have no CLI equivalent; shared journal behavior must be exercised through both interfaces.

The mappings identify available permanent coverage, not a per-change execution checklist. Select routine verification with the [PRD verification matrix](PRD.md#verification-selection-and-checkpoints); reuse passing results while their tested inputs remain unchanged.
The [suite responsibility guide](TESTING.md) separates isolated browser contracts from emulator-backed application journeys. The [redesign declaration map](../tests/contracts/baseline.json) records destinations for original contracts, including grouped parameterized cases; its count is not an executed-test count.

| PRD area | Permanent evidence |
|---|---|
| User isolation | `tests/integration/security.test.js`: denies anonymous and cross-user access including children; CLI: does not expose another user's records and rejects unsafe saved sessions |
| Catalogue | Domain: validates instrument readiness and snapshots remain independent; browser configuration in `workflows.spec.js`; CLI: blocks draft catalogue definitions from starting trades; instrument preview contracts |
| Historical settings | Repository: persists source records, snapshots, historical edits and export-ready reload; CLI correction workflow; browser snapshot currency correction |
| Quantity sizing | Domain: sizes five contracts and floors fractional increments; uses conversion direction and adverse stop; browser `trade-plan.spec.js`; CLI: reproduces PRD sizing and scaled-fill fixtures (five contracts; fractional FX quantity 0.4) |
| Partial fills | Domain scaled-entry fixture; browser complete journal workflow; CLI: reproduces PRD sizing and scaled-fill fixtures (remaining 150, average 11, gross 100) |
| Scaling | Domain: reproduces scaled entry fixture independently; browser complete journal workflow and reload; CLI: reproduces PRD sizing and scaled-fill fixtures (final gross 350, replay/export agreement) |
| Short positions | Domain: uses short direction; browser `audit-financial.spec.js`: short partial covers reproduce the PRD gross result and reload (40 USD); CLI multi-leg workflow verifies short gross 4 USD → 3.2 EUR |
| Multi-leg trades | Domain: closes multi-leg only after every leg closes and supports settlement; browser trade-capacity/workflows; CLI multi-leg manual-results workflow |
| Manual results | Domain: keeps missing manual result unknown and charges fees once; browser manual results, historical FX, retained validation and snapshot preview; CLI manual/incomplete FX |
| Currencies | Domain: preserves fees, signed adjustments, separate historical conversion rates; browser audit-financial; CLI invalidates snapshot FX in correction previews and saved records |
| Corrections | Domain: rejects correction causing later excess exit; repository invalid earlier corrections; browser/CLI correction preview and save; CLI rejects a changed proposal with an earlier preview fingerprint without changing the revision |
| Reliability | Repository idempotent retry/stale revisions; CLI receipt/retry guarantees; browser concurrent edits and lifecycle/history regressions |
| Mobile/desktop | Real desktop/compact workflows and dense forms; isolated component/history/filter layouts at 320/838/1440 px and both sidebar states |
| Optional Ko-fi and crypto support | `tests/browser/support.spec.js` covers Ko-fi lifecycle/delayed fallback, ordered icon network options, independent decoding of supplied QR destinations, network hints, keyboard/typeahead and outside dismissal, timed clipboard feedback/manual recovery, stable layout, themes and responsive QR disclosure; `tests/e2e/support.spec.js` retains real draft/focus and sign-in lifecycle checks. `support-reminders.spec.js` covers reminder actions and suspension. Final design verified on 2026-10-10: focused browser run 25/25 passing (48.3s), lint/documentation checks and production build passing; representative mobile, intermediate and dark desktop screenshots reviewed without clipping. |
| Portable import and recovery | Unit portable-import validates formats, integrity, versions, conflicts, owner rebinding and settings; transfer-lifecycle preserves rejected retry errors; integration import covers historical 4.02/3.675 USD replay, strategy snapshots, foreign fees, decimal precision, stale previews, fenced ownership, interrupted backup/rollback staging, corrupt restoration manifests and retained backups; CLI covers preview/apply/status and backup contracts; browser import covers replacement, downloads, reload recovery, keyboard behavior and 375/800/1280 px screenshots |
| Database evolution | Unit database-evolution/snapshot, automatic development-database preservation/resume and dev-startup lifecycle coverage; integration database/security/CLI availability, isolation, leases and recovery; emulator-backed maintenance browser project at 375/800/1280 px; packaged CLI guard and dependency exclusion |
| Export | Application: exports reconstructible source records without auth secrets; browser workflow download/reload; CLI complete export and packaged skill |

## Journal workspace and account lifecycle

| Contract | Permanent evidence |
|---|---|
| Viewport-owned shell and collapsed sidebar | `tests/browser/workspace-shell.spec.js`: independent scrolling, route reset and reachable 44px footer controls; `tests/e2e/workspace-shell.spec.js`: live drafts, remembered/unavailable storage, keyboard tooltips and breakpoint focus/scroll transfer; `tests/browser/workspace-shell-contracts.spec.js`: 224px expanded width at intermediate/iPad-sized viewports and reachable expanded footer at short height; compact-navigation and project-dialog regressions |
| Transfer activity, observations and recovery | `transfer-status.test.js`, `transfer-lifecycle.test.js` and `transfer-heartbeat.test.js`: active/expired/inconsistent states, recovery permissions, primary/secondary failures and fenced cleanup; import integration verifies active-export contention, expired-snapshot takeover with stale-owner rejection, missing-session uncertainty and retained source data; CLI doctor/import status retain existing error codes and omit owner tokens |
| Website transfer feedback | `tests/e2e/transfer-feedback.spec.js` and `tests/browser/transfer-feedback.spec.js`: duplicate prevention, guarded navigation, retained Settings drafts, precise download wording, explicit read-only status/retry, terminal recovery actions, rollback wording, stale/detached requests, new-attempt clearing, secondary diagnostics; `tests/browser/feedback-layout.spec.js` checks accessible status/Details and long errors at mobile/intermediate/desktop widths |
| Always-visible live filters and tags | `journal-filter-session.test.js`: debounce, immediate flushing, last-valid date basis/range, equivalent-state pagination, Clear and disposal; `tests/browser/journal-filters.spec.js`: 320/838/1024/1440px and both sidebar states; `tests/e2e/journal-filters.spec.js`: focus/selection/scroll, navigation, combined criteria and touch tag suggestions; `tests/browser/tag-autocomplete.spec.js`: keyboard and long suggestion lists; shared matching expectations remain in application tests |
| Currency-group overview | `overview.test.js`: independently specified 350/450 totals, distinct USD/USDC, exact 0.3 and large signed Decimal values, incomplete exclusions and active-account scope; CLI reporting and journal-filter browser checks verify same/mixed currency results through both interfaces |
| Archive visibility and destructive deletion | `account-lifecycle.test.js`, route-policy, repository/security and import integration: active-only scope, account/default guards, exact cascade manifest, unrelated revisions, stale previews, competing owners, concurrent independent-owner writes/deletion, foreign-read rejection, interrupted resume/rollback and terminal cleanup ownership; `accounts.spec.js` and CLI manage active/archived views, restoration, explicit deletion and recovery after reload. Portable export retains archives until live deletion |
| Trade lifecycle chronology and comparison | `journal-timeline.test.js`: creation fallback, partial/final/multi-leg/settlement/reopened dates, later edits, offset/tied/missing timestamps and timezone boundaries; `journal-cli-reporting.test.js` and CLI integration preserve default ordering/JSON/export contracts and revision-checked closing queries; `tests/browser/journal-history.spec.js` and `tests/e2e/journal-history.spec.js` verify container-driven table/cards, readable long identities, incomplete outcomes, both lifecycle dates, keyboard View details, sorting persistence and date-basis state |

Chromium tests and screenshots establish separate behavioral, layout and keyboard/status evidence. Real iPad dynamic browser chrome, native date controls and assistive-technology output still require device confirmation; the automated iPad-sized viewports do not establish native Safari behavior.

## Final remediation regressions

| Contract | Evidence |
|---|---|
| Canonical creation/opening date | Repository: derives unfilled opening dates from canonical creation metadata; CLI creation/filter/replay/export assertions; browser `final-dates.spec.js` |
| Draft snapshots | Session: refreshes only unsaved leg snapshots and keeps preview and save consistent; reconciles refreshed draft currencies; browser `final-snapshots.spec.js` verifies quantity 50 → 5 and persisted replay |
| Accepted discard | Lifecycle/route-policy unit tests: session aliases, independent sessions, clean drafts, rejected departures, child Back and deleted-record handling; browser `final-discard.spec.js`: Cancel → Back, nested sidebar departure and reload success/failure |
| Confirmed-save refresh recovery | Browser `final-recovery.spec.js`: catalogue at 800px, trade, nested parent/focus return, repeated read failures, parent-discard Sign out acceptance/rejection and stale-auth completion; `editor-session.spec.js` verifies one write after inline reconstruction |
| Existing leg removal | Session: removable-leg prerequisites for persisted/oversized records; browser `final-removal.spec.js` at 800px verifies disabled descriptions and eligible save; CLI: removes eligible persisted legs and preserves executed legs and the final leg |
| Reachable execution validation | Browser `final-validation.spec.js` at 800px: visible invalid rate, associated error, rejected save and keyboard correction; CLI: rejects invalid supplied Entry result rates and accepts corrected retained rates |
| Current component contract | Existing planning-errors and component-contracts regressions |
| Credential input sources | CLI: rejects auth login/register credential-file input before accessing a path; renewable-session and registration/login workflows verify stdin, absence of secret output and private refresh-only storage |

## CLI and distribution acceptance

- Identity and profiles: CLI `uses renewable sessions across processes and protects credentials`, cross-user explicit record lookup, and `rejects sessions copied into another Firebase profile before token refresh`; `session-store.test.js` verifies private profile isolation, locking and unsafe-file rejection; `firebase-config.test.js` verifies isolated demo projects and production configuration boundaries.
- Contracts and reliability: `cli-contract.test.js` verifies command options, JSON decimal inputs, stable IDs, revisions and operation IDs. CLI integration exercises dry runs, receipt reads, identical retries, changed-input rejection, stale revisions, preview fingerprint rejection and complete source export. `cli-auth.test.js` verifies renewable-session identity checks and redacted service errors.
- Portable installation: `scripts/test-skill.js` extracts the generated ZIP, installs locked dependencies in a temporary directory, runs schema/version/error checks from an unrelated directory and reruns CLI integration against emulators. Unit archive/docs checks verify contents, references and generated inventory.
- Website distribution: `skill-download.spec.js` verifies downloads before/after sign-in at 375/996/1280 px, keyboard operation and archive metadata. Archive unit tests verify hosted/local copies match generated bytes.
- Targeted verification: `test-runner.test.js` uses controlled subprocesses to verify integration/E2E filters, CLI-only selection, rejected complete-run selectors, executed-test evidence, unit-before-service ordering, failure propagation and interruption cleanup. CLI scenario fixtures reset source records and restore private sessions so file/name filters do not depend on earlier tests.

## Rendered and accessibility evidence

`final-recovery`, `final-removal` and `final-validation` produce full-page screenshots at 800px for recovery, leg removal and invalid-rate states. Isolated feedback/component fixtures cover mobile, intermediate and desktop widths with long errors and labels. Real `trade-plan` and `layout` journeys retain dense-form captures at 375/996/1280px. Functional checks assert recovery/write counts and save outcomes. Separate accessibility assertions cover associated errors/prerequisite descriptions, keyboard correction/refresh and nested focus restoration. Root reviews rendered spacing, control visibility and overflow; automated layout/component tests provide additional contract evidence.

## Final gate

Run `npm run check` once before merging an accumulated batch into the main branch. The check includes lint, skill documentation contracts, unit/integration/browser acceptance, local build and portable packaged-skill acceptance. Releases additionally require `npm run build:prod` against the release inputs. Reuse integration results only when source, tests, configuration, dependencies and packaged artifacts remain unchanged; regenerate commit-bearing build metadata when the release revision changes. Verify generated application and skill metadata match the clean release revision; inspect affected rendered states and record functional, accessibility and visual evidence separately. Routine tasks use affected coverage and do not automatically repeat this complete gate.

Known limits: automated browser coverage uses Chromium; classic History fallback preserves drafts and usable navigation but cannot guarantee the original physical cursor for unindexed entries. Automated authentication exercises stdin; the existing interactive hidden terminal prompt is unchanged and not exercised by this gate. Production services are not exercised or deployed by this remediation. Disposable test records require no retained-data conversion. Earlier dated results in VALIDATION.md are historical observations, not current acceptance status.


## Dependable trade records and correction history

| Contract | Permanent evidence |
| --- | --- |
| Source identity, deterministic replay and unchanged inputs | `tests/unit/corrections.test.js`: 32 seeded histories, tie ordering and array permutations; independently specified basis, gross, fees and signed conversion results |
| Correction scope/reasons and grouped pagination | Shared correction-diff/reason tests; `tests/e2e/corrections.spec.js` at 800px, missing-to-known FX, deletion, thirteen-operation history and uncertain receipt retry |
| Atomic source/history/receipt and owner isolation | `tests/integration/corrections.test.js`, security and repository suites: six multiplier/currency corrections, eighteen source changes in one compact entry, retries, basic entry validation, append-only history, stale/invalid writes and trade cascade deletion |
| Structured errors and offline verification | CLI `exposes correction requirements, structured rejection and offline backup verification`; typed validation and write-outcome unit tests |
| Portable correction recovery | Import/correction integration: owner rebinding, replacement backup, interrupted rollback preserving exact events and retained schema-1 backup restoration |
| Portable projection identity | `tests/unit/portable-import.test.js`: reordered multi-leg sources preserve valid saved projections; resealed monetary/instrument-cache mismatches are rejected |
| Adjacent schema preservation | Frozen transition registry and `schema-validation.test.js` graph/history rejection checks; database integration compares full source graph/snapshots/receipts/results before and after retained schema-1 startup migration |
| Skill contracts | Generated CLI inventory, validated workflow examples and packaged-skill acceptance at complete verification |

The six-currency/twelve-rate regression verifies eighteen source changes recorded in one application history entry, without splitting the save or adding a service. Rules intentionally permit direct owner source writes with a parent revision; application-recorded history does not independently verify authorship or every before/after value.
