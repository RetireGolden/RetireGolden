## Claim

Kind: composition. The `averagePreRetirementSavingsRatePct` field's doc comment states that `projection/compare.ts#summarizeProjection` computes the unweighted arithmetic mean, in percentage points, of the published `savingsRates[].ratePct` values over the years strictly before the primary person's target retirement year (birth year plus retirement age, 65 when unset), with every qualifying year counted once regardless of income and 0 when no year qualifies; no rounding is stated.

## Justification

For `n>0` qualifying working-year rates `r_i`, an average giving every represented working year equal weight is `r_bar=(sum r_i)/n`; it is not a dollar-weighted ratio because the summary publishes the per-year rates as its input series. An empty qualifying set publishes exactly 0.

## Inputs

Assume the primary person was born in 1964 and has retirement age 65, so the target retirement year is `1964 + 65 = 2029`.

Case 1 — qualifying years (every listed working year is strictly before 2029):

| Year | Savings rate | Unit |
|---|---:|---|
| 2026 | 10 | percentage points |
| 2027 | 20 | percentage points |
| 2028 | 35 | percentage points |

Case 2 — no qualifying year (every listed year is at or after 2029):

| Year | Savings rate | Unit |
|---|---:|---|
| 2029 | 10 | percentage points |
| 2030 | 20 | percentage points |
| 2031 | 35 | percentage points |

## Arithmetic

`sum r_i = 10 + 20 + 35 = 65` percentage points. `n=3`. `r_bar=65/3=21.6666666666667%`.

## Expected

- Case 1: average pre-retirement savings rate `21.6666666666667%`, absolute tolerance `1e-12` percentage points, derived from one floating-point division with no specified output rounding.
- Case 2: with no qualifying year, average pre-retirement savings rate exactly `0%`.

## Wrong readings

- Dividing by four calendar boundaries rather than three represented working years gives `16.25%`.
- Taking the terminal working-year rate rather than the mean gives `35%`.
- Counting the target retirement year itself as pre-retirement.

## Family

outputs: `projection-summary-average-pre-retirement-savings-rate-pct`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-slice-seven.md in this directory (approved with a note, closed by the doc comment named in that file; the revision on that comment, with the empty case added, was re-checked and approved the same day, see the re-check section of that file).

Revision: wording revised on 2026-09-18 from the added doc comment, with the worked values unchanged and the empty case added.
