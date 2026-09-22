## Claim

Kind: formula. `montecarlo/run.ts#aggregateMonteCarlo` publishes `fan`, the per-year `p10`, `p25`, `p50`, `p75`, and `p90` investable balances, using linear interpolation at index `(p / 100) × (n - 1)`.

## Justification

The `fan` comment identifies a per-year investable-balance fan, `investableByYear` is the end-of-year balance list, and `percentileSet` fixes the five percentile levels and interpolation rule.

## Inputs

`startYear = 2030`, `endYear = 2032`. The sole per-path field read is:

| Path | `investableByYear` (2030, 2031, 2032), dollars |
|---:|---|
| A | `[0, 100, 1000]` |
| B | `[100, 300, 2000]` |
| C | `[300, 700, 4000]` |
| D | `[1000, 1500, 8000]` |

## Arithmetic

For 2030 the ascending sample is `[0, 100, 300, 1000]`, with `n - 1 = 3`.

- p10: index `0.3`; `0 × 0.7 + 100 × 0.3 = 30`.
- p25: index `0.75`; `0 × 0.25 + 100 × 0.75 = 75`.
- p50: index `1.5`; `100 × 0.5 + 300 × 0.5 = 200`.
- p75: index `2.25`; `300 × 0.75 + 1000 × 0.25 = 475`.
- p90: index `2.7`; `300 × 0.3 + 1000 × 0.7 = 790`.

For 2031, p50 is the mean of the middle values: `(300 + 700) / 2 = 500`. For 2032 it is `(2000 + 4000) / 2 = 3000`.

## Expected

The 2030 fan is `{ year: 2030, p10: $30, p25: $75, p50: $200, p75: $475, p90: $790 }`. The 2031 median is `$500`; the 2032 median is `$3,000`. Fixture tolerance: absolute `1e-9` for all interpolated percentiles and exact for years.

## Wrong readings

- Nearest-rank percentiles on 2030 give p10 `$0`, p25 `$0`, p50 `$100`, p75 `$300`, p90 `$1,000`, rather than the interpolated set.
- Taking either middle observation as the even-sample median gives 2030 p50 `$100` or `$300`, rather than `$200`.
- Treating rows as years instead of paths makes the first alleged year sample `[0, 100, 1000]` and produces median `$100`, not `$200`.

## Family

outputs: `monte-carlo-investable-fan-percentiles`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-seven.md in this directory.
