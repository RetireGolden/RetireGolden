## Claim

Kind: composition. `socialSecurity/currentSpouseBenefit.ts#ordinarySimultaneousEarlyCurrentSpouseComponents` uses the POMS order within its narrow domain: current-spouse context, both people alive in the priced period, positive spousal-payable months, one Social Security stream on each side, neither person declared disabled, exact configured claim dates, claimant before FRA, and worker already claimed. It computes unreduced excess `max(0, 0.5 × worker PIA - own PIA)` on raw PIAs, then multiplies only that excess by the spousal factor.

## Justification

At 24 months before FRA, the spousal reduction is `24 × 25/36 of 1% = 1/6`, so the spousal factor is `5/6`. The own component is the already retirement-factor-reduced `ownActualMonthly`; it is not recomputed from the raw PIA.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Own PIA | 1,000 | dollars/month |
| Own retirement claim factor | 13/15 | factor |
| Own actual benefit | 2,600/3 | dollars/month |
| Worker PIA | 3,000 | dollars/month |
| Months before claimant FRA | 24 | months |
| Spousal factor | 5/6 | factor |

The `currentSpouseBenefit.ts` header supplies the excess order and the 25/36-of-1%-per-month rate; `claimFactor.ts#spousalBenefitFactor` confirms no delayed credits.

## Arithmetic

Unreduced excess: `max(0, 0.5 × 3,000 - 1,000) = $500`.

Reduced auxiliary: `500 × 5/6 = 1,250/3 = $416.666666…`.

Own component: `1,000 × 13/15 = 2,600/3 = $866.666666…`.

Combined monthly amount: `2,600/3 + 1,250/3 = 1,283 1/3`.

## Expected

Exact derived components: own `2,600/3`, auxiliary `1,250/3`; combined `3,850/3 = $1,283.333333…` monthly. Fixture tolerance: `1e-9` dollars, sufficient for the short rational-operation chain without imposing currency rounding absent from this contract.

## Wrong readings

- Reducing half the worker PIA first and then subtracting reduced own benefit produces auxiliary `1,150/3 = $383.333333…` and combined `$1,250`.
- Subtracting raw own PIA after reducing the full spousal amount produces only `$250` of auxiliary.
- Applying the retirement factor to the excess instead of the spousal factor produces `$433.333333…`.

## Family

outputs: none.

feeds: `social-security-benefit-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-four.md in this directory.
