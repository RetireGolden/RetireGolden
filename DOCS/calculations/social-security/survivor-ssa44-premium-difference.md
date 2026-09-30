## Claim

Kind: formula. For each death timing, `projection/survivorTransition.ts#survivorTransitionAnalysis` runs the plan with SSA-44 survivor relief switched off and on (`#withSurvivorSsa44`: `expenses.healthcare.ssa44.survivorYears`, the retirement-years setting kept), and `#ssa44PremiumDifference` publishes:

- `ssa44PremiumSavings`: for each year of the run without relief that the run with relief also has, `medicarePremiums` without minus with, summed over every year (nominal dollars of different years);
- `ssa44ReliefYearSavings`: the same sum over the two relief years only, the death year + 1 and + 2.

The survivor page prints the whole sum, the relief years' tier changes, and ", including $X in later years" when the two differ by at least a dollar; it says "no surcharge to relieve at this timing" exactly when the relief-year part is at most 50 cents.

New 2026-09-28 (B2-P1 slice 5): the total is unchanged from planner-ui's `survivorAnalysis.ts#buildTimingRow` (same operands, same order); the relief-year part is new, because the cell's note named only the relief years while the figure included later years' knock-on.

## Justification

20 CFR 418.1205(a) lists "Your spouse dies" among the major life-changing events after which the income-related adjustment can use a more recent year's income. The engine's selection is `irmaa-lookback-selection`: in a premium year with an active event, the year − 1 MAGI when it is strictly lower than year − 2. Relief lowers the premiums in the relief years; the lower premiums leave more money, which changes later withdrawals, MAGI and tiers, so the whole-projection difference is the honest total and the relief-year part is published beside it (derivation open question 8).

## Inputs

M-B (synthetic premiums, death in 2039, relief years 2040 and 2041):

| Year | Without relief | With relief |
|---|---:|---:|
| 2040 | 5,000 | 3,000 |
| 2041 | 4,800 | 2,900 |
| 2042 | 2,500 | 2,510 |

## Arithmetic

Relief years: (5,000 − 3,000) + (4,800 − 2,900) = 2,000 + 1,900 = 3,900. Whole projection: 3,900 + (2,500 − 2,510) = 3,890; the later years' knock-on is −10.

## Expected

| Case | Expected |
|---|---|
| M-B total | 3,890 |
| M-B relief years | 3,900 |

Tolerance: exact (whole dollars in, sums of integers out).

## Wrong readings

- Counting only the relief years as "the saving" while displaying the total, or the reverse.
- Counting the death year as a relief year.
- A today's-dollar sum.
- Reading "—" as "no IRMAA in these years": it means the relief years' premiums do not differ.

## Family

outputs: `survivor-scenario-row-ssa44premium-savings`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27, B2-P1 slice 5 derivation (worksheet `survivor-scenario-row-ssa44premium-savings.md`, case M-B by hand); independently checked (evidence/b2p1-slice5-check.md, item 4). Implemented by: claude (opus 5.5), 2026-09-28. Reviewed by: not yet reviewed at the time; see the review below.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-1-social-security.md`.
