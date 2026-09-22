## Claim

Kind: model. `insights/detectors/annuitizationHeadroom.ts#annuitizationHeadroom.screen` illustrates, for a planning-age-95-or-later plan with a qualifying largest liquid account of at least `$100,000` and no annuity or pension covering the floor, a nominal premium `min(25% of that account,$250,000)` and monthly payout `premium*spiaPayoutRate(startAge)/12`, without stated rounding.

## Justification

The model uses a bounded quarter-account purchase to make annuitization headroom concrete while leaving the exact liquidity, tax and estate tradeoff to a scenario ledger; it is an illustration, not a quote, recommendation or claim that the payout is optimal or guaranteed by a particular carrier. The arithmetic domain requires a nonnegative qualifying balance, a finite annual payout rate and a resolved eligible start age.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Planning age | 97 | age in years |
| Largest qualifying liquid account | 800,000 | nominal dollars |
| Existing annuity/pension covering the floor | no | boolean |
| `spiaPayoutRate(startAge)` | 6.6 | percent/year |

## Arithmetic

Quarter-account amount `=$800,000/4=$200,000`. Cap comparison gives `premium=min($200,000,$250,000)=$200,000`. Annual payout `=$200,000*(66/1000)=$13,200`. Monthly payout `=$13,200/12=$1,100`.

## Expected

The exact derived illustrative premium is `$200,000.00` and the exact derived monthly payout is `$1,100.00`. Each published card figure equals its derived value and is shown as `"$200,000"` and `"$1,100"`, respectively, with exact tolerance on those published figures.

## Wrong readings

- Always using the cap gives premium `$250,000.00` and monthly payout `$1,375.00`.
- Applying the 6.6% annual rate as a monthly rate gives `$13,200.00/month`.

## Family

outputs: `insight-annuitization-headroom-illustrative-spia`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.

Revision: The published-figure statement was added on the pull-request review's finding.
