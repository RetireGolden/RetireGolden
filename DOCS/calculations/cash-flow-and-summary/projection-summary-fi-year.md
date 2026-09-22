## Claim

Kind: formula. `projection/compare.ts#ProjectionSummary.fiYear` is the first ledger year, in ledger order, whose published end-of-year `investableTotal`, deflated by `(1 + inflationPct/100)^(year - startYear)`, is greater than or equal to `fiNumber`; it is `null` when no year crosses or the ledger is empty.

## Justification

The comparison uses the ledger's own investable total, is inclusive, and compares start-year dollars to the already-derived FI number.

## Inputs

| Input | Crossing case | Null case | Unit |
|---|---:|---:|---|
| Projection start year | 2026 | 2026 | year |
| General inflation | 0 | 0 | percent/year |
| FI number | 500,000 | 500,000 | start-year dollars |
| 2026 investable total | 490,000 | 490,000 | nominal dollars |
| 2027 investable total | 500,000 | 499,999 | nominal dollars |
| 2028 investable total | 520,000 | 499,999 | nominal dollars |

## Arithmetic

With zero inflation, every deflator is `1`. Crossing case: 2026 gives `$490,000 < $500,000`; 2027 gives `$500,000 >= $500,000`, so the first crossing is 2027. Null case: every row remains below `$500,000`, so no crossing exists.

## Expected

Exact values: crossing case `fiYear = 2027`; null case `fiYear = null`. Fixture tolerance: exact, because the published result is a year or `null`.

## Wrong readings

- Using a strict `>` comparison delays the crossing case to 2028.
- Returning the largest investable year rather than the first crossing produces 2028.
- Returning the horizon year when no row crosses produces 2028 instead of `null`.

## Family

outputs: `projection-summary-fi-year`.

feeds: `none yet`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory.
