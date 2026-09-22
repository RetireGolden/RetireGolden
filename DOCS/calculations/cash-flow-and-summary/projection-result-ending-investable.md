## Claim

Kind: composition. `projection/internal/types/result.ts#ProjectionResult.endingInvestable` copies the last year row's `investableTotal`, or publishes 0 when the projection has no rows.

## Justification

This is a terminal copy, not a new account fold. Assets excluded from the annual investable total cannot enter through the terminal field.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| 2030 `investableTotal` | 510,000 | nominal dollars |
| 2031 `investableTotal` | 487,250.125 | nominal dollars |
| Year-row order | 2030, 2031 | ordered rows |

## Arithmetic

Last row is 2031, so ending investable `= $487,250.125`.

## Expected

Exact value: `$487,250.125`. Fixture tolerance: absolute `$0.005`, because the copied ledger dollar is represented in binary floating point. An empty `years` array produces exactly `$0`; that is the publishing site's fallback as the field comment states it, and it is a contract statement here rather than executed evidence, because `simulatePlan` emits at least one row for a living household and no caller produces an empty array.

## Wrong readings

- Copying the first row produces `$510,000`.
- Summing the rows produces `$997,250.125`.

## Family

outputs: `projection-result-ending-investable`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six.md in this directory.

Revision note (2026-09-22, pull-request review of #729): the empty-array sentence now says it is a contract statement the fixture does not execute; the fixture's earlier assertion of it compared a hand-built result with itself and was removed. No value changed.
