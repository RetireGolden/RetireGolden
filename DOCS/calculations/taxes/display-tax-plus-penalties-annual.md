## Claim

Kind: composition. `projection/yearFigures.ts#taxAndPenalties(year)` publishes the single "Tax" figure the ledger pages print: `year.tax + year.penalties`, the year's settled tax (federal regular tax, AMT and NIIT, plus state and any composed calculator) plus the early-withdrawal penalty and the IRC 4974 excise, in nominal dollars of the year. The Results year-by-year table, the spending chart's tax series, the report's year ledger and the printed report's year table all read it.

## Justification

`tax` excludes penalties by contract ("Penalties are not in it", `YearResult.tax`), and `penalties` is the early-withdrawal penalty plus the 4974 excise, "not in `tax`" (`YearResult.penalties`). The pages print one outflow line for both, so their sum is the figure. `tax` already includes the AMT, so adding `amt` again would count it twice. The engine forms the same per-year sum inside `summarizeProjection`'s lifetime total.

## Inputs

| Case | `tax` | `penalties` | `amt` (already inside `tax`) |
|---|---:|---:|---:|
| A | 18,742 | 2,000 | 0 |
| B | 8,412.35 | 1,250.10 | 0 |
| C | 31,000 | 0 | 1,400 |

## Arithmetic

- A: `18,742 + 2,000 = 20,742`.
- B: `8,412.35 + 1,250.10 = 9,662.45`; binary64 prints `9662.45`.
- C: `31,000 + 0 = 31,000` (the 1,400 of AMT is part of the 31,000).

## Expected

A `20,742` and C `31,000`, exact. B `9,662.45` within `$0.000001` (two binary64 inputs and one addition).

## Wrong readings

- Tax only: A shows `18,742`, hiding the $2,000 penalty the year paid.
- Adding AMT again: C shows `32,400`.
- Tax minus penalties: A shows `16,742`.
- Associating differently inside a larger sum (for example `expenses.total + taxAndPenalties(y)`) is not a wrong reading of this family but would change `display-total-spending-annual` in the last binary digit; see that worksheet.

## Family

outputs: `display-tax-plus-penalties-annual`.

feeds: none. Reads `tax-total-annual` and `tax-penalties-annual`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-26, from the source at RetireGolden `aeb2861a`; values checked with plain JavaScript arithmetic, no engine import. Checked by a second claude agent that did not derive it, which confirmed every value. Reviewed by: pending; the catalog asks for a reviewer of a different agent family.
