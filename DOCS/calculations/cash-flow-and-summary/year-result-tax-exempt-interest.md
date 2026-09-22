## Claim

Kind: formula. `projection/internal/types/result.ts#YearResult.taxExemptInterest` is the account-generated federally tax-exempt interest total except in a known ACA contract year, when it is `max(attested household tax-exempt interest, plan-generated subset)`. Generated account interest is the stated taxable-account balance times `taxExemptInterestYieldPct / 100`. The multiplication is derived from the schema's annual-yield convention.

## Justification

The interest is cash-real but excluded from ordinary income. The ACA characterization prevents a known household total from being understated by the modeled subset.

## Inputs

| Input | Case A: no known ACA contract | Case B: known ACA contract | Unit |
|---|---:|---:|---|
| Taxable-account start balance | 200,000 | 200,000 | nominal dollars |
| Tax-exempt interest yield | 2 | 2 | percent/year |
| Attested household total | n/a | 6,000 | nominal dollars/year |
| Account return / inflation | 0 / 0 | 0 / 0 | percent/year |

## Arithmetic

Generated total `= $200,000 × 2% = $4,000`. Case A publishes `$4,000`. Case B publishes `max($6,000, $4,000) = $6,000`.

## Expected

Exact values: Case A `taxExemptInterest = $4,000`; Case B `taxExemptInterest = $6,000`. Fixture tolerance: absolute `$0.005`, because yield multiplication uses binary floating point.

## Wrong readings

- Adding attested and generated figures in Case B produces `$10,000`.
- Always preferring the generated subset produces `$4,000` in Case B.
- Treating tax-exempt interest as non-cash produces `$0` in Case A.

## Family

outputs: `year-result-tax-exempt-interest`.

feeds: `income-total-annual`; `tax-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory.
