# Database deployment and recovery

The journal is live on schema `1`. Application release numbers do not identify database structure. Only adjacent schema transitions are registered; releases that retain the schema need no conversion. This implementation establishes infrastructure without changing journal records or financial calculation version.

## Operator setup

Install repository dependencies with `npm ci`. Privileged database access uses Firebase Admin with Application Default Credentials (ADC); Firebase CLI login alone does not establish ADC. Configure ADC through the Google Cloud SDK (`gcloud auth application-default login`) or the standard credential environment supplied by the operator environment. Credentials need Firestore data access; publishing needs Firebase Hosting/rules permissions. Keep credentials outside the repository and never print them. Production commands reject emulator environment overrides.

The installed skill requires only its own locked runtime dependencies. It includes no admin SDK or recovery tools. Replace all pre-guard installed skills before the first schema-changing release. Old binaries cannot be retrofitted; new skill copies fail explicitly on schema mismatch even when application release versions differ.

## Deployment

```sh
npm run database:status -- --profile prod
npm run deploy:prod -- --dry-run --register-existing-schema 1
npm run deploy:prod -- --register-existing-schema 1
```

The `--register-existing-schema 1` flag is required only when existing production metadata is absent. It means register verified existing data; it never means erase or reset. It validates retained schema-1 records after enforced maintenance and backup. It does not relabel an unknown installation as the target schema. Snapshot/restore covers Firestore journal data, not Auth users or credential material.

Subsequent deployments use `npm run deploy:prod`; dry run uses `--dry-run`. Optional `--backup-dir /private/path` overrides `~/.local/share/vx-trade-journal/backups`. Use a private owned directory (0700); recovery files are owned regular files (0600). Copy completed recovery files to operator-managed durable storage, preserving confidentiality. Snapshots are not automatically removed or overwritten.

Deployment builds website and skill before maintenance, creates `dist-prod/release.json`, validates project/schema/migration identity and serializes work through a fenced renewable lease. If schema or rules change, ordinary journal reads/writes are unavailable. Changed rules incur a ten-minute propagation barrier; the process prints progress and renews its lease. Compatible deployments with identical rules avoid that window. The `deploy:rules` alias uses the same complete guarded deployment rather than bypassing governance.

Hosting manifest and downloadable skill hashes must match prepared inputs before database reopening. Schema version advances after each verified step; availability is restored only after deployment verification. A partially migrated schema remains in maintenance.

## Automatic development evolution

Run `npm run dev`, `npm run dev:test` or `npm run emulators` normally. Startup preserves retained records, temporarily guards journal access, captures a private snapshot when registration/conversion is needed, validates the source and applies the same adjacent migration registry used for production. It prints readiness and the recovery-file path. No separate setup command or website data reset is required.

A genuinely empty Firestore database receives the required current schema. Retained records without metadata must validate as the known legacy schema 1 before automatic registration. Missing metadata never implies the newest schema. Known older schemas migrate one step at a time. Invalid records, unknown/newer schemas, missing migration paths and changed checksums stop safely, preserving data and recovery evidence.

Interrupted development upgrades retain maintenance, run identity, original backup and atomic checkpoints. Startup automatically resumes the same recorded upgrade after its lease expires and only with matching project, target schema and migration checksums. Handled failures expire their own fenced lease immediately; hard termination may require waiting for the two-minute lease expiry. Competing live runs are refused. Other operator operations require explicit recovery rather than automatic takeover. A shutdown signal stops the upgrade at a bounded checkpoint before asking Firebase to export; repeated interrupts still wait for export completion.

The optional manual operation has an explicit preserving name:

```sh
npm run database:upgrade -- --profile dev --dry-run
npm run database:upgrade -- --profile dev
```

Use `--profile test` for the interactive test installation. `--backup-dir /private/path` overrides the private default directory for manual upgrades. This tooling rejects production; production uses deployment with explicit `--register-existing-schema 1` for its first baseline. Normal development startup never calls `data:reset`. That separate destructive command clears development Firestore records and Auth users before restoring synthetic sample records. Snapshot restore also explicitly replaces journal records and requires `--yes`.

## Interrupted deployment

Keep the exact prepared build, source tree and snapshot. Read status for the recorded run ID. Stop the previous process and allow its two-minute lease to expire. Resume explicitly:

```sh
npm run deploy:prod -- --resume <run-id>
```

Build/source, target and migration checksums must match the recorded run. An applied migration must never be edited. Resume preserves completed steps and retries incomplete work. Failure during rules or Hosting publication may leave external publication uncertain; repeat publication and verification before reopening. Do not manually delete locks, reset schema versions or set ready status.

## Restore

Restore discards journal changes after the snapshot, including records created by conversion. Deployment maintenance prevents ordinary user changes during the recovery interval. Inspect snapshot/project and interrupted run before explicit restore:

```sh
npm run database:restore -- --profile prod --snapshot /private/path/run.json --resume <interrupted-run-id> --yes
```

Recovery requires maintenance and exclusive expired-run takeover. Snapshot integrity and project identity are checked before journal writes. Restore replaces journal contents in bounded transactions, deletes documents absent from snapshot, verifies exact data and restores source schema/active migration evidence. It preserves privileged audit history and leaves maintenance active. Repeated restore safely completes interrupted recovery.

Deploy a retained source release matching the restored schema before reopening. Retain source revision and release artifacts with migration recovery records; never use an application-only rollback against incompatible migrated data. Authentication users remain unchanged. Snapshot corruption, unsupported values or missing files requires operator repair; no fallback to an incomplete user export.

## Migration authors

Register one `n→n+1` transition through `loadMigration`, with unique ID, module path and declared transformation-code dependencies. The loader computes the source checksum automatically; include all transformation dependencies. Supply source/target validators and a deterministic `transform(records)` returning bounded `{path, data}` writes or `{path, delete: true}` removals. Input chunks contain at most 100 documents from one owner; output paths and record ownership must remain with that owner; output permits at most 200 writes. Every affected path must remain within the journal. Transformations must be idempotent across retries and mixed source/target records after interruption, including moved/created paths. Checkpoint and writes commit together. Validate the entire target dataset before completing the step.

Define embedded snapshot, receipt and derived-cache treatment explicitly. Preserve historical financial inputs and decimal strings. Retain all transitions needed by deployed data, and test independent expected outcomes, reruns, interruption and recovery. Synthetic migrations exercise the runner; the production registry currently contains no transitions.

## Verification

Select focused commands through the PRD matrix. Database unit tests cover chain/lease/deployment/snapshot contracts. Full integration covers rule isolation and CLI/recovery. Browser database tests form a serial project that runs after ordinary browser coverage because metadata is global; focused execution uses `npm run test:e2e -- tests/e2e/database-availability.spec.js --no-deps`. Check rendered maintenance and draft screenshots at 375/800/1280 px. Packaging checks ensure administrator code/dependencies never enter the user skill. Production bootstrap and restore are operator actions, not automated test fixtures.
