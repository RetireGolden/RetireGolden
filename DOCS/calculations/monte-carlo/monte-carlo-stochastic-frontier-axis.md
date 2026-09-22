## Claim

Kind: data. `montecarlo/frontiers.ts#buildSpendingSuccessFrontier` publishes each point's `x` as the variant plan's `expenses.baseAnnual`: the plan's base annual expenses multiplied by that grid point's multiplier. `montecarlo/frontiers.ts#buildRetirementAgeSuccessFrontier` publishes `x` as the lowest resulting retirement age among the people who have one after each age is moved by the grid delta and clamped to `[30, 80]`; it publishes `0` when nobody has a retirement age. The retirement-age delta itself is not published.

## Justification

The corrected `StochasticFrontierPoint.x` comment identifies the value placed on each frontier axis. For spending, the axis value is the variant plan's absolute `expenses.baseAnnual`. For retirement age, the axis value is the minimum of the resulting clamped retirement ages for people who have retirement ages, or `0` if there are none. Thus the retirement grid delta changes the plan but is not itself the point's `x` value.

## Inputs

Spending frontier: base plan `expenses.baseAnnual = $60,000` and caller multipliers `[0.8, 1.0, 1.2]`.

Retirement-age frontier, primary case: one person whose current retirement age is `65`, with caller deltas `[-2, 0, 3]` years.

Retirement-age frontier, minimum case: two people whose current retirement ages are `65` and `62`, with caller delta `+3` years.

Retirement-age frontier, clamp case: one person whose current retirement age is `31`, with caller delta `-2` years.

The comparison summaries may contain any valid stochastic output values; none participates in deriving `x`.

## Arithmetic

Spending variants: `60,000 * 0.8 = 48,000`, `60,000 * 1.0 = 60,000`, and `60,000 * 1.2 = 72,000`, so their `x` values are `48,000`, `60,000`, and `72,000`.

Retirement-age primary case: `65 + (-2) = 63`, `65 + 0 = 65`, and `65 + 3 = 68`. All three results are already within `[30, 80]`, so the clamp is inapplicable here and the published `x` values are `63`, `65`, and `68`.

Retirement-age minimum case: the resulting ages are `65 + 3 = 68` and `62 + 3 = 65`; both are within `[30, 80]`, and `min(68, 65) = 65`, so `x = 65`.

Retirement-age clamp case: `31 + (-2) = 29`, then `clamp(29, 30, 80) = 30`, so `x = 30`.

## Expected

For the spending frontier, point `x` values in caller-grid order are exactly `[48000, 60000, 72000]`.

For the single-person retirement-age frontier with current age `65`, point `x` values in caller-grid order are exactly `[63, 65, 68]`.

For the two-person retirement-age case with ages `65` and `62` and delta `+3`, the point `x` value is exactly `65`.

For the lower-clamp retirement-age case with age `31` and delta `-2`, the point `x` value is exactly `30`.

Fixture tolerance: exact for all six caller-grid axis values (`48000`, `60000`, `72000`, `63`, `65`, and `68`) and for the two additional age-case values (`65` and `30`), because every expected value is an integer.

## Wrong readings

- Publishing the retirement-age delta gives `[-2, 0, 3]` instead of the resulting ages `[63, 65, 68]` in the primary case.
- Taking the maximum resulting retirement age in the two-person case gives `68` instead of the required minimum, `65`.
- Ignoring the retirement-age clamp gives `29` instead of `30` in the lower-bound case.
- Publishing the spending multipliers themselves gives `[0.8, 1, 1.2]` instead of the variant plans' base-annual values `[48000, 60000, 72000]`.

## Family

outputs: `stochastic-frontier-variant-axis`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 frontier-axis doc-comment correction), without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-seven.md in this directory (the follow-up review, and the re-check section after the comment correction).

Revision note: The first derivation followed a comment that named the delta, and the implementation's fixture found the published value is the resulting age.
