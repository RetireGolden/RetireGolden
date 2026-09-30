## Claim

Kind: composition. `projection/yearFigures.ts#upsideSpending(year)` publishes the spending the plan intended above its target lifestyle layer in the year: `year.expenses.idealSpending + year.expenses.excessSpending`, in nominal dollars of the year. These are intended amounts, not funded ones; what went unfunded is `display-upside-shortfall-annual`. The Results page's Upside column shows it when it is above $0.50.

## Justification

The layered-spending model stacks required, target, ideal and excess layers (`YearExpenses`); "upside" on the Results page is the two layers above target, which is the plain sum of the two published increments.

## Inputs

| Case | `idealSpending` | `excessSpending` |
|---|---:|---:|
| A | 12,000.40 | 3,000.35 |
| B | 0.30 | 0.10 |
| C | 8,000 | 0 |

## Arithmetic

A: `12,000.40 + 3,000.35 = 15,000.75` (binary64 prints `15000.75`). B: `0.30 + 0.10 = 0.4`, which is not above the $0.50 display test, so the cell is blank. C: `8,000`.

## Expected

A: `15,000.75` within `$0.000001`. B: `0.4` within `1e-12`, not above $0.50. C: `8,000` exactly.

## Wrong readings

- Ideal only: A shows `12,000.40`.
- Intended total (`intendedSpending`) or target: the whole lifestyle, not the upside.
- Funded upside (intended minus shortfall): a different quantity; the column is labelled as intent.

## Family

outputs: `display-upside-spending-annual`.

feeds: none. Reads `spending-ideal-requested-annual`, `spending-excess-requested-annual`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-26, from the source at RetireGolden `aeb2861a`; no engine value used. Checked by a second claude agent that did not derive it, which confirmed every value. Reviewed by: pending; the catalog asks for a reviewer of a different agent family.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-5-medicare-spending.md`.
