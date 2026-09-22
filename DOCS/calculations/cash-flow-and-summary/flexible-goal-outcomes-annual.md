## Claim

Kind: model. `spending/flexibleGoals.ts#createGoalScheduler` and `projection/internal/types/result.ts#YearResult.flexibleGoals` classify goals in classification, priority, then plan order and publish the six annual counts and nominal amounts. The formulae below are derived from the comments' stated ordering, inflation, budget, partial-funding, deferral, and terminal-skip conventions.

## Justification

Under an active guardrail policy, a fixed goal funds unconditionally in its target year. Movable and skippable goals fully fund when the remaining flexible-goal budget covers the inflated amount, partially fund when partial funding is allowed and the budget clears the inflated minimum, otherwise defer before `latestYear` and skip at `latestYear`. A skipped amount remains intended spending in its classification layer. Outside guardrail mode all six published fields are 0 even though ordinary target-year goal funding still occurs.

## Inputs

Planning year 2030 has cumulative inflation factor `1.10`, an active guardrail cut, no pull-forward, and `$1,700` nominal flexible-goal budget. Goals are:

| Plan order | Classification | Priority | Flexibility | Timing in 2030 | Today-dollar amount | Partial rule |
|---:|---|---:|---|---|---:|---|
| 1 | required | 1 | fixed | target year | $1,000 | none |
| 2 | target | 1 | movable | target year; latest 2031 | $1,000 | none |
| 3 | ideal | 1 | movable | target year; latest 2031 | $1,000 | allowed, 50% minimum |
| 4 | excess | 1 | movable | target year; latest 2031 | $500 | none |
| 5 | excess | 2 | skippable | latest year | $400 | none |

## Arithmetic

Visiting order is required fixed, target movable, ideal movable, then the two excess goals by priority. Nominal amounts are `$1,100`, `$1,100`, `$1,100`, `$550`, and `$440`.

The fixed goal funds `$1,100` without using the flexible budget. The target goal fully funds `$1,100`, leaving `$600`. The ideal goal's minimum is `$1,100 × 50% = $550`; `$600` clears it, so it partially funds `$600`, leaves `$500` unfunded, and exhausts the budget. The first excess goal is before its latest year and defers. The second is at its latest year and skips, leaving `$440` unfunded.

Thus funded amount `= 1,100 + 1,100 + 600 = $2,800`; unfunded amount `= 500 + 440 = $940`.

## Expected

Exact outputs: `funded = 2`, `partiallyFunded = 1`, `deferred = 1`, `skipped = 1`, `fundedAmount = $2,800`, and `unfundedAmount = $940`. Fixture tolerance: exact for counts; absolute `$0.005` for dollar amounts because nominal amounts are binary-floating-point calculations.

Outside guardrail mode, the expected publication is six exact zeros.

## Wrong readings

- Letting the fixed goal consume the flexible budget leaves `$600`; the target goal then defers, the ideal goal partially funds `$600`, and the later goals defer/skip, producing counts `1/1/2/1`, funded `$1,700`, and unfunded `$940`.
- Testing the ideal goal's 50% minimum against `$1,000` today-dollars still partially funds this fixture, but uses the wrong `$500` threshold instead of `$550`; with a `$520` remainder it would report partial instead of skipped/deferred.
- Dropping the terminal skipped amount produces unfunded `$500` instead of `$940` and removes `$440` from the excess layer's intended spending.

Limit: `model/plan.ts#GoalFlexibility` describes movable and skippable goals differently at `latestYear`, but the scheduler and published-field comments specify that both skip with the amount folded into layer totals. This worksheet follows the latter behavior; decision D-GOAL-FLEXIBILITY is queued.

## Family

outputs: `flexible-goals-funded-count-annual`; `flexible-goals-partially-funded-count-annual`; `flexible-goals-deferred-count-annual`; `flexible-goals-skipped-count-annual`; `flexible-goal-funded-amount-annual`; `flexible-goal-unfunded-amount-annual`.

feeds: `spending-intended-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six.md in this directory (approved with a note: the plan schema's movable/skippable distinction is not what the scheduler does; the worksheet follows the scheduler and names decision D-GOAL-FLEXIBILITY in its limits).
