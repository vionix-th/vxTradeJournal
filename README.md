# vxTradeJournal

Locally runnable trade journal prototype. Application uses browser JavaScript modules, Vite, Firebase Auth/Firestore emulators, and decimal.js for financial arithmetic.

## Local tooling

Requirements: Node.js 22.13+ and Java 21+ (Firestore emulator runtime). Install dependencies with `npm install`.

- `npm run dev` starts Vite on `http://127.0.0.1:5173` with Auth on `9099`, Firestore on `8080`, Emulator UI on `4000`, project `demo-vxjournal-dev`.
- `npm run dev:test` starts interactive test profile on Vite `5174`, Auth `9199`, Firestore `8180`, UI `4100`, project `demo-vxjournal-test`.
- `npm run emulators` starts dev Auth and Firestore emulators without Vite.
- Dev and interactive test emulator state persists in `.local-emulators/dev` and `.local-emulators/test` when processes stop cleanly. The automated profile is disposable.
- `npm run test` runs units first, then starts isolated automated profile on Auth `9299`, Firestore `8280`, UI `4200` for integration and browser tests, and stops services. It does not reuse dev emulator data or accept extra selectors.
- `npm run test:unit`, `npm run test:integration`, and `npm run test:e2e` run each test group. Integration and browser commands start and stop their own isolated emulator profile; E2E also manages Vite on port `5175`. Integration/E2E commands forward native file/name filters; `npm run test:cli -- -t "off-increment plans"` selects a source CLI scenario without selecting other integration files. A run with no executed tests is unsuccessful verification.
- `npm run test:watch` watches unit tests; `npm run lint` checks JavaScript; `npm run build` builds the skill first and creates `dist/` including its ZIP; `npm run preview` serves the bundle on Vite's selected profile port.
- `npm run data:seed` idempotently writes synthetic dev data; `npm run data:reset` clears dev Auth and Firestore data, then restores sample records. Both require the dev emulators running. Seed login: `demo@example.test` / `Demo-journal-123`.
- `npm run check` runs lint, skill documentation checks, full tests, application build and packaged-skill verification at integration/release checkpoints. Routine changes use the [PRD verification matrix](docs/PRD.md#verification-selection-and-checkpoints).

The `dev` and `emulators` scripts accept `-- --profile dev|test|auto`; for example, `npm run dev -- --profile auto`. `VXJ_PROFILE` is also supported. Firebase demo project IDs prevent accidental access to hosted projects. Profile configuration lives in `firebase.dev.json`, `firebase.test.json`, and `firebase.auto.json`.

Development startup handles schema evolution automatically. `npm run dev`, `npm run dev:test` and `npm run emulators` preserve records, create a private recovery snapshot when needed, validate the existing schema and apply adjacent migrations. Retained data without metadata receives schema-1 registration only after validation; it is never treated as disposable. Interrupted matching upgrades resume on the next startup after their lease expires. Unknown schemas or invalid data stop safely. No separate initialization command is required. `npm run database:upgrade -- --profile dev` runs the same preserving operation manually; add `--dry-run` to inspect it. `data:reset` explicitly deletes development Firestore records and Auth users before reseeding. See [database operations](docs/DATABASE.md).

Build embeds package version and current Git commit in `__APP_VERSION__` and `__BUILD_COMMIT__`. Runtime Firebase metadata is exposed as `import.meta.env.VITE_PROFILE`, `VITE_FIREBASE_PROJECT_ID`, `VITE_AUTH_EMULATOR_PORT`, and `VITE_FIRESTORE_EMULATOR_PORT`.

## Application workflow

Sign in with the synthetic login above, or register and verify a new user using the link printed by the Auth emulator. Create an account, configure instruments, optionally define a strategy, then create a trade. Each leg records entries, exits or settlements; realized results replay the execution history using weighted averages. Missing manual results or FX rates remain visible as incomplete. Catalogue and strategy edits preserve historical trade snapshots.

Settings control display timezone/theme and export all owned journal source data as versioned JSON. Rates always mean reporting-currency units per one source-currency unit. Sizing excludes fees and slippage; multi-leg risk is entered manually.

Settings and first-account onboarding also offer portable JSON import: add-only rejects conflicting IDs, while confirmed replacement captures a private retained recovery backup. Preview shows effects before applying; interrupted imports expose resume/rollback controls without requiring the uploaded file again. Website and CLI support equivalent modes, optional settings and backup downloads/deletion. See [import and recovery](docs/IMPORT.md).

Implementation decisions: [docs/DECISIONS.md](docs/DECISIONS.md). Executed checks and acceptance coverage: [docs/VALIDATION.md](docs/VALIDATION.md). Initial delivery is a local prototype; hosting and release publication follow prototype review.

## Agent CLI and skill

The CLI exposes the same owned journal workflows as the website through the shared domain and Firebase repository. Run it from the source checkout with `npm run cli -- help`; network commands require an explicit `--profile dev|test|auto|prod`. Use emulator profiles for synthetic work. Production commands use the authenticated user's hosted Firebase account and records.

Build the distributable skill with `npm run skill:build`. The authored skill lives in [`skills/vx-trade-journal`](skills/vx-trade-journal); the build produces both `dist-skill/vx-trade-journal` and `dist-skill/vx-trade-journal-<version>.zip`. Download the ZIP through the website's sign-in screen or signed-in Session area, extract its `vx-trade-journal` folder into the agent's skill directory, then run `npm ci --omit=dev` inside that folder. The installed CLI runs from any working directory with Node.js 22.13+ on macOS or Linux.

Both `npm run build` and `npm run build:prod` build the skill before Vite and include its ZIP under `downloads/` in the website artifact. Development Vite serving prepares the same download before starting. `npm run test:skill` extracts the ZIP before verifying installation and emulator workflows.

Maintain website/CLI capability parity under [AGENTS.md](AGENTS.md) and the [PRD](docs/PRD.md#agent-cli-and-skill). After changing the CLI catalogue, run `npm run skill:docs` to regenerate its command inventory. `npm run skill:docs:check` checks inventory freshness and documented shell examples; `npm run test:skill` verifies a fresh portable installation and emulator workflows. Both are included in `npm run check`.

Each release includes a skill built from the same tested application commit and version. To upgrade an installed skill, replace its directory with the new generated distribution and run `npm ci --omit=dev` there again. Saved sessions live in the separate user configuration directory. Run the installed executable's `version` command to identify its application version and source commit; website deployment does not update installed copies.

Authentication setup reads credentials through stdin or a hidden terminal prompt. Sessions are stored per profile under `VXJ_CONFIG_DIR`, `XDG_CONFIG_HOME`, or `~/.config/vx-trade-journal`, with private file permissions. The CLI never stores passwords or ID tokens. See the installed skill's `SKILL.md` and references for command schemas, mutation safeguards and workflow examples.

## Production Firebase

Production project ID is `vionixtradejournal`, display name `vionix-trade-journal`, project number `389058969816`. The default Firestore database is in `asia-east1`. The project uses Spark, email/password Auth, and static Hosting. `.firebaserc` records the `prod` alias; deployment commands also name the project explicitly.

The Firebase CLI is installed locally by `npm install`. Use `npx firebase login`, then `npx firebase projects:list` to confirm access. The registered `vxTradeJournal` web app configuration is in `firebase.web.json`; it is public browser configuration, not an Admin SDK credential. Never add service-account keys or login tokens to this repository.

- `npm run build:prod` creates `dist-prod/` using hosted Auth and Firestore.
- `npm run preview:prod` serves that build locally on port `4173` and uses real production accounts and data.
- `npm run deploy:prod` builds production and the skill, preflights database schema, runs adjacent migrations with private backup and enforced maintenance, publishes matching rules/Hosting, then verifies hosted release inputs before reopening. First rollout requires `-- --register-existing-schema 1`; use `-- --dry-run` for preflight and `-- --resume <run-id>` for interrupted work.
- `npm run deploy:rules` routes through the same guarded complete deployment; it no longer publishes rules independently.
- `npm run database:status -- --profile prod` inspects operator metadata. Database tools require Application Default Credentials separately from Firebase CLI login. See [database operations](docs/DATABASE.md) for private snapshots, retained emulator initialization and explicit restore.

Local `npm run build` still creates an emulator-backed `dist/`; production Hosting serves only `dist-prod/`. Development/test commands and seed/reset keep their separate demo projects. No composite indexes are currently required because repository reads query per-user collections without compound Firestore filters.

Before publication, complete the repository's release checks and review Authentication's authorized domains and email templates in the Firebase console. After publication, verify registration, email delivery, verification, reset, saved-record reload and user isolation on `https://vionixtradejournal.web.app`. Use the app's JSON export for user-controlled copies of journal data; Spark does not include managed Firestore backups or PITR.

Monitor Hosting and Firestore usage in the console. Spark limits include 10 GB Hosting storage, 10 GB/month Hosting transfer; Firestore includes 1 GiB storage, 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day and 10 GiB/month outbound transfer. Daily Firestore quotas reset daily; Hosting transfer resets monthly. Storage capacity does not reset. Quota exhaustion can interrupt service. Keep large exports and repeated full-journal reads in mind as data grows. Cloud Functions, Cloud Run and other billing-required services require an explicit Blaze decision. See [Hosting quotas](https://firebase.google.com/docs/hosting/usage-quotas-pricing) and [Firestore quotas](https://firebase.google.com/docs/firestore/quotas).
