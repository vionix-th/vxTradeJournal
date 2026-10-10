# Command reference

The executable is `node /path/to/vx-trade-journal/scripts/vxjournal.mjs`. Use `help` for current commands and `schema` for exact inputs. Network commands require `--profile dev|test|auto|prod`; offline commands (`help`, `schema`, `version`, `ids`) do not. Success and errors are emitted as JSON. Preserve the process exit code and inspect the returned versioned envelope.

## Command inventory

This inventory is generated from the executable catalogue. Required options are the base contract; use `schema --command '<command>'` for input fields and conditional safeguards.

<!-- command-inventory:start -->
| Command | Purpose | Required options |
|---|---|---|
| `help` | Discover command groups and options | None |
| `schema` | Machine-readable command contracts | None |
| `version` | Application, CLI, schema and calculation versions | None |
| `ids` | Generate stable IDs before submitting creates | None |
| `doctor` | Check runtime, project, saved authentication and database compatibility | `--profile` |
| `auth login` | login a Firebase user session using stdin or a hidden terminal prompt | `--profile` |
| `auth register` | register a Firebase user session using stdin or a hidden terminal prompt | `--profile` |
| `auth reset` | reset a Firebase user session | `--profile` |
| `auth status` | status the selected profile session | `--profile` |
| `auth verify` | verify the selected profile session | `--profile` |
| `auth logout` | logout the selected profile session | `--profile` |
| `accounts list` | List owned accounts | `--profile` |
| `accounts get` | Get an owned accounts record | `--profile`, `--id` |
| `accounts create` | Create accounts using a stable ID | `--profile`, `--input` |
| `accounts update` | update an owned accounts record | `--profile`, `--id`, `--revision`, `--input` |
| `accounts archive` | archive an owned accounts record | `--profile`, `--id`, `--revision` |
| `accounts unarchive` | unarchive an owned accounts record | `--profile`, `--id`, `--revision` |
| `instruments list` | List owned instruments | `--profile` |
| `instruments get` | Get an owned instruments record | `--profile`, `--id` |
| `instruments create` | Create instruments using a stable ID | `--profile`, `--input` |
| `instruments update` | update an owned instruments record | `--profile`, `--id`, `--revision`, `--input` |
| `instruments archive` | archive an owned instruments record | `--profile`, `--id`, `--revision` |
| `instruments unarchive` | unarchive an owned instruments record | `--profile`, `--id`, `--revision` |
| `strategies list` | List owned strategies | `--profile` |
| `strategies get` | Get an owned strategies record | `--profile`, `--id` |
| `strategies create` | Create strategies using a stable ID | `--profile`, `--input` |
| `strategies update` | update an owned strategies record | `--profile`, `--id`, `--revision`, `--input` |
| `strategies archive` | archive an owned strategies record | `--profile`, `--id`, `--revision` |
| `strategies unarchive` | unarchive an owned strategies record | `--profile`, `--id`, `--revision` |
| `instruments presets` | Inspect editable preset examples | None |
| `instruments preview` | Validate instrument configuration and calculation capabilities | `--profile`, `--input` |
| `strategies trades` | List trade summaries linked to a strategy | `--profile`, `--id` |
| `journal list` | Filter journal summaries, ordered by newest activity | `--profile` |
| `journal overview` | Counts and one-account realized results | `--profile` |
| `trades corrections` | Read correction history grouped by operation | `--profile`, `--id` |
| `trades get` | Read complete source records and current calculations | `--profile`, `--id` |
| `trades create` | Create a trade with up to six legs | `--profile`, `--operation-id`, `--input` |
| `trades update` | Edit context or link/unlink a strategy | `--profile`, `--id`, `--revision`, `--operation-id`, `--input` |
| `trades delete` | Delete a trade and all children | `--profile`, `--id`, `--revision`, `--yes` |
| `legs list` | List legs of a trade | `--profile`, `--trade` |
| `legs get` | Read a legs record | `--profile`, `--trade`, `--id` |
| `legs add` | Add a legs record and replay history | `--profile`, `--trade`, `--revision`, `--operation-id`, `--input` |
| `legs update` | Correct a legs record and replay history | `--profile`, `--trade`, `--id`, `--revision`, `--operation-id`, `--input` |
| `legs delete` | Remove a legs record and replay history | `--profile`, `--trade`, `--id`, `--yes`, `--revision`, `--operation-id` |
| `executions list` | List executions of a trade | `--profile`, `--trade` |
| `executions get` | Read a executions record | `--profile`, `--trade`, `--id` |
| `executions add` | Add a executions record and replay history | `--profile`, `--trade`, `--revision`, `--operation-id`, `--input` |
| `executions update` | Correct a executions record and replay history | `--profile`, `--trade`, `--id`, `--revision`, `--operation-id`, `--input` |
| `executions delete` | Remove a executions record and replay history | `--profile`, `--trade`, `--id`, `--yes`, `--revision`, `--operation-id` |
| `adjustments list` | List adjustments of a trade | `--profile`, `--trade` |
| `adjustments get` | Read a adjustments record | `--profile`, `--trade`, `--id` |
| `adjustments add` | Add a adjustments record and replay history | `--profile`, `--trade`, `--revision`, `--operation-id`, `--input` |
| `adjustments update` | Correct a adjustments record and replay history | `--profile`, `--trade`, `--id`, `--revision`, `--operation-id`, `--input` |
| `adjustments delete` | Remove a adjustments record and replay history | `--profile`, `--trade`, `--id`, `--yes`, `--revision`, `--operation-id` |
| `legs correct-snapshot` | Preview or apply a correction to one historical instrument snapshot | `--profile`, `--trade`, `--id`, `--revision`, `--input` |
| `operations get` | Check whether a trade operation committed | `--profile`, `--trade`, `--operation-id` |
| `calculate trade` | Replay source history without changing persisted summaries | `--profile`, `--id` |
| `calculate size` | Compute single-leg linear sizing with decimal arithmetic | `--profile`, `--trade`, `--leg` |
| `settings get` | Read display preferences | `--profile` |
| `settings update` | Update preferences and owned default account | `--profile`, `--revision`, `--input` |
| `export` | Export complete versioned journal source data | `--profile` |
| `export verify` | Verify portable integrity, versions and replay without journal writes | `--input` |
| `import preview` | preview portable journal JSON with add-only or replacement mode | `--profile`, `--mode`, `--input` |
| `import apply` | apply portable journal JSON with add-only or replacement mode | `--profile`, `--mode`, `--accept-preview`, `--operation-id`, `--input` |
| `import status` | status a durable journal import | `--profile` |
| `import resume` | resume a durable journal import | `--profile`, `--operation-id` |
| `import rollback` | rollback a durable journal import | `--profile`, `--operation-id`, `--yes` |
| `backup list` | List private retained journal recovery backups | `--profile` |
| `backup export` | Download recovery backup as portable journal JSON | `--profile`, `--operation-id` |
| `backup delete` | Permanently delete a completed recovery backup | `--profile`, `--operation-id`, `--yes` |
<!-- command-inventory:end -->

