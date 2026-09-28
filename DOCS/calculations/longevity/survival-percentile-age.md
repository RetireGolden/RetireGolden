## Claim

Kind: formula. `montecarlo/survival.ts#survivalPercentileAge` returns the oldest integer age whose conditional survival probability from the current age, read off the survival curve (`survival-probability-product`), is at least `pct/100`, bounded by the current age and the table endpoint. For 'average' the curve is the 50/50 mixture of the two sexes.

Revision 2026-09-27 (decision D-LIFE-TABLE-2023): the survivals are the curve's on SSA's published 2023 q (the 2022 identity's `S(66) = 0.982070561017930` and `S(67) = 0.963150477964002` are replaced; the answer, 66, is unchanged), and 'average' is the mixture.

## Justification

Survival is nonincreasing because every annual factor lies in `[0,1]`; consequently the qualifying ages form an initial interval and its last member is the stated percentile age. Domain: percentage threshold interpreted on 0–100 scale and valid age/sex/hazard inputs. An age read off the mixture's curve is not the mean of the male and female ages.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Current age | 65 | years |
| Sex | male; for the second case each sex | category |
| Threshold | 97; for the second case 50, 25, 10 | percent |
| Hazard | 1 | ratio |

## Arithmetic

`S(65)=1`. `S(66)=0.983545 >= 0.97`. `S(67)=0.96626018017 < 0.97`. Therefore the oldest qualifying age is 66.

A current age past the table, 125: no later age is reached (the closed last row), so the answer is the floored current age, 125, which is already reached; the answer is at most max(119, the floored current age).

At 50, 25 and 10 percent from 65 (exact rational arithmetic on the printed columns): a man 83, 89 and 94; a woman 86, 92 and 96; 'average' 85, 91 and 95, which are not the means of the male and female ages (84.5, 90.5 and 95).

## Expected

| Case | Value |
|---|---:|
| Male from 65 at 97% | 66 |
| Male from 65 at 50%, 25%, 10% | 83, 89, 94 |
| Female from 65 at 50%, 25%, 10% | 86, 92, 96 |
| Average from 65 at 50%, 25%, 10% | 85, 91, 95 |
| Male from 125 at 50% | 125 |

Exact integers.

## Wrong readings

- Returning the first failing age gives `67`.
- Interpreting 97 as a probability rather than 97% finds no later age and can incorrectly return only the current age `65`.
- 'average' as the mean of the male and female ages: 84.5, 90.5 and 95 from 65.

## Family

outputs: `longevity-survival-percentile-age`.

feeds: `spending-base-annual` (the amortization-based spending policy's survival-percentile horizon, worked out again on every projection).

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-14, by independent recomputation without executing the engine; see REVIEW-2026-09-14.md in this directory.

Revision 2026-09-27: restated by claude (opus 5.5) from the D-LIFE-TABLE-2023 derivation (sections 7.6 and 8.2) and its independent check (F2: the percentile ages at 65 are not averages) (both in RetireGolden-Docs, `calculations/bidirectional-validation-plan-2026-09-13/evidence/life-table-2023-derivation.md` and `calculations/bidirectional-validation-plan-2026-09-13/evidence/life-table-2023-check.md`, at commit `75e1cf87`); the values above were recomputed in exact rational arithmetic from the printed columns, importing nothing from the engine; not yet reviewed.
