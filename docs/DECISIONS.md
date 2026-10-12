# Development decisions

## 2026-10-13 — Integrate sidebar toggle into the workspace bar

Refine [viewport-owned shell](#2026-10-13--let-the-application-shell-own-viewport-height): place collapse/expand before the workspace breadcrumb in the existing main header. Remove the standalone sidebar control row to reclaim vertical space and keep publisher identity first. Retain the 44px target, local preference and mobile exclusion; use main-header theme tokens. The workspace bar continues scrolling with main content.

## 2026-10-13 — Let the application shell own viewport height

Use a viewport-sized Grid shell above 700px, with naturally stretched sidebar and independently scrolling main/sidebar regions. This matches persistent application navigation and avoids coupling footer position to document length. Add an explicit, locally remembered 224px/64px collapse preference; retain compact document-scrolling navigation on smaller screens. Transfer scroll position across the breakpoint and preserve live editor DOM, drafts and focus. This changes website scroll ownership, so targeted layout, navigation and accessibility coverage is required; automated execution is deferred at the user’s request. CLI, persistence and financial contracts remain unchanged.

## 2026-10-11 — Release wallet support as 0.6.0

Publish native wallet address links, expanded cryptocurrency destinations, alphabetical network selection and clearer donation controls as `0.6.0`. These are compatible website-only support additions; journal schema `2`, calculation version `1`, CLI/data contracts and persistence rules remain unchanged, with no conversion required. Verify the complete release and portable skill, then publish website and skill from the same tested clean commit through guarded deployment and annotated `v0.6.0` tag. Wallet handoff availability depends on the donor's installed wallet; QR and clipboard preserve raw addresses.

## 2026-10-10 — Release crypto support as 0.5.0

Publish the approved crypto donation selector, address QR and clipboard interaction as `0.5.0`. This is website-only support presentation; journal schema `2`, calculation version `1`, user records and persistence rules remain unchanged, with no conversion required. Verify the complete release and portable skill, then use guarded deployment with unchanged rules/schema. Publish website and skill from the same tested clean commit and annotated `v0.5.0` tag.

## 2026-10-10 — Release correction history and schema 2 as 0.4.0

Publish proportional correction history, structured validation/write outcomes and portable verification as `0.4.0`. Persistence impact is the registered schema-1-to-2 transition and matching rules; calculation version remains `1`. The immutable transition updates managed record and embedded snapshot schema markers while preserving source values, identities, historical timestamps and receipts. Guard production conversion with exclusive maintenance, the rules propagation barrier, a verified private source snapshot and complete target validation. Publish website and skill from the same tested clean commit with annotated `v0.4.0`; replace installed skills and reinstall their locked dependencies before schema-2 workflows. A schema-1 application-only rollback is incompatible after conversion; recovery uses the retained source snapshot and guarded procedure.

## 2026-10-09 — Group journal data actions in Settings

Group Export JSON and Import journal and recovery under Journal data, using matching secondary buttons and the shared wrapping action layout aligned right. Keep Save settings primary to distinguish preference persistence from data transfer. Preserve export/import handlers, keyboard activation, CLI contracts and financial behavior; no version change is required. Add focused layout and keyboard coverage at 320, 910 and 1280 pixels.

## 2026-10-09 — Release portable import and recovery as 0.3.0

Publish portable journal import/recovery, website navigation and project/support UI, and updated skill contracts as `0.3.0`. Persistence impact is compatible user-scoped transfer/recovery additions and changed rules; journal schema and calculation versions remain `1`, with no existing-record conversion. Use complete worker verification and a clean-commit hosted build, then guarded production deployment with enforced maintenance and rule propagation. Publish the website and portable skill from the same commit and immutable annotated `v0.3.0` tag. Installed skills require replacement and locked dependency installation to obtain import/recovery commands. Branding acceptance derives its expected application version from the package manifest so release increments do not invalidate the UI contract.

## 2026-10-09 — Make verification proportional to risk

Supersede the mandatory stage and delegation rules in [Reduce routine test workload](#2026-10-05--reduce-routine-test-workload). Require the smallest intended failing regression for bug fixes and focused failing coverage before changes to financial calculations, ownership enforcement or migration invariants; syntax, fixture and environment failures do not qualify. Other changes use focused post-implementation checks and add tests only for observable coverage gaps. A passing run covering the final implementation satisfies completion; rerun only checks affected by subsequent edits. Expand coverage for concrete dependencies, failures or identified unknowns, with a stated reason and boundary; retain complete batch-integration and release gates.

Run focused unit and documentation checks directly; delegate emulator, browser, packaged-skill and complete verification to one reusable `worker-m` for related sequential runs. Keep selection, test design, implementation and evaluation with the orchestrator. Cap routine output and report counts, outcomes, elapsed time, material omissions and applicable failure proof without claiming measured token savings. Preserve independent financial expectations, interface parity and release safeguards. Focused verification defers unrelated regression discovery to integration gates. This changes governance only; command contracts, runtime behavior and historical validation records remain unchanged.

## 2026-10-09 — Place Reload records before project information

Refine the compact More menu from the preceding Session merge: order Settings, Reload records, About and Support above session identity/sign-out/download. Move the existing Reload control between the compact action group and its original desktop session position so pointer and keyboard order agree. Preserve reload guards, dismissal and responsive focus restoration; website presentation only.

## 2026-10-08 — Portable import with explicit add and replacement modes

Offer identical website/CLI previews and recovery operations. Add-only skips identical IDs and rejects conflicts; replacement requires explicit confirmation and retains a private recovery snapshot until deletion. Source settings are opt-in and all ownership is rebound to the authenticated destination. Share pure schema validation and adjacent transformations, while keeping Admin deployment persistence separate. Durable source upload precedes user-scoped ownership; fenced checkpoints, target verification and rollback protect interrupted imports without requiring the original file. Apply one journal record per transaction after emulator evidence showed combined record validation exceeded the Firestore expression budget. Persisted schema/calculation remain 1; administrative records and rule changes require guarded publication but no financial conversion.

## 2026-10-08 — Merge compact Session controls into More

Extend the compact workspace More decision below by grouping identity, reload, sign-out and skill download in the same disclosure after project actions. Remove the separate compact Session trigger and move the same session controls between More and the desktop footer; preserve action handlers and unsaved-draft guards. Bound the taller disclosure to the viewport with internal scrolling and restore visible focus across responsive moves. Desktop session controls remain directly accessible. This changes website navigation only, with no CLI, persistence or calculation contract changes.

## 2026-10-08 — Compact workspace More menu

At the existing 700px compact-navigation breakpoint, replace Settings with More and move Settings, About and Support into a native auto popover. Reuse the same action controls across responsive layouts, preserve Settings navigation guards, and return project-dialog focus to More on compact screens. Keep desktop footer actions and sign-in actions. This supersedes the always-visible workspace project-action row in the preceding project-dialog decisions for compact widths only; CLI, persistence and calculation contracts are unchanged.

## 2026-10-08 — Keep application version in About

Remove the version and commit paragraph from the signed-in Session sidebar to keep routine workspace controls focused. About retains the website application version. Preserve the skill ZIP link, project actions and build/CLI metadata; no schema or application version change is required.

## 2026-10-08 — Release guarded database operations as 0.2.0

Release database availability guards, preserving development upgrades and guarded production deployment as `0.2.0`. Persistence impact is a rules change plus compatible control-metadata additions; journal schema and calculation versions remain `1`, with no source-record conversion. The first production rollout explicitly registers validated existing schema-1 data under maintenance with a private recovery snapshot and the rules propagation barrier. Build the website and portable skill from the same tested clean commit; publish an immutable annotated `v0.2.0` tag after successful deployment. Installed skills require replacement and locked dependency installation to receive the new availability guards.

## 2026-10-08 — Trial authored text sizing on iOS Safari

Set `-webkit-text-size-adjust: 100%` and `text-size-adjust: 100%` on the existing HTML root as a reversible trial for the reported enlarged appearance on fresh iOS Safari loads. Normalize automatic text inflation without changing authored font sizes, viewport configuration or focus behavior; retain user zoom. The root cause and actual iOS effect remain unverified. This presentation-only trial leaves CLI behavior and application versions unchanged.

## 2026-10-08 — Automate preserving development schema evolution

Supersede the development-startup recovery decision below: requiring a second-terminal initialization step is unnecessary friction for retained emulator data. Development startup automatically captures private recovery snapshots, validates schema-1 legacy records and composes adjacent migrations under fenced maintenance. Empty databases receive the required schema; missing metadata never implies current compatibility. Matching expired emulator upgrade runs resume automatically, while production retains explicit resume/build identity checks. Handled emulator failures expire their own lease without clearing checkpoints or reopening data; shutdown checkpoints conversion before export.

Rename the optional operator action to `database:upgrade` and production baseline flag to `--register-existing-schema 1`. Both preserve existing journal data. Reject the ambiguous legacy spellings with guidance rather than interpreting them as reset instructions. Destructive clearing remains explicit `data:reset`; restore continues to replace journal contents only through snapshot verification and `--yes`. Application, schema and calculation versions remain unchanged.

## 2026-10-08 — Preserve development startup for retained uninitialized data

Follow the database evolution decision: missing metadata still requires explicit, snapshot-backed baseline initialization. Treat this state as recoverable during development startup rather than terminating Firebase and Vite. Keep operator services available and print the profile-specific command while persistence guards block journal access. Propagate other initialization failures as nonzero exits after graceful emulator export. Keep shutdown idempotent under repeated interrupts and await child completion, so wrappers cannot exit before Firebase exports retained state. This preserves retained data and removes the manual Firebase startup workaround without automatically assigning a schema.

## 2026-10-08 — Govern live schema evolution through deployment

Extend the [initial production release](#2026-10-07--publish-the-initial-development-release) with an explicit schema-1 baseline and immutable adjacent database migrations, independent of application releases. Require schema equality for installed skills and persistence-enforced maintenance for conversion; retain authentication/diagnostics access. Compose transitions rather than maintain direct migrations from every old version. Keep Spark through private local snapshots and privileged ADC operator tooling, including fenced resume and exact journal restore. Failed deployments stay unavailable until verified recovery. The initial change supplies infrastructure and synthetic migration tests, not a new production schema. Existing installed skills must be replaced before the first schema transition because old binaries cannot gain this guard retroactively. Accept local backup responsibility and a ten-minute propagation barrier for changed rules in exchange for avoiding billing services and browser compatibility infrastructure.

## 2026-10-07 — Publish the initial development release

Publish the existing `0.1.0` application as the initial development release on Firebase Hosting project `vionixtradejournal`, together with the current ownership rules and downloadable skill from the same clean source commit. Retain the development version because this is the first numbered publication; production deployment does not establish stable `1.0.0` acceptance. Require complete worker-m verification and a hosted build before publication, then create an immutable annotated `v0.1.0` tag. No schema conversion is required. Verify public hosted assets after deployment; emulator coverage does not establish real email delivery or authenticated hosted persistence.

## 2026-10-07 — Keep skill installation guidance outside the sidebar

Revise the [website distribution decision](#2026-10-02--distribute-the-skill-through-the-website): keep the signed-in Session skill panel limited to its ZIP download link. Retain runtime and installation guidance on the sign-in screen and in the existing installation documentation. This removes documentation from routine workspace navigation without changing the skill archive, download contract or CLI behavior.

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

## 2026-10-08 — Publisher attribution

Keep product identity separate from the Vionix publisher link. Expose About through native disclosure on sign-in and in the workspace so reading project information does not navigate away from an editor or discard a draft. Bundle the publisher logo locally. Target `vionix-th/vxTradeJournal` for planned public GitHub access; publication and license selection remain separate from attribution. Keep current palette and financial/CLI contracts.

## 2026-10-08 — Optional Ko-fi support

Use a native app-themed dialog for the official vionixconsulting Tip Panel, loaded only on explicit support actions and removed on close. Keep a persistent new-tab fallback; provider failures and frame events never establish payment completion. No vendor script runs in the parent page, no journal data is passed to the frame, and the referrer is suppressed. One-time/monthly contributions do not grant privileges. This is website-only presentation; CLI and persisted/financial contracts remain unchanged. No shared hosted page, webhook or new runtime dependency is needed. Ko-fi form styling and account configuration remain provider-owned; automated live probing currently receives HTTP403, so actual monthly/payment entry remains unverified.

## 2026-10-08 — Integrated project actions and checkout

Supersedes the disclosure layout and persistent fallback in the preceding publisher/support decisions. Keep one product mark with a text publisher credit; group About and Support in a compact footer action row rather than expanding sidebar navigation. About uses a native modal and closes before Support opens, restoring focus to the persistent About trigger. The payment panel sits flush beneath a compact app-themed header, without duplicate explanatory copy. Show the external recovery link only after a ten-second loading delay. Ko-fi content remains provider-owned; no account, financial, CLI or persistence contract changes.

## 2026-10-08 — Vionix identity and composed project dialogs

Supersedes the product-mark-only identity in the preceding project-actions decision. Use the bundled Vionix logo as the single mark, vertically centred in a dedicated column beside the product name/publisher subtitle. Make the entire identity block a Vionix link; avoid nested anchors. Move branding composition out of the icon module so shared SVG glyphs remain independent of branding/support lifecycles. Footer About/Support controls use consistent information/heart icons and equal-width columns. About groups identity, concise purpose, icon-led resource rows and a separate version/support footer.

Centre the checkout iframe in symmetric responsive padding and reduce its initial viewport to 576px, retaining default iframe scrolling for longer provider states and parent scrolling on short viewports. This is iframe geometry, not an assertion of exact centring for every internal payment state. Browser origin isolation prevents measuring/repositioning Ko-fi's card, and the inspected official overlay script does not expose a content-height message contract. Preserve delayed recovery, fresh-frame lifecycle, focus, data isolation and financial/CLI contracts.

## 2026-10-08 — Usage-based support reminders

Use a persistent secondary floating card after demonstrated website use instead of opening payment automatically. Count ten confirmed user journal writes; initial eligibility also needs 72 hours and three local dates, repeats need 28 days plus renewed writes. Count confirmation separately from refresh so retrying a failed read cannot inflate usage. Explicit UI commit options own qualifying writes; repository, financial and CLI layers do not know reminder policy.

A small browser-local versioned store and origin-scoped Web Lock coordinate usage updates and claims. Corrupt storage or unavailable coordination fails closed. Metadata is separate from journal export and existing records are not backfilled. Keep claimed presentation in the page session, suspend while busy/editing/modal, and preserve keyboard-focused controls. Manual Support preserves opt-out while refreshing cooldown. No new dependency/backend/schema is introduced; rollback can remove automatic presentation without affecting manual Support or journal data.

## 2026-10-09 — Source integrity and correction evidence

Implement schema-2 correction evidence for saved execution/adjustment edits and removals and saved leg snapshot/direction/planning changes. Require a bounded explanation, including missing-to-known historical FX/manual amounts. Exclude new records and trade annotations. Persist before/after source records atomically with the parent revision and retry receipt; delete evidence with its trade. Treat imported evidence as supplied history, not authenticated authorship. Use a frozen preserving schema-1-to-2 transition; retain calculation version 1 and portable format 1. Installed skills must be replaced before schema-2 access. Existing backups retain original versions and convert on restoration. No release/version increment or deployment is part of this implementation.

Expose shared structured validation and evidence-based application outcomes, offline export verification, a read-only skill walkthrough and restore drills. Extend deterministic replay coverage against independent arithmetic; retain six-leg atomic saves and existing uncertain-write/confirmed-refresh recovery behavior.


## 2026-10-09 — Expanded correction transaction boundary (pending)

The expanded six-currency regression changes six snapshots and twelve execution rates, requiring eighteen correction documents in one save. Current client rules reject that transaction at Firestore's 1,000-expression limit despite reduced repeated validation. Six-leg multiplier corrections remain atomic; no save splitting or supported leg-capacity reduction is introduced. A trusted mutation service would change the current client-only/Spark architecture; that decision remains pending. Keep the failing regression visible until the requirement is resolved. Validated unchanged snapshot fields and rate-only execution edits use bounded validation shortcuts; evidence still matches full persisted before/after records, and metadata-only fabricated events are rejected.

## 2026-10-09 — Portable projection ordering

A failing regression demonstrated that Firestore child query order can differ from the order used when saving a valid multi-leg summary. Portable validation now compares projection legs by ID and instrument caches as multisets, preserving duplicate counts, every projected value and stored presentation order. Tampered monetary results or cached instrument values still fail verification. Source records, calculation rules/version and frozen schema-transition dependencies remain unchanged.

## 2026-10-10 — Proportional correction history

Supersedes the per-source evidence design and pending architecture decision of 9 October. Keep the static browser/CLI architecture. Each application save records one append-only entry with reason and changed financial fields, including automatic FX invalidations, in the existing source/parent/receipt transaction. Full unchanged source records and their metadata are omitted. Rules retain ownership, basic history structure and append-only protection; exhaustive source/evidence cross-document verification is removed. Authenticated owners can already maintain their own financial facts; history is application-recorded information, not independently verified authorship. Preserve six-leg atomic saves and verify the formerly failing eighteen-change correction. Schema 2 is unreleased; revise its new correction shape directly, retaining the immutable 1→2 transition and calculation version 1.

## 2026-10-10 — Direct crypto support in vxTradeJournal

Add Ko-fi/Crypto method tabs to the existing native support dialog, retaining Ko-fi as default and keeping checkout state mounted while switching. Keep public receiving addresses and supported network/asset labels in a presentation-owned configuration module; the wallet owner maintains funds and explicitly supports Ethereum Mainnet, Base, Arbitrum One, Optimism, Polygon PoS and BNB Smart Chain alongside Bitcoin and Solana. Use address-only QR codes with explicit network instructions and a primary copy action; expose QR through a disclosure on small/short viewports. This avoids network-dependent wallet integration, transaction monitoring and token-contract configuration. The app never infers payment success from copy, QR or dialog events.

Bundle MIT-licensed, dependency-free `qrcode-generator` for local QR encoding. Keep it as a browser build dependency; the generated CLI runtime dependency manifest remains Firebase/decimal.js. Use `jsqr` only as an independent test decoder to verify displayed QR destinations. These libraries are development dependencies; no runtime origin, wallet SDK, schema or financial/CLI change is introduced. vxTradeJournal is the first integration; other applications remain outside this change.

## 2026-10-10 — Single icon network selector

Refines the direct crypto support design above. Replace currency buttons and conditional network controls with one persistent selector, ordered Bitcoin, Ethereum Mainnet, Solana, then Base, Arbitrum One, Optimism, Polygon PoS and BNB Smart Chain. Preserve icons in the selected value and each menu row through a themed select-only combobox and the existing native popover pattern. Keep network assets immediately below the selector; reserve two address lines and use fixed instruction text to prevent movement when switching networks. Product-owner instruction defers test execution until agreement on the finished design; previous verification does not establish acceptance of the revised selector.

## 2026-10-10 — Explicit stablecoin donation examples

Name USDC and USDT in applicable network captions, including Solana, alongside native assets and existing EVM token support. Distinguish bridged Base USDT, USDT/USDT0 on Arbitrum/Optimism/Polygon and Binance-Peg USDC/USDT on BNB; do not imply every representation is issuer-native. Reserve two caption lines for stable layout. Availability references: [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), [Tether protocols](https://tether.to/en/supported-protocols/), [USDT0 deployments](https://docs.usdt0.to/technical-documentation/deployments), [Superchain USDT token list](https://github.com/ethereum-optimism/ethereum-optimism.github.io/blob/master/data/USDT/data.json) and [BNB stablecoin representations](https://github.com/bnb-chain/mpp-sdk#tokens). Test execution remains deferred until design agreement.

## 2026-10-10 — Simple donation hints

Supersedes the caption detail in “Explicit stablecoin donation examples” above. Captions are nonexclusive hints, not acceptance rules: show BTC for Bitcoin, and the native asset, USDC, USDT and other tokens for the remaining networks, including Solana. The wallet owner handles tokens received on supported networks. Remove the “Accepts:” prefix, token standards, bridge and variant terminology. Keep every network row uniform, removing the separator after Solana while retaining icons and ordering. Test execution remains deferred until design agreement.

## 2026-10-10 — Remove donation footer instruction

Refines “Direct crypto support in vxTradeJournal” and “Single icon network selector” above. Remove the footer instruction and its accessibility description reference: the explicit Network field and receiving-address label provide the requested context. The default crypto panel ends at the receiving-address card, reducing height. QR codes remain address-only. Test execution remains deferred until design agreement.

## 2026-10-10 — Donation spacing rhythm

Refines the spacing reservations in “Single icon network selector” and “Explicit stablecoin donation examples” above. Use existing spacing tokens: 24px desktop/16px mobile outer padding, consistent 16px section gaps, 8px selector field gaps and 8px vertical padding around the method tabs and support header. The concise asset hint reserves one line. Group the receiving label and address with a 4px gap, then separate Copy address by 12px. Reserve one address line on desktop and two at viewport widths up to 480px to accommodate wrapping without network-switch movement. Keep the 180px QR and 44px action targets. Test execution remains deferred until design agreement.

## 2026-10-10 — Copy feedback without layout changes

Refines the copy feedback in “Direct crypto support in vxTradeJournal” above. After clipboard success, show “Copied” in the existing button for two seconds, then restore “Copy address”. Keep the live status visually hidden to prevent dialog resizing. Clipboard failure selects the address and changes the button to “Copy manually”, with detailed recovery text announced to screen readers. A new copy attempt or network selection cancels the previous feedback timer; closing clears it. Destination revision checks continue to discard stale clipboard results. Test execution remains deferred until design agreement.

## 2026-10-10 — Final donation design acceptance

The product owner approved the design for verification, ending the test deferral recorded above. Update the focused support coverage for the final single selector and timed copy feedback. `npm run test:e2e -- tests/e2e/support.spec.js tests/e2e/support-reminders.spec.js` passes 25/25 tests in 48.3 seconds. Lint, skill documentation checks and the production build pass; representative mobile, intermediate and dark desktop captures show no clipping. Build retains the existing large-chunk warning. This verification is scoped to website support; financial, persistence and CLI behavior are unaffected. Other applications remain outside this commit.

## 2026-10-10 — Donation method labels and icons

Label the provider-backed method Cash and retain Crypto as the second method. Give each tab a decorative banknote/coin icon while preserving accessible text, equal-width controls and the existing Ko-fi checkout lifecycle. This makes method choice independent of provider branding; provider-specific loading and recovery copy still names Ko-fi.

## 2026-10-10 — Native wallet address links

Make the displayed receiving address a native Bitcoin, ERC-681 or Solana Pay link, retaining raw address text, clipboard contents and address-only QR payloads. Include the selected EVM chain ID to avoid inheriting the wallet's active network; omit amounts and token contracts. Link activation delegates native-asset payment entry to a compatible installed wallet without adding a wallet SDK or new dialog controls. Generic token donations retain the copy flow. Browser and wallet support determines whether the URI opens a payment screen.

## 2026-10-10 — Zcash and Monero donations

Append Zcash and Monero to the existing selector, with ZEC/XMR hints and the wallet owner's supplied addresses. Reuse the native URI helper for `zcash:` and `monero:` without amounts or payment IDs; keep clipboard and QR payloads address-only. Extend the themed outline icon set rather than adding assets or dependencies. Reserve enough wrapping lines for the 95-character Monero address at desktop and compact widths to preserve stable network switching.

## 2026-10-11 — Shielded Zcash donations

Distinguish Zcash Transparent and Zcash Shielded in the shared selector, retaining the Zcash icon and ZEC hint. The Shielded entry uses the wallet owner's Unified Address and an explicit `zcash:` URI scheme override, independent of its selector ID. Display, clipboard and QR remain raw-address only. Reserve three desktop address lines and four at narrow mobile widths for the 106-character address, keeping destination switching stable.

## 2026-10-11 — TRON and Dogecoin donations

Add TRON and Dogecoin to the shared icon selector with the wallet owner's supplied addresses. TRON uses the owner-approved Trust Wallet native `trust://send` handoff for asset `c195`, without preset amount or HTTPS fallback; no generic `tron:` payment format is assumed. Dogecoin uses `dogecoin:`. Keep display, Copy and QR address-only. TRON's nonexclusive caption lists TRX, USDT and other tokens; do not promote discontinued USDC support there. Extend the existing themed outline icon set without dependencies or wallet connection.

## 2026-10-11 — Alphabetical donation selector

Keep Bitcoin and Ethereum Mainnet first, then list all remaining destinations alphabetically by displayed name. The maintained public configuration owns this order; no runtime sorting or locale-dependent order is needed for the shared proper network names. Keyboard navigation follows the displayed order, with End selecting Zcash Transparent.
