## Claim

Kind: formula. `insights/types.ts#InsightImpact.endingAfterTaxEstateDelta` and `.lifetimeTaxDelta`, populated by `decisions/evaluateCandidate.ts#evaluateCandidate`, are candidate minus baseline on their respective summaries. The estate field comment explicitly states that subtraction order; the lifetime-tax comment defines a negative value as savings, implying the same candidate-minus-baseline convention.

## Justification

Both figures compare the same candidate and baseline. Keeping the subtraction order consistent makes an estate improvement positive and a tax saving negative.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Baseline ending after-tax estate | 500,000 | nominal dollars of the plan's last year |
| Candidate ending after-tax estate | 530,000 | nominal dollars of the plan's last year |
| Baseline lifetime taxes and penalties | 200,000 | nominal dollars, each year's own, summed |
| Candidate lifetime taxes and penalties | 185,000 | nominal dollars, each year's own, summed |

## Arithmetic

Ending after-tax estate delta `= $530,000 - $500,000 = +$30,000`. Lifetime tax delta `= $185,000 - $200,000 = -$15,000`; the negative sign denotes savings.

## Expected

Exact values: `endingAfterTaxEstateDelta = +$30,000`; `lifetimeTaxDelta = -$15,000`. Fixture tolerance: absolute `$0.005`, because summary dollars and subtraction are represented in binary floating point.

## Wrong readings

- Reversing both subtractions gives estate delta `-$30,000` and lifetime tax delta `+$15,000`.
- Reporting the candidate totals themselves gives `$530,000` and `$185,000`, not deltas.
- The `irmaa-tier-edge` detector's calculation record writes its annual premium cliff—for example `$2,400`—into `endingAfterTaxEstateDelta` as an avoidance signal. Reading that `$2,400` as candidate-minus-baseline estate change is wrong; the field comment explicitly names this exception.

## Family

outputs: `insight-impact-ending-after-tax-estate-delta`; `insight-impact-lifetime-tax-delta`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eleven.md in this directory.

## Restated (PR #754 review, finding 7, 2026-09-27)

The record's statement and this worksheet's inputs named the unit as today's dollars. Both deltas are differences of `summarizeProjection` figures, which are nominal: the ending after-tax estate is in dollars of the plan's last year, and the lifetime sum adds each year's own dollars. `InsightImpact`'s comments (slice 3) and the census families (`insight-impact-ending-after-tax-estate-delta` and `insight-impact-lifetime-tax-delta`, basis `nominal`) already say so, and the Insights card prints no basis beside either figure ("Ending estate delta", "Lifetime tax delta"). The evidence plan runs at zero inflation, so its figures are the same in either basis and no worked value moves. The record is unreviewed until the review lane checks the correction. RetireGolden-Pro renders these fields in its review queue; its labels are outside this repository and are on the slice's Pro follow-up list.
