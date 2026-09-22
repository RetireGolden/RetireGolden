## Claim

Kind: model. `projection/internal/annualSocialSecurity.ts#annualSocialSecurity` falls back outside the guarded POMS-order helper to the documented approximation: reduce `0.5 × worker PIA` by the spousal factor first, then subtract the claimant's own benefit after its retirement claim factor, flooring the auxiliary excess at zero. This formula is derived from the extract's stated “reduce-then-subtract” convention.

## Justification

Using the same raw PIAs and 24-month-early factors as the POMS-order worksheet makes the modeling difference visible rather than hiding it behind different facts.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Own PIA | 1,000 | dollars/month |
| Own retirement claim factor | 13/15 | factor |
| Worker PIA | 3,000 | dollars/month |
| Spousal factor, 24 months early | 5/6 | factor |

The fallback order is stated in the `currentSpouseBenefit.ts` file header; the spousal rate is also stated by `claimFactor.ts#spousalBenefitFactor`.

## Arithmetic

Reduced full spousal amount: `0.5 × 3,000 × 5/6 = $1,250`.

Reduced own amount: `1,000 × 13/15 = 2,600/3 = $866.666666…`.

Fallback auxiliary: `max(0, 1,250 - 2,600/3) = 1,150/3 = $383.333333…`.

Combined amount: `2,600/3 + 1,150/3 = $1,250`.

## Expected

Exact derived fallback auxiliary: `1,150/3`; exact combined monthly benefit: `$1,250`. Fixture tolerance: `1e-9` dollars for the auxiliary and exact to cents for the integer-dollar combined result, because no further rounding convention is stated.

## Wrong readings

- A reader may expect the POMS-order figure from the paired worksheet: auxiliary `1,250/3 = $416.666666…`, combined `3,850/3 = $1,283.333333…`.
- Subtracting raw own PIA from the reduced full spousal amount produces a `$250` auxiliary.

## Family

outputs: none.

feeds: `social-security-benefit-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-four.md in this directory.
