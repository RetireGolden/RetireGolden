## Claim

Kind: composition. `projection/internal/types/result.ts#YearResult.penalties`, composed by `projection/internal/annualFundingCandidateEvaluation.ts#annualFundingCandidateEvaluation` with `rmd/rmdShortfallExcise.ts#computeRmdShortfallExcise`, equals the 10% early-withdrawal penalty on pre-age-59½ taxable traditional withdrawals plus the IRC §4974 excise on the nonnegative RMD shortfall at the applicable stated rate; this fixture uses the stated post-SECURE-2 default rate of 25% and no relief.

## Justification

The inherited-IRA comments state both the 10% early-withdrawal rate and that inherited distributions are never subject to it. The shortfall module states the default rate `RMD_SHORTFALL_DEFAULT_RATE = 0.25` and prices `max(0, required - distributed by deadline)` without changing income or balances. `YearResult.penalties` composes early-withdrawal penalties and the §4974 excise and keeps them outside `tax`, AGI, and MAGI.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Pre-age-59½ taxable traditional withdrawal subject to early penalty | 20,000 | dollars |
| Early-withdrawal penalty rate | 10 | percent |
| RMD required amount | 12,000 | dollars |
| Distributed by deadline | 4,000 | dollars |
| §4974 default rate | 25 | percent |
| Relief election | none | election |

## Arithmetic

Early-withdrawal penalty: `$20,000 × 10/100 = $2,000`.

RMD shortfall: `max(0, $12,000 - $4,000) = $8,000`.

§4974 excise: `$8,000 × 25/100 = $2,000`.

Total penalties: `$2,000 + $2,000 = $4,000`.

## Expected

Exact early-withdrawal component `$2,000`, RMD shortfall `$8,000`, §4974 excise `$2,000`, and published `penalties = $4,000`; fixture tolerance: exact, because integer dollar inputs multiplied by 10% and 25% produce whole dollars exactly in this fixture.

## Wrong readings

- Applying 25% to the full `$12,000` RMD requirement gives `$3,000` of excise and `$5,000` total penalties; the excise applies to the `$8,000` shortfall, so the total is `$4,000`.
- Applying the corrected 10% §4974 rate without qualifying correction gives `$800` of excise and `$2,800` total penalties; this fixture uses the default 25% rate.
- Omitting the early-withdrawal component reports `$2,000`; both nonzero components compose to `$4,000`.
- Applying the early-withdrawal penalty to an inherited distribution would add 10% of that inherited amount; the extract expressly excludes inherited-IRA distributions from the early penalty.

## Family

outputs: `tax-penalties-annual`.

feeds: `portfolio-need-annual`; `display-total-spending-annual`; `scenario-lifetime-penalties`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory (the follow-up review section).
