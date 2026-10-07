# Project governance

Engineering standards for consistent development across models and sessions.

## Requirements

- [docs/PRD.md](docs/PRD.md) owns product requirements, technology direction and acceptance criteria.
- Ground changes in current repository state and a defined requirement. Keep scope bounded and preserve existing workspace contributions.
- Resolve material ambiguities before implementing affected behavior. Requirement changes belong in the PRD.
- For each new or changed journal capability, assess website and CLI access together. Update affected shared operations, CLI contracts, skill guidance and acceptance coverage in the same change. Define equivalent observable outcomes in the PRD; document intentional interface exclusions there.

## Engineering

- Build cohesive modules with explicit contracts and independently testable domain logic. Shared model creation, transformations and calculations have a single implementation at the appropriate owning layer.
- Separate presentation, editable state and application operations. Keep state transitions and event handling explicit, with one owner for each update.
- Choose tools and abstractions according to the PRD's technology criteria and demonstrated implementation needs.
- Preserve financial precision, historical integrity and reproducible results throughout data handling.
- Validate external inputs and enforce domain invariants; internal code relies on established contracts. Error handling addresses concrete failure and recovery requirements.
- Runtime code targets the current schema. Disposable emulator data may be reset; retained and production data evolve through immutable adjacent schema migrations executed by guarded deployment. Each schema increment supplies exactly one transition from the preceding schema. Never infer a baseline from missing metadata or bypass maintenance, validation, checkpoints or recovery safeguards.
- Backup, migration and compatibility tooling serve concrete preservation or recovery requirements and remain proportional to current application scale.

## Interface design

- Establish a coherent visual language through shared tokens for typography, spacing, control dimensions and responsive density. Component styles own their states and responsive rules together.
- Compose screens from reusable semantic components and layout patterns. Validate representative screen patterns before extending them across workflows. Component contracts distinguish container layout, control attributes, content and interaction state.
- Organize workflows through clear action hierarchy, related field groups and progressive disclosure. Content length and mixed control types inform alignment, sizing and spacing.
- Give navigation and editing a consistent lifecycle covering browser history, draft preservation, save/cancel transitions and focus restoration.
- Shared form components own label, help and error associations, validation feedback and keyboard behavior. Responsive layouts preserve required information and actions.

## Quality

- Develop behavior through a failing test, the smallest correct implementation and refactoring. Bug fixes include regression coverage.
- Delegate test execution at failing-test, passing-test and regression stages to a `worker-m` sub-agent. The main agent retains test design, implementation and result evaluation.
- At the failing-test stage, execute the new regression and confirm the intended failure. At the passing-test stage, execute that regression and directly related coverage. At completion, execute affected coverage against the final implementation; reuse passing results when their tested inputs remain unchanged. Subsequent edits invalidate only affected checks.
- Select explicit commands using the [PRD verification matrix](docs/PRD.md#verification-selection-and-checkpoints) and explain their coverage. Expand to the affected suite when impact cannot be bounded; run complete verification for unresolved impact across suites. Do not infer passing verification from zero executed tests.
- Run `npm run check` once before merging an accumulated batch into the main branch. Complete checks are integration/release gates, not mandatory for every task. The acceptance ledger maps permanent evidence, not a per-change execution checklist.
- Worker summaries provide commands, outcomes, expected-failure confirmation and actionable diagnostics. Full test output stays in worker context.
- Verify observable outcomes against independently derived expectations, especially for financial calculations.
- Evaluate applicable repository checks against acceptance criteria, with unverified behavior and remaining limitations identified explicitly.
- Functional, visual and accessibility checks provide distinct acceptance evidence. Review rendered screens at representative mobile, intermediate and desktop widths, including dense forms, long content and relevant interaction states.
- Changes to shared interface components receive targeted layout and interaction regressions. Test expectations verify component contracts and user-visible outcomes.
- Documentation changes receive content and reference checks.
- Generate the skill command inventory from the CLI catalogue with `npm run skill:docs`. `npm run skill:docs:check` rejects stale inventory and invalid documented command examples. Run `npm run test:skill` for packaging, runtime dependency or installation-guidance changes and at complete verification checkpoints. Ordinary CLI/shared behavior changes require focused source/interface coverage and applicable documentation checks, without a fresh packaged installation.

## Releases

- Use [Semantic Versioning](https://semver.org/) for application releases. Initialize `package.json` version to `0.1.0` when scaffolding; it is the release version source. Keep lockfile metadata synchronized and derive application build metadata from it.
- During `0.x` development, increment minor for new features or breaking changes and patch for compatible fixes. From `1.0.0`, increment major for breaking changes, minor for compatible features and patch for compatible fixes; reset lower components when incrementing a higher one.
- Assess compatibility against supported website and CLI workflows, CLI command/JSON contracts and persisted/exported data contracts actually in use. Establish `1.0.0` for the first stable production release.
- Classify each release’s persistence impact: compatible addition, schema transition, calculation change or rules/index change. Explain whether conversion is required. Applied migrations retain identifiers and source checksums; preserve every adjacent path needed by retained records. Deployment rejects downgrades, missing paths and modified applied migrations.
- Migration and restoration require privileged operator access, verified private snapshots, exclusive fenced ownership and persistence-enforced maintenance. Database version advances only after full target validation. Failed runs remain unavailable until explicit resume or verified recovery; preserve financial source data, ownership, identities and historical meaning. Database administration is excluded from installed user skills.
- Update versions when preparing releases. Use numbered prerelease identifiers for release candidates. Document, schema and calculation versions remain independent.
- Each release uses an immutable annotated Git tag `v<version>` matching the package version and tested commit. Tag notes describe changes, any required data-conversion steps and known limitations.
- Release readiness requires complete verification executed by `worker-m` and a successful production build against release inputs. Reuse integration results only when source, tests, configuration, dependencies and packaged artifacts remain unchanged; regenerate commit-bearing build metadata when the release revision changes. Deployment metadata identifies the released version and commit.
- Each application release includes a generated skill distribution from the same tested commit and package version, with `npm run test:skill` passing. Installed skills are snapshots: document replacement and dependency installation for upgrades; do not assume website deployment updates an installed skill. Keep installed runtime guidance self-contained; repository maintenance policy belongs in AGENTS.md and the PRD.

## Security

- Enforce ownership and validation at the persistence boundary; verify isolation across related records.
- Protect credentials and user privacy. Automated tests use isolated environments and synthetic data.

## Development continuity

- Record choices made during ongoing development in [docs/DECISIONS.md](docs/DECISIONS.md). Use concise dated entries with the decision and reason; include tradeoffs and affected work when relevant.
- Revisit decisions as development progresses. Record changes of direction as subsequent entries linked to the earlier choice.
- Shared work has explicit ownership and integration boundaries. The coordinating agent retains scope and integration accountability.
- Create sub-agents sequentially for conflicting or dependent tasks, completing and evaluating each preceding task before creating the next. Parallel creation and execution serve only unrelated tasks with independent inputs and non-conflicting resources.
