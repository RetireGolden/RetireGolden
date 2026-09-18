## Claim

Kind: model. `insights/detectors/spendingHeadroom.ts#spendingHeadroom.screen` publishes rough real annual spending headroom for a nondepleting plan as `(ending after-tax estate deflated to today - bequest target)/N`, where `N = max(1, endYear - startYear)` is the number of year boundaries between the projection's start and end years, not the inclusive projection-row count. Thus a 2026–2035 projection has `N = 9`. The detector screens only when the real excess estate is at least `$250,000` and the quotient is at least `$2,000`, and it formats the published headroom to whole dollars.

## Justification

Spreading excess terminal estate evenly across the projection's remaining year boundaries gives a cheap first-pass lifestyle amount before the exact ledger solver prices taxes, healthcare cliffs and sequencing. The boundary count is `endYear - startYear`, rather than the number of inclusive annual rows, because it measures the intervals from the start year to the end year; `max(1, ...)` keeps the divisor positive for a one-year projection. It is intended only to decide whether exact evaluation is worthwhile; it does not claim that withdrawing this amount every year is sustainable. The valid domain has no depletion and finite deflated estate and target values.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Projection start year | 2026 | calendar year |
| Projection end year | 2035 | calendar year |
| Nominal ending after-tax estate | 1,200,000 | horizon dollars |
| End-year-to-today deflation factor | 3/4 | ratio |
| Bequest target | 500,000 | today's dollars |
| Remaining projection rows, 2026 through 2035 inclusive | 10 | years |

## Arithmetic

Ending estate today `=$1,200,000*(3/4)=$900,000`. Excess `=$900,000-$500,000=$400,000`, clearing `$250,000`. The 2026–2035 projection has `N=max(1,2035-2026)=9` year boundaries. Rough headroom `=$400,000/9=$44,444.444444444445/year`, clearing `$2,000`.

## Expected

Ending estate today is exactly `$900,000.00`. The numeric rough annual headroom quotient is `44,444.444444444445`, defended with an absolute tolerance of `1e-9` on the quotient. Formatted to whole dollars, the card shows `"$44,444"`.

## Wrong readings

- Dividing by the inclusive projection-row count (`10`) gives `$40,000/year`; the contract uses the nine year boundaries instead.
- Forgetting the `max(1, ...)` floor gives a zero divisor for a one-year projection whose start and end years are equal.
- Not deflating the ending estate uses `$1,200,000` instead of `$900,000` and gives `($1,200,000-$500,000)/9=$77,777.77777777778/year`.

## Family

outputs: `insight-spending-headroom-rough-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment correction) and the orchestrator's contract statement for the year count, without executing the engine or reading any implementation body. Reviewed by: unreviewed.

Revision: Replaced the first derivation's guessed inclusive-row-count convention with the specified year-boundary convention `N = max(1, endYear - startYear)`. The projection start-year and end-year input rows were added on the reviewer's note.
