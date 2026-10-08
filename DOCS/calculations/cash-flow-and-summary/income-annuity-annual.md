## Claim

Kind: model. `projection/internal/types/result.ts#YearResult.incomes.annuity`, produced by `projection/internal/annualPensionAndAnnuityIncome.ts#annualPensionAndAnnuityIncome`, starts an annuity at its start age, applies its annual COLA, and applies the selected payout form. For `jointSurvivor`, payments continue to the surviving joint annuitant at `survivorPct`; the annualization and COLA formula are derived from the plan comments' monthly amount and annual-COLA convention.

## Justification

The extract states the joint-survivor fraction explicitly, so no unstated payout fraction is needed. A life-only contract would stop at owner death; a period-certain contract would continue only inside its guarantee window.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Start age | 65 | attained age |
| Current owner's would-be age | 66 | attained age |
| Owner alive / other household member alive | false / true | Boolean |
| Monthly amount at start | 1,500 | nominal dollars/month |
| COLA | 2 | percent/year |
| Payout form | joint survivor | form |
| Joint-survivor percentage | 60 | percent |

## Arithmetic

One post-start COLA gives full annual payment `= 1,500 × 12 × 1.02 = $18,360`. Survivor payment `= 18,360 × 60/100 = $11,016`.

## Expected

Exact value: `$11,016`. Fixture tolerance: absolute `$0.005`, because COLA multiplication uses binary floating point.

## Wrong readings

- Applying life-only behavior to the joint-survivor form produces `$0`.
- Paying the full amount after owner death produces `$18,360`.
- Applying 60% to the monthly amount but omitting the COLA produces `$10,800` annually.

## Family

outputs: `income-annuity-annual`.

feeds: `income-total-annual`.

## A purchase dated before the start year (D-2027-ROLLOVER): a registered limit

The engine reads every entered balance as of the start year, so a contract whose purchase year is before the start is treated as already paid: its annuity pays, and no premium leaves the funding account. That is right when the balance was entered after the purchase. When it was entered before and not updated, the premium is counted twice. The derivation measured its U1 household ($100,000 non-qualified, bought in 2026 from the brokerage, $550 a month from 67): the purchase lowers ending net worth by $147,623 from a 2026 start and raises it by $454,837 from a 2027 start. `packages/planner-ui/src/planner/preStartEvents.figures.test.ts` pins U1 to the cent: -$151,691.59 from a 2026 start and +$455,159.49 from a 2027 start (main's #761 moved the 2027 figure from the derivation's, by pricing a saved example's 2027 premium tax credit from a 2027 start; the 2026-09-29 change to CMS's published IRMAA amounts moved both, from -$147,622.51 and +$455,165.79; on 2026-10-07 Kentucky's part-year slice took its whole standard deduction, which moved the 2026 figure from -$147,623.51, the household being Kentucky residents who move to Florida in November; and on 2026-10-08 the slice received the characterized retirement rows, so Kentucky's pension exclusion meets the in-plan Roth conversion received while resident, up to the whole $31,110 of 2025 Schedule P, which moved it from -$147,615.81; `DOCS/calculations/taxes/scripts/part-year-split-years.mjs` lists that split year's slices, rows and state tax before and after). The check found every tax qualification behaves the same way.

The engine cannot tell which case it has, so the figure is not corrected: deducting the premium at the start would double-deduct it for every household that did update the balance. The projection names each such purchase instead (`projection/preStartEvents.ts#preStartEvents`):

> The Income annuity purchase is dated 2026, before this plan starts in 2027, so it is treated as already paid: the premium is not taken from Joint brokerage. If that balance still includes the premium, lower it by $100,000.

Worked case for the evidence file: a $700,000 brokerage, zero returns, inflation and spending. From a 2026 start the 2026 brokerage row is `$100,000` lower with the contract than without it, and no warning is added. From a 2027 start the 2027 row is the same with and without it, and the warning above is added.

Restated 2026-09-28 by the implementer of decision D-2027-ROLLOVER (Claude Opus 5.5), from the derivation and the independent check (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/rollover-2027-derivation.md` and `rollover-2027-check.md`). Not yet reviewed: the record is `reviewedBy: 'unreviewed'`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six.md in this directory.

Reviewed by: Grok (grok-4.7), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-grok-1.md`.

Revision 2026-09-29, after the Grok review above: the engine now reads CMS's published IRMAA amounts, which moves the pre-start figures `packages/planner-ui/src/planner/preStartEvents.figures.test.ts` pins (a full-horizon measurement the review did not recompute) by cents to a few dollars; the record's limit and the paragraph above state the new pins beside the old. No worked case of this worksheet moves. Because the record's text changed, it was unreviewed until the review below. Revised by claude (opus 5.5).

Reviewed by: Grok (grok-4.7), 2026-09-30, targeted re-check after the fix, `DOCS/calculations/reviews/REVIEW-2026-09-30-recheck-grok.md`.

Reviewed by: Codex (GPT-6-Sol), 2026-10-08, the restated pre-start purchase limit, item 5 of `DOCS/calculations/reviews/REVIEW-2026-10-08-part-year-methods-codex.md`.
