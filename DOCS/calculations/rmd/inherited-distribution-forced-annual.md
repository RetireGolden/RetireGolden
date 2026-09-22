## Claim

Kind: composition. `projection/internal/types/result.ts#YearResult.inheritedDistribution` publishes the sum of every `inheritedAccounts[]` row's executed required amount, including annual/year-of-death requirements and final sweeps, across traditional and Roth inherited accounts; voluntary amounts are excluded. `#YearResult.inheritedTraditionalDistribution` publishes the phase's ordinary-income total, each traditional row in full plus, for a non-qualified inherited Roth distribution, its characterized taxable earnings, as its field comment now states; an earlier comment excluded Roth dollars outright, and decision D-INHERITED-ROTH-SLICE settles whether the published composition is the intended meaning. This record therefore derives both the gross forced total and that traditional share from `projection/internal/annualInheritedIraDistributions.ts#AnnualInheritedIraDistributionsResult`.

## Justification

`inheritedDistribution` is a gross forced-cash composition, so each row contributes its executed required amount once, regardless of tax character. The separate traditional-share publication is narrower. The extract's Roth characterization operation reports both gross `distributionAmount` and `ordinaryIncome`; therefore a taxable Roth slice changes the current traditional/ordinary-income share, not the gross forced total. The field comment now states this composition (its earlier wording excluded Roth dollars outright); D-INHERITED-ROTH-SLICE is queued to settle whether the published composition is the intended meaning, not to reconcile the comment with the code.

## Inputs

| Inherited row | Executed required amount | Voluntary amount | Characterized taxable Roth slice | Unit |
|---|---:|---:|---:|---|
| Traditional annual RMD | 8,000 | 4,000 | 0 | dollars |
| Roth final sweep | 3,000 | 0 | 600 | dollars |
| Traditional no-requirement row | 0 | 2,000 | 0 | dollars |

## Arithmetic

Gross forced total: `$8,000 + $3,000 + $0 = $11,000`.

Voluntary amounts excluded: `$4,000 + $2,000 = $6,000` contributes `$0` to the forced total.

Current-code traditional/ordinary-income share limit: traditional forced `$8,000` plus the Roth row's characterized taxable slice `$600` gives `inheritedTraditionalDistribution = $8,600`; the Roth row's remaining `$2,400` is not in that share. The gross forced total remains `$11,000`.

## Expected

Exact published `inheritedDistribution = $11,000`. Under the current-code limit described above, exact `inheritedTraditionalDistribution = $8,600`; also retain the Roth gross forced amount `$3,000` and characterized taxable slice `$600` as discriminating evidence for D-INHERITED-ROTH-SLICE. Fixture tolerance: exact, because these are additions of whole-dollar row amounts.

## Wrong readings

- Adding voluntary draws produces `$11,000 + $6,000 = $17,000`; voluntary amounts are excluded, so the forced total is `$11,000`.
- Excluding the Roth sweep from the gross forced total produces `$8,000`; `inheritedDistribution` includes both traditional and Roth forced character, so it is `$11,000`.
- Adding the `$600` Roth taxable slice again to gross forced cash produces `$11,600`; the slice characterizes part of the existing `$3,000` Roth row and is not new cash.
- Following the field comment's earlier wording, which excluded Roth dollars outright, would report `$8,000`; the comment now states the composition that reports `$8,600`, and D-INHERITED-ROTH-SLICE is queued on whether that composition is the intended meaning.

## Family

outputs: `inherited-distribution-forced-annual`.

feeds: `withdrawals-by-category-annual`; `withdrawals-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory (the follow-up review section) (approved with a note restating decision D-INHERITED-ROTH-SLICE, which the worksheet already names).

Revision note (2026-09-22, pull-request review of #730): the Claim, Justification and fourth wrong reading described the inheritedTraditionalDistribution comment as excluding Roth dollars; the comment completed on this branch states the published composition, so those sentences now say so and name the decision as one about the intended meaning. No value changed.
