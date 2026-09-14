## Claim

Kind: model. `spending/flexibleGoals.ts#createGoalScheduler` resolves each goal at most once, ordering candidates by classification, explicit priority, then original order, inflating today's-dollar cost and permitting partial funding only when its minimum percentage and budget rules are met.

## Justification

Lexicographic ordering prevents lower-priority upside goals from consuming scarce dollars before required/target goals. This is a product policy, not a claim that the ordering maximizes welfare.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Target goal cost | 1,000 | today's dollars |
| Inflation factor | 1.10 | nominal/today ratio |
| Available budget | 700 | nominal dollars |
| Minimum funding | 50 | percent |
| Partial funding allowed | true | Boolean |

## Arithmetic

Intended nominal amount `=1,000(1.10)=1,100`. Minimum acceptable `=1,100(0.50)=550`. Budget `$700` is below full amount but above `$550`, so fund `$700`; unfunded `=1,100-700=400`.

## Expected

Outcome `partiallyFunded`, amount `$1,100`, funded `$700`, unfunded `$400`, remaining budget `$0`; exact cents if inputs are exact dollars.

## Wrong readings

- Testing the 50% minimum against today's `$1,000` uses `$500` instead of nominal `$550`.
- Deferring despite meeting the partial minimum reports funded `$0` and leaves `$700` unused.

## Family

`flexible-goal-funded-amount-annual`, `flexible-goal-unfunded-amount-annual`, `flexible-goals-funded-count-annual`, `flexible-goals-partially-funded-count-annual`, `flexible-goals-deferred-count-annual`, `flexible-goals-skipped-count-annual`, `spending-one-time-goals-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
