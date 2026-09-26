# Stationary-bootstrap historical market path

## Claim

Kind: model. `montecarlo/marketModels.ts#createStationaryBootstrapModel` draws one random length per historical block, replays that many contiguous rows with wrap, and draws a new start row and length only when the block is exhausted. Published return shocks are the sampled 60/40 returns minus the full dataset's 60/40 mean; inflation is replayed as-is.

## Justification

With mean parameter `L = meanBlockLength ?? 5` (a finite number of at least 2; anything else is refused with a RangeError rather than raised to 2), a block draws

`remaining = floor(-ln(1 - U) * L) || 1`.

This is a floored exponential draw kept at no less than one year on purpose (a block of length 0 would publish no row). Its mean is near `L`, not exactly `L`; for `L = 5`, `E[remaining] = 1 + exp(-2/5) / (1 - exp(-1/5)) = 4.697924813049012`. A per-year restart/continuation coin is a different probability law even if its parameter is chosen to give a similar mean. In particular, the uniform draw is consumed once per block here and does not decide continuation separately in every path year.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Historical rows `n` | 96 | rows |
| Mean block length setting | 5 | years |
| Effective `L` | 5 | years |
| Equity weight | 60 | percent |
| Path length | 5 | years |
| Scripted draw 1 | `nextInt(96) -> 72` | row index |
| Scripted draw 2 | `next() -> 0.50` | uniform draw |
| Scripted draw 3 | `nextInt(96) -> 0` | row index |
| Scripted draw 4 | `next() -> 0.90` | uniform draw |

Index 72 is the 2000 row in the reproduced table; index 0 is 1928.

## Arithmetic

For each row, the 60/40 blended return is

`blend = 0.60 * stocksPct + 0.40 * bondsPct`.

Across all 96 reproduced rows, the standalone JavaScript calculation gives:

- stock-return sum: `1118.8999999999999`
- bond-return sum: `466.5999999999998`
- accumulated 60/40 blend sum: `857.9800000000002`
- 60/40 dataset mean: `857.9800000000002 / 96 = 8.937291666666669`

In exact decimal arithmetic the same identities are `1118.9`, `466.6`, `0.60 * 1118.9 + 0.40 * 466.6 = 857.98`, and `857.98 / 96 = 8.937291666666666...`. The expected shocks below use the JavaScript full-precision mean above; the `1e-12` tolerance covers only floating-point representation, not a different centering rule.

First block length:

`floor(-ln(1 - 0.50) * 5) || 1 = floor(-ln(0.5) * 5) = floor(3.4657359027997265) = 3`.

It publishes rows 2000, 2001, and 2002. After the third publication, `remaining` reaches zero. Before the fourth path year the model draws the next cursor first, then its length:

`floor(-ln(1 - 0.90) * 5) || 1 = floor(-ln(0.1) * 5) = floor(11.51292546497023) = 11`.

The second block therefore begins at 1928 and publishes 1928 and 1929 for the two path years still requested.

| Path year | Historical row | 60/40 blend (%) | Return shock: blend - mean (pp) | Inflation (%) | Remaining after publication |
|---:|---:|---:|---:|---:|---:|
| 1 | 2000 | `1.2800000000000002` | `-7.657291666666668` | `3.4` | 2 |
| 2 | 2001 | `-4.9` | `-13.837291666666669` | `1.6` | 1 |
| 3 | 2002 | `-7.159999999999999` | `-16.097291666666667` | `2.4` | 0 |
| 4 | 1928 | `26.599999999999998` | `17.662708333333327` | `-1.2` | 10 |
| 5 | 1929 | `-3.3000000000000003` | `-12.23729166666667` | `0.6` | 9 |

## Expected

For the scripted RNG, assert:

- replayed rows exactly: `[2000, 2001, 2002, 1928, 1929]`
- return shocks, absolute tolerance `1e-12`: `[-7.657291666666668, -13.837291666666669, -16.097291666666667, 17.662708333333327, -12.23729166666667]`
- inflation exactly: `[3.4, 1.6, 2.4, -1.2, 0.6]`
- drawn block lengths exactly: `[3, 11]`
- RNG call order exactly: `nextInt`, `next`, then after three publications `nextInt`, `next`

## Wrong readings

- Treating `U = 0.50` as a per-year continuation coin with restart probability `1/L = 0.20`, and scripting `0.50` for every yearly coin, continues every year. Starting at 2000 it replays `[2000, 2001, 2002, 2003, 2004]`; the incorrect fifth row is 2004 rather than 1929. That coin rule is not the per-block length draw.
- Omitting the `|| 1` clamp permits an empty block: at `U = 0.01`, `floor(-ln(0.99) * 5) = floor(0.05025167926750725) = 0`, whereas the contract requires length 1.
- Wrap uses the row index modulo the row count `n = 96`, not calendar-year arithmetic or an off-by-one modulus. Advancing after the final row 2023 wraps to index 0, the 1928 row.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment corrections) and the orchestrator's contract statement for the per-block draw, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory (addendum 3).

Revision note: replaces the prior per-year continuation-coin misreading with the contracted once-per-block floored-exponential draw and a discriminating five-year scripted-RNG fixture.
