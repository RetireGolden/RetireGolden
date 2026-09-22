## Claim

Kind: model. `projection/internal/types/result.ts#YearResult.incomes.pension`, produced by `projection/internal/annualPensionAndAnnuityIncome.ts#annualPensionAndAnnuityIncome`, pays an annual pension from its start age, applies its annual COLA, and after the owner dies continues the stated survivor percentage to a surviving spouse. The annualization and COLA formula are derived from the plan comments' monthly amount and annual-COLA convention.

## Justification

The fixture isolates the survivor rule after two COLA years. A pension commuted by a lump-sum election would not pay, but no election is present here.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Owner's pension start age | 65 | attained age |
| Current owner's would-be age | 67 | attained age |
| Owner alive / spouse alive | false / true | Boolean |
| Monthly amount at start | 2,000 | nominal dollars/month |
| COLA | 3 | percent/year |
| Survivor percentage | 50 | percent |
| Lump-sum election | absent | election |

## Arithmetic

Full annual payment after two COLAs `= 2,000 × 12 × 1.03^2 = $25,461.60`. Survivor payment `= 25,461.60 × 50/100 = $12,730.80`.

## Expected

Exact value: `$12,730.80`. Fixture tolerance: absolute `$0.005`, because COLA multiplication uses binary floating point.

## Wrong readings

- Paying the full post-COLA pension after the owner dies produces `$25,461.60`.
- Applying the survivor percentage before annualization but omitting COLA produces `$12,000`.
- Gating on the deceased owner alone produces `$0` despite the surviving-spouse continuation.

## Family

outputs: `income-pension-annual`.

feeds: `income-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six.md in this directory.
