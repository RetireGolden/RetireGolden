## Claim

Kind: composition. `projection/internal/annualWithdrawalApplyFlowPlan.ts#annualWithdrawalApplyFlowPlan` and `#AnnualWithdrawalEvidenceWrite.voluntaryAmount` publish the ordinary withdrawal plan's additional draw from an inherited account after its forced take; an account effective as treat-as-own is not an inherited voluntary row.

## Justification

The required-distribution phase plans forced cash first. The later apply-flow phase receives the withdrawal plan by account ID and writes that account's voluntary amount into inherited evidence. Because owner treatment removes the account from beneficiary treatment, a treat-as-own account does not receive this inherited voluntary classification.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Opening inherited-account balance | 100,000 | dollars |
| Forced required take already executed | 5,000 | dollars |
| Remaining balance before ordinary withdrawals | 95,000 | dollars |
| Household ordinary withdrawal plan draw from this account | 12,000 | dollars |
| Treat-as-own effective | false | boolean |

## Arithmetic

The forced `$5,000` is already classified separately. The ordinary plan then takes `$12,000` from the inherited account, so `voluntaryAmount = $12,000`. Total account cash distributed is `$5,000 + $12,000 = $17,000`, but only `$12,000` is voluntary.

## Expected

Exact published `voluntaryAmount = $12,000`; the account's total distribution is `$17,000`, and `$5,000` remains forced rather than voluntary. Fixture tolerance: exact, because the example uses whole-dollar withdrawal-plan and ledger amounts.

## Wrong readings

- Publishing the total `$17,000` as voluntary double-counts the `$5,000` forced take; the voluntary field is `$12,000`.
- Subtracting the forced take from the ordinary plan again gives `$12,000 - $5,000 = $7,000`; the ordinary plan's stated account draw is already the additional voluntary amount.
- Classifying the same `$12,000` as inherited voluntary after treat-as-own becomes effective is wrong; that account is routed as owner treatment, so the inherited voluntary amount is `$0`/no inherited write.

## Family

outputs: `inherited-distribution-voluntary-annual`.

feeds: `withdrawals-by-category-annual`; `withdrawals-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory (the follow-up review section).
