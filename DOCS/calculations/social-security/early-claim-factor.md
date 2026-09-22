## Claim

Kind: formula. `socialSecurity/benefitFactor.ts#earlyRetirementFactor` computes the retirement-benefit factor for months before NRA by reducing PIA 5/9 of 1% per month for the first 36 months and 5/12 of 1% for additional months.

## Justification

For \(m\ge0\) months early, reduction is \(\min(m,36)\cdot5/(9\cdot100)+\max(0,m-36)\cdot5/(12\cdot100)\), and factor is one minus that reduction. The example deliberately crosses 36 months.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Months before NRA | 60 | months |
| First-band rate | 5/9 of 1 | percent/month |
| Later-band rate | 5/12 of 1 | percent/month |

The rates are stated in the `earlyRetirementFactor` comment.

## Arithmetic

First 36-month reduction: `36 × 5/(9×100) = 1/5 = 20%`.

Remaining reduction: `(60 - 36) × 5/(12×100) = 1/10 = 10%`.

Factor: `1 - 1/5 - 1/10 = 7/10 = 0.70`.

## Expected

Exact derived factor: `7/10`; published floating figure: `0.70`; fixture tolerance: `1e-12`, sufficient for the short rational-operation chain.

## Wrong readings

- Applying 5/9 of 1% for all 60 months produces factor `2/3 ≈ 0.6666667`.
- Treating 5/9 as 5.9% per month drives the factor below zero.

## Family

outputs: none.

feeds: `social-security-benefit-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
