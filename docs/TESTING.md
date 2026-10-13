# Test responsibilities

The 14 October 2026 redesign preserves the original contracts in [the declaration map](../tests/contracts/baseline.json). Parameterized variants are grouped under their declaration; this map is not an executed-test count. Its unit check rejects missing destinations. New tests remain in the acceptance ledger; future replacement of a mapped contract must name its destination.

| Layer | Responsibility | Exclusions |
|---|---|---|
| Unit | Independently specified arithmetic, normalization, validation, filter/timeline state, error classification, fencing policy and preserving migration logic | DOM layout, real service admission and CLI subprocess wiring |
| Persistence/security | Actual source writes/reads, owner isolation, revisions, receipts, immutable corrections, fenced transfer/deletion and interrupted restoration | Responsive controls and presentation |
| CLI | Actual subprocess input, exit/error/JSON contracts, authenticated operations and website-equivalent reporting | DOM behavior; subprocess execution is not included in Vitest in-process coverage |
| Isolated browser | Production components/views with controlled data: fields/help, feedback, autocomplete, journal filters/history, workspace geometry and donation controls | Authentication and real writes; fixture rejects every emulator request |
| Application journey | Real application routes, drafts, navigation, writes/reload, import/deletion recovery and desktop/compact complete journals | Repetition of all financial permutations at every width |
| Maintenance browser | Global availability, retained drafts, schema mismatch and retry; sequential, after ordinary journeys even when they fail | Concurrent execution with ordinary journal cases |

## Commands

- `npm run test:unit -- <file> -t <name>`: focused unit checks without services.
- `npm run test:browser -- <file> --grep <name>`: isolated browser checks, four workers, no emulators.
- `npm run test:e2e -- <file> --grep <name>`: application/maintenance browser checks, sequential emulator-backed cases.
- `npm run test:integration -- <file> -t <name>` and `npm run test:cli -- -t <name>`: sequential emulator contracts.
- `npm run test:coverage`: unit then in-process integration coverage, separate reports under `coverage/unit` and `coverage/integration`.
- `VXJ_COVERAGE=1 npm run check`: final lint/documentation, unit, both browser categories, integration, local build and packaged-skill gate with coverage.

File/name selectors are forwarded unchanged. A browser selector may match only one phase; an empty phase is reported as skipped, never as passing evidence. Zero executed cases across the selected suite fails. Ordinary-browser failure does not suppress maintenance cases; the runner retains a nonzero outcome. Interruption or infrastructure startup failure stops services. CI and local Playwright runs have zero automatic retries.

## Fixtures and scope

Ordinary application cases use verified synthetic users created through automated emulator APIs and programmatic sign-in. Accounts use shared normalization; financial browser data uses shared trade preparation. Each test owns its journal and removes only its user graph and authentication identity. Dedicated authentication coverage exercises registration, verification, first account and subsequent UI sign-in. Development and production projects/ports are rejected by fixture administration. No parallel case performs a database-wide reset.

The isolated harness imports production presentation modules without application authentication. Controlled adapters supply data and operation observations rather than duplicating business calculations. Application-level acknowledgement/read failures retain explicit injection where the complete lifecycle is the tested contract.

Complete journal journeys retain desktop and compact variants. Account lifecycle, correction, confirmed-save recovery, leg-removal and execution-validation operations run once; responsive coverage belongs to prepared account/field/feedback/history fixtures and existing dense-form layouts. Lower-layer permutations, independent currency expectations, stale revisions and explicit competing-owner regressions remain intact. CLI scenarios are grouped by authentication, records, reporting and transfers; creation/retry, fill rejection and correction/export are separate cases with fresh prerequisites.

Timers use controlled clocks. Captures use test-specific output directories and remain manual-review artifacts, not screenshot-comparison acceptance. Geometry, keyboard focus, accessible names/descriptions and polite status checks provide separate automated evidence.

## Coverage interpretation and verification limits

Coverage reports include uncovered first-party source and database administration modules. Global percentages therefore include browser-only modules at zero; they do not establish total application coverage. Evaluate domain, persistence and migration modules with their owning layer's report and acceptance contracts. CLI child-process execution and actual assistive-technology behavior need distinct evidence. Packaged CLI acceptance explicitly disables inherited coverage instrumentation, preserving the owning in-process integration report. No blanket percentage threshold is introduced.

Initial measurement identified missing short-target sizing, validation-context/error-preservation, lease-renewal scheduling and schema-2 correction validation branches; independent focused unit cases were added. Fake-clock lease tests verify checkpoint preservation, no overlapping renewal, shutdown waiting and secondary renewal failure retention. Schema graph checks cover valid history preservation, orphan paths, mismatched correction identity, future history revisions and stale snapshot metadata. Other uncovered branches must be evaluated by contract relevance, not filled with implementation-mirroring assertions. Frozen migration dependencies remain unchanged. Final measurements and remaining gaps belong in [VALIDATION.md](VALIDATION.md).

Previous concurrent browser permission denials remain unresolved historical evidence. Serializing unrelated backend journeys is an execution policy, not proof of their cause or a production fix. Explicit owner/concurrency contracts remain covered independently. Real iPad browser chrome, native Safari controls and actual screen-reader output still require device confirmation.

Verification is bounded: affected checks first, one final accumulated gate, one focused rerun per failure signature. Recurring emulator denials are recorded and stop investigation. A failed gate never becomes passing through skipped tests, retry masking, altered ownership rules or an emulator-version experiment.
