# Walkthroughs

A walkthrough takes one plan from the app's example library and works one or more projection years out by hand: every published figure of each year derived from the plan's inputs and the engine's documented contracts (the calculation worksheets under `DOCS/calculations/`, the `YearResult` field comments, the parameter packs), without running the engine, then independently recomputed, and only then held against the engine by a test. The public methodology site renders each walkthrough from the evidence file the test keeps fresh.

Each walkthrough has five parts, all pinned to the same commit:

| Part | Where | What it holds |
|---|---|---|
| Derivation | `DOCS/walkthroughs/<id>.md` | the year by hand: inputs as built, every figure with its arithmetic and its contract, the wrong readings a test rejects, the contracts found ambiguous, a suggested later year |
| Independent check | `DOCS/walkthroughs/REVIEW-<date>.md` | a second derivation of every figure and a check of every citation, with a verdict |
| Rows | `packages/planner-ui/src/planner/examples/walkthroughs/<id>.walkthrough.ts` | the hand table as data: each row's value written as the expression the derivation states, its derivation, its contract, and the selector that reads the engine's figure |
| Test | `packages/planner-ui/src/planner/examples/walkthroughs/<id>.test.ts` | holds the engine to every row (numbers to half a cent, strings exactly); its `it()` title is what the engine's coverage index publishes under `walkthroughs` |
| Evidence | `DOCS/operations/walkthroughs/<id>.json` | the rows with the engine's figures beside the hand values, the reading notes and the plan as built; written by `pnpm walkthroughs:export` in `packages/planner-ui` and held fresh by `walkthroughEvidence.test.ts` |

| Id | Example | Year | Derivation | Check | Rows and test |
|---|---|---|---|---|---|
| rmd-irmaa | High balances: RMDs and IRMAA (`buildRmdIrmaa.ts`) | 2026 | [rmd-irmaa.md](rmd-irmaa.md) | [REVIEW-2026-09-22.md](REVIEW-2026-09-22.md) | `rmdIrmaa.walkthrough.ts`, `rmd-irmaa.test.ts` |
| early-retiree-aca | Early retiree and the ACA cliff (`buildEarlyRetireeAca.ts`) | 2026 | [early-retiree-aca.md](early-retiree-aca.md) | [REVIEW-2026-09-22.md](REVIEW-2026-09-22.md) | `earlyRetireeAca.walkthrough.ts`, `early-retiree-aca.test.ts` |
