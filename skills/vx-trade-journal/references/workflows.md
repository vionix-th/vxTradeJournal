# Workflow examples

These examples use the dev emulator profile and synthetic records. Resolve current field contracts with `schema` before use; keep generated IDs and returned revisions from the CLI response.

New trades support up to six legs; adding a leg cannot exceed that limit. Earlier larger records can be read, corrected or reduced, but cannot expand above six. This conservative capacity preserves atomic persistence and ownership checks.

Planned quantities and fills must match the leg snapshot's quantity increment. An optional plan may omit quantity; a supplied off-increment quantity is rejected, including when correcting a snapshot's increment. Read the historical snapshot rather than assuming the current catalogue definition applies.

## Inspect a journal without changes

After authentication, confirm profile/project with `doctor --profile dev`. These examples inspect synthetic emulator records; select `prod` only for the authorized hosted journal.

```sh
node /path/to/vx-trade-journal/scripts/vxjournal.mjs accounts list --profile dev
node /path/to/vx-trade-journal/scripts/vxjournal.mjs accounts get --profile dev --id account-example
node /path/to/vx-trade-journal/scripts/vxjournal.mjs journal list --profile dev --account account-example
node /path/to/vx-trade-journal/scripts/vxjournal.mjs trades get --profile dev --id trade-example
node /path/to/vx-trade-journal/scripts/vxjournal.mjs calculate trade --profile dev --id trade-example
node /path/to/vx-trade-journal/scripts/vxjournal.mjs trades corrections --profile dev --id trade-example --page 1 --page-size 12
```

Read account currency, historical instrument snapshots, source fills/adjustments, revisions and incomplete flags. Current catalogue definitions do not replace historical snapshots. Derived results are reproducible from source records, snapshots, supplied FX, event ordering and calculation version. Missing results/rates remain unknown. Correction history has one entry per correcting save with reason and changed values, including automatic FX invalidations; schema-1 edits cannot be reconstructed. History does not independently verify authorship.

## Record a trade

1. Check the selected environment and signed-in user with `doctor --profile dev`.
2. List accounts, instruments and strategies. Read each chosen record by ID; confirm instrument configuration is complete and the account currency is correct.
3. Generate IDs with `ids`, then create the trade with a new operation ID. Example input (replace the placeholder IDs with generated IDs):

```sh
node /path/to/vx-trade-journal/scripts/vxjournal.mjs trades create \
  --profile dev --operation-id create-trade-20261001-001 --input - <<'JSON'
{
  "id": "trade-20261001-001",
  "accountId": "account-example",
  "legs": [{
    "id": "leg-20261001-001",
    "instrumentId": "instrument-example",
    "direction": "long",
    "planning": { "entry": "10.00", "stop": "9.00", "target": null, "riskBudget": null, "rate": null, "quantity": null }
  }],
  "strategyId": null,
  "rationale": "Synthetic example",
  "review": "",
  "tags": [],
  "riskBudget": null
}
JSON
```

4. Save the returned trade revision. Before each execution or adjustment, re-read the trade and use its current revision, a stable child ID, an explicit timestamp offset, and a new operation ID. Review the replayed position and incomplete-result flags after every write.

## Correct historical data

Read the trade, its children and current revision first. Preview edits to prior executions with `--dry-run`; reconcile any invalid subsequent exits before applying. For instrument snapshot correction, pass the proposed instrument JSON with `--preview`, review recalculated results and the returned fingerprint, then submit `--accept-preview <fingerprint>` using that same proposal, revision and a new operation ID. Re-read the trade and correction history after saving. Saved execution/adjustment edits or removals and leg direction/planning changes also require a correction reason; completing missing FX/manual values counts. Keep original explanation on retry. Dry runs/previews disclose reason requirements without requiring the reason until apply.

For example, a proposal file containing `{ "pointValue": "2" }` uses:

```sh
node /path/to/vx-trade-journal/scripts/vxjournal.mjs legs correct-snapshot \
  --profile prod --trade trade-example --id leg-example --revision 3 \
  --preview --input proposal.json
```

The apply call adds `--correction-reason "Correct historical broker specification"`, retains `--revision 3` and the same input, replaces `--preview` with `--accept-preview <returned fingerprint>`, and adds `--operation-id <unique ID>`. A changed trade or proposal requires a new preview.

Changing the snapshot P&L currency changes the source side of its FX pair. The correction clears that leg's planning and execution result rates; if the corrected currency matches the account, rates become `1`. Fee currencies/rates and other legs remain unchanged. Review the resulting incomplete flags rather than inferring replacement rates. After saving, use `executions update` with a known `resultRate` for each realized closing result, and `legs update` with a known planning rate when sizing is needed. Read the current revision before every update. Existing leg instrument references cannot be replaced; snapshot corrections retain that reference.

## Handle an uncertain write or conflict

If a command times out, inspect `operations get --profile <profile> --trade <id> --operation-id <original ID>` and read the current trade. A matching receipt confirms the write committed; report its applied revision without adding the execution again. If no receipt exists, retry the original request with the same operation ID, IDs, expected revision and identical JSON. If that retry conflicts, reconcile fresh source data; do not blindly change the revision or operation ID. Only submit a new intentional operation after determining what happened to the original write.

FX rates are reporting-currency units per source-currency unit. Read the account and snapshot currencies rather than inferring either from symbols. Missing fee/result conversion rates may remain null and mark results incomplete; supply a known historical rate later through `executions update` using the current parent revision and a new operation ID. Entry fills do not realize a closing result, but their incurred fees still require conversion when foreign.

