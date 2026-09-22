## Claim

Kind: composition. `projection/internal/types/yearLedger.ts#YearIncomes.tipsLadder` and `projection/internal/types/result.ts#YearResult.ladderValue`, produced through `projection/internal/tipsLadderAnnualCashFlow.ts#tipsLadderAnnualCashFlows`, apply the stated rung eligibility rules, funding scale, and cumulative inflation factor. Cash is `(coupons + maturing principal) × scale × inflation`; remaining value is unmatured face `× scale × inflation`.

## Justification

Coupons include rungs with `maturityOffset >= offset`; principal includes rungs maturing at the offset; year-end value includes only rungs with `maturityOffset > offset`. Purchase-year cash is explicitly zero.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Anchor/purchase year | 2026 | year |
| Rung A face / coupon / maturity offset | 10,000 / 1 / 1 | dollars / percent / years |
| Rung B face / coupon / maturity offset | 20,000 / 2 / 3 | dollars / percent / years |
| Funding scale | 0.8 | funded fraction |
| Offset-1 cumulative inflation factor | 1.05 | nominal/real ratio |
| Offset-2 cumulative inflation factor | 1.10 | nominal/real ratio |
| Household alive | true | Boolean |

## Arithmetic

Purchase year 2026, offset 0: cash `= $0`; value `= ($10,000 + $20,000) × 0.8 × 1 = $24,000`.

Offset 1: coupons `= $10,000(0.01) + $20,000(0.02) = $500`; maturing principal `= $10,000`; cash `= ($500 + $10,000) × 0.8 × 1.05 = $8,820`. Only Rung B remains, so value `= $20,000 × 0.8 × 1.05 = $16,800`.

Offset 2: only Rung B pays a coupon, `$20,000(0.02) = $400`, and no principal matures. Cash `= $400 × 0.8 × 1.10 = $352`. Rung B remains, so value `= $20,000 × 0.8 × 1.10 = $17,600`.

## Expected

Exact values: purchase-year cash `$0` and value `$24,000`; offset-1 cash `$8,820` and value `$16,800`; offset-2 cash `$352` and value `$17,600`. Fixture tolerance: absolute `$0.005`, because scaled and inflation-adjusted dollars are computed in binary floating point.

## Wrong readings

- Excluding the maturing rung's offset-1 coupon gives cash `($400 + $10,000) × 0.8 × 1.05 = $8,736`.
- Keeping the matured face in offset-1 year-end value gives `$30,000 × 0.8 × 1.05 = $25,200`.
- Paying cash in the purchase year gives `$500 × 0.8 = $400`; the contract says purchase-year cash is `$0`.

## Family

outputs: `income-tips-ladder-annual`; `ladder-value-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eleven.md in this directory.
