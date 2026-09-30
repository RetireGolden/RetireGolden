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

Restated 2026-09-30 by claude, and unreviewed since: the record now states a known limit rather than leave it silent. In the year a surviving spouse's treat-as-own election takes effect, the engine takes each IRA's owner RMD from the election facts' reference balance when one is given, and the plan checks require every IRA inherited from one decedent to carry identical facts, so a pool of two or more elected IRAs shares one reference. Treas. Reg. 1.408-8(c)(3) makes that year's RMD the owner's under section 401(a)(9)(A), computed under 1.401(a)(9)-5 on the balance 1.408-8(b)(2) substitutes for 1.401(a)(9)-5(b), the IRA's own balance at the prior December 31, calculated separately for each IRA ((e)(1)(i)). Worked case, pinned as current behavior in `simulate.spousalElectionYearOwnerRmd.test.ts`: a `$29,600` IRA pooled with a `$100,000` one under a `$100,000` reference owes `$100,000 / 24.6 = $4,065.04` in the engine, where its own balance gives `$29,600 / 24.6 = $1,203.25`; the engine overstates the requirement for every pooled IRA smaller than the reference. No input, arithmetic or expected value of this worksheet changed.

Reviewed by: Grok (grok-4.7), 2026-09-30, `DOCS/calculations/reviews/REVIEW-2026-09-30-round3-grok.md`.
