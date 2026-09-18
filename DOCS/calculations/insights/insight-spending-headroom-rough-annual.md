## Claim

Kind: model. `insights/detectors/spendingHeadroom.ts#spendingHeadroom.screen` publishes rough real annual spending headroom for a nondepleting plan as `(ending after-tax estate deflated to today - bequest target)/remaining projection-year count`, screening only when the real excess estate is at least `$250,000` and the quotient at least `$2,000`; the inclusive row-count denominator is the convention implied by “years remaining in the projection” and must be checked against the engine.

## Justification

Spreading excess terminal estate evenly across the remaining modeled years gives a cheap first-pass lifestyle amount before the exact ledger solver prices taxes, healthcare cliffs and sequencing. It is intended only to decide whether exact evaluation is worthwhile; it does not claim that withdrawing this amount every year is sustainable. The valid domain has no depletion, a positive remaining-year count and finite deflated estate and target values.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Nominal ending after-tax estate | 1,200,000 | horizon dollars |
| End-year-to-today deflation factor | 3/4 | ratio |
| Bequest target | 500,000 | today's dollars |
| Remaining projection rows, 2026 through 2035 inclusive | 10 | years |

## Arithmetic

Ending estate today `=$1,200,000*(3/4)=$900,000`. Excess `=$900,000-$500,000=$400,000`, clearing `$250,000`. Rough headroom `=$400,000/10=$40,000/year`, clearing `$2,000`.

## Expected

Ending estate today is exactly `$900,000.00` and rough annual headroom is exactly `$40,000.00`, with exact-cent tolerance because the example uses exact rational arithmetic.

## Wrong readings

- Omitting deflation gives `($1,200,000-$500,000)/10=$70,000.00/year`.
- Using nine year-to-year intervals instead of ten projection rows gives `$44,444.4444444444/year`.

## Family

outputs: `insight-spending-headroom-rough-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
