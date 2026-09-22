## Claim

Kind: formula. `projection/internal/annualInheritedIraDistributions.ts#annualInheritedIraDistributions`, using `#AnnualInheritedIraDistributionOperation.executed` and the required evidence from `strategies/inheritedIra.ts#inheritedRequirementForYear`, executes `min(required amount, live balance)` in an ordinary required year, the full live balance in a final-sweep year, and 0 when the requirement is `none` or notice-waived. The exact formulas are derived from the comments that execution never exceeds the current balance, that the final sweep reconciles the entire remaining interest to the live balance, and that waived/none evidence does not force cash.

## Justification

Requirement evidence is immutable legal-year evidence, while the distribution operation is the cash actually debited. Capping an ordinary requirement at the live balance preserves both facts. A sweep empties what remains. A none or notice-waived requirement authorizes no forced debit.

## Inputs

| Case | Required evidence | Live balance | Requirement status | Unit |
|---|---:|---:|---|---|
| Ordinary, sufficient balance | 8,000 | 20,000 | annual RMD | dollars |
| Ordinary, insufficient balance | 8,000 | 5,000 | annual RMD | dollars |
| Final sweep | 83,000 | 61,000 | final sweep | dollars |
| No annual requirement | 0 | 20,000 | none | dollars |
| Notice-waived annual amount | 8,000 | 20,000 | notice waived | dollars |

## Arithmetic

- Ordinary sufficient balance: `min($8,000, $20,000) = $8,000`.
- Ordinary insufficient balance: `min($8,000, $5,000) = $5,000`.
- Final sweep: take the full live balance, `$61,000`.
- None: `$0`.
- Notice waived: `$0` forced execution.

## Expected

Exact published executed required amounts, in table order: `$8,000`, `$5,000`, `$61,000`, `$0`, and `$0`. Fixture tolerance: exact, because every operation is a comparison or selection over whole-dollar inputs.

## Wrong readings

- Executing the uncapped `$8,000` requirement against the `$5,000` live balance overdraws by `$3,000`; the executed amount is `$5,000`.
- Using final-sweep evidence `$83,000` as cash despite a `$61,000` live balance overdraws by `$22,000`; the sweep executes `$61,000`.
- Forcing the notice-waived `$8,000` produces `$8,000`; the executed required amount is `$0`.

## Family

outputs: `inherited-distribution-required-executed-annual`.

feeds: `inherited-distribution-forced-annual`; `withdrawals-by-category-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory (the follow-up review section).
