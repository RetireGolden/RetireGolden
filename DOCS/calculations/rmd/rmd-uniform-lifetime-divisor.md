## Claim

Kind: data. `rmd/rmd.ts#requiredMinimumDistribution` computes an owner RMD for the age-attained year as the prior December 31 traditional-account balance divided by the 2026 pack's Uniform Lifetime Table divisor when no qualifying more-than-ten-years-younger sole-spouse beneficiary applies.

## Justification

The pack reproduces IRS Pub. 590-B's Uniform Lifetime Table. For age 75 its published divisor is 24.6; annual RMD is prior-year-end balance divided by that divisor.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Birth year | 1951 | calendar year |
| Age attained in 2026 | 75 | years |
| Prior-year-end balance | 246,000 | dollars at prior Dec. 31 |
| Uniform divisor at 75 | 24.6 | years |
| Sole spouse more than 10 years younger | no | boolean |

The divisor is `year2026.rmd.uniformLifetimeTable[75]`.

## Arithmetic

RMD: `$246,000 ÷ 24.6 = $10,000`.

## Expected

Exact derived and published RMD: `$10,000`; fixture tolerance: exact because the selected balance is an exact multiple of the published divisor.

## Wrong readings

- Using age-74 divisor 25.5 produces `$9,647.058823...`.
- Using current year-end rather than prior-year-end balance of, for example, `$240,000` produces `$9,756.097561...`.

## Family

outputs: `rmd-required-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.

Restated 2026-09-30 by claude, and reviewed by Grok (grok-4.7) the same day (below): the record now states a known limit rather than leave it silent. In the year a surviving spouse's treat-as-own election takes effect, the engine takes each IRA's owner RMD from the election facts' reference balance when one is given, and the plan checks require every IRA inherited from one decedent to carry identical facts, so a pool of two or more elected IRAs shares one reference. Treas. Reg. 1.408-8(c)(3) makes that year's RMD the owner's under section 401(a)(9)(A), computed under 1.401(a)(9)-5 on the balance 1.408-8(b)(2) substitutes for 1.401(a)(9)-5(b), the IRA's own balance at the prior December 31, calculated separately for each IRA ((e)(1)(i)). Worked case, pinned as current behavior in `simulate.spousalElectionYearOwnerRmd.test.ts`: a `$29,600` IRA pooled with a `$100,000` one under a `$100,000` reference owes `$100,000 / 24.6 = $4,065.04` in the engine, where its own balance gives `$29,600 / 24.6 = $1,203.25`; the engine overstates the requirement for every pooled IRA smaller than the reference. No input, arithmetic or expected value of this worksheet changed.

Reviewed by: Grok (grok-4.7), 2026-09-30, `DOCS/calculations/reviews/REVIEW-2026-09-30-round3-grok.md`.

Restated 2026-10-07 by claude (decision D-POOLED-ELECTION-REFERENCE-BALANCE): the limit above is fixed. Each elected IRA in a pool of two or more now takes its own opening balance for the year, the projection's prior December 31 balance, as Treas. Reg. 1.408-8(b)(2) and (e)(1)(i) require; the reference balance stands in only for an IRA alone in its payee/decedent/type pool. The worked case is re-pinned in `simulate.spousalElectionYearOwnerRmd.test.ts` as a `describeRule` fixture with its worksheet in the comment: the `$29,600` IRA owes `$29,600 / 24.6 = $1,203.25`, not `$4,065.04`, the `$100,000` IRA still owes `$4,065.04`, and the owner's one owned-IRA obligation is `$129,600 / 24.6 = $5,268.29` (it was `$8,130.08`). The record names what remains: a pooled IRA has no reference of its own, so an opening balance that already nets a pre-election distribution understates its requirement, and the pool's one j(4) pre-election distribution is credited against each pooled IRA. No input, arithmetic or expected value of this worksheet changed. This restatement has not yet had an independent review.

Restated again 2026-10-07 by claude: the two pooled remainders named above are fixed. Treas. Reg. 1.408-8(c)(3) makes each elected IRA's election-year RMD an owner RMD, so a distribution from it in that calendar year, before the election or after, counts toward it (1.402(c)-2(j)(4) treats a current-year pre-election distribution the same way when it sizes the catch-up), and 1.408-8(e)(1)(i) lets the separately calculated requirements be totaled and distributed from any one or more of the IRAs, so the distribution counts once toward the total. A completed current-year history row is credited to the IRA it names; the j(4) pre-election distribution, one figure in the pool's shared facts that names no IRA, is counted once for the pool. Because the projection never debits an accepted pre-election distribution, a plan's balance is entered after it, so each IRA's prior December 31 balance under 1.408-8(b)(2) is its opening balance plus the distributions accepted as taken from it; the pool's unnamed figure is added back to the first IRA, which leaves the total requirement unchanged (one owner, one divisor). Worked case, pinned in `simulate.spousalElectionYearOwnerRmd.test.ts`: `$99,000` and `$29,600` IRAs, a `$100,000` reference and `$1,000` paid before the election have prior December 31 balances of `$100,000` and `$29,600`, requirements `$4,065.04` and `$1,203.25` (total `$129,600 / 24.6 = $5,268.29`), and `$4,268.29` forced, so the year distributes `$5,268.29`; the engine had forced `$3,227.64` and left `$1,040.65` unmet with no shortfall reported. What remains is stated in the record: a gain or loss since the prior December 31 is not carried, a pool with any completed history row does not also count its j(4) figure, and an IRA whose balance cannot cover its unpaid amount is not made up from another IRA. No input, arithmetic or expected value of this worksheet changed. This restatement has not yet had an independent review.
