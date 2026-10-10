# Local prototype validation


## Automatic preserving development upgrades — 8 October 2026

Development/emulator startup now registers validated legacy schema-1 data and applies adjacent migrations automatically, using private snapshots and fenced maintenance. Current ready databases need no backup or conversion; failed matching upgrades retain their original recovery file and checkpoints for automatic expired-lease resume. Optional administration is named `database:upgrade`; production baseline registration uses `--register-existing-schema 1`. Destructive `data:reset` and snapshot restore remain separate explicit operations.

Worker-m confirmed seven missing-module contract failures plus the existing manual-startup guidance regression before implementation. A later concurrency regression showed stale preflight metadata could overwrite a newer installed schema; it failed before the acquired-lease recheck and typed startup retry were added. Final focused coverage passed 52 unit tests across five files and 41 integration tests across four files, including real backup-before-validation, enforced maintenance, lossless unknown descendants, two-step automatic failure/resume, checksum drift, interrupted upgrade-before-export and concurrent schema advancement. Three browser availability cases passed at 375/800/1280 px; their unchanged guard coverage was reused after the race fix.

Lint, generated skill inventory/examples, documentation references and whitespace checks passed. Application, schema and calculation versions remain unchanged. Production was not accessed. A read-only status inspection confirmed the already-running development database is schema 1 and ready; its processes and journal values were not changed by this implementation work. Complete release verification remains a later integration/release gate.

## Main-branch integration gate — 8 October 2026

Before committing the accumulated database evolution and startup repair, worker-m executed `npm run check`. Lint, generated skill documentation, 199 unit tests and 40 isolated integration tests passed. The browser stage had 64 passes, one instrument-save failure in the inline-editor lifecycle scenario and three dependent tests not run. The failed request contained valid instrument fields, matching ownership and verified authentication; its emulator permission denial remains unexplained.

The exact browser scenario passed focused reproduction, and the subsequent full browser suite passed all 68 tests without retries or assertion changes. Separate `npm run build` passed with the existing bundle advisory. `npm run test:skill` passed after retrying a transient dependency-install `ECONNRESET`. All gate components therefore passed against unchanged runtime inputs in separate executions; the original composite command itself failed. This recurrence extends the earlier intermittent instrument-save observation below and does not establish a deterministic cause or production behavior.

## Development startup recovery — 8 October 2026

Retained development Firestore data without the newly required database metadata caused `npm run dev` to stop both services. Startup now leaves services running with explicit baseline guidance while journal access remains blocked. Unrelated initialization failures preserve their nonzero exit status. Repeated interrupts no longer terminate wrappers before Firebase can export retained data.

Worker-m confirmed the initial startup and exit-status regressions failed, then confirmed both repeated-interrupt regressions failed before the signal fix. Final focused startup/test-runner coverage passed 26 tests; database integration passed 4 tests, including actual missing-metadata detection without modifying retained records and explicit snapshot-backed initialization. Lint, skill documentation checks, Markdown references and whitespace checks passed.

A real retained-data development smoke returned HTTP 200 from Vite, Firestore and Auth while baseline guidance remained visible. One Ctrl-C completed Firebase export and shutdown; all development ports closed and no emulator processes remained. No baseline initialization, data reset, seed, journal operation or production action was performed. These focused checks supplement the earlier complete verification; the full suite was not repeated for this startup repair.

## Database evolution and guarded deployment — 8 October 2026

Schema and calculation versions remain `1`; application version remains `0.1.0` pending release preparation. Governance now requires immutable adjacent schema transitions, deployment-driven composition, explicit baseline registration, maintenance and local recovery. Production bootstrap, deployment and destructive restore were not executed.

Worker-m confirmed the initial security regression failed because absent metadata still allowed a journal write. After implementation, focused unit and security checks passed, followed by complete persistence/CLI integration. A later ownership regression proved privileged transforms could move records across users; owner-scoped input chunks and output validation then passed that regression and related coverage. Independent decimal-string expectations verify source preservation across adjacent conversions and restoration.

Final worker-m `npm run check` passed lint, generated skill documentation checks, 194 unit tests, 40 isolated-emulator integration tests, 68 Chromium browser tests, local build and freshly installed portable-skill verification. `npm run build:prod` also passed. Packaging confirms admin tooling/dependencies remain outside the installed skill. Markdown references resolve and `git diff --check` passes. The existing large-bundle advisory remains.

