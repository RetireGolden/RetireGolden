## Claim

Kind: composition. `decisions/swrComparator.ts#compareSwrRules` publishes, for each constant-real rule run, the projection's first calendar year whose funding shortfall after any HECM backstop draw is strictly greater than `ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS`, which is `0.005` nominal dollars, or `null` when no projection year crosses that gate.

## Justification

The corrected `ProjectionResult` contract defines depletion year as the first year whose funding shortfall, after any HECM backstop draw, exceeds the ledger's own annual residual budget of half a cent. The selection rule is `min{y: shortfall_y > 0.005}` when that set is nonempty and `null` otherwise. The comparison is strict, so a residual at or below `0.005` is not depletion; the explicit horizon prevents a shorter run from being interpreted as depletion. The valid domain is an ordered finite rule-run ledger.

## Inputs

| Year | Spending shortfall | Unit |
|---|---:|---|
| 2039 | 0.004 | nominal dollars |
| 2040 | 0.00 | nominal dollars |
| 2041 | 125.00 | nominal dollars |
| 2042 | 2,400.00 | nominal dollars |
| Projection end year | 2042 | calendar year |

## Arithmetic

The qualifying set is `{2041, 2042}` because those rows have `shortfall > 0.005`; `2039` is excluded because `0.004 <= 0.005`. The minimum qualifying year is `2041`.

## Expected

Depletion year is exactly the integer `2041`.

A second case with every shortfall equal to zero expects exactly `null`.

A third case whose only nonzero shortfall is exactly `0.005` in one year expects exactly `null`, because the comparison is strict.

What the fixture executes: the first two cases, realized by a real ledger run rather than the shortfall table above (a $1,000,000 cash portfolio exhausted in 2041 by the rule level and a level premium, whose shortfalls from 2041 on are in the thousands of dollars; and a run ending in 2040 with no shortfall). The `0.004` row and the third case are contract statements, not executed evidence: the ledger funds to its own exact-cent fixed point, and no plan input leaves a residual of exactly half a cent in one year while every other year is funded, so the fixture does not discriminate the strict `>` from `>=` or from any-positive-shortfall. The record's limits say the same.

## Wrong readings

- Treating any shortfall greater than zero as depletion gives `2039`.
- Selecting the largest-shortfall year gives `2042`.
- Using a `>=` comparison flips the exact-`0.005` case from `null` to that year (not executed as a mutation, for the reason given under Expected).

## Family

outputs: `swr-rule-result-depletion-year`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment corrections) and the orchestrator's contract statement, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-slice-seven.md in this directory.

Revision note: The first derivation assumed any shortfall was depletion; pull-request review of #720 found that assumption.
