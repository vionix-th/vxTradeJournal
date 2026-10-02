# Local prototype validation

Validated on 1 October 2026. Application version: `0.1.0`. Hosted deployment and release publication remain separate work after prototype review, as specified in [PRD delivery defaults](PRD.md#5-delivery-and-release-defaults).

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

Development data persists only after graceful emulator shutdown. JSON export provides a portable source-record copy; import remains deferred. Architecture and implementation choices appear in [DECISIONS.md](DECISIONS.md); routine commands and synthetic login appear in [README.md](../README.md).

## Production Firebase preparation — 1 October 2026

Authenticated CLI queries confirm `vionixtradejournal` / project number `389058969816` and the default free-tier Firestore database in `asia-east1`. Registered a production web app and retrieved its public SDK configuration. Hosted builds now use online services; local builds use demo-ID emulators. Hosting configuration serves only `dist-prod/`.

`worker-m` confirmed the new configuration tests fail before implementation because the configuration module is absent, then pass 3/3 after implementation. Full unit tests pass 39/39 and emulator integration tests pass 15/15. Browser tests pass 12/14; two tooltip tests in `tests/e2e/tooltips.spec.js` fail at 1280 and 375 pixels because the expected “About Instrument name” button is absent. These failures remain unresolved and prevent claiming complete release validation.

Lint, local build and production build pass. Bundle inspection confirms `vionixtradejournal` with emulators disabled in `dist-prod/`, and `demo-vxjournal-dev` with emulators enabled in `dist/`. An explicit local-profile override of a hosted build fails with “Hosted builds require the prod profile.” Firebase Hosting configuration parses successfully. Builds retain Vite's >500 kB chunk advisory.

No Hosting release or Firestore rules deployment was performed. Real email delivery, production Authentication domain configuration and hosted persistence have not yet been exercised. Preparation does not establish release readiness or create a release tag.
