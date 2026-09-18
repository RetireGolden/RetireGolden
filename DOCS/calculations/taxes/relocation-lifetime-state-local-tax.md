## Claim

Kind: composition. `projection/relocation.ts#compareRelocationCandidates` sums a row's recorded nominal per-year state-plus-local income-tax lines over the complete projection to publish that candidate's lifetime state and local tax, with no stated rounding.

## Justification

The row exposes the exact annual reconciliation series `stateTaxByYear`, so `lifetimeStateLocalTax=sum_y stateTaxByYear[y].tax`; federal tax, property tax, sales tax and cost of living are outside this quantity. The domain is a successful candidate row with a finite annual series.

## Inputs

| Year | Recorded state + local tax | Unit |
|---|---:|---|
| 2026 | 4,250.00 | nominal dollars |
| 2027 | 5,100.25 | nominal dollars |
| 2028 | 3,900.00 | nominal dollars |

## Arithmetic

`$4,250.00 + $5,100.25 + $3,900.00 = $13,250.25`.

## Expected

Lifetime state and local tax is exactly `$13,250.25`, with exact-cent tolerance because the result is a direct sum of recorded cent amounts.

## Wrong readings

- Using only the destination's post-move years 2027-2028 gives `$9,000.25` and wrongly drops the split/baseline year.
- Treating the annual lines as real dollars and applying an extra 3% discount gives `$12,502.74` (`4250/1.03 + 5100.25/1.03^2 + 3900/1.03^3`, rounded here only to show the wrong result).

## Family

outputs: `relocation-lifetime-state-local-tax`.

feeds: `insight-state-relocation-lifetime-state-tax-savings`, `scenario-comparison-cell`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
