## Claim

Kind: composition. `projection/yearFigures.ts#upsideShortfall(year)` publishes the upside spending the year did not fund: `year.idealShortfall + year.excessShortfall`, in nominal dollars of the year. It is the "Upside" part of the Results table's Layer miss cell.

The cell's show-or-blank test reads engine figures separately: `requiredShortfall > 0.5 || targetShortfall > 0.5 || upsideShortfall(y) > 0.5`. The page used to add all four shortfalls and compare the sum with $0.50; every shortfall is nonnegative, so the old test could be true only with every part at or below $0.50 when their sum exceeded it, and then every inner part was blank and the cell already read empty. The rendered cell is the same in every case.

## Justification

The ledger attributes a year's unfunded spending to layers, discretionary first (`spending/layers.ts#attributeShortfall`, record `spending-layer-shortfall-attribution`). The Upside miss is the sum of the two layers above target.

## Inputs

| Case | `idealShortfall` | `excessShortfall` | `requiredShortfall` / `targetShortfall` |
|---|---:|---:|---|
| A | 4,200 | 3,000.35 | 0 / 0 |
| B | 0.20 | 0.25 | 0.30 / 0 |
| C | 0 | 0 | 0 / 1,250 |

## Arithmetic

A: `4,200 + 3,000.35 = 7,200.35`. B: upside `0.20 + 0.25 = 0.45`, not above $0.50; the old outer test summed `0.30 + 0 + 0.20 + 0.25 = 0.75 > 0.5` and rendered a cell whose three inner parts were all blank; the new test (`0.30 > 0.5 || 0 > 0.5 || 0.45 > 0.5`) is false and renders nothing. Both read empty. C: upside `0`; the cell reads `Target $1,250`.

## Expected

A: `7,200.35` within `$0.000001`. B: `0.45` within `1e-12`, and the new test is false while the old sum is `0.75`. C: `0` exactly.

## Wrong readings

- Adding the required and target misses into "Upside": A plus a target miss would overstate the upside miss.
- Using `shortfall`, the portfolio's total funding shortfall: a different quantity, charged to layers in order.
- Reading upside intent (`display-upside-spending-annual`) as the miss.

## Family

outputs: `display-upside-shortfall-annual`.

feeds: none. Reads `spending-ideal-shortfall-annual`, `spending-excess-shortfall-annual`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-26, from the source at RetireGolden `aeb2861a`; no engine value used. Checked by a second claude agent that did not derive it, which confirmed every value and the show-or-blank equivalence. Reviewed by: pending; the catalog asks for a reviewer of a different agent family.
