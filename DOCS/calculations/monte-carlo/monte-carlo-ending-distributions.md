## Claim

Kind: formula. `montecarlo/run.ts#aggregateMonteCarlo` publishes `endingInvestable.histogram` and `endingAfterTaxEstate.percentiles`. This fixture passes `histogramBins = 4` and uses the documented equal-width histogram and interpolated percentiles.

## Justification

For an ascending nonconstant sample, histogram `min` is its minimum, width is `(max - min) / bins`, and the bin index is `min(bins - 1, floor((v - min) / binWidth))`; this last clamp places the maximum in the last bin. Ending-estate percentiles use the same five-level percentile set.

## Inputs

`startYear = endYear = 2030`, `histogramBins = 4`. These are every per-path field read:

| Path | `endingInvestable` | `endingAfterTaxEstate` |
|---:|---:|---:|
| A | $0 | $0 |
| B | $20 | $100 |
| C | $40 | $300 |
| D | $80 | $600 |
| E | $100 | $1,000 |

## Arithmetic

Investable minimum is `$0`; width is `(100 - 0) / 4 = $25`. Bin intervals are `[0,25)`, `[25,50)`, `[50,75)`, and `[75,100]` after applying the maximum clamp. Values map as `0→0`, `20→0`, `40→1`, `80→3`, and `100→3`, so counts are `[2,1,0,2]`.

For ending estates `[0,100,300,600,1000]`, `n - 1 = 4`: p10 index `0.4` gives `$40`; p25 index `1` gives `$100`; p50 index `2` gives `$300`; p75 index `3` gives `$600`; p90 index `3.6` gives `600 × 0.4 + 1000 × 0.6 = $840`.

## Expected

`endingInvestable.histogram = { min: $0, binWidth: $25, counts: [2,1,0,2] }`. `endingAfterTaxEstate.percentiles = { p10: $40, p25: $100, p50: $300, p75: $600, p90: $840 }`. Fixture tolerance: exact for counts; absolute `1e-9` for `min`, `binWidth`, and percentiles from these short exact inputs.

## Wrong readings

- Giving the maximum its raw index `floor(100 / 25) = 4` creates a fifth (or “31st” under the default 30-bin case) bin and yields `[2,1,0,1,1]`, instead of clamping it into the last bin.
- Using inclusive upper bounds from the left puts `$100` outside the four bins; the documented index rule puts it in bin 3.
- Nearest-rank p90 selects `$1,000`, rather than the interpolated `$840`.

## Family

outputs: `monte-carlo-ending-investable-histogram`; `monte-carlo-ending-after-tax-estate-percentiles`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-seven.md in this directory.
