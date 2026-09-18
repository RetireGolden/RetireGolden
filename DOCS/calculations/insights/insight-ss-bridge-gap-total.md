## Claim

Kind: composition. `insights/detectors/ssBridgeGap.ts#ssBridgeGap.screen` sums nominal quoted ladder costs and annual real bridge amounts across delaying claimants whose retirement-to-claim gap is not already covered by a plan ladder and whose liquid funding meets the shared 50% cost threshold.

## Justification

Each claimant's `sizeBridge` result is already the authoritative per-person amount, so the detector identities are `totalCost=sum_eligible ladderCost_i` and `annualTotal=sum_eligible annualRealAmount_i`; excluding covered gaps prevents proposing duplicate income. This screen supports a scenario preview and does not claim the ladder is affordable merely because half its cost is present. The domain is a finite set of independently sized claimant results.

## Inputs

| Claimant | Delays past retirement | Gap already covered | Funding / cost | Ladder cost | Annual bridge | Unit |
|---|---|---|---:|---:|---:|---|
| A | yes | no | 0.75 | 120,000 | 18,000 | dollars |
| B | yes | yes | 1.00 | 90,000 | 14,000 | dollars |
| C | yes | no | 0.50 | 80,000 | 12,000 | dollars |

## Arithmetic

A and C qualify; B is excluded because its gap is already covered. `totalCost=$120,000+$80,000=$200,000`. `annualTotal=$18,000+$12,000=$30,000/year`.

## Expected

Expected total cost is exactly `$200,000.00` and annual total is exactly `$30,000.00`, with exact-cent tolerance because they are sums of exact dollar inputs.

## Wrong readings

- Including the already covered claimant gives cost `$290,000.00` and annual total `$44,000.00`.
- Averaging the two eligible claimants gives `$100,000.00` cost and `$15,000.00/year`, rather than household totals.

## Family

outputs: `insight-ss-bridge-gap-total`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
