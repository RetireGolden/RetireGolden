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

## A purchase dated before the start year (D-2027-ROLLOVER): a registered limit

A ladder whose purchase year is before the start is treated as already paid, anchored at its purchase year: its rungs pay and no cost leaves the funding account. When the balance was entered before the purchase and not updated, the cost is counted twice. The check measured a $30,000-a-year real bridge ladder for 2028 to 2031 bought in 2026: it costs $14,873 of ending net worth from a 2026 start and adds $702,171 from a 2027 start. `packages/planner-ui/src/planner/preStartEvents.figures.test.ts` pins the same ladder to the cent: -$14,871.56 from a 2026 start and +$702,077.94 from a 2027 start (main's #761 moved the 2027 figure from the check's, by pricing a saved example's 2027 premium tax credit from a 2027 start, and the 2026-09-29 change to CMS's published IRMAA amounts moved both, from -$14,872.97 and +$702,077.21). The figure is not corrected, for the reason the annuity record gives; the projection names each such purchase with the cost the ledger prices for a purchase in its own year (`ladder/ladderMath.ts#quotePlanLadder`, `projection/preStartEvents.ts#preStartEvents`):

> The Bridge TIPS ladder purchase is dated 2026, before this plan starts in 2027, so it is treated as already paid: its $114,426 cost is not taken from Joint brokerage. If that balance still includes the cost, lower it by $114,426.

Worked case for the evidence file: the check's ladder on a $700,000 brokerage, zero returns, inflation and spending. From a 2026 start more than $100,000 leaves the brokerage in 2026 and no warning is added. From a 2027 start the 2027 brokerage row is the no-ladder row plus that year's coupons (no cost taken), and the warning above is added.

Restated 2026-09-28 by the implementer of decision D-2027-ROLLOVER (Claude Opus 5.5), from the derivation and the independent check (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/rollover-2027-derivation.md` and `rollover-2027-check.md`). It was then unreviewed (`reviewedBy: 'unreviewed'`); Grok reviewed the restated record on 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-grok-1.md`, and re-checked its later revision on 2026-09-30, `DOCS/calculations/reviews/REVIEW-2026-09-30-recheck-grok.md`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eleven.md in this directory.

Reviewed by: Grok (grok-4.7), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-grok-1.md`.

Revision 2026-09-29, after the Grok review above: the engine now reads CMS's published IRMAA amounts, which moves the pre-start figures `packages/planner-ui/src/planner/preStartEvents.figures.test.ts` pins (a full-horizon measurement the review did not recompute) by cents to a few dollars; the record's limit and the paragraph above state the new pins beside the old. No worked case of this worksheet moves. Because the record's text changed, it was unreviewed until the review below. Revised by claude (opus 5.5).

Reviewed by: Grok (grok-4.7), 2026-09-30, targeted re-check after the fix, `DOCS/calculations/reviews/REVIEW-2026-09-30-recheck-grok.md`.