## Archive, restore and delete accounts

`accounts list --profile dev` shows active accounts. Use `--archived true` for archived accounts or `--archived all` for management. Archive with current `--id` and `--revision`; linked history disappears from journal results, totals, suggestions and defaults. Restore with `accounts unarchive` before viewing or editing its trades. Both preserve source records. Exports retain archives for backup.

Deletion permanently removes the archived account and its linked trades, executions, adjustments, corrections and receipts. Preview first, report the account name and trade count, and obtain authorization for this destructive scope. Apply only the accepted snapshot:

```sh
node /path/to/vx-trade-journal/scripts/vxjournal.mjs accounts delete --profile dev --id archived-account --revision 3 --preview
node /path/to/vx-trade-journal/scripts/vxjournal.mjs accounts delete --profile dev --id archived-account --revision 3 --accept-preview 0000000000000000000000000000000000000000000000000000000000000000 --operation-id delete-account-1 --yes
```

The all-zero fingerprint is a placeholder; replace it and the sample revision with actual preview inputs. Preserve operation ID and inputs on retries. Unrelated records and revisions remain unchanged. Inspect `import status --profile dev --operation-id delete-account-1` after interruption: `transfer.operationKind` identifies account deletion. Supported `resume_import`/`rollback_import` actions use existing `import resume`/`import rollback --yes`; rollback cancels incomplete deletion and restores removed records. `finish_cleanup` means live deletion completed (or cancellation/rejection is settled), but final cleanup/ownership release remains; use `import resume` with that ID to finish cleanup. Verified live deletion cannot be rolled back, including during final cleanup. Journal access returns after cleanup and ownership release; committedRecords retains the preceding source-record checkpoint and does not count deleted staging files. Previously downloaded files and independent recovery backups remain separate copies.

## Journal overview

Run `journal overview --profile dev` for counts and complete monetary results across active accounts; archived history is excluded. Add `--account <id>` for one account. Results use account reporting currencies; `currencyTotals` is sorted by currency and reports exact decimal `net`, `complete` count and `incomplete` excluded count per unit. Top-level `net` is populated only for a single currency, identified by `currency`; both are null for mixed currencies. Never add USD and USDC or other distinct units without an explicit conversion policy. Empty currency groups show zero, while no accounts produces no monetary unit. Incomplete trades are omitted, including foreign results lacking required rates. Journal search/status/date filters affect history rather than these account-scoped totals. Website Realized net uses the same source expectations and totals.

## Export

Run `export --profile dev --output <path>` after checking the profile. The export retains archived accounts and history and contains complete owned journal source data and version metadata; it excludes authentication secrets. If the path already exists, choose a different path or explicitly use `--overwrite` only when replacement is intended.

Verify downloaded JSON without authentication or journal writes:

```sh
node /path/to/vx-trade-journal/scripts/vxjournal.mjs export verify --input journal.json
```

Verification reports source/target versions, integrity, record counts, conversions/warnings and incomplete trades. Legacy files have no checksum. Store exports privately, retaining dated copies. Run a restore drill in an isolated emulator journal: preview/apply the export, re-export, compare source records/snapshots/correction events and independently expected financial results. Ownership and optimistic revisions change during import; whole-file checksums/times need not match. Checksum consistency does not prove authenticity. Restore hosted data only when authorized; replacement preserves displaced data in its recovery backup.

Export contention retains `IMPORT_BUSY` (exit 5). Inspect `doctor --profile dev` or `import status --profile dev` without an operation ID for current journal availability. Errors and status reports include a `transfer` diagnostic: `reason`, `actions`, phase, expiry and observed client time when available. Reasons distinguish `ready`, `active_export`, `expired_export`, `active_import`, `interrupted_import` and `status_unavailable`. Expiry is based on client observation, not a promise that another operation has completed; mismatched clocks need investigation. `retry_export` means retry explicitly, not automatically. Successful export JSON remains unchanged. Export errors include whether data was prepared; CLI output is not produced on failure. Secondary inspection/cleanup errors never replace the original failure. Internal owner tokens are excluded.

## Import and recovery

Inspect `schema --command "import preview"`. Preview with `import preview --profile dev --input <path> --mode add|replace`; optionally select `--include-settings`. Apply the identical file/options with the returned `--accept-preview`, a stable new `--operation-id`, and `--yes` for replacement. Add-only skips identical IDs and rejects conflicts. Replacement retains a private recovery backup until explicit deletion. Imported ownership becomes the authenticated destination; historical values and snapshots remain intact.

Use returned `transfer.actions` to determine supported next steps; unavailable/inconsistent status authorizes no recovery action. Terminal imports do not offer resume/rollback; incompatible recovery requires the matching client. For interruption, inspect `import status --profile dev --operation-id <id>`, then explicitly `import resume` or `import rollback --yes` with that ID/profile. A live competing run stops; wait for its owner to stop and lease to expire before takeover. Resume needs no source file after complete upload. Incomplete upload has not changed journal data and may be cancelled with rollback. Never change operation ID to bypass recovery.

Use `backup list`, `backup export --operation-id <id> --output <path>`, and confirmed `backup delete --operation-id <id> --yes`, each with the explicit profile. Restore a completed backup by importing its downloaded JSON through a new replacement preview. These are user-scoped recovery commands, not administrator database restoration.
