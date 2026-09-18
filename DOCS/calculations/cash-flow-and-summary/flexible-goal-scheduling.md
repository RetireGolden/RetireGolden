## Claim

Kind: model. `spending/flexibleGoals.ts#createGoalScheduler` resolves each goal at most once, ordering candidates by classification, explicit priority, then original order, inflating today's-dollar cost and permitting partial funding only when its minimum percentage and budget rules are met.

## Justification

Lexicographic ordering prevents lower-priority upside goals from consuming scarce dollars before required/target goals. This is a product policy, not a claim that the ordering maximizes welfare. Case (b) must be evaluated in the goal's latest allowed year because an under-minimum goal with a later allowed year could be `deferred` instead of `skipped`. The finite available budget binds a movable goal only while a guardrail cut is in force.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Target goal cost | 1,000 | today's dollars |
| Inflation factor | 1.10 | nominal/today ratio |
| Available budget, case (a) | 700 | nominal dollars |
| Available budget, case (b) | 520 | nominal dollars |
| Minimum funding | 50 | percent |
| Partial funding allowed | true | Boolean |
| Candidate goals, cases (a) and (b) | This goal only | goal list |
| Planning year, cases (a) and (b) | Goal's `latestYear` | calendar-year condition |
| Guardrail cutting, cases (a) and (b) | true | Boolean |

## Arithmetic

Intended nominal amount `=1,000(1.10)=1,100`. Minimum acceptable `=1,100(0.50)=550`.

Case (a): Budget `$700` is below full amount but above `$550`, so fund `$700`; unfunded `=1,100-700=400`.

Case (b): Budget `$520` is below the nominal `$550` minimum, so the goal is skipped with no funding, the full `$1,100` is unfunded, and the budget is not consumed. Under the wrong reading, the minimum would instead be `=1,000(0.50)=500`, so the scheduler would fund `$520`; unfunded `=1,100-520=580`.

## Expected

Case (a): Outcome `partiallyFunded`, amount `$1,100`, funded `$700`, unfunded `$400`, remaining budget `$0`; exact cents if inputs are exact dollars.

Case (b): Outcome `skipped`, amount `$1,100`, funded `$0`, unfunded `$1,100`, remaining budget `$520`; exact cents if inputs are exact dollars.

## Wrong readings

- Testing the 50% minimum against today's `$1,000` uses `$500` instead of nominal `$550`.
- Under that reading, case (b) is `partiallyFunded`: funded `$520` and unfunded `$580`, rather than skipped.
- Deferring despite meeting the partial minimum reports funded `$0` and leaves `$700` unused.

## Family

`flexible-goal-funded-amount-annual`, `flexible-goal-unfunded-amount-annual`, `flexible-goals-funded-count-annual`, `flexible-goals-partially-funded-count-annual`, `flexible-goals-deferred-count-annual`, `flexible-goals-skipped-count-annual`, `spending-one-time-goals-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory (first review and the addendum for the cases added on 2026-09-18).

Revision note: Case (b) was added on 2026-09-18 with a budget between the today-dollar and inflated nominal minimums so the example discriminates between those readings. Following the independent reviewer's note that later allowed years leave `deferred` available, the Inputs now pin a single candidate, resolution in its latest allowed year, and `cutting = true` for both cases. The guardrail-cutting pin was corrected after the pull-request review caught the error.
