## Claim

Kind: composition. `projection/yearFigures.ts#spendingWithTaxAndPenalties(year)` publishes the year's total outflow the charts call "spending": `year.expenses.total + year.tax + year.penalties`, evaluated left to right, in nominal dollars of the year. It is the composite the engine already uses as the FI number's spending base (`projection/compare.ts#summarizeProjection` now calls this function for it) and inside `netPortfolioNeed`.

## Justification

The chart's spending line is everything the household paid out in the year: the ledger's funded expenses plus the tax and penalties it settled. It is gross of income on purpose; `netPortfolioNeed` is the net figure. The order of the additions is part of the figure: binary floating point is not associative, and `(total + tax) + penalties` is the order the pages and the FI base used.

## Inputs

| Case | `expenses.total` | `tax` | `penalties` |
|---|---:|---:|---:|
| A | 64,321.50 | 7,000.25 | 500 |
| B (association) | 40,477.35 | 18,353.95 | 539.21 |

## Arithmetic

- A: `64,321.50 + 7,000.25 = 71,321.75`; `+ 500 = 71,821.75`. Every operand and partial sum is a multiple of 1/4 below 2⁵³, so the binary64 result is exact.
- B: exact decimal `40,477.35 + 18,353.95 + 539.21 = 59,370.51`. In binary64 `(40,477.35 + 18,353.95) + 539.21` prints `59370.51`, while `40,477.35 + (18,353.95 + 539.21)` prints `59370.509999999995`.

## Expected

A: `71,821.75` exactly. B: the left-to-right binary64 sum, which prints `59370.51`, and not the other grouping (`59370.509999999995`); the two agree within `$0.000001`. On a ledger year the function returns exactly `expenses.total + tax + penalties` written in that order.

## Wrong readings

- Leaving out penalties or tax: A shows `71,321.75` or `64,821.50`.
- Using `intendedSpending` instead of funded `expenses.total` ignores guardrail cuts.
- Netting incomes (`netPortfolioNeed`) turns an outflow into a need floored at 0; a different family.
- Adding `careCost` again double counts: `expenses.total` already contains `careCost − ltcBenefit`.
- The other association (B): not a different number to the cent, but not bit-identical to what the pages printed or to the FI base.

## Family

outputs: `display-total-spending-annual`.

feeds: none. Reads `spending-total-annual`, `tax-total-annual`, `tax-penalties-annual`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-26, from the source at RetireGolden `aeb2861a`; the association example was found by the deriver's own random search in plain JavaScript. No engine value is used. Checked by a second claude agent that did not derive it, which confirmed both values and the association. Reviewed by: pending; the catalog asks for a reviewer of a different agent family.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-5-medicare-spending.md`.