Recovery coverage includes missing-parent descendants and receipts, typed values, private/integrity-checked snapshots, exclusive publication, interrupted bootstrap/rules publication, fenced leases, cross-owner rejection, mid-step 205-document conversion recovery and repeated partial 205-document restore. Maintenance prevents observing partial records; restoring data leaves maintenance active until matching rules/release are verified. CLI mismatch prevents journal handler execution and export-file creation while authentication/diagnostics remain available.

Maintenance loading, draft retention, schema mismatch and keyboard retry passed at 375, 800 and 1280 pixels. Representative rendered draft and unavailable screens were visually reviewed without clipping or unreadable controls. Screenshots do not independently establish contrast ratios. Database browser cases execute in a separate serial project after ordinary coverage because control metadata is global.

An earlier composite run encountered one instrument-creation permission denial in the concurrent-edit browser scenario. Trace fields and verified authentication claim were valid; no deterministic cause was established. The exact scenario passed focused reproduction and two subsequent complete browser runs, including the final successful composite gate. No unrelated functional workaround was introduced.

Production ADC authorization, real rule propagation and hosted publication/recovery remain unverified live operations. Follow [database operations](DATABASE.md) for first baseline rollout, interrupted-run resume, durable backup handling and explicit recovery.

Historical validation journal through 4 October 2026. Dated counts and unresolved observations below describe those runs, not the current remediation state. The 5 October acceptance mapping, final gates and verification limits are maintained in [ACCEPTANCE.md](ACCEPTANCE.md); final command outcomes identify the delivered source revision.

