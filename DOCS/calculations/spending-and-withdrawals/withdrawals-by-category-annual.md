## Claim

Kind: composition. `projection/internal/types/yearLedger.ts#YearWithdrawals` partitions annual withdrawals by source-account category in the stated sequence: cash-account draws in `cash`, taxable-account draws in `taxable`, traditional-account draws in `traditional`, Roth-account draws in `roth`, and HSA draws in `hsa`. The comments additionally state that traditional RMDs and SEPP distributions are included in `traditional`; forced inherited traditional dollars join `traditional`, while forced inherited Roth dollars join `roth`.

## Justification

The category meanings and order come from the `YearWithdrawals` comment. The `YearResult.rmd`, `sepp`, `inheritedDistribution`, and `inheritedTraditionalDistribution` comments provide the stated inclusions. Those named amounts are subsets, not extra categories or amounts to add again.

## Inputs

| Published year-row component | Value | Unit |
|---|---:|---|
| `withdrawals.cash` | 4,000 | nominal dollars/year |
| `withdrawals.taxable` | 11,000 | nominal dollars/year |
| `withdrawals.traditional` | 18,000 | nominal dollars/year |
| of which `rmd` | 8,000 | nominal dollars/year |
| of which `sepp` | 3,000 | nominal dollars/year |
| of which forced inherited traditional | 2,000 | nominal dollars/year |
| `withdrawals.roth` | 7,000 | nominal dollars/year |
| of which forced inherited Roth | 1,000 | nominal dollars/year |
| `withdrawals.hsa` | 2,000 | nominal dollars/year |

## Arithmetic

Published category vector: `{$4,000, $11,000, $18,000, $7,000, $2,000}` for `{cash, taxable, traditional, roth, hsa}`.

Traditional residual not in the named subsets: `$18,000 - $8,000 - $3,000 - $2,000 = $5,000`.

Roth residual not forced inherited Roth: `$7,000 - $1,000 = $6,000`.

## Expected

Exact category values: `cash $4,000; taxable $11,000; traditional $18,000; roth $7,000; hsa $2,000`. Fixture tolerance: absolute `$0.005` per dollar category, because these are unrounded binary-floating-point annual amounts.

## Wrong readings

- Adding RMD, SEPP, and forced inherited traditional dollars on top of `traditional` reports `$31,000` traditional instead of `$18,000`.
- Putting the `$1,000` forced inherited Roth amount in `traditional` produces `$19,000` traditional and `$6,000` Roth.
- Treating HSA as a sixth non-withdrawal bucket omits `$2,000` from the category publication.

## Family

outputs: `withdrawals-by-category-annual`.

feeds: `withdrawals-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-five.md in this directory.
