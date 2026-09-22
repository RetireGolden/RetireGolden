## Claim

Kind: formula. `projection/internal/types/result.ts#YearResult.expenses.insurancePremiums`, selected by `projection/internal/annualInsurancePremiumRows.ts#annualInsurancePremiumRows`, sums fixed-nominal `annualPremium` for living subjects under `lifetime`, charges zero under `paidUp`, and under `untilAge` charges only while the subject's attained age is below `premiumEndAge`. Nothing is charged in the year the subject attains `premiumEndAge` or afterward.

## Justification

The schema explicitly calls premiums level rather than inflation-adjusted and defines the two stop rules. The `premiumEndAge` field is the age when premiums stop, and the completed `untilAge` comment makes the comparison strict: attained age must be below the end age. Decision D-PREMIUM-END-AGE records the earlier conflicting “through” reading for resolution.

## Inputs

Primary case:

| Policy | Mode | Annual premium | Subject age | End age | Alive | Unit |
|---|---|---:|---:|---:|---|---|
| LTC A | lifetime | 1,200 | 64 | n/a | true | nominal dollars/year |
| Life B | paidUp | 900 | 70 | n/a | true | nominal dollars/year |
| Life C | untilAge | 600 | 65 | 65 | true | nominal dollars/year |
| LTC D | untilAge | 500 | 66 | 65 | true | nominal dollars/year |

Boundary case:

| Policy | Mode | Annual premium | Subject age | End age | Alive | Unit |
|---|---|---:|---:|---:|---|---|
| Life E | untilAge | 600 | 64 | 65 | true | nominal dollars/year |

## Arithmetic

Primary case: `$1,200 + $0 + $0 + $0 = $1,200`. Life C is at its end age, so its charge is zero. No inflation factor is applied.

Boundary case: Life E is one year before its end age, and `64 < 65`, so its charge is `$600`.

## Expected

Primary exact value: `expenses.insurancePremiums = $1,200`. Boundary-case exact value: `expenses.insurancePremiums = $600`. Fixture tolerance: absolute `$0.005`, because the annual ledger folds dollar rows in binary floating point.

## Wrong readings

- Charging `untilAge` through and including the end age charges Life C `$600` and produces the first derivation's `$1,800`; the strict stop-age contract produces `$1,200`.
- Stopping Life E one year early produces `$0`; at age 64 it is still below its end age of 65 and owes `$600`.
- Inflating the primary case's charged premium by 3% produces `$1,236` instead of the fixed-nominal `$1,200`.
- Charging the paid-up and post-end-age policies in the primary case produces `$2,600`.

## Family

outputs: `spending-insurance-premiums-annual`.

feeds: `spending-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment completion), without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory (the re-check section named "Re-check, 2026-09-18 (three worksheets after the slice-eleven comment completion)").

Revision note: The first derivation treated `premiumEndAge` as inclusive, charged Life C at age 65, and expected `$1,800`; the implementation's fixture found that error. This revision applies the strict stop-age contract and expects `$1,200`.
