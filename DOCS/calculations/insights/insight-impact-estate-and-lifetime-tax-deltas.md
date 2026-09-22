## Claim

Kind: formula. `insights/types.ts#InsightImpact.endingAfterTaxEstateDelta` and `.lifetimeTaxDelta`, populated by `decisions/evaluateCandidate.ts#evaluateCandidate`, are candidate minus baseline on their respective summaries. The estate field comment explicitly states that subtraction order; the lifetime-tax comment defines a negative value as savings, implying the same candidate-minus-baseline convention.

## Justification

Both figures compare the same candidate and baseline. Keeping the subtraction order consistent makes an estate improvement positive and a tax saving negative.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Baseline ending after-tax estate | 500,000 | today's dollars |
| Candidate ending after-tax estate | 530,000 | today's dollars |
| Baseline lifetime taxes and penalties | 200,000 | today's dollars |
| Candidate lifetime taxes and penalties | 185,000 | today's dollars |

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
