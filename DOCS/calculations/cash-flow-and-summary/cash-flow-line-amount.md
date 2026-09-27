## Claim

Kind: composition. The selected-year cash-flow Sankey's amounts are engine figures: each link is one published cash-flow line's `planDollars` amount; the "Household cash" hub is the engine's cash-identity source total, `YearCashFlow.reconciliation.cash.sourceTotalPlanDollars` (`engine/src/projection/annualCashFlowReconciliation.ts#cashIdentity`); the "Unfunded" origin is the use-identity unfunded total, `reconciliation.uses.unfundedUsesPlanDollars` (`#useIdentity`). The page stops re-adding lines for those two nodes. The transfer-endpoint in/out sums and the "Other" grouping stay in the UI as chart aggregation (orchestrator decision R18). The dollar basis is slice 1's. No owner decision changes a number.

## What the UI computes today

`planner-ui/src/planner/yearCashFlow/buildYearCashFlow.ts` at `a7f62f1e` (unchanged by #747):

```ts
let sourceTotal = 0                                                          // :1026
let unfundedTotal = 0                                                        // :1027
for (const line of cashFlow.sourceLines) {
  const role = sourceRole(line)                                              // :956-961 keeps spendableSource, portfolioFunding, loanProceeds
  if (role === null) continue
  sourceTotal += line.amountPlanDollars                                      // :1034, in line order across the three roles
  ...
}
nodes.push(makeNode({ id: HOUSEHOLD_CASH_NODE_ID, ..., amountPlanDollars: sourceTotal, ... }))   // :1061-1075
for (const line of cashFlow.useLines) {
  ...
  if (line.unfundedPlanDollars > 0) { unfundedTotal += line.unfundedPlanDollars; ... }           // :1103-1104
}
if (unfundedTotal > 0) nodes.push(makeNode({ id: UNFUNDED_ORIGIN_NODE_ID, ..., amountPlanDollars: unfundedTotal, ... }))  // :1133-1149
```

Transfers view: each endpoint accumulates `totalIn`/`totalOut` and is sized `Math.max(totalIn, totalOut)` (`:1169-1171`); `grouping.ts:96-97` sums the collapsed "Other" node and `:163` merges links. `YearCashFlowSankey.tsx:139-150` prints each node's amount through the page's `displayAmount` (the transfer endpoints as "in $X / out $Y"), and the dialog's summary strip already prints the engine's `sourceTotalPlanDollars` and `unfundedUsesPlanDollars` (`YearCashFlowDialog.tsx:141, 144`), so the hub node and the strip can disagree in the last binary digit.

## Engine publication

No new function: the two identity totals are already published on every captured year (`annualCashFlowReconciliation.ts:134-185` and `:187-202`):

```ts
sourceTotalPlanDollars = spendableSourcesPlanDollars + portfolioFundingPlanDollars + loanProceedsPlanDollars   // each a sum by role, in line order
unfundedUsesPlanDollars = Σ over useLines of unfundedPlanDollars                                               // every line, in order
```

- After the move: the hub node's `amountPlanDollars` is `cashFlow.reconciliation.cash.sourceTotalPlanDollars`; the unfunded origin's is `cashFlow.reconciliation.uses.unfundedUsesPlanDollars`, and the node is emitted when that is `> 0` (as today). `sourceTotal` and `unfundedTotal` are deleted.
- Domain: a year whose report is `reconciled` (the builder refuses a `notReconciled` year before this point, `:1261-1268`). Units: nominal plan dollars of the year; the page converts with slice 1's dollar basis. Rounding: none.
- R18 (settled by the orchestrator): the endpoint `max(in, out)` sizes, the printed "in / out" totals and the "Other" sums add engine line amounts by the chart's own node grouping; they are view aggregation, reclassified as presentation and left in the UI.

## Justification

The engine's cash-flow record `cash-flow-reconciliation-totals` (`rules/calculations/cashFlowAndSummary.ts:1026` at `a7f62f1e`) defines the cash source total as the sum of exactly the three roles the hub keeps, and the use identity's unfunded total as the sum over all use lines. The UI's sums are the same sets in a different association (hub) or with zero terms skipped (unfunded).

## Inputs

Hub, one year's source lines in published order: spendable 41,234.11; portfolio funding 17,890.20; spendable 3,000.30; loan proceeds 0; spendable 12.07.

Unfunded, one year's use lines' `unfundedPlanDollars`: 0; 1,500.25; 0; 300.50; 0.10.

## Arithmetic

Hub, UI order: `((((41,234.11 + 17,890.2) + 3,000.3) + 0) + 12.07) = 62,136.68` (binary `62136.68`). Engine: spendable `(41,234.11 + 3,000.3) + 12.07`, portfolio `17,890.2`, loans `0`; `(spendable + portfolio) + loans = 62,136.68000000001`. They differ by `7.275957614183426e−12`; both print "$62,137".

Unfunded: UI adds the three positive lines, `1,500.25 + 300.5 + 0.1 = 1,800.85`; the engine adds all five, and adding an exact zero leaves a binary sum unchanged, so it is the same `1,800.85` bit for bit. That holds whenever no line is negative: on the example library none of the 4,466 published use lines is (420 are positive).

## Expected

Hub node `= sourceTotalPlanDollars`, `62,136.68000000001` for the case above (exact, Object.is), which is within `1e−9` of the retired sum; unfunded node `= unfundedUsesPlanDollars = 1,800.85` (exact, and equal to the retired sum).

Example library (scratch-copy run, 29 examples, every year with the cash-flow capture on, 1,210 years, all reconciled): the retired hub sum differs from `sourceTotalPlanDollars` in 30 years, by at most `5.82e−11`; the printed whole dollars differ in 0 years in nominal mode and 0 in today's-dollar mode. The unfunded origin exists in 175 years and equals the engine total bit for bit in all of them. Nothing displayed changes.

## Wrong readings

- A hub that also counts the other source roles (for example internal transfers or inflows the cash identity excludes): not the household-cash total the identity reconciles.
- An unfunded origin sized by the requested uses, or by funded plus unfunded: that is the use identity's disposition total, not the unfunded part.
- Treating the endpoint `max(in, out)` as a published figure: it is a node size for layout (R18).

## Parity test for the switch-over

`planner-ui/src/planner/yearCashFlow/buildYearCashFlow.parity.test.ts`: for the 29 examples, every captured year: the hub node's amount `Object.is` `reconciliation.cash.sourceTotalPlanDollars`, and the retired line-order sum (kept in the test) is within `1e−9`; `fmtMoney(displayAmount(year, ·))` of the two is identical in both dollar modes; the unfunded origin exists exactly when `unfundedUsesPlanDollars > 0` and equals it. The existing `buildYearCashFlow.test.ts` assertions on node sets are unchanged. Acceptance grep: no `sourceTotal +=` and no `unfundedTotal +=` in `buildYearCashFlow.ts`.

## Proposed calculation record

- id `cash-flow-drilldown-amounts`, group `cash-flow-and-summary`, kind `composition`, outputs `['cash-flow-line-amount']`. Statement: "In the selected-year cash-flow drilldown each link amount is one published line's planDollars; the Household cash node is reconciliation.cash.sourceTotalPlanDollars and the Unfunded node reconciliation.uses.unfundedUsesPlanDollars (annualCashFlowReconciliation.ts#cashIdentity, #useIdentity). Transfer-endpoint in/out sums and the Other group are chart aggregation in the UI (R18). Units: nominal plan dollars, shown through the page's dollar basis. Rounding: none." Justification: derivation, `DOCS/calculations/cash-flow-and-summary/cash-flow-line-amount.md`. Limits: "The endpoint and Other amounts printed on the chart are sums of engine lines by the chart's grouping and have no engine record; the Other threshold is a layout rule." implementedByFunctions `packages/engine/src/projection/annualCashFlowReconciliation.ts#cashIdentity`, `#useIdentity`.
- `cash-flow-reconciliation-totals` and `cash-flow-line-plan-dollars` add `cash-flow-line-amount` to `feeds`.

## Census bookkeeping

Convention (RetireGolden #747 at `093ae4b6`, Docs `3b5f835`): a relocated family's `uiSources` name the UI symbols that now read the engine value, the retired computing symbol moves to `notes` as history, and a conformance test fails on a `uiSources` entry that names a missing file or symbol.

- `relocation: { status: 'done', target: 'engine/src/projection/annualCashFlowReconciliation.ts#cashIdentity' }`; `uiSources` unchanged (`buildYearCashFlow.ts#buildYearCashFlowSankey` and `YearCashFlowSankey.tsx#YearCashFlowSankey` are the readers); notes gain "The hub and unfunded nodes were computed in planner-ui/src/planner/yearCashFlow/buildYearCashFlow.ts#buildCashFlowView (line sums) until B2-P1 slice 2; now the engine's reconciliation totals, which buildCashFlowView reads."; transformations "Links are published lines; the hub and unfunded nodes read reconciliation.cash.sourceTotalPlanDollars and reconciliation.uses.unfundedUsesPlanDollars; transfer-endpoint in/out and Other sums are chart aggregation (R18); every amount is shown through the dollar basis."; notes: "R18: the endpoint and Other sums are printed on node labels but are view aggregation of engine lines."
- Field coverage: add rows for the planner-ui node fields `YearCashFlowSankeyNode.totalInPlanDollars` / `totalOutPlanDollars` and the grouped `amountPlanDollars` of an Other node, `excluded` with the reason "chart aggregation of published lines (R18)"; the census has no reason kind for view aggregation, and the nearest existing one is `runtime-diagnostic`, which the file already uses for Sankey geometry. Recommended: add a reason kind `view-aggregation` to `validate-census.mjs` rather than stretch `runtime-diagnostic` over printed dollars.

## Family

outputs: `cash-flow-line-amount`.

feeds: none. Reads `cash-flow-line-plan-dollars` and `cash-flow-reconciliation-totals`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-26; the two cases by `scripts/independent.mjs`; example counts from the scratch-copy run (`scripts/engine-cashflow-buckets.json`). Checked by: a separate Claude (Opus 5.5) instance that did not derive it, which recomputed every value with its own scripts and ran the engine where a claim was numeric (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice2-check.md`): every expected value reproduces; its corrections are applied in the implementation section. Reviewed by: pending; the catalog asks for a reviewer of a different agent family, so the record is `unreviewed`.

## Implementation (B2-P1 slice 2, 2026-09-27)

- **Correction 10:** the relocation target and the record's pin are the exported `reconcileYearCashFlow`, which publishes both totals, not the module-private `cashIdentity`.
- **Open question 12:** the census gains the reason kind `view-aggregation` for the transfer endpoints' printed in and out totals (`YearCashFlowSankeyNode.totalInPlanDollars`, `totalOutPlanDollars`).
- Re-measured after #748 and #750 (1,210 captured years): the retired hub sum differs from `sourceTotalPlanDollars` in 32 years (the derivation's 30 was measured on #747), by at most 5.82e-11; no printed whole dollar changes in either dollar mode; the Unfunded node appears in 175 years and equals the engine total bit for bit.
