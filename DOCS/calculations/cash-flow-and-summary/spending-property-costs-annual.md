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

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory (approved with a note that the rule was stated to the deriver rather than by a doc comment; the comment patch closes it).
