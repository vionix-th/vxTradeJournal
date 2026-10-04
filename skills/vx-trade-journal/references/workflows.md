# Workflow examples

These examples use the dev emulator profile and synthetic records. Resolve current field contracts with `schema` before use; keep generated IDs and returned revisions from the CLI response.

Planned quantities and fills must match the leg snapshot's quantity increment. An optional plan may omit quantity; a supplied off-increment quantity is rejected, including when correcting a snapshot's increment. Read the historical snapshot rather than assuming the current catalogue definition applies.

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

Read the trade, its children and current revision first. Preview edits to prior executions with `--dry-run`; reconcile any invalid subsequent exits before applying. For instrument snapshot correction, pass the proposed instrument JSON with `--preview`, review recalculated results and the returned fingerprint, then submit `--accept-preview <fingerprint>` using that same proposal, revision and a new operation ID. Re-read the trade after saving.

For example, a proposal file containing `{ "pointValue": "2" }` uses:

```sh
node /path/to/vx-trade-journal/scripts/vxjournal.mjs legs correct-snapshot \
  --profile prod --trade trade-example --id leg-example --revision 3 \
  --preview --input proposal.json
```

The apply call retains `--revision 3` and the same input, replaces `--preview` with `--accept-preview <returned fingerprint>`, and adds `--operation-id <unique ID>`. A changed trade or proposal requires a new preview.

Changing the snapshot P&L currency changes the source side of its FX pair. The correction clears that leg's planning and execution result rates; if the corrected currency matches the account, rates become `1`. Fee currencies/rates and other legs remain unchanged. Review the resulting incomplete flags rather than inferring replacement rates. After saving, use `executions update` with a known `resultRate` for each realized closing result, and `legs update` with a known planning rate when sizing is needed. Read the current revision before every update. Existing leg instrument references cannot be replaced; snapshot corrections retain that reference.

## Handle an uncertain write or conflict

If a command times out, inspect `operations get --profile <profile> --trade <id> --operation-id <original ID>` and read the current trade. A matching receipt confirms the write committed; report its applied revision without adding the execution again. If no receipt exists, retry the original request with the same operation ID, IDs, expected revision and identical JSON. If that retry conflicts, reconcile fresh source data; do not blindly change the revision or operation ID. Only submit a new intentional operation after determining what happened to the original write.

FX rates are reporting-currency units per source-currency unit. Read the account and snapshot currencies rather than inferring either from symbols. Missing fee/result conversion rates may remain null and mark results incomplete; supply a known historical rate later through `executions update` using the current parent revision and a new operation ID. Entry fills do not realize a closing result, but their incurred fees still require conversion when foreign.

## Export

Run `export --profile dev --output <path>` after checking the profile. The export contains complete owned journal source data and version metadata; it excludes authentication secrets. If the path already exists, choose a different path or explicitly use `--overwrite` only when replacement is intended.
