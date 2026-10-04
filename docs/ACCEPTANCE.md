# Acceptance evidence

This ledger maps the PRD acceptance criteria to permanent evidence. Test names describe observable outcomes; final command results belong in the delivery report. Automated environments contain synthetic data only. Browser lifecycle mechanics have no CLI equivalent; shared journal behavior must be exercised through both interfaces.

The mappings identify available permanent coverage, not a per-change execution checklist. Select routine verification with the [PRD verification matrix](PRD.md#verification-selection-and-checkpoints); reuse passing results while their tested inputs remain unchanged.

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
| Mobile/desktop | Browser workflows, layout and component-contracts; affected remediation states reviewed at 375/800/1280 px |
| Export | Application: exports reconstructible source records without auth secrets; browser workflow download/reload; CLI complete export and packaged skill |

## Final remediation regressions

| Contract | Evidence |
|---|---|
| Canonical creation/opening date | Repository: derives unfilled opening dates from canonical creation metadata; CLI creation/filter/replay/export assertions; browser `final-dates.spec.js` |
| Draft snapshots | Session: refreshes only unsaved leg snapshots and keeps preview and save consistent; reconciles refreshed draft currencies; browser `final-snapshots.spec.js` verifies quantity 50 → 5 and persisted replay |
| Accepted discard | Lifecycle/route-policy unit tests: session aliases, independent sessions, clean drafts, rejected departures, child Back and deleted-record handling; browser `final-discard.spec.js`: Cancel → Back, nested sidebar departure and reload success/failure |
| Confirmed-save refresh recovery | Browser `final-recovery.spec.js`: catalogue at 375/800/1280, trade, nested parent/focus return, repeated read failures, parent-discard Sign out acceptance/rejection and stale-auth completion; `editor-session.spec.js` verifies one write after inline reconstruction |
| Existing leg removal | Session: removable-leg prerequisites for persisted/oversized records; browser `final-removal.spec.js` at 375/800/1280 verifies disabled descriptions and eligible save; CLI: removes eligible persisted legs and preserves executed legs and the final leg |
| Reachable execution validation | Browser `final-validation.spec.js` at 375/800/1280: visible invalid rate, associated error, rejected save and keyboard correction; CLI: rejects invalid supplied Entry result rates and accepts corrected retained rates |
| Current component contract | Existing planning-errors and component-contracts regressions |
| Credential input sources | CLI: rejects auth login/register credential-file input before accessing a path; renewable-session and registration/login workflows verify stdin, absence of secret output and private refresh-only storage |

## CLI and distribution acceptance

- Identity and profiles: CLI `uses renewable sessions across processes and protects credentials`, cross-user explicit record lookup, and `rejects sessions copied into another Firebase profile before token refresh`; `session-store.test.js` verifies private profile isolation, locking and unsafe-file rejection; `firebase-config.test.js` verifies isolated demo projects and production configuration boundaries.
- Contracts and reliability: `cli-contract.test.js` verifies command options, JSON decimal inputs, stable IDs, revisions and operation IDs. CLI integration exercises dry runs, receipt reads, identical retries, changed-input rejection, stale revisions, preview fingerprint rejection and complete source export. `cli-auth.test.js` verifies renewable-session identity checks and redacted service errors.
- Portable installation: `scripts/test-skill.js` extracts the generated ZIP, installs locked dependencies in a temporary directory, runs schema/version/error checks from an unrelated directory and reruns CLI integration against emulators. Unit archive/docs checks verify contents, references and generated inventory.
- Website distribution: `skill-download.spec.js` verifies downloads before/after sign-in at 375/996/1280 px, keyboard operation and archive metadata. Archive unit tests verify hosted/local copies match generated bytes.
- Targeted verification: `test-runner.test.js` uses controlled subprocesses to verify integration/E2E filters, CLI-only selection, rejected complete-run selectors, executed-test evidence, unit-before-service ordering, failure propagation and interruption cleanup. CLI scenario fixtures reset source records and restore private sessions so file/name filters do not depend on earlier tests.

## Rendered and accessibility evidence

`final-recovery`, `final-removal` and `final-validation` produce full-page screenshots at 375/800/1280 px for long recovery messages, dense multi-leg forms and invalid-rate states. Functional checks assert recovery/write counts and save outcomes. Separate accessibility assertions cover associated errors/prerequisite descriptions, keyboard correction/refresh and nested focus restoration. Root reviews rendered spacing, control visibility and overflow; automated layout/component tests provide additional contract evidence.

## Final gate

Run `npm run check` once before merging an accumulated batch into the main branch. The check includes lint, skill documentation contracts, unit/integration/browser acceptance, local build and portable packaged-skill acceptance. Releases additionally require `npm run build:prod` against the release inputs. Reuse integration results only when source, tests, configuration, dependencies and packaged artifacts remain unchanged; regenerate commit-bearing build metadata when the release revision changes. Verify generated application and skill metadata match the clean release revision; inspect affected rendered states and record functional, accessibility and visual evidence separately. Routine tasks use affected coverage and do not automatically repeat this complete gate.

Known limits: automated browser coverage uses Chromium; classic History fallback preserves drafts and usable navigation but cannot guarantee the original physical cursor for unindexed entries. Automated authentication exercises stdin; the existing interactive hidden terminal prompt is unchanged and not exercised by this gate. Production services are not exercised or deployed by this remediation. Disposable test records require no retained-data conversion. Earlier dated results in VALIDATION.md are historical observations, not current acceptance status.
