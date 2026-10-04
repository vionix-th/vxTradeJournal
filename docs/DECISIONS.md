# Development decisions

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