Validated through 4 October 2026. Application version: `0.1.0`. Hosted deployment and release publication remain separate work after prototype review, as specified in [PRD delivery defaults](PRD.md#5-delivery-and-release-defaults).

## Code quality audit fixes — 4 October 2026

Shared snapshot correction now invalidates the corrected leg's sizing and realized-result conversion rates when its P&L currency changes. Matching account currencies use `1`; foreign rates remain missing until explicitly supplied. Fee currencies/rates and other legs remain independent. Website and CLI regressions use the same independently derived fixture: two units bought at 10 and sold at 12 realize 4 in the snapshot currency; a 1 USD fee remains 1 USD. Correcting the snapshot to EUR produces an incomplete account result with a known subtotal of -1 USD. Supplying a result rate of 0.8 produces 2.2 USD net. Preview, persistence and export preserve these outcomes without changing the catalogue.

Existing leg instrument references are immutable in application validation and Firestore rules. Application, repository and atomic direct-write regressions reject instrument replacement while permitting explicit same-instrument snapshot correction. The independent point-value fixture retains 2 USD before correction and produces 20 USD after an authorized point-value correction. A shared calendar predicate validates instrument expiry, timestamps and CLI opening-date filters, including leap-century cases. The unused contract module was removed after confirming it had no consumers.

The [editor lifecycle](../src/ui/editor-lifecycle.js) owns pending-operation locks, departure guards, suspended parent drafts, history and Cancel focus. Save payloads are captured before controls are disabled; failure restores the original enabled/disabled states. Nested instrument save/cancel preserves trade values, disclosure state and unsaved protection. Browser Back/Forward uses the same guard; cached draft arguments are cleared at authentication transitions and retired after successful trade save. Conflict reload still returns to the current saved trade. Regression coverage confirms parent protection during sidebar/reload departure, pending-save failure recovery, rejected history navigation, focus restoration and prevention of pre-save draft resurrection. An isolated original-UI baseline accepted the valid save payload but failed the pending-field lock assertion before the fix.

Execution price fields use snapshot quotation-unit descriptions, including missing-unit guidance. Journal cards now preserve strategy information at intermediate widths. Worker-m visual review covered journal screenshots at 375, 800 and 1280 pixels; dense trade-plan forms at 375, 996 and 1280 pixels; missing-FX guidance; and a dark-theme tooltip. No blocking clipping, overlap or readability issue was identified. Accessible descriptions, keyboard/focus behavior and overflow are separately covered by browser assertions; screenshots alone do not establish contrast ratios.

Worker-m completed `npm run check`: lint, generated skill documentation checks, 79 unit tests, 23 emulator integration tests, 28 Chromium browser tests, the local build and 6 freshly installed portable-skill CLI tests passed. `npm run build:prod` and `git diff --check` passed. The hosted build retains the approximately 652 kB main-chunk advisory. PRD 1.6 and portable skill guidance document the correction and lifecycle contracts. No deployment or release was performed; application, schema and calculation versions remain unchanged.

## Website skill download — 2 October 2026

Local and hosted website builds now generate the skill first and publish its versioned ZIP under `downloads/`. Development serving prepares the same resource before listening. Sign-in and signed-in Session areas share the download link and extraction/dependency-installation guidance. Hosting configuration sets ZIP downloads to `application/zip` with cache revalidation.

`worker-m` confirmed the archive test initially failed for the missing archive module and all three browser scenarios failed for the absent download link. The archive-content test, lint and focused browser tests then passed. Browser checks download and inspect the ZIP before sign-in, verify the authenticated link, activate it with the keyboard, preserve the Journal view and check 44-pixel targets and no page overflow at 375, 996 and 1280 CSS pixels. All six sign-in/journal screenshots were visually reviewed; content and installation guidance remain readable.

The full `npm run check` passed 64 unit tests, 19 emulator integration tests, 18 Chromium browser tests, local build and four packaged CLI workflows. A subsequent archive-byte comparison exposed timestamp-only differences across unchanged rebuilds; a regression test first failed for that difference. Fixed ZIP timestamps then passed both archive tests, all 65 unit tests, lint, four ZIP-install CLI workflows and all three download browser scenarios. Final local and hosted builds passed, with each website ZIP matching its generated source byte for byte and both website archives matching each other. Independent `unzip -t` reported no compressed-data errors. Changed Markdown references and Firebase download-header configuration passed checks. Vite retains its roughly 646 kB main-chunk advisory.

Portable-install acceptance now extracts the built ZIP into an isolated temporary directory before installing its locked runtime dependencies and exercising CLI workflows. The ZIP contains the generated installable folder, bundled CLI and guidance/manifests; it excludes installed node_modules and user sessions. No deployment or release was performed by this implementation.

## CLI and skill maintenance contract — 2 October 2026

AGENTS.md and PRD 1.4 now require affected website and CLI capabilities to evolve together, with documented exclusions and equivalent observable acceptance outcomes. The command inventory is generated from the runtime catalogue. Documentation checks reject stale inventory, unsupported commands/options, missing required options and invalid JSON heredoc input in fenced shell examples. Both the standard check command and portable skill builder enforce documentation checks; the standard check also verifies a fresh skill installation.

`worker-m` confirmed the failing stage for the missing documentation module, then passed all eight focused tests. `npm run skill:docs:check` verified the inventory and six shell examples. The expanded `npm run check` passed lint, documentation checks, 63 unit tests, 19 emulator integration tests, 15 Chromium browser tests, the local application build and all four CLI workflows through a freshly installed portable skill. Vite retains its roughly 645 kB main-chunk advisory.

The hosted production build, changed Markdown references and official authored/generated skill validation also passed. PyYAML was installed only in a temporary validation environment and removed afterward. A temporary skill copy with an altered inventory row failed the documentation gate as expected; regeneration restored a passing check without modifying source documentation.

Installed skills remain application-version/source-commit snapshots; replacement and locked dependency installation are documented in the README and runtime skill. This patch does not change financial behavior, application/export schemas, the release version or production records.

## Agent CLI and portable skill — 1 October 2026

`worker-m` executed failing, passing and regression stages for shared operations, command contracts, private sessions, authentication and CLI integration. The orchestrator owned test design, core implementation, integration and result evaluation. Supporting session-store, packaging and skill-documentation work was delegated with explicit file ownership.

Final commands passed:

- `npm run check`: lint, 55 unit tests, 19 emulator integration tests, 15 Chromium browser tests, and the local application build.
- `npm run build:prod`: successful hosted build. Vite retains its advisory for a roughly 645 kB minified main JavaScript chunk.
- `npm run test:skill`: generated the portable distribution, installed its locked runtime dependencies into an isolated temporary skill directory, verified commands and references from an unrelated working directory, and passed all four CLI emulator workflow scenarios through that installed executable.
- The official `quick_validate.py` passed for authored and generated skills. Its PyYAML dependency was installed only in a temporary environment, which was removed afterward. An independent read-only skill evaluation checked command contracts, missing FX, historical correction, retry handling and hosted export instructions.

CLI coverage includes registration and refreshed sessions across processes, verified-email writes, separate users/profiles, secret exclusion, private files and symlink rejection, serialized session updates, stable create IDs, parent revision conflicts, matching retry receipts, rejection of changed retry input, calculation previews, snapshot correction fingerprints, historical snapshots, archives, settings, multi-leg short/manual outcomes, incomplete FX, currency-pair rate clearing, cash adjustments, output-file overwrite handling and cascading trade deletion.

Independently derived fixtures include linear gross `2 × (12 − 10) = 4 USD`, less a `1 USD` fee for net `3 USD`; correcting point value to `2` produces `7 USD` net. A separate multi-leg fixture realizes short gross `2 × (20 − 18) = 4 USD`, converted at `0.8` to `3.2 EUR`, plus `3.25 EUR` manual gross and a `0.05 EUR` adjustment, for final net `6.5 EUR`. Missing foreign/manual results remain incomplete until explicitly corrected.

Rendered trade forms were reviewed at 375, 996 and 1280 CSS pixels, plus the journal at 320 pixels. Labels, units, disclosure content and save actions remain readable without page overflow. Existing tooltip keyboard/touch, layout, draft-preservation and complete browser workflow regressions passed; this run supersedes the earlier production-preparation report's tooltip failures.

No hosted records, credentials, deployment, release tag or release version were changed. Live production authentication/email delivery and hosted persistence remain unverified. The application/export schema and calculation versions remain `1`. Saved sessions require macOS/Linux private file semantics; crashed-process locks fail with an explicit recovery instruction. The generated distribution is under `dist-skill/vx-trade-journal`; install dependencies with `npm ci --omit=dev` after copying it to an agent skill directory.

## Executed checks

A `worker-m` executed failing, passing and regression stages. The orchestrator designed tests, implemented behavior and evaluated results.

- `npm run check`: lint, 26 unit tests, 13 emulator integration tests, 6 Chromium browser workflows, and production build passed.
- Final UI/FX changes: `npm run test:e2e`, `npm run lint`, and `npm run build` passed again. Unit/domain and persistence/rules behavior remained unchanged after their passing checks.
- Browser workflows ran at 320, 375 and 1280 CSS pixels. No horizontal page overflow in checked workflows. Visual captures reviewed; text, muted text and gain/loss token contrasts pass WCAG AA in both themes.
- Development smoke: `npm run dev`, repeated `npm run data:seed`, `npm run data:reset`, and built-bundle preview passed. Auth and Firestore export/import restored seeded records after restart. Graceful shutdown closed service ports. Automated services use their own profile and shut down after checks.
- Production dependency audit: `npm audit --omit=dev` reported zero vulnerabilities after the scoped gRPC override. Remaining development-tool advisories do not belong to the browser bundle; review those again before hosted delivery.

## Visual redesign verification

The subsequent workspace redesign passed `npm run test:unit` (29 tests), `npm run lint`, `npm run test:e2e` (6 workflows) and `npm run build`, executed by `worker-m`. Three new tests first failed for the absent overview function and then passed; independently specified expectations cover account-only monetary results, incomplete exclusions and single-account default scope. The previous 13 persistence/security integration tests remain applicable because persistence and rules did not change.

Responsive journal captures cover 320, 375 and 1280 pixels; sign-in and dark-theme captures provide visual review evidence. Self-hosted Inter removes runtime font requests. Revised normal-text foreground/background tokens meet 4.5:1 contrast, including primary buttons and muted text on the workspace background. Navigation exposes all five destinations at mobile widths, and existing labels, keyboard focus and 44-pixel controls remain available.

## Spacing and alignment verification

The follow-up spacing pass adds two browser layout regressions at 1280 and 375 pixels. Both first failed: desktop card top edges differed by 20 pixels and mobile search-to-card separation was zero. A further desktop expectation exposed a 7-pixel metadata offset under wrapped titles. Shared heading/body grid tracks and parent-owned spacing correct these cases. Catalogue edit actions, strategy subsections and editor field gutters receive visual review. Passing and regression stages executed by `worker-m`: targeted layout tests 2/2, full browser workflows 8/8, lint and production build passed. Financial/domain and persistence logic remain unchanged.

## New/Edit trade clarity verification

The optional-planning patch passed 36 unit tests, 15 emulator integration tests, 12 Chromium browser tests, lint and the production build, executed by `worker-m`. Failing stages confirmed absent quotation-unit trimming/type limits, rules rejection of valid metadata, a missing instrument unit field and absent planning helpers. Browser tests now await save completion before navigation, respect Settings remaining on its own page after save, and select the intended reporting account explicitly in two-account fixtures.

Coverage includes optional/missing metadata, rejection of invalid units at the persistence boundary, historical snapshot retention after catalogue edits, missing-field preservation during historical edits, unchanged financial examples, neutral incomplete planning, supplied-value validation, leg-scoped concise labels, saved/open and empty/collapsed plans, dynamic quotation/quantity/account units, explicit FX direction and pair-change clearing, manual/multi-leg planning, and draft/disclosure retention through inline instrument creation. A final failing browser regression found duplicate explanatory text across expanded legs. Native disclosure toggles now display help only in the first expanded leg, with close/reopen coverage. Responsive screenshots cover 375, 996 and 1280 pixels; light and dark captures were reviewed. The live development page was refreshed only after verifying no active editor draft. Documentation local links were checked.

No release or deployment was prepared. Existing quotation metadata was not backfilled; schema and calculation versions remain 1. The production JavaScript bundle is about 636 kB uncompressed and retains Vite's 500 kB advisory.

## Label tooltip verification

Instrument and trade editors now explain all field and checkbox labels through shared hover/focus/tap help. A new browser test first failed for absent help controls. A passing-stage check then exposed scroll events dismissing tooltips immediately after focus or hover; active tooltips now reposition during scrolling. Coverage verifies label hover, pointer entry into tooltip text, Escape dismissal, keyboard focus, real touch taps, 44-pixel help targets, viewport bounds, contract fields, multi-leg controls and unchanged quotation-unit descriptions.

`worker-m` executed the final `npm run check`: 39 unit tests, 15 emulator integration tests, 15 Chromium browser tests, lint and the production build passed. Tooltip screenshots were reviewed at 375 and 1280 pixels in light mode and 996 pixels in dark mode. The live development journal was refreshed after confirming no editor draft. PRD and decision records were updated; local documentation references resolve. The existing Vite bundle-size advisory remains.

## Acceptance evidence

| PRD area | Evidence |
| --- | --- |
| Financial precision and sizing | Decimal strings, 40 significant digits; fixture quantities and FX direction verified independently in [domain tests](../tests/unit/domain.test.js). |
| Weighted average and scaling | `100 @ 10`, `100 @ 12`, exit `50 @ 13`, entry `50 @ 10`, exit `200 @ 12`: final gross `350`; intermediate quantity `200`, basis `10.75`. |
| Short positions | `100 @ 20`, covers `40 @ 22`, `60 @ 18`: final gross `40`. |
| Fees, adjustments and manual results | Fees deducted once; unknown manual results never replaced with zero; native grouping and incomplete conversion surfaced. Browser fixture: gross `100 EUR × 0.8 − 5 USD = 75 USD`; additional `−10 GBP × 1.2` yields `63 USD`. |
| Configuration and snapshots | Draft/archived new-trade prevention, relevant presets, stable IDs, instrument/strategy historical snapshots, explicit correction preview and current strategy links covered. |
| Identity and ownership | Registration/verification/setup/sign-out/reset workflows; unauthenticated, unverified and cross-user denial, including child paths, covered by [security tests](../tests/integration/security.test.js). |
| Persistence and corrections | Source child collections, revision conflicts, consistent multi-collection reads, durable retry receipts, invalid earlier corrections and cascade deletion covered by [repository tests](../tests/integration/repository.test.js). |
| Journal and settings | Search, each filter dimension, pagination, account-only totals, local opening dates, timezone/theme reload and linked strategies covered by [application tests](../tests/unit/application.test.js) and browser workflows. |
| Mobile/desktop and recovery | Scaled/multi-leg trades, manual results, incomplete FX, retained validation inputs, conflict reconciliation, inline catalogue creation, draft preservation and mobile session actions covered by [browser tests](../tests/e2e/workflows.spec.js). |
| Export | Versioned JSON includes accounts, catalogue, strategies, settings, trade snapshots and all source executions/adjustments. Authentication secrets excluded. Download/reconstruction fields checked in browser tests. |

## Practical limits

Firebase Authentication/Firestore validation uses local demo emulators. Hosted configuration, real email delivery, production service behavior and release tags are outside this prototype phase. Browser automation used Chromium; Firefox and WebKit have not been checked. Vite reports a JavaScript chunk above its 500 kB advisory threshold (about 636 kB uncompressed); build succeeds.

Development data persists only after graceful emulator shutdown. At the initial prototype checkpoint, JSON export provided a portable source-record copy and import was deferred; the portable import verification below supersedes that limitation. Architecture and implementation choices appear in [DECISIONS.md](DECISIONS.md); routine commands and synthetic login appear in [README.md](../README.md).

## Production Firebase preparation — 1 October 2026

Authenticated CLI queries confirm `vionixtradejournal` / project number `389058969816` and the default free-tier Firestore database in `asia-east1`. Registered a production web app and retrieved its public SDK configuration. Hosted builds now use online services; local builds use demo-ID emulators. Hosting configuration serves only `dist-prod/`.

`worker-m` confirmed the new configuration tests fail before implementation because the configuration module is absent, then pass 3/3 after implementation. Full unit tests pass 39/39 and emulator integration tests pass 15/15. Browser tests pass 12/14; two tooltip tests in `tests/e2e/tooltips.spec.js` fail at 1280 and 375 pixels because the expected “About Instrument name” button is absent. These failures remain unresolved and prevent claiming complete release validation.

Lint, local build and production build pass. Bundle inspection confirms `vionixtradejournal` with emulators disabled in `dist-prod/`, and `demo-vxjournal-dev` with emulators enabled in `dist/`. An explicit local-profile override of a hosted build fails with “Hosted builds require the prod profile.” Firebase Hosting configuration parses successfully. Builds retain Vite's >500 kB chunk advisory.

No Hosting release or Firestore rules deployment was performed. Real email delivery, production Authentication domain configuration and hosted persistence have not yet been exercised. Preparation does not establish release readiness or create a release tag.

## Portable import and user recovery — 8 October 2026

`worker-m` executed the completed `npm run check`: 226 unit tests in 30 files, 52 emulator integration tests in five files and 92 Chromium browser tests passed, with browser retries disabled. Lint, generated skill documentation, local build and packaged-skill acceptance also passed. The packaged CLI exercises the same authenticated import and backup contracts outside the repository. Separate hosted build, migration-manifest verification, whitespace checks and local documentation reference checks passed. The existing Vite bundle-size advisory remains. Source/configuration/test/skill checksums were unchanged across the final gate.

Failing regressions exposed altered restoration checkpoints being accepted and rollback intent being lost during interrupted restoration staging. Separate restoration hashes and durable rollback preparation now reject corruption and resume the selected recovery action. Rejected import retries retain their original error code. Integration coverage also verifies complete source staging before journal changes, stale previews, expired ownership, stale fences, operation receipts, backup retention/download/deletion and owner rebinding. Independently derived historical results are 4.02 USD and 3.675 USD, including archived catalogue/strategy snapshots, foreign fees and signed adjustments.

Full browser runs exposed intermittent rule-expression-limit failures during ordinary instrument creation. Ordinary and import authorization now share one instrument validation body, and browser concurrency is bounded to four workers for the shared emulator. The completed gate passed all 92 cases. Import preview/recovery screenshots were reviewed at 375, 800 and 1280 pixels; keyboard preview/apply/resume, replacement deletion and recovery downloads passed.

Schema and calculation versions remain 1; application package version remains 0.2.0 pending release preparation. User recovery covers the managed journal graph and receipts; unknown administrator-created descendants remain the privileged database snapshot scope. No production bootstrap, deployment, destructive restore or release tag was performed.

## Dependable trade records and correction history — 9 October 2026

Schema 2 adds immutable source-correction evidence, bounded reasons, grouped history, structured validation/application outcomes and verified portable recovery. Calculation version and portable format remain 1; application version remains 0.3.0 pending release preparation. Existing workspace contributions were preserved. No production migration, deployment, release tag or version increment was performed.

Focused expected-failure evidence preceded affected invariant changes. The preserving transition test first failed because the registry still targeted schema 1 (one failure, thirteen skipped; 1.10 seconds). The missing-correction-evidence security test first demonstrated that an otherwise valid atomic edit succeeded without evidence (one failure, thirteen skipped; 6.79 seconds). Fixture/environment failures were excluded from this proof. Both regressions pass after implementation; negative coverage also rejects forged before/after records, independent history mutation/deletion, cross-owner evidence, invalid rate/currency shortcuts and metadata-only fabricated events.

Independent replay expectations exercise thirty-two seeded source histories, scaling after partial exits, closure/re-entry, tied timestamps, permutations, signed adjustments and conversion results. Earlier invalid edits/deletions preserve source records, revisions, receipts and evidence. The portable multi-leg order regression separately failed against the unfixed implementation (one failure, seven skipped; 0.61 seconds): Firestore child order differed from saved projection order. Validation now compares projection legs by ID and cached instruments as multisets without rewriting source or cached records. Its eight-test file passes, including resealed forged monetary/instrument-cache rejection.

| Command | Executed evidence | Outcome and elapsed time |
| --- | --- | --- |
| `npm run check` (delegated accumulated-batch gate) | 234 unit tests; 63 integration/CLI tests | Unit tests passed; 62 integration/CLI passed, one failed; approximately 77 seconds. The command stopped before browser/build/package stages. |
| `npm run test:unit` (after portable order fix) | 235 tests, 32 files | Passed; Vitest 19.58 seconds. |
| `npm run test:e2e` (delegated full browser suite) | 100 Chromium tests | Passed; approximately 87 seconds, before the portable order fix. Correction reasons, missing-to-known FX, deletion/history, pagination and uncertain receipt retries are covered. |
| `npm run test:integration -- tests/integration/import.test.js` (after portable order fix) | 12 tests | Passed; 15.4 seconds wall time. |
| `npm run test:cli` (after portable order fix) | 17 tests | Passed; 46.1 seconds wall time. |
| `npm run test:e2e -- import.spec.js` (after portable order fix) | 3 tests, 3 workers | Two passed; the 1280-pixel case failed after Apply import; 44.2 seconds wall time. See investigation below. |
| `npm run test:e2e -- import.spec.js --grep 'replacement preview, backup and interrupted recovery at 1280px' --workers=1` | 1 test | Passed; 39.7 seconds wall time. |
| `npm run test:e2e -- import.spec.js --workers=1` | 3 tests | Passed; 41.9 seconds wall time. |
| `npm run build` (delegated) | Local application and generated skill | Passed; 22.84 seconds. JavaScript chunk 743.54 kB retains Vite's 500 kB advisory. |
| `npm run test:skill` (after portable order fix, delegated) | Fresh packaged installation, CLI examples/contracts and 17 emulator CLI tests | Passed; 71.6 seconds wall time. |
| `npm run build:prod` (after portable order fix, delegated) | Hosted-mode application and generated skill | Passed; 25.0 seconds wall time. No deployment. |
| `npm run lint`; `npm run skill:docs:check`; `npm run schema:manifest:check`; `git diff --check` | Source lint, generated inventory, thirteen command examples, immutable migration checksums and whitespace | Passed after the portable order fix. |

Functional browser evidence includes keyboard reason validation, Escape/focus restoration, retained input after an uncertain acknowledgement, retry without duplicate evidence and confirmed-write recovery. Separate rendered history captures at 375, 800 and 1280 pixels were reviewed for wrapping, control visibility and overflow. Existing accessibility/component coverage remains part of the full browser suite. Hosted production services and browsers other than Chromium were not exercised.

The later concurrent import failure left the page at `preparing · preparing · checkpoint 0`. Its trace showed a permission-denied commit updating import status/control, with evaluation errors at rule lines 31 and 40; no expression-count/access-call-count error or invalid transition was exposed. The exact case and all three widths passed without concurrency and without assertion changes or retries. Concurrency correlation is observed; the cause remains unproven. Retained trace/error context: `test-results/import-replacement-preview-e5031-errupted-recovery-at-1280px-journal/`. The broad browser pass and subsequent isolated passes do not erase this observation.

**Unresolved acceptance:** `corrects six currencies and atomically records all resulting execution-rate invalidations` changes six snapshots and twelve execution rates and creates eighteen immutable correction documents. Firestore rejects this valid aggregate at its 1,000-expression rules budget. The failing regression remains active; it is not skipped or reclassified as a passing negative test. Six-leg saves and six simultaneous multiplier corrections pass atomically, with complete evidence and ownership checks. No splitting or capacity reduction was introduced. A final authorization-inheritance optimization also failed the focused positive test (one failure, six skipped; 8.16 seconds) and was reverted byte-for-byte; final rules retain explicit authorization. The current PRD excludes server services without a separate architecture decision; that decision remains pending. This batch is reviewable but does not satisfy the complete implementation/release gate.

## Proportional correction history — 10 October 2026

Supersedes the per-source audit design and unresolved architecture boundary above. Each correcting application save now creates one append-only entry with reason and changed source fields' before/after values, including snapshot-triggered FX invalidations. Unchanged fields and persistence metadata are omitted; deletions retain removed source values. Missing fields remain absent rather than being conflated with explicit nulls. The shared source/history/parent/receipt transaction, reason validation and deterministic retries remain in place. Rules retain ownership, source validation, parent revisions, basic entry structure and append-only history, without exhaustive cross-document evidence verification. Direct authenticated-owner source edits can bypass application history; history does not independently verify authorship. No service, release or deployment is introduced.

Expected failures were established before the new contract/rules changes. The operation-entry unit contract rejected the new valid shape (one failure, three skipped; 0.83 seconds). The new entry's rules authorization failed while its source fixture save succeeded (one failure, seven skipped; 8.50 seconds). After simplification, security passed 14/14, while correction coverage exposed absent-field-to-null invalidations being omitted from compact diffs. That focused integration failure was confirmed before preserving absent keys. The resulting six-currency regression passes: six snapshots and twelve execution-rate invalidations, eighteen changes in one entry, atomic persistence and identical retry, without splitting the save. Focused final run: one passed, seven skipped; Vitest 1.63 seconds.

The earlier verification interruption completed 235 unit tests but produced no integration evidence. A replacement worker completed the final accumulated-batch gate against the simplified implementation:

| Command | Final outcome | Recorded stage duration |
| --- | --- | --- |
| `npm run check` | Exit 0: lint, inventory/thirteen command examples, 235/235 unit tests, 64/64 integration tests across six files, 100/100 Chromium tests, local build and packaged-skill acceptance | Unit 19.42 seconds; integration 57.10 seconds; browser approximately 1.5 minutes; local Vite build 205 milliseconds. Total command wall time was not captured. |
| Packaged-skill stage of `npm run check` | ZIP extraction, fresh locked dependencies, documentation/contracts and 17/17 packaged CLI tests passed | CLI Vitest 39.59 seconds; full packaging wall time was not captured. |
| `npm run build:prod` | Hosted build and regenerated skill passed; no deployment | Vite 1.12 seconds; full npm command wall time was not captured. |
| `npm run schema:manifest:check`; `git diff --check`; local Markdown reference check | Passed; nine modified Markdown files and twenty-five local references checked | No test cases; command wall times were not captured. |

The coordinating agent reviewed rendered correction history at 375, 800 and 1280 pixels (`test-results/corrections-375.png`, `corrections-800.png`, `corrections-1280.png`): changed-value tables and long identities wrap within their containers, reasons remain readable and controls remain visible. Functional/keyboard/history/retry coverage passed separately in the browser suite. The current full browser gate includes import/recovery at all three widths and passed; the earlier concurrent denial remains a historical observation with unproven cause. Emulator logs still contain denied negative requests, including an expression-limit message during the malformed-entry/ownership test; no specific asserted request uniquely identifies that log message, and it is not claimed as dedicated oversized-payload coverage. All positive source/history workflows pass.

The hosted main JavaScript chunk remains above Vite's 500 kB advisory at 743.66 kB; compilation succeeds. Production services, production migration/deployment and Firefox/WebKit were not exercised. Application version remains 0.3.0; release preparation, including 0.4.0 and deployment, remains separate. Existing workspace edits were preserved. The prior six-currency rules-budget blocker is resolved by the proportional design, without a service, save splitting or capacity reduction.
