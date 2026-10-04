# Development decisions

## 2026-10-05 — Reduce routine test workload

Revise the [website/CLI/skill maintenance decision](#2026-10-02--maintain-website-cli-and-skill-together) and acceptance-gate frequency: keep worker-m delegation, but use focused failing/passing checks and affected final coverage, reusing results while tested inputs remain unchanged. Complete checks run before integrating an accumulated batch into main and for releases; fresh skill installation is required for packaging, runtime dependencies and installation guidance, not every shared behavior edit. Preserve independent financial expectations, interface parity and release coverage. Forward integration/CLI filters, reject zero executed tests and make CLI scenarios self-contained. This reduces routine execution while accepting that unrelated regressions may be discovered at the next integration gate. Browser fixture migration, emulator reuse, dependency caching and concurrency tuning remain separate work. [PRD verification selection](PRD.md#verification-selection-and-checkpoints) defines the command matrix and escalation rules.

## 2026-10-05 — Restrict credential input and complete acceptance evidence

Reject login/registration credential paths before filesystem access with the existing INVALID_INPUT contract. Preserve stdin and hidden prompts, journal JSON file input and refresh-only session storage. Command summaries and generated skill guidance expose the restriction without changing JSON shapes. Close concrete acceptance evidence gaps with CLI receipt reads, preview mismatch rejection, profile/project session isolation, draft readiness, independently specified sizing/scaled fills, and browser short partial covers. These are tests of established behavior, not new product features. [ACCEPTANCE.md](ACCEPTANCE.md) records requirements, evidence and verification limits; final check/build and remote synchronization complete the bounded remediation.

## 2026-10-05 — Use the current planning component contract

Remove the unused alternate field collection and optional-method fallback. Every leg block owns its planning fields, and shared field components provide setError. Existing planning-validation and component-contract tests verify unchanged behavior; no compatibility layer or implementation-mirroring test is added.

## 2026-10-05 — Keep invalid execution rates reachable

Use the existing domain decimal rule for live result-rate feedback. Foreign invalid input remains visible with the shared field's error association after switching a closing record to Entry. Preserve supplied values; matching-currency rates remain automatic one. Website/CLI still reject invalid source input, with browser keyboard correction and CLI no-write/corrected-value regressions.

## 2026-10-05 — Expose eligible persisted leg removal

Use the edit session's immutable execution history and current leg count to own removal eligibility and its UI explanation. Show removal for historical and new legs, retain at least one, and protect executed legs. Shared replacement/removal operations and transaction validation remain authoritative. Browser and CLI regressions verify identical prerequisites, including reductions of oversized retained records.

## 2026-10-05 — Preserve confirmed writes across refresh failure

Supersede the retained-session decision's refresh-failure Save retry: the application now owns pending completion after a write resolves, retaining saved result, callback, editor identity and authentication generation. Failed reads show a recovery screen and block ordinary navigation through the lifecycle's injected guard. Retry loads data without rerunning the write; successful refresh clears pending state before one completion. Recovery Sign out bypasses only that navigation block, preserving operation/restoration guards and confirmation for an unsaved parent. Authentication reset invalidates stale callbacks. Pre-confirmation write errors still retain editable content and existing receipt/conflict semantics.

## 2026-10-05 — Retire discarded composite sessions explicitly

Extend the retained-session and route-policy decisions with a discard transition. Match session object identity, collect aliases and descendants before rewriting them, and preserve history markers and independent sessions. Ordinary navigation, accepted browser departure and top-level Cancel reconstruct clean editors; explicit child suspension/return preserves parent state. Successful reload retires aliases after its read, while failed reload and rejected departure change nothing. Existing editors resolve current data by ID rather than a stale record fallback.

## 2026-10-05 — Reconcile unsaved snapshots during context refresh

Retained edit sessions refresh catalogue snapshots only for legs absent from their immutable base record. Preserve raw planning and disclosures, use shared instrument normalization, and apply existing currency-pair rate transitions. Missing, archived or draft selections remain visible and cannot save. Historical legs continue using their stored snapshots. Browser preview and shared new-leg operations now agree after inline catalogue refresh without changing persisted contracts.

## 2026-10-05 — Assign canonical metadata before trade projection

Prepare trades from one repository-owned parent metadata envelope inside the transaction. Creation time is immutable and assigned before calculating the opening-date cache; an actual entry still takes precedence. Keep request fingerprints on original input and receipt/revision checks unchanged. This fixes website/CLI date filtering, replay and export agreement without a schema change. Remediation uses disposable test data, so no retained-record repair is required. Track acceptance in [ACCEPTANCE.md](ACCEPTANCE.md).

## 2026-10-05 — Restore native cursors and isolate fallback history ledgers

Supersede the 2026-10-04 unknown-fragment repair: copying the active marker onto another physical history slot produced duplicate indexes and could turn a rejected Back into `history.go(0)`, which reloads. One reconciliation path now handles actual browser state for both popstate and queued hashchange. Native entry keys restore the physical cursor without replacing controls or suspended drafts. Recovery callbacks belong to their authentication session, ledger epoch and active entry; rejected native recovery rebases once and releases the guard.

Without native traversal, use a nonzero delta only between trusted entries in the current ledger. A queued Back can move the cursor again before the relative return executes; allow one corrective return from its observed landing slot, then rebase on failure, with a one-second bound for stalled classic recovery. Unknown entries require a fresh key and ledger epoch on the selected physical slot; preserve live controls, parent references, dirty state and operation locks. Classic History cannot determine that slot's distance from an unindexed origin, so this fallback preserves drafts and subsequent managed navigation but cannot promise the original physical cursor. Record that exception in the PRD. These mechanics are browser-only; CLI contracts remain unchanged.

## 2026-10-05 — Connect route policies to the editor lifecycle

Complete the 2026-10-04 route-policy decision: descriptors now invoke actual renderers and own save, cancel, refresh and completed-editor identity. The application delegates transitions to the lifecycle; editors supply persistence actions without destination callbacks. Completion retires matching cached editors and their suspended descendants while preserving unrelated drafts. Replacement is explicit for saves, parent returns and mutation refreshes, rather than inferred from an operation lock. Browser regressions exercise real catalogue retirement and nested trade workflows.

## 2026-10-04 — Reconcile unknown fragments without guessing history direction

Dirty editors reject foreign hash navigation while preserving live controls and draft state. The lifecycle replaces the transient fragment with the active application route and restores its managed navigation state; it does not infer Back versus Forward, push duplicate entries or leave a restoration lock set. This fallback preserves the editor and subsequent managed history on browsers exposing only the classic History API.

## 2026-10-04 — Restore focus by stable record identity

Record actions expose stable focus keys derived from their parent and record IDs. Editor cancellation restores that key before falling back to the existing contextual match for generic actions. Duplicate labels therefore remain independently addressable across adjustment, execution and snapshot workflows.

## 2026-10-04 — Snapshot cancellation returns to the invoking trade

Snapshot correction is a child workflow of the trade view. Cancel returns to that trade, reopens the corrected leg's snapshot disclosure and restores the invoking correction control. The correction editor remains reusable for ordinary catalogue editing; only its explicit parent context changes the destination.

## 2026-10-04 — Keep invalid planning controls reachable

Planning validation exposes stable field paths while retaining existing error names and messages. Editors keep supplied combined and per-leg values visible when applicability changes, attach errors to their controls and preserve raw input until correction. This avoids hidden invalid state blocking a save and keeps website feedback aligned with CLI/domain validation.

## 2026-10-04 — Give editor routes one lifecycle policy

Route descriptors own rendering, navigation section, refresh/cancel/completion destinations and completed-editor identity. Lifecycle methods execute cancellation, parent return, completion and retirement; editors supply saved data rather than repeat navigation callbacks. History replacement is explicit instead of depending on a pending-operation flag. A confirmed refresh discards a new trade session, while refreshing a persisted trade editor returns to its current saved trade. Keep browser mechanics in the lifecycle and raw composite state in its edit session.

## 2026-10-04 — Own composite trade drafts in retained edit sessions

A detached trade editor session owns immutable source history, raw editable values, leg identities, disclosure state and the save operation ID. Controls send explicit updates; rendering and inline catalogue creation reuse the session rather than reconstructing submitted state from markup. Keep absent historical planning keys absent during context-only edits, and emit null when an existing value is cleared. Shared application operations still construct and validate domain records. This preserves idempotent retries after a committed write followed by a failed refresh without expanding simple catalogue editors into a general state framework.

## 2026-10-04 — Bound atomic trade creation to verified capacity

Limit new trades and additions to six legs in shared operations, persistence preparation, CLI contracts and the editor. Emulator probes cover distinct instruments, a strategy, first-account locking, entry/exit history, snapshot correction and cascading deletion: six passes; eight and higher fail rules service-call limits. Six is a conservative verified capacity, not an asserted exact platform ceiling. Preserve earlier larger records for calculation, corrections and reductions without expansion. Keep atomic writes and ownership checks; no schema conversion or reset is required.

## 2026-10-04 — Share currency-pair editing transitions

One pure UI transition determines the pair, retained rate and automatic/manual state for planning, fee and adjustment controls and fixed result-currency controls. An unchanged foreign pair retains its rate, a changed foreign pair clears it, and matching currencies use one. Domain conversion and save validation remain authoritative and independent of the DOM.

## 2026-10-04 — Share recent catalogue ordering

Website and CLI use one pure instrument selector ordered by the latest linked trade activity, with instrument name as a deterministic tie breaker. Adapters provide source references; the selector leaves input arrays intact. This removes duplicated ordering policy while retaining filtering and read contracts.

## 2026-10-04 — Validate planned quantity increments

Apply the same snapshot quantity increment to supplied plans and actual fills. Empty plans remain optional, fractional quantities remain valid for fractional increments, and explicit snapshot corrections reject plans that would become invalid. Website and CLI share the domain check; rejected writes leave records and receipts unchanged.

## 2026-10-04 — Expose field and disclosure interaction contracts

Shared native form components expose explicit controls, content, visibility, unit and error handles. Control attributes and container attributes have separate owners. Errors update accessible associations without replacing help or units, and disclosure content no longer depends on child positions. Migrate callers together rather than retaining a flat-options compatibility layer. This keeps native form submission and keyboard behavior while isolating markup changes from editor logic.

## 2026-10-04 — Make mutation and preparation guarantees explicit

All shared trade mutations return detached, fully replay-valid source records without derived caches. Complete validation includes execution ordering, position history and adjustments; keep structural prerequisites private. Preparation returns the persistence projection and full calculation together so CLI previews reuse the calculation. Repository saves still check fresh references and replay at the transaction boundary. This preserves financial and external JSON contracts while giving callers consistent guarantees.

## 2026-10-04 — Give new legs one construction contract

Use a pure leg factory for initial trade creation and later leg additions. Normalize catalogue snapshots once, detach snapshots and planning from caller state, and accept caller IDs before construction. Preserve deterministic fallback IDs and leave historical legs intact. This consolidates shared model creation for website and CLI without changing persisted shapes.

## 2026-10-04 — Share unsaved preference defaults

Use one application factory for default preferences in individual repository reads and full journal loads. Both return the same complete preferences identity and values, including exports before the first settings save. Each call returns detached state. This removes duplicated defaults without changing saved records.

## 2026-10-04 — Repair audit findings with shared boundaries and editor ownership

Extend the [currency editing decision](#2026-10-01--currency-editing-and-compact-mobile-journal): snapshot currency corrections invalidate the corrected leg's sizing and realized-result rates, preserve independent fee rates, and set `1` only when currencies match. Website and CLI retain one shared correction implementation and matching preview/replay/export expectations. Enforce immutable existing leg instrument references in application validation and Firestore rules while retaining explicit snapshot corrections.

Extend the [time validation decision](#2026-10-01--time-and-read-consistency) with one calendar-date predicate for timestamps, instrument expiry and CLI opening-date filters. Remove the unused, stale JSDoc contract module rather than introducing a project-wide type migration.

Extend the [native UI decision](#2026-10-01--local-prototype-implementation) with one editor/navigation lifecycle: captured saves lock editing and departure, nested instrument creation owns a suspended parent draft, and browser history uses the same departure guard. Retire cached trade drafts and their nested callbacks after successful save, and clear private history arguments at authentication transitions. Restore invoking focus after cancellation. Reuse existing unit descriptions for execution prices and preserve strategy information at intermediate widths. Keep schema/calculation versions and release version unchanged; these fixes need no data conversion and are not release preparation.

## 2026-10-02 — Distribute the skill through the website

Extend the [skill maintenance contract](#2026-10-02--maintain-website-cli-and-skill-together): local and hosted website builds first generate the portable skill and a versioned ZIP, then Vite includes the exact archive as a downloadable asset. Development serving prepares the same archive. Use the build-only fflate dependency for ZIP creation and extraction tests; ship the installable folder and locked dependency manifest without node_modules or sessions. Sort archive entries and fix ZIP container timestamps so unchanged file contents produce identical ZIP bytes across rebuilds. Offer public sign-in and signed-in Session download links with installation instructions. Revalidate download responses because development artifacts can change before the release version changes. Portable-install tests now extract the ZIP users receive.

## 2026-10-02 — Maintain website, CLI and skill together

Extend the [agent CLI decision](#2026-10-01--agent-cli-and-portable-skill) with an explicit capability-parity contract in AGENTS.md and PRD 1.4. Each affected workflow assesses both interfaces and updates command contracts, guidance and acceptance coverage together; intentional capability exclusions belong in the PRD. Generate command inventory from the runtime catalogue and validate documented shell examples without executing them. Include documentation and portable-install checks in `npm run check` and require the packaged skill for each application release. Installed skills remain versioned snapshots upgraded by replacing the distribution and reinstalling locked dependencies; keep runtime guidance independent of repository maintenance files.

## 2026-10-01 — Agent CLI and portable skill

Expose website-equivalent journal operations through a Node.js CLI that reuses application operations, calculations and Firebase persistence. Maintain authored skill guidance under `skills/vx-trade-journal`; generate the portable installable distribution at `dist-skill/vx-trade-journal`. Bundle project-owned JavaScript and install runtime dependencies with npm so the installed skill works outside the source repository. Use Firebase user refresh tokens in profile-separated private files; do not persist passwords or ID tokens. CLI mutations require stable IDs/revisions and trade operation IDs, with explicit dry-run and snapshot preview flows. Do not create a server API, admin capability, import workflow or billing-dependent service for this interface. Recover stale locks through an explicit safe error rather than racy automatic deletion.

## 2026-10-01 — Local prototype implementation

Use native JavaScript ES modules and semantic HTML with reusable form builders. The first-release editors and journal do not require framework lifecycle or routing abstractions; Vite supplies development and static build tooling. Keep domain calculations and application validation independent of Firebase and the DOM. Financial values use decimal.js with 40 significant digits, persisted decimal strings, and display-only monetary rounding.

Use per-user collections, child collections for trade legs/executions/adjustments, immutable instrument/strategy snapshots, and a revision-checked parent trade transaction with durable operation receipts. This preserves correction history, idempotent retries and conflict detection without a server API. Local demo profiles separate development, interactive test and automated test services. Hosted deployment follows prototype review.

## 2026-10-01 — Bounded caches and historical context

Persist only compact trade summaries; execution histories remain in child collections and are replayed for detail views. New strategy links capture current definitions. Existing links reject implicit snapshot changes, preserving prior rules. Instrument snapshot corrections are explicit and preview recalculated outcomes before save.

## 2026-10-01 — Local emulator durability

Development and interactive test profiles import/export their own emulator data on graceful shutdown. Automated tests use a third disposable profile and serialized integration files to prevent concurrent `clearFirestore` calls from racing. Seed/reset commands operate only on the development demo project and restore fixed synthetic records.

## 2026-10-01 — Time and read consistency

Opening-date filters use the configured display timezone; stored source timestamps remain UTC. Reject impossible calendar dates, invalid rates and non-integral sequence values. A trade read checks parent revision before and after fetching child collections and retries concurrent changes, preventing mixed source snapshots during correction or export.

## 2026-10-01 — Dependency patch and build identification

Override Firestore's pinned gRPC client with compatible patched 1.13.6 after reviewing [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) and [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4). Keep Firebase CLI's separately patched dependency version. Verify emulator integration after changing the transport. Local builds identify uncommitted changes with a `-dirty` commit suffix; no release tag or hosted deployment is created by prototype development.

## 2026-10-01 — Currency editing and compact mobile journal

Conversion fields belong to their source currency. Changing that currency clears a foreign rate; same-currency conversion alone automatically becomes `1`. Editing a record with missing foreign conversion preserves the missing value. This prevents implicit FX assumptions for execution fees and cash adjustments.

Keep search/account selection visible and progressively disclose advanced journal filters. Collapse mobile session controls behind a keyboard-accessible native details element. This preserves all mobile functionality while placing journal records earlier on the page.

### 2026-10-01 — Rebuild the application visual system

Replace the initial sparse presentation with a compact workspace: dark navigation rail, self-hosted Inter, restrained indigo accent, shared surface/control tokens and responsive trade history. Keep existing native controls, accessible labels and workflows. The journal overview shows actual open/closed counts and complete realized results scoped to a selected account (or the sole account); multiple accounts never receive a combined monetary total. Advanced filters use a native disclosure to reduce default visual density. Sign-in and all editors share the same typography and controls. This implements the PRD's restrained visual style and numeric hierarchy without adding deferred analytics or changing persistence/calculation contracts.

### 2026-10-01 — Give page and section layouts explicit spacing ownership

Follow the visual-system rebuild above with shared page stacks and section heading/body contracts. Parent gaps now separate pages, panels and grid cards; remove sibling margins that offset catalogue cards and double row spacing. Catalogue edit actions share the heading row; strategy links and journal notes use bounded subsections. Editor headings align to the page gutter, with fields in a separate panel and save actions in one footer. Preserve control labels, workflows and data contracts. Browser regression coverage verifies card alignment, search separation and mobile overflow with varying title lengths.

### 2026-10-01 — Make trade planning optional and quotation units explicit

Follow the spacing decision above with accessible leg fieldsets and native Trade plan/Position sizing disclosures. Short labels describe inputs; separate visible units also supply accessible descriptions. Empty plans collapse, saved values open, and stable leg IDs preserve disclosure state through inline catalogue creation and leg changes. Incomplete sizing inputs receive guidance; supplied invalid values receive validation. Manual and multi-leg quantities remain manual.

Add optional editable `priceUnit` (trimmed text, maximum 80 characters) to instruments and snapshots. Presets leave it blank because quotation conventions cannot safely be inferred from instrument type. Missing units remain explicit and do not block use; catalogue edits preserve historical snapshots. This additive presentation metadata requires no backfill, schema/calculation version change or data reset. Currency-pair changes clear foreign sizing rates; matching currencies always use 1. Accounting formulas and precision remain unchanged.

### 2026-10-01 — Record production Firebase project provisioning

The production Firebase project has been created with Hosting, email/password Authentication and the default Firestore database on the Spark plan. The supplied numeric identifier `389058969816` is the Firebase project number. `vionix-trade-journal` is the supplied display name; verify the distinct project ID with `firebase projects:list` after login. Keep local profiles on `demo-*` IDs and add a separate hosted build profile that connects to the online project. Production is not an emulator target.

The repository includes `firebase-tools` as a dev dependency, so use `npx firebase` (or `npm exec firebase`) after `npm install`; a global CLI install is unnecessary. Authenticate the CLI with `npx firebase login`, verify with `npx firebase login:list`, and target the verified project ID explicitly or through a checked-in `.firebaserc` alias. Deploy the production static output to Hosting and deploy `firestore.rules` separately. The browser production build must use the registered Firebase web app configuration and must not call `connectAuthEmulator` or `connectFirestoreEmulator`.

For the initial hosted release, use static Firebase Hosting with the browser Firebase SDK, Firebase Authentication and the existing Firestore rules. Stay within Spark's no-cost quotas: Hosting includes 10 GB stored content and 10 GB/month transfer; Firestore includes 1 GiB stored data, 50,000 reads/day, 20,000 writes/day and 20,000 deletes/day. Exceeding applicable Spark quota disables that product for the remainder of the billing period rather than charging overage. Avoid Cloud Functions, Cloud Run, Cloud Storage, phone authentication and other billing-required services unless a later decision explicitly accepts moving the project to Blaze. Review actual console quotas before public launch because Firebase limits may change.

### 2026-10-01 — Prepare the verified production project

Follow the provisioning decision above: authenticated CLI inspection confirms project ID `vionixtradejournal`, display name `vionix-trade-journal`, number `389058969816`, and a free-tier default database in `asia-east1`. Register the `vxTradeJournal` web app (`1:389058969816:web:b675d1a1ca458f1c0c97ad`) and store its public SDK configuration. Add an explicit hosted build profile and production alias/config. Shared environment resolution keeps local profiles on demo IDs; only production uses the hosted project. Serve production from `dist-prod/` so a local emulator-backed build cannot accidentally replace the hosted artifact. Verification guidance reflects real email delivery in production.

Preparation does not publish a release or change deployed Firestore rules. Production build/preview/deploy commands are documented; release checks and hosted workflow verification remain required for publication. Correct the earlier quota wording: Firestore daily operations reset daily, Hosting transfer monthly, and stored capacity does not reset. No billing-required service is provisioned.

### 2026-10-01 — Add accessible label explanations to instrument and trade editors

Give field and checkbox labels optional tooltip content owned by the shared form primitive. Instrument and trade editors supply concise explanations of quotation conventions, increments, calculation models and planning inputs. Hovering the label, focusing its help button or tapping it exposes the same text; Escape dismisses help, and pointer entry into the tooltip keeps it readable. Tooltip positioning stays within the viewport. Preserve existing accessible labels, visible units, field values and persistence/calculation behavior. Native title-only help was rejected because it does not provide consistent keyboard or touch access.
