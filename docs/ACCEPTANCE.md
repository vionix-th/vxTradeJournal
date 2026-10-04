# Acceptance evidence

This ledger maps the PRD acceptance criteria to permanent evidence. Test names describe observable outcomes; final command results belong in the delivery report. Automated environments contain synthetic data only. Browser lifecycle mechanics have no CLI equivalent; shared journal behavior must be exercised through both interfaces.

| PRD area | Permanent evidence |
|---|---|
| User isolation | `tests/integration/security.test.js`: denies anonymous and cross-user access including children; CLI: does not expose another user's records and rejects unsafe saved sessions |
| Catalogue | Domain: validates instrument readiness and snapshots remain independent; browser workflow configuration; CLI instrument create/preview contracts |
| Historical settings | Repository: persists source records, snapshots, historical edits and export-ready reload; CLI correction workflow; browser snapshot currency correction |
| Quantity sizing | Domain: sizes five contracts and floors fractional increments; uses conversion direction and adverse stop; browser trade-plan; CLI calculate size |
| Partial fills | Domain scaled-entry fixture; browser scaled-trade workflow; CLI records trades, calculations and corrections with revision and retry guarantees |
| Scaling | Domain: reproduces scaled entry fixture independently; browser complete workflow and reload |
| Short positions | Domain: uses short direction; browser short workflow |
| Multi-leg trades | Domain: closes multi-leg only after every leg closes and supports settlement; browser trade-capacity/workflows; CLI multi-leg manual-results workflow |
| Manual results | Domain: keeps missing manual result unknown and charges fees once; browser manual results, historical FX, retained validation and snapshot preview; CLI manual/incomplete FX |
| Currencies | Domain: preserves fees, signed adjustments, separate historical conversion rates; browser audit-financial; CLI invalidates snapshot FX in correction previews and saved records |
| Corrections | Domain: rejects correction causing later excess exit; repository invalid earlier corrections; browser/CLI correction preview and save |
| Reliability | Repository idempotent retry/stale revisions; CLI receipt/retry guarantees; browser concurrent edits and lifecycle/history regressions |
| Mobile/desktop | Browser workflows, layout and component-contracts; affected remediation states reviewed at 375/800/1280 px |
| Export | Application: exports reconstructible source records without auth secrets; browser workflow download/reload; CLI complete export and packaged skill |

## Final remediation regressions

| Contract | Evidence |
|---|---|
| Canonical creation/opening date | Repository: derives unfilled opening dates from canonical creation metadata; CLI creation/filter/replay/export assertions; browser `final-dates.spec.js` |
| Draft snapshots | Session: refreshes only unsaved leg snapshots and keeps preview and save consistent; reconciles refreshed draft currencies; browser `final-snapshots.spec.js` verifies quantity 50 → 5 and persisted replay |
| Accepted discard | Lifecycle/route-policy unit tests: session aliases, independent sessions, clean drafts, rejected departures, child Back and deleted-record handling; browser `final-discard.spec.js`: Cancel → Back, nested sidebar departure and reload success/failure |
| Confirmed-save refresh recovery | Browser `final-recovery.spec.js`: catalogue at 375/800/1280, trade, nested parent/focus return, repeated read failures, parent-discard Sign out acceptance/rejection and stale-auth completion; `editor-session.spec.js` verifies one write after inline reconstruction |
| Existing leg removal | Pending issue 5 |
| Reachable execution validation | Pending issue 6 |
| Current component contract | Existing planning-errors and component-contracts regressions |
| Credential input sources | Pending issue 8 |

## Final gate

Run `npm run check` and `npm run build:prod` from the final committed revision. The check includes lint, skill documentation contracts, unit/integration/browser acceptance, local build and portable packaged-skill acceptance. Verify generated application and skill metadata match the clean source revision; inspect affected rendered states and record functional, accessibility and visual evidence separately.

Known limits: automated browser coverage uses Chromium; classic History fallback preserves drafts and usable navigation but cannot guarantee the original physical cursor for unindexed entries. Production services are not exercised or deployed by this remediation. Disposable test records require no retained-data conversion.