## Input and safeguards

- Mutations with data accept `--input <file>` or `--input -`. Input is JSON validated against that command's schema; extra fields fail. Financial values must be decimal strings. Timestamps must include `Z` or a numeric offset.
- `ids` generates stable caller-owned IDs. Use those IDs in create payloads. Never use an ID returned by an earlier uncertain create as evidence that it succeeded; read the record first.
- Updates and deletes require `--revision <number>`. Leg, execution and adjustment changes also require `--trade <trade-id>` and use that parent trade revision. Trade changes require a unique `--operation-id` so retries can be reconciled.
- `--dry-run` runs mutation validation and returns the proposed effect without writing. Deletes also require `--yes`.
- Snapshot correction takes the current `--revision`, target `--trade` and `--id`, plus instrument JSON. First call with `--preview`; then submit the returned 64-character fingerprint through `--accept-preview <fingerprint>` along with `--operation-id` and the same revision.
- Use `export --output <path>` to write the versioned export. The command protects an existing file; `--overwrite` is explicit.

## Typical discovery

```sh
node /path/to/vx-trade-journal/scripts/vxjournal.mjs help
node /path/to/vx-trade-journal/scripts/vxjournal.mjs schema --command 'trades create'
node /path/to/vx-trade-journal/scripts/vxjournal.mjs doctor --profile dev
node /path/to/vx-trade-journal/scripts/vxjournal.mjs ids --count 3
```
