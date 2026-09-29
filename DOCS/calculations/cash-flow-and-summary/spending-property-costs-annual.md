## Claim

Kind: formula. `projection/internal/types/result.ts#YearResult.expenses.propertyCosts`, produced by `projection/internal/annualPropertyCarryingCosts.ts#annualPropertyCarryingCosts`, is the sum, for owned and not-yet-sold properties, of `(propertyTaxAnnual + insuranceAnnual) × cumulative general-inflation factor`. The formula is derived from the comments' inflation and ownership-through-sale convention; a property contributes nothing in its sale year.

## Justification

Property tax and homeowner insurance are today-dollar carrying costs, continue after mortgage payoff, and stop when the property is sold.

## Inputs

| Plan input | Home A | Home B | Unit |
|---|---:|---:|---|
| Property tax annual | 3,000 | 2,000 | today dollars/year |
| Insurance annual | 1,200 | 800 | today dollars/year |
| Planned sale year | 2031 | 2030 | year |
| Current year | 2030 | 2030 | year |
| Cumulative general-inflation factor | 1.10 | 1.10 | nominal/today ratio |
| Any household member alive | true | true | Boolean |

## Arithmetic

Home A is still owned: `($3,000 + $1,200) × 1.10 = $4,620`. Home B is in its sale year and contributes `$0`. Total `= $4,620 + $0 = $4,620`.

## Expected

Exact value: `expenses.propertyCosts = $4,620`. Fixture tolerance: absolute `$0.005`, because inflation multiplication uses binary floating point.

## Wrong readings

- Charging Home B through its sale year produces `$7,700`.
- Inflating tax but not insurance produces `$4,500`.
- Stopping Home A's costs because its mortgage is paid produces `$0`.

## Family

outputs: `spending-property-costs-annual`.

feeds: `spending-total-annual`.

## A sale dated before the start year (D-2027-ROLLOVER, review H1)

The costs stop from the year the ledger sells the property, which is its planned sale year or, when that year is before the projection start year, the start year (`projection/propertySaleYear.ts#effectivePropertySaleYear`). The sale itself runs in that same year, on both sale paths (`internal/propertyEventsAndGrowth.ts` for the expected-proceeds deposit, `internal/fixedAssetDispositions.ts` for the exact-basis sale tax).

Before this rule the two readers disagreed. The costs stopped for every year at or after the planned year, while the sale ran only in a year equal to it, which a projection that starts later never reaches. So a plan saved in 2026 with a 2026 sale and reopened in 2027 kept the house to the end of the plan with no property tax or insurance. On the reviewer's case (the example couple's $420,000 home, $6,000 of tax and $1,800 of insurance, sale dated 2026, run from 2027) that added $1,017,839 to ending net worth.

No source governs a sale date that has passed. A property still on the plan means its balances hold no proceeds, so the decision reads the sale as not yet reflected and runs it in the first year. The projection names it:

> The Home sale is dated 2026, before this plan starts in 2027, so the plan sells it in 2027. If it has already been sold, remove the Home and add the proceeds to an account.

Both sale paths sell only a property with a value, so a property at $0 with a past sale year is not sold and yields no proceeds; its costs stop from the start year all the same. Its warning says only that (PR #768 review issue 9, `projection/preStartEvents.test.ts`):

> The Lot sale is dated 2026, before this plan starts in 2027, so its property tax and insurance stop from 2027.

Worked case (the evidence file): Home B's sale moved to the year before a projection that starts in 2030. Its effective sale year is 2030, so it is charged nothing in 2030, and Home A is still charged `(3,000 + 1,200) x 1.10 = 4,620`. `projection/propertySaleYear.test.ts` holds the ledger: a sale dated 2026 in a run from 2027 is the same projection as a sale dated 2027, apart from the warning.

Restated 2026-09-29 by the implementer of decision D-2027-ROLLOVER (Claude Opus 5.5), after the independent review (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/rollover-2027-review.md`, finding H1). Not yet reviewed: the record is `reviewedBy: 'unreviewed'`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory (approved with a note that the rule was stated to the deriver rather than by a doc comment; the comment patch closes it).
