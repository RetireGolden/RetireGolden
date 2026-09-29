## Claim

Kind: model. `insights/detectors/annuitizationHeadroom.ts#annuitizationHeadroom.screen` illustrates, for a planning-age-95-or-later plan with a qualifying largest liquid account of at least `$100,000` and no annuity or pension covering the floor, a nominal premium `min(25% of that account,$250,000)` and monthly payout `premium*spiaPayoutRate(startAge)/12`, without stated rounding. `startAge=min(95,max(currentAge,65))`, where `currentAge` is that of the person `model/peopleOrder.ts#canonicalFirstPerson` puts first (the older; between two people born the same day, the sex order female, male, average (`CANONICAL_SEX_ORDER`) and then the smaller id by ordinal comparison decide, so for two people with the same birth date and sex, renaming the ids can move the annuitant and every figure on that life, as it can move a Monte Carlo path (`monte-carlo-people-draw-order`)), whoever is listed first; the card names them and the previewed annuity is on their life (decision D-PEOPLE-ORDER).

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

Couple case (revision 2026-09-28). Pat, born 1968-03-01, is listed first; Robin, born 1958-03-01, second; the same `$800,000` cash account and a planning age of 97. The canonical order puts Robin (the older) first, so `currentAge=2026-1958=68` and `startAge=min(95,max(68,65))=68`: the card reads "on Robin's life from age 68", the monthly-income row is labelled "(from age 68)", the previewed annuity names Robin as owner with start age 68, and the premium is still `$200,000`. Listed the other way round, the card is the same.

## Wrong readings

- Always using the cap gives premium `$250,000.00` and monthly payout `$1,375.00`.
- Applying the 6.6% annual rate as a monthly rate gives `$13,200.00/month`.
- Illustrating on the first-listed person, the rule before the decision: the couple case would read Pat's life from age 65, and reversing the list would change the card.

## Family

outputs: `insight-annuitization-headroom-illustrative-spia`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.

Revision: The published-figure statement was added on the pull-request review's finding.

Revision 2026-09-28 (decision D-PEOPLE-ORDER): the illustration's person is the canonical first (the older), whoever is listed first; couple case added by claude (Opus 5.5). Reviewed by: unreviewed.

Later the same day (the independent review's L5): the claim states the tie-break past the birth date, which the review found moved the SPIA candidate's value from -$45,676 to -$9,332 on a same-birth-date, same-sex probe when the ids were renamed. No figure changes.
