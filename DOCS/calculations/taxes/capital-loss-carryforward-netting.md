## Claim

Kind: composition. `tax/federalTax.ts#applyCapitalLossCarryforward` applies an annual capital-loss pool first against current gains, then reports up to the annual ordinary-offset limit as a negative capital-gain-line amount without changing ordinary income, and carries the unused pool forward.

## Justification

For opening pool \(C\ge0\), signed current capital result \(G\), and limit \(L\ge0\): current gains consume \(\min(C,\max(G,0))\); a current loss enlarges the remaining pool; then \(\min(L,\text{available loss})\) is reported as a negative net capital gain and the balance remains. The offset is not capped by ordinary income under the stated convention.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Opening carryforward | 20,000 | dollars |
| Ordinary income | 50,000 | dollars/year |
| Current capital gains | 5,000 | dollars/year |
| Ordinary offset limit | 3,000 | dollars/year |

The limit is `year2026.federalTax.capitalLossOrdinaryOffsetLimit`.

## Arithmetic

Used against gains: `min($20,000,$5,000) = $5,000`; pool left `$15,000`; current gain left `$0`.

Used against ordinary-income base: `min($15,000,$3,000) = $3,000`; reported net capital gain `= -$3,000`; ordinary income remains `$50,000`.

Remaining pool: `$15,000 - $3,000 = $12,000`.

## Expected

Exact result: `{ordinaryAfter: $50,000, netCapitalGain: -$3,000, usedAgainstGains: $5,000, usedAgainstOrdinary: $3,000, remaining: $12,000}`; all published figures use exact whole-dollar tolerance.

## Wrong readings

- Subtracting the ordinary offset directly from ordinary income produces `ordinaryAfter = $47,000` and `netCapitalGain = $0`.
- Forgetting to use the pool against gains first produces a `$5,000` gain and `$17,000` remaining.

## Family

outputs: `tax-loss-carryforward-remaining-annual`; `tax-loss-carryforward-used-against-gains-annual`; `tax-loss-carryforward-used-against-ordinary-annual`.

feeds: `tax-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory (approved with a note on the feeds list, applied below).

Revision: `tax-realized-gains-annual` was removed from feeds on the reviewer's note; it is the signed capital result this calculation reads, not a family it feeds.
