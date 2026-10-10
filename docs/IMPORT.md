# Portable journal import and recovery

Import accepts vxTradeJournal user JSON, not privileged database snapshots or broker files. Website and installed CLI expose the same operations. Files may contain private financial information; downloaded exports should remain in private storage. Input files are limited to 32 MiB. Export format, database schema and financial calculation versions are independent.

## Choose an import mode

Open **Settings → Import journal and recovery**, or **Import journal** before creating the first account. Select JSON, choose mode and whether to apply exported settings, then preview.

- **Add only** keeps existing records. Identical IDs are skipped; differing IDs reject the entire plan. A trade and its children are compared together, never partially merged. Required account usage bookkeeping may advance when new trades are added.
- **Replace existing journal** removes supported destination journal records absent from the source. Review deletions and confirm explicitly. A verified private recovery backup is captured before journal changes and retained after success until explicit deletion.

All ownership becomes the signed-in destination user, including historical snapshot ownership. IDs, decimal strings, historical source values and creation/update timestamps are preserved. Optimistic revisions advance so earlier drafts cannot silently overwrite imported records. Old operational receipts are not replayed; imported trades receive fresh receipts.

Destination preferences remain by default. Source settings are an explicit option. If replacement removes the destination default account, preview explains that its selection will be cleared. Empty-journal import is supported without first creating an account.

## CLI workflow

Discover current contracts with `schema --command "import preview"`. Every network command requires an explicit profile. Use emulator profiles only for synthetic work; `prod` operates on the authenticated user's hosted records.

```sh
npm run cli -- import preview --profile dev --input journal.json --mode add
npm run cli -- import apply --profile dev --input journal.json --mode add --accept-preview <returned-fingerprint> --operation-id <new-id>
npm run cli -- import preview --profile dev --input journal.json --mode replace --include-settings
npm run cli -- import apply --profile dev --input journal.json --mode replace --include-settings --accept-preview <returned-fingerprint> --operation-id <new-id> --yes
```

Use the exact fingerprint returned by preview and the same source/options. A changed destination requires a new preview and operation ID. Retrying identical inputs with an existing completed operation ID returns its result without repeating journal writes. Application release differences do not themselves prevent import; schema compatibility remains exact.

## Interruption and recovery

The source upload finishes before journal ownership. An incomplete upload leaves the journal usable; reselect the same source to complete upload, or cancel it through confirmed rollback. Once uploaded, resume no longer needs the local file.

During application or rollback, normal website/CLI journal operations are unavailable. Recovery status and staging stay private and readable to their owner. Each journal write and checkpoint commit atomically. A live competing owner stops; a stopped owner's lease expires after two minutes and permits explicit takeover with the recorded operation ID. Expiry never automatically reopens a partially applied journal.

```sh
npm run cli -- import status --profile dev --operation-id <recorded-id>
npm run cli -- import resume --profile dev --operation-id <recorded-id>
npm run cli -- import rollback --profile dev --operation-id <recorded-id> --yes
```

Website reload shows the recovery screen for an incomplete import. Resume continues the stored checkpoint, including a previously selected rollback interrupted during restoration staging. Source, target and restoration checkpoints have separate integrity hashes. Rollback restores original financial/source content and receipts, removes newly created records and verifies the result before reopening. Revisions advance during recovery to reject stale edits. Network timeout can leave a committed checkpoint; inspect status rather than assuming no write occurred. Global database maintenance temporarily prevents recovery writes; wait for deployment to reopen first.

Successful replacement backups appear in the import screen. Download one as ordinary portable JSON, then use a new confirmed replacement preview to recover a completed import. This deliberately creates fresh receipts. Backups remain until explicit deletion; active recovery data cannot be deleted.

```sh
npm run cli -- backup list --profile dev
npm run cli -- backup export --profile dev --operation-id <backup-id> --output recovery.json
npm run cli -- backup delete --profile dev --operation-id <backup-id> --yes
```

User recovery covers supported accounts, instruments, strategies, settings, trades, legs, executions, adjustments and operation receipts. It does not enumerate unknown administrator-created descendants or change Firebase Authentication users. Privileged [database snapshots](DATABASE.md) remain the complete operator recovery mechanism.

## Version evolution and deployment

Legacy unversioned journal exports are explicitly recognized and fully validated; they lack checksum protection. Format 1 adds counts and canonical integrity checks. Unsupported calculation versions, unknown/newer schemas and missing adjacent conversion paths are rejected. Cached historical results are validated without silently rewriting them.

Deployment and import share pure source/target validators and deterministic bounded adjacent transformations. Future transitions belong in `src/application/schema-evolution.js` and declare source files/dependencies. Run `npm run schema:manifest`, review immutable checksum changes, then `npm run schema:manifest:check`. Website and portable skill builds verify the generated manifest; Admin independently verifies source hashes. Current schema is 2 and calculation version is 1. The registered 1→2 transition preserves historical financial values and adds no fabricated correction events.

Schema-changing deployment closes transfer admission under its global lease and rejects active imports before conversion. Compatible rule deployments can temporarily pause imports through global maintenance. Future migrations must explicitly handle import controls and retained backup versions; backups must not be silently rewritten as current data. No production deployment is implied by implementing this feature.

## Verified backups and correction history

Run `npm run cli -- export verify --input journal.json` offline after each download. Verification checks integrity when present, supported versions, adjacent conversions, record counts and replay/cache agreement; it reports incomplete trades without inventing rates/results. Store dated copies privately and exercise restoration in an isolated emulator journal. Compare source values, snapshots, correction events and independently expected results; destination ownership/revisions and export timestamps intentionally differ. A checksum proves consistency, not authenticity.

Schema 2 exports include append-only correction history; schema 1 exports convert without fabricated events. One entry per correcting save retains event revision/time, reason and changed fields' before/after values, including automatic FX invalidations. Removed records retain their source values; unchanged fields and operational metadata are omitted. Imported entry ownership is rebound to the destination. History is application-recorded information, not independently verified authorship. Operational receipts remain excluded. Replacement restores supplied history and preserves displaced history in the verified destination backup. Existing retained backups keep original schema/calculation versions and convert only on restoration. Trade deletion deletes its current correction history; previously downloaded backups remain recovery sources.
