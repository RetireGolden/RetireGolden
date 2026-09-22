## Claim

Kind: formula. `projection/optimizePlan.ts#SimpleCandidateEvaluation` sums the candidate result's `YearResult.rothConversion`; computes `afterTaxEstateDelta`, `lifetimeTaxDelta`, and `moneyLastsYearsDelta` candidate minus baseline using the two `summarizeProjection` results; and reports `incompleteComputationYears`, only when non-empty, as the sorted union of years across both results where `taxComputation.status` or `hecmComputation.status` is `incomplete`, omitting the key when no year qualifies. For money-lasts, the field comment defines `lastsThrough` as `depletionYear` when present and `endYear + 1` otherwise. The sum, differences, and sorted-union formulas are derived from those field conventions.

## Justification

The `SimpleCandidateEvaluation` field comments state the conversion sum and all three comparison directions. The comment on incomplete annual valuations says they remain informational, and the requested convention identifies both optional computation-status channels across both projections while making the published key conditional on a non-empty union. `recommendationState` has no census family this round and is deliberately not published.

## Inputs

| Input | Baseline result | Candidate result | Unit |
|---|---:|---:|---|
| Summary ending after-tax estate | 500,000.00 | 525,250.25 | nominal dollars at horizon |
| Summary lifetime taxes and penalties | 120,000.00 | 127,500.75 | nominal dollars over projection |
| `depletionYear` | 2034 | `null` | calendar year or null |
| `endYear` | 2035 | 2035 | calendar year |

Candidate year rows have `rothConversion` of `$12,500.25` in 2030 and `$7,500.50` in 2031. Baseline 2031 has `taxComputation.status = 'incomplete'`; candidate 2030 has `hecmComputation.status = 'incomplete'`; candidate 2031 also has `taxComputation.status = 'incomplete'`. All other stated tax and HECM statuses are complete or absent.

Empty-list branch fixture: both results have only complete or absent `taxComputation` and `hecmComputation` statuses.

## Arithmetic

Executed conversion total `= $12,500.25 + $7,500.50 = $20,000.75`.

After-tax-estate delta `= $525,250.25 − $500,000.00 = $25,250.25`.

Lifetime-tax delta `= $127,500.75 − $120,000.00 = $7,500.75`.

Baseline depletes, so `lastsThrough(baseline) = depletionYear = 2034`. Candidate never depletes, so `lastsThrough(candidate) = endYear + 1 = 2035 + 1 = 2036`. Money-lasts delta `= 2036 − 2034 = 2 years`.

Incomplete years before union are baseline `{2031}` and candidate `{2030, 2031}`. Set union removes the repeated 2031 and ascending sort gives `[2030, 2031]`. In the all-complete/absent branch, the union is `[]`.

## Expected

- `simple-candidate-evaluation-executed-conversion-total`: exact value `$20,000.75`; fixture tolerance absolute `$0.005`, because the dollar sum uses binary floating point.
- `simple-candidate-evaluation-after-tax-estate-delta`: exact value `$25,250.25`; fixture tolerance absolute `$0.005`, because dollar subtraction uses binary floating point.
- `simple-candidate-evaluation-lifetime-tax-delta`: exact value `$7,500.75`; fixture tolerance absolute `$0.005`, for the same reason.
- `simple-candidate-evaluation-money-lasts-years-delta`: exact value `2`; fixture tolerance exact because it is a count of years.
- `simple-candidate-evaluation-incomplete-computation-years`: exact list `[2030, 2031]`; fixture tolerance exact for values, order, and de-duplication. In the no-incomplete-status branch, the union it stands for is empty and the published object omits the key; fixture tolerance exact.

## Wrong readings

- Reversing candidate minus baseline gives estate `−$25,250.25`, lifetime tax `−$7,500.75`, and money-lasts `−2`.
- Using `endYear` instead of `endYear + 1` for the non-depleting candidate gives `2035 − 2034 = 1` year instead of `2`.
- Summing baseline conversions too would add amounts that the field comment restricts to the candidate result.
- Concatenating incomplete years without a set union gives `[2031, 2030, 2031]`; unioning without ascending sort can give `[2031, 2030]`, rather than `[2030, 2031]`.
- Publishing `incompleteComputationYears: []` in the no-incomplete-status branch instead of omitting the key.

## Family

outputs: `simple-candidate-evaluation-after-tax-estate-delta`, `simple-candidate-evaluation-executed-conversion-total`, `simple-candidate-evaluation-incomplete-computation-years`, `simple-candidate-evaluation-lifetime-tax-delta`, `simple-candidate-evaluation-money-lasts-years-delta`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 incomplete-years doc-comment completion), without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-nine.md in this directory (the re-check section named "Re-check, 2026-09-18 (the incomplete-years branch after the comment completion)").

Revision note: The first derivation expected an empty list where production omits the key, found by the implementation's fixture.
