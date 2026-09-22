## Claim

Kind: composition. `projection/internal/types/result.ts#ProjectionResult.endingNetWorth` copies the last year row's `netWorth`, or publishes 0 when the projection has no rows.

## Justification

The terminal result preserves the annual row's already-composed net worth; it does not rebuild investable, property, insurance, ladder, debt, or HECM components.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| 2030 `netWorth` | 925,000 | nominal dollars |
| 2031 `netWorth` | 901,375.625 | nominal dollars |
| Year-row order | 2030, 2031 | ordered rows |

## Arithmetic

Last row is 2031, so ending net worth `= $901,375.625`.

## Expected

Exact value: `$901,375.625`. Fixture tolerance: absolute `$0.005`, because the copied ledger dollar is represented in binary floating point. An empty `years` array produces exactly `$0`.

## Wrong readings

- Copying the first row produces `$925,000`.
- Substituting ending investable for net worth produces a different annual field, not `$901,375.625`.

## Family

outputs: `projection-result-ending-net-worth`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six.md in this directory.
