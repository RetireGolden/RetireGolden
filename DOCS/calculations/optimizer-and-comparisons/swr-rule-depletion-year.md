## Claim

Kind: composition. `decisions/swrComparator.ts#compareSwrRules` publishes, for each constant-real rule run, the first calendar year whose exact ledger has any spending shortfall, or `null` when no projection year has a shortfall.

## Justification

The `ProjectionResult` contract defines depletion year as the first year with any shortfall, so the selection rule is `min{y: shortfall_y>0}` when that set is nonempty and `null` otherwise; the explicit horizon prevents a shorter run from being interpreted as depletion. The valid domain is an ordered finite rule-run ledger.

## Inputs

| Year | Spending shortfall | Unit |
|---|---:|---|
| 2040 | 0.00 | nominal dollars |
| 2041 | 125.00 | nominal dollars |
| 2042 | 2,400.00 | nominal dollars |
| Projection end year | 2042 | calendar year |

## Arithmetic

The qualifying set is `{2041,2042}` because those rows have `shortfall>0`; its minimum is `2041`.

## Expected

Depletion year is exactly integer `2041`; a second case with all three shortfalls equal to zero expects exactly `null`.

## Wrong readings

- Selecting the largest-shortfall year gives `2042`.
- Reporting the year before the first shortfall gives `2040`.

## Family

outputs: `swr-rule-result-depletion-year`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
