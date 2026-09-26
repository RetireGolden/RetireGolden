## Claim

Kind: formula. `socialSecurity/benefitFactor.ts#delayedRetirementFactor` increases retirement benefit by a credit rate r per month after NRA, capped at the months available through age 70. The rate is the 20 CFR 404.313(b)(2) credit for the effective birth year (`#delayedCreditMonthlyPct`): 2/3 of 1% for births after January 1, 1943, and less for earlier births. This worksheet works the 2/3 of 1% case.

## Justification

For \(m\ge0\) months late and cap \(c\ge0\), payable factor is \(1+\min(m,c)\cdot r/100\), with \(r=2/3\) in the case below. This gives no credit past age 70.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Months after NRA | 24 | months |
| Maximum months to age 70 | 36 | months |
| Credit rate (a birth after January 1, 1943) | 2/3 of 1 | percent/month |

The rate and cap convention are stated in the `delayedRetirementFactor` and `delayedCreditMonthlyPct` comments.

## Arithmetic

Credited months: `min(24,36) = 24`.

Credit: `24 × 2/(3×100) = 4/25 = 16%`.

Factor: `1 + 4/25 = 29/25 = 1.16`.

## Expected

Exact derived factor: `29/25`; published floating figure: `1.16`; fixture tolerance: `1e-12`.

## Wrong readings

- Applying 2/3 as a fraction rather than 2/3 of 1% produces factor `17`.
- Applying early-claim 5/9-of-1% rates produces `1.133333...`.
- Applying 2/3 of 1% to a birth on or before January 1, 1943 overstates the credit: a 1941 birth earns 5/8 of 1% a month, so 24 months give `1.15`, not `1.16`.

## Family

outputs: none.

feeds: `social-security-benefit-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory. Revision 2026-09-26 (RetireGolden #744): the rate became the birth-date table of 20 CFR 404.313(b)(2); the claim and justification were generalized to a rate r and a wrong reading added for a pre-1943 birth, edited by Claude to match the code; the worked 2/3 of 1% case is unchanged.
