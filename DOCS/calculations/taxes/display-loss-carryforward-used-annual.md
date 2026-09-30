## Claim

Kind: composition. `projection/yearFigures.ts#capitalLossCarryforwardUsed(year)` publishes how much of the capital-loss carryforward the year used: `year.capitalLossUsedAgainstGains + year.capitalLossUsedAgainstOrdinary`, in nominal dollars. It is the ledger download's `lossCarryforwardUsed` column, which rounds it to whole dollars and is nominal in both page modes.

## Justification

`tax/federalTax.ts#applyCapitalLossCarryforward` uses the opening pool against the year's gains first (`usedAgainstGains = min(pool, gain)`), then deducts up to the offset limit of the loss that remains (`usedAgainstOrdinary`), carrying the rest (IRC 1211(b), 1212(b)). "Used" is the part of the opening pool and the year's own loss that the year consumed, the two uses added. It is not the pool's decrease when the year also had a loss of its own: that loss joins the pool before the offset.

## Inputs

Through the engine's own netting, `applyCapitalLossCarryforward(pool, 40,000, gain, 3,000)`:

| Case | Opening pool | Ordinary income | Year's realized gain (signed) |
|---|---:|---:|---:|
| A | 10,000 | 40,000 | 4,000 |
| B | 10,000 | 40,000 | 0 |
| C | 10,000 | 40,000 | −2,000 |
| D | 2,000 | 40,000 | 5,000 |

## Arithmetic

- A: against gains `min(10,000, 4,000) = 4,000`; available `6,000`; against ordinary `min(6,000, 3,000) = 3,000`; remaining `3,000`. Used `7,000`.
- B: `0` against gains; available `10,000`; `3,000` against ordinary; remaining `7,000`. Used `3,000`.
- C: `0` against gains; available `10,000 + 2,000 = 12,000`; `3,000` against ordinary; remaining `9,000`. Used `3,000` (the pool fell by only 1,000: the year's own 2,000 loss joined it).
- D: `min(2,000, 5,000) = 2,000` against gains; available `0`; `0` against ordinary; remaining `0`. Used `2,000`.

## Expected

A `7,000`, B `3,000`, C `3,000`, D `2,000`, all exact.

## Wrong readings

- The remaining balance (`capitalLossCarryforwardRemaining`): A `3,000`, B `7,000`.
- The pool's decrease (opening minus remaining): C `1,000`, not `3,000`.
- Against ordinary only: A `3,000`.
- The opening pool: `10,000` in A to C.

## Family

outputs: `display-loss-carryforward-used-annual`.

feeds: none. Reads `tax-loss-carryforward-used-against-gains-annual`, `tax-loss-carryforward-used-against-ordinary-annual`. Registry rules: `irc-1211-b-capital-loss-ordinary-offset`, `irc-1212-b-capital-loss-carryforward`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-26, from `tax/federalTax.ts#applyCapitalLossCarryforward` as read at RetireGolden `aeb2861a`; arithmetic by hand. Checked by a second claude agent that did not derive it, which confirmed every value. Reviewed by: pending; the catalog asks for a reviewer of a different agent family.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-3-longevity-ladders-taxes.md`.
