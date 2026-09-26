## Claim

Kind: model. `spending/flexibleGoals.ts#createGoalScheduler` and `projection/internal/types/result.ts#YearResult.flexibleGoals` classify goals in classification, priority, then plan order and publish the six annual counts and nominal amounts. The formulae below are derived from the comments' stated ordering, inflation, budget, partial-funding, deferral, and terminal-skip conventions.

## Justification

Under an active guardrail policy, a fixed goal funds unconditionally in its target year. A movable or skippable goal enters the schedule in its target year, or from its earliest year when goals may be pulled forward, and leaves it after `latestYear`; a goal not in the schedule has no outcome that year. The flexible-goal budget constrains a movable or skippable goal only when it is funded before its target year or the year is cutting; in a non-cutting year, a goal in or after its target year funds in full, and a skip at `latestYear` therefore happens only in a cutting year. Movable and skippable goals fully fund when the applicable remaining flexible-goal budget covers the inflated amount, partially fund when partial funding is allowed and the budget clears the inflated minimum, otherwise defer before `latestYear` and skip at `latestYear`. A skipped amount remains intended spending in its classification layer. Outside guardrail mode all six published fields are 0 even though ordinary target-year goal funding still occurs.

## Inputs

Planning year 2030 has cumulative inflation factor `1.10`. Both cases use these goals:

| Plan order | Classification | Priority | Flexibility | Earliest year | Target year | Latest year | Today-dollar amount | Partial rule |
|---:|---|---:|---|---:|---:|---:|---:|---|
| 1 | required | 1 | fixed | 2030 | 2030 | 2030 | $1,000 | none |
| 2 | target | 1 | movable | 2030 | 2031 | 2032 | $1,000 | none |
| 3 | ideal | 1 | movable | 2030 | 2031 | 2032 | $1,000 | allowed, 50% minimum |
| 4 | excess | 1 | movable | 2030 | 2031 | 2032 | $500 | none |
| 5 | excess | 2 | skippable | 2030 | 2030 | 2030 | $400 | none |

Case A is a non-cutting pull-forward year. Goals may be pulled forward, and the remaining upside budget the ledger hands the scheduler is `$1,700` nominal.

Case B is a cutting year. Goals may not be pulled forward, so goals 2, 3, and 4 are not yet in the schedule and have no outcome. The budget the ledger hands the scheduler is `0`.

## Arithmetic

Visiting order is required fixed, target movable, ideal movable, then the two excess goals by priority. Nominal amounts are `$1,100`, `$1,100`, `$1,100`, `$550`, and `$440`.

Case A:

- Goal 1 is fixed and in its target year, so it funds `$1,100` without using the `$1,700` flexible budget. Remaining budget: `$1,700`.
- Goal 2 is before its target year, so the budget constrains it. The `$1,700` remainder covers its `$1,100` nominal amount, so it fully funds. Remaining budget: `$1,700 - $1,100 = $600`.
- Goal 3 is before its target year, so the budget constrains it. Its inflated minimum is `$1,100 × 50% = $550`; `$600` clears it, so it partially funds `min($1,100, $600) = $600`, leaves `$1,100 - $600 = $500` unfunded, and exhausts the budget.
- Goal 4 is before its target year, has no partial rule, and the remaining budget is `0`, so it defers. It adds nothing to either amount.
- Goal 5 is in its target and latest year in a non-cutting year, so it funds its full `$440` regardless of the exhausted budget.

Thus Case A funded amount `= 1,100 + 1,100 + 600 + 440 = $3,240`; unfunded amount `= 500 = $500`.

Case B:

- Goal 1 is fixed and in its target year, so it funds `$1,100` unconditionally and does not consume the flexible budget.
- Goals 2, 3, and 4 have target year 2031, and goals may not be pulled forward in a cutting year, so they are not in the 2030 schedule and have no outcome. They add nothing to either amount.
- Goal 5 is skippable, the cutting-year budget is `0`, and 2030 is its `latestYear`, so it skips. Its `$440` nominal amount is unfunded and remains intended spending in the excess layer.

Thus Case B funded amount `= 1,100 = $1,100`; unfunded amount `= 440 = $440`.

## Expected

Case A exact outputs: `funded = 3`, `partiallyFunded = 1`, `deferred = 1`, `skipped = 0`, `fundedAmount = $3,240`, and `unfundedAmount = $500`.

Case B exact outputs: `funded = 1`, `partiallyFunded = 0`, `deferred = 0`, `skipped = 1`, `fundedAmount = $1,100`, and `unfundedAmount = $440`.

Fixture tolerance: exact for counts; absolute `$0.005` for dollar amounts because nominal amounts are binary-floating-point calculations.

Outside guardrail mode, the expected publication is `funded = 0`, `partiallyFunded = 0`, `deferred = 0`, `skipped = 0`, `fundedAmount = $0`, and `unfundedAmount = $0`.

## Wrong readings

- In Case A, letting the fixed goal consume the flexible budget leaves `$600`; goal 2 then defers, goal 3 partially funds `$600`, goal 4 defers, and goal 5 still funds in full because it is in its target year in a non-cutting year, producing counts `2/1/2/0`, funded `$2,140`, and unfunded `$500`.
- In Case A, testing goal 3's 50% minimum against `$1,000` today-dollars produces the wrong `$500` threshold instead of `$550`. The actual `$600` remainder clears both, so this misread coincidentally produces the same counts `3/1/1/0`, funded `$3,240`, and unfunded `$500`; with a `$520` remainder it would report partial instead of deferred.
- In Case B, dropping the terminal skipped amount produces unfunded `$0` instead of `$440` and removes `$440` from the excess layer's intended spending.
- In Case B, treating goals 2, 3, and 4 as deferred even though they are not in the schedule publishes `deferred = 3` instead of `deferred = 0`.

Limit: movable and skippable goals end the same way at `latestYear`: both skip with the amount folded into layer totals. The `model/plan.ts#GoalFlexibility` comment once described them differently; decision D-GOAL-FLEXIBILITY (2026-09-25) kept the scheduler, and the comment now states this behavior.

## Family

outputs: `flexible-goals-funded-count-annual`; `flexible-goals-partially-funded-count-annual`; `flexible-goals-deferred-count-annual`; `flexible-goals-skipped-count-annual`; `flexible-goal-funded-amount-annual`; `flexible-goal-unfunded-amount-annual`.

feeds: `spending-intended-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six.md in this directory (approved with a note: the plan schema's movable/skippable distinction is not what the scheduler does; the worksheet follows the scheduler and names decision D-GOAL-FLEXIBILITY in its limits). Revision 2026-09-22: the single case, a cutting year carrying a $1,700 budget, is not a state the completed YearResult.flexibleGoals contract allows (a cutting year hands the scheduler a budget of 0, and the budget constrains only goals funded before their target year); it was split into a pull-forward year and a cutting year over one goal table. Re-derived by codex without executing the engine. Corrected the same day: in the cutting year, goals not yet in the schedule have no outcome, so Case B publishes deferred 0.

Amended 2026-09-25 by claude (the implementer of decision D-GOAL-FLEXIBILITY): the limit line now records the decision instead of calling it queued. No input, arithmetic or expected value changed.
