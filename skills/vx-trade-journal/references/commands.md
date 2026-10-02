# Command reference

The executable is `node /path/to/vx-trade-journal/scripts/vxjournal.mjs`. Use `help` for current commands and `schema` for exact inputs. Network commands require `--profile dev|test|auto|prod`; offline commands (`help`, `schema`, `version`, `ids`) do not. Success and errors are emitted as JSON. Preserve the process exit code and inspect the returned versioned envelope.

## Command groups

| Group | Commands |
|---|---|
| Authentication | `auth login`, `register`, `status`, `verify`, `reset`, `logout`; `doctor` |
| Accounts | `accounts list|get|create|update|archive|unarchive` |
| Instruments | `instruments list|get|create|update|archive|unarchive|presets|preview` |
| Strategies | `strategies list|get|create|update|archive|unarchive|trades` |
| Journal | `journal list|overview` |
| Trades | `trades get|create|update|delete`; `calculate trade|size`; `operations get` |
| Trade children | `legs list|get|add|update|delete|correct-snapshot`; `executions` and `adjustments` support `list|get|add|update|delete` |
| Settings and export | `settings get|update`, `export` |

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
