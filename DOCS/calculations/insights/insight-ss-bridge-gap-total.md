## Claim

Kind: composition. `insights/detectors/ssBridgeGap.ts#ssBridgeGap.screen` sums nominal quoted ladder costs and annual real bridge amounts across delaying claimants whose retirement-to-claim gap is not already covered by a plan ladder, then reports the household gap when liquid balance is greater than or equal to 50% of that total eligible cost.

## Justification

Each claimant's `sizeBridge` result is already the authoritative per-person amount, so the detector first computes `totalCost=sum_eligible ladderCost_i` and `annualTotal=sum_eligible annualRealAmount_i`; excluding covered gaps prevents proposing duplicate income. One household test, `liquidBalance >= 0.5 * totalCost`, gates the result after aggregation because the funding account must hold at least half the total eligible bridge cost before a bridge is proposed. The screen does not compute or apply claimant-level funding ratios.

## Inputs

| Claimant | Delays past retirement | Gap already covered | Ladder cost | Annual bridge | Unit |
|---|---|---|---:|---:|---|
| A | yes | no | 120,000 | 18,000 | dollars |
| B | yes | yes | 90,000 | 14,000 | dollars |
| C | yes | no | 80,000 | 12,000 | dollars |

Household liquid balance is `$120,000`; total eligible ladder cost is `$200,000`.

## Arithmetic

A and C are eligible; B is excluded because its gap is already covered. `totalCost=$120,000+$80,000=$200,000`. The single household threshold is `0.50*$200,000=$100,000`, and `$120,000>=$100,000`, so the gap is reported. `annualTotal=$18,000+$12,000=$30,000/year`.

## Expected

Expected total cost is exactly `$200,000.00` and annual total is exactly `$30,000.00`, with exact-cent tolerance because they are sums of exact dollar inputs.

## Wrong readings

- Including the already covered claimant gives cost `$290,000.00` and annual total `$44,000.00`.
- Averaging the two eligible claimants gives `$100,000.00` cost and `$15,000.00/year`, rather than household totals.
- An insufficiency gate (`liquidBalance < 0.5 * totalCost`) would report the card for a `$50,000` balance, which the contract suppresses because `$50,000<$100,000`.
- Incorrectly applying the household `$120,000` balance separately to each claimant's 50% threshold uses per-claimant funding gates instead of the single post-aggregation household gate.

## Family

outputs: `insight-ss-bridge-gap-total`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. The pull-request review found and prompted correction from claimant-level funding ratios to the single post-aggregation household liquid-balance gate. The gate direction was corrected after the independent reviewer read it against the funding-fraction comment. Reviewed by: unreviewed.
