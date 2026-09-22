## Claim

Kind: composition. `socialSecurity/survivorBenefit.ts#survivorReductionFactor; #survivorBenefitMonthly` computes monthly survivor benefit as the greater of deceased actual benefit and 82.5% of deceased PIA, multiplied by a linear widow(er) factor from 71.5% at age 60 to 100% at survivor FRA.

## Justification

Base \(W=\max(A,0.825P)\). Between age 60 (720 months) and survivor FRA \(F\), the stated linear factor is \(0.715+0.285(m-720)/(F-720)\), clamped to 0.715 below 60 and 1 at/after FRA. Monthly benefit is \(W\) times that factor.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Deceased PIA | 2,000 | dollars/month |
| Deceased actual benefit | 1,400 | dollars/month |
| Survivor claim age | 60 years 0 months | age |
| Survivor FRA | 66 years 8 months | age |
| Widow-limit fraction | 0.825 | fraction |
| Maximum reduction | 0.285 | fraction |

Constants are `WIDOW_LIMIT_PIA_FRACTION`, `SURVIVOR_EARLIEST_AGE`, and `SURVIVOR_MAX_REDUCTION`.

## Arithmetic

Widow-limit amount: `$2,000 × 0.825 = $1,650`.

Survivor base: `max($1,400,$1,650) = $1,650`.

At age 60 factor: `1 - 0.285 = 0.715`.

Benefit: `$1,650 × 0.715 = $1,179.75` per month.

## Expected

Exact derived and published monthly benefit: `$1,179.75`; fixture tolerance: absolute `$0.005` for cents computed in binary floating point.

## Wrong readings

- Using the deceased actual benefit without RIB-LIM produces `$1,001.00`.
- Using worker FRA 67 instead of the distinct survivor FRA changes intermediate reductions for claims between 60 and FRA.

## Family

outputs: none.

feeds: `social-security-benefit-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
