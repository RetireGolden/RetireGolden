# Review, 2026-09-30 (round3-grok)

Reviewer: Grok (grok-4.7, xAI), headless and read-only, by independent recomputation without executing the engine, on a snapshot of branch `claude/evidence-completeness` at `45efae57`. Scope: the two calculation records derived by Codex that the branch restated (rmd-uniform-lifetime-divisor and tax-penalties-annual). Verdicts: 2 approve, 0 reject. The reviewer's script `DOCS/calculations/reviews/scripts/round3-grok/recompute.py` runs from the repository root. The only edits to the report below replace local paths with repository paths. Verbatim output follows.

---

# Independent review of two restated calculation records

Reviewer: Grok (grok-4.7, xAI), headless, read-only.
Date: 2026-09-30.
Repository commit: `45efae57` (copy under `tree4/`).
Scope: `rmd-uniform-lifetime-divisor` and `tax-penalties-annual`, both restated 2026-09-30 and unreviewed since. Recomputation is from the worksheets, the cited primary sources, and the pinned election-year cases. The engine was not run, and no file under `packages/` was imported. Signatures of the named functions were not needed; the evidence tests were skimmed for the values they assert, not executed.

Arithmetic is in `scratch/recompute.py` (Python `decimal` and `fractions`, nothing imported from the repository). Sources actually read: eCFR 26 CFR 1.408-8 as served 2026-09-30 (saved at `scratch/cfr-1-408-8-2.txt`); Cornell LII 26 CFR 1.401(a)(9)-5; Office of the Law Revision Counsel, 26 USC 4974, current through 2026-09-18 (Public Law 119-111); IRS Publication 590-B (2025), catalog 66303U, downloaded from `https://www.irs.gov/pub/irs-pdf/p590b.pdf` on 2026-09-30.

## rmd-uniform-lifetime-divisor

### Recomputed

Original worked case, unchanged by the restatement. Prior December 31 balance $246,000 divided by the Uniform Lifetime divisor at age 75:

`$246,000 / 24.6 = $10,000` exactly (`246,000 / 24.6 = 10,000` in `Decimal`).

Restated limit, recomputed. A $29,600 IRA pooled with a $100,000 IRA under one $100,000 reference, age-75 divisor 24.6:

- Shared reference: `$100,000 / 24.6 = 500,000/123 = 4,065.040650...`, which is `$4,065.04` to the cent. The third decimal is 0, so the cent is not a rounding tie.
- Own prior December 31 balance: `$29,600 / 24.6 = 148,000/123 = 1,203.252032...`, which is `$1,203.25` to the cent. The third decimal is 2.
- The two figures differ by `$2,861.7886...`, about `$2,861.79`.

### Match

Yes. The worksheet's unchanged expected RMD is `$10,000`. The restated limit's two figures, `$4,065.04` and `$1,203.25`, are the cent values of the two quotients. The original inputs, arithmetic, and expected value are unchanged.

### Tolerance

The original fixture's "exact" tolerance is justified: $246,000 is an integer multiple of 24.6, so the quotient is the integer $10,000 with no remainder.

The restated figures are stated to the cent. Both quotients have a third decimal that is not 5, so half-up, half-even, and truncation to the cent all give the same dollar. The cent presentation does not hide a tie.

### Wrong readings checked

Both original wrong readings give a different number:

- Age-74 divisor 25.5, confirmed as the Table III row for age 74: `$246,000 / 25.5 = 9,647.058823...`. The worksheet's `$9,647.058823...` matches. It is not `$10,000`.
- Current year-end balance of $240,000 at the age-75 divisor: `$240,000 / 24.6 = 9,756.097560...`. The worksheet's `$9,756.097561...` is that repeating expansion. It is not `$10,000`.

The restatement's contrast is also a different number: `$4,065.04` from the shared reference against `$1,203.25` from the IRA's own balance.

### Sources

The original method follows the sources it relies on.

IRS Publication 590-B (2025), Appendix B, Table III (Uniform Lifetime), age 75 applicable denominator **24.6**, age 74 **25.5**. The table's heading limits it to unmarried owners, married owners whose spouses are not more than 10 years younger, and married owners whose spouses are not the sole beneficiaries. Appendix A-1, line 3, takes "the value of IRA at the close of business on December 31 of the year immediately prior," and line 5 divides that value by the denominator. Footnote 1: "If you have more than one IRA, you must figure the required distribution separately for each IRA."

Treas. Reg. 1.408-8(b)(2), read from the current eCFR text: "For purposes of determining the required minimum distribution from an IRA for any calendar year, the account balance of the IRA as of December 31 of the calendar year preceding the calendar year for which distributions are required to be made is substituted for the account balance of the employee under § 1.401(a)(9)-5(b)."

Treas. Reg. 1.401(a)(9)-5(b)(1), read from Cornell LII: the benefit used for a distribution calendar year "is the account balance as of the last valuation date in the calendar year preceding that distribution calendar year ... adjusted in accordance with this paragraph (b)." For an IRA, 1.408-8(b)(2) replaces that valuation date with the IRA's own prior December 31. Paragraph (b)(1)'s aggregation sentence ("all of an employee's accounts under the plan are aggregated") is a qualified-plan sentence; for IRAs, 1.408-8(e)(1)(i) is the operative rule, and it requires the opposite of pooling the balance: "the required minimum distribution must be calculated separately for each IRA."

The restated limit's reading of the election year follows the same text. Treas. Reg. 1.408-8(c)(3): "the required minimum distribution for the calendar year of the election and each subsequent calendar year is determined under section 401(a)(9)(A) with the spouse as IRA owner and not section 401(a)(9)(B) with the surviving spouse as the deceased IRA owner's beneficiary." That owner RMD is still computed under 1.401(a)(9)-5 on the balance 1.408-8(b)(2) substitutes, which is that IRA's own prior December 31, and 1.408-8(e)(1)(i) calculates it separately for each IRA. Using one shared reference balance for every IRA in the pool is a departure from those sentences. The record states that departure as a known limit rather than as the rule. The death-year exception in the same paragraph of (c)(3) is outside this limit, which is confined to the year the election takes effect after the owner's death.

### Record consistency

The statement and formula still say what the original worksheet derives: prior December 31 balance divided by the Uniform Lifetime entry for the age attained, and zero before the applicable age, with no rounding. They do not claim the pooled-election case.

The new limit names the approximation the engine actually makes: in the election year, an IRA in a same-decedent pool of two or more elected IRAs takes its owner RMD from the pool's one shared reference balance, because the plan checks require identical election facts and a positive reference replaces the prior December 31 balance. It states the direction correctly (overstated when the IRA is smaller than the reference, understated when larger) and gives both numbers. It does not claim the shared-reference figure is what the regulation requires.

One scope point, not a defect: the limit is about the election-year owner RMD, which the record's `implementedBy` list attributes to `electionYearOwnerRmdReferenceBalance`, not about the ordinary `requiredMinimumDistribution` path the original worksheet derives. The limit says so.

### Evidence binding

`packages/engine/src/rmd/rmd.evidence.test.ts` asserts the unchanged headline: prior-year-end balance 246,000 divided by divisor 24.6, expected RMD 10,000, tolerance exact. It also asserts that age 72 for a 1951 birth returns 0 and that a 240,000 balance does not publish 10,000.

The restated case is pinned in `packages/engine/src/projection/simulate.spousalElectionYearOwnerRmd.test.ts`, in the block labeled as current behavior that the fix is meant to fail. It asserts `100_000 / 24.6` close to 4,065.04 at two decimals, `29_600 / 24.6` close to 1,203.25 at two decimals, and that the $29,600 IRA's published `requiredAmount` matches the shared reference and not its own balance. That is the contrast the limit states. The test was not run.

### Verdict

Approve. The unchanged worked case matches exactly, both wrong readings produce different numbers, the method follows Pub. 590-B Table III and the prior-December-31 rule, and the restated limit accurately describes a departure from Treas. Reg. 1.408-8(c)(3), 1.408-8(b)(2), and 1.408-8(e)(1)(i) without claiming that departure is the law. The pinned contrast, $4,065.04 against $1,203.25, is the cent value of the two quotients.

## tax-penalties-annual

### Recomputed

Original worked case, unchanged by the restatement:

- Early-withdrawal penalty: `$20,000 × 10/100 = $2,000`.
- Shortfall: `max(0, $12,000 − $4,000) = $8,000`.
- Section 4974 excise at the stated 25 percent: `$8,000 × 25/100 = $2,000`.
- Total penalties: `$2,000 + $2,000 = $4,000`.

Restated election-year case. Owner RMD `$100,000 / 24.6 = 4,065.040650...` = `$4,065.04` to the cent. Paid $1,000 before the election, so the remainder is `$3,065.040650...` = `$3,065.04`, and `$1,000 + $3,065.04` of the unrounded quotient equals the unrounded owner RMD. Shortfall on that one obligation is zero, so the excise is `$0`.

Beneficiary figure kept as the trigger: `$99,000 / 14.8 = 6,689.189189...` = `$6,689.19` to the cent (third decimal 9). Charging that figure as a second, unpaid obligation at 25 percent: `$6,689.189189... × 0.25 = 1,672.297297...` = `$1,672.30` to the cent (third decimal 7). That is not `$0`.

### Match

Yes. The original expected values are `$2,000`, `$8,000`, `$2,000`, and `$4,000`, all exact. The restated case's `$4,065.04`, `$3,065.04`, `$0`, `$6,689.19`, and `$1,672.30` are the cent values of the quotients, and none is a rounding tie. The worksheet's inputs, arithmetic, and expected values are unchanged.

### Tolerance

The original fixture's "exact" tolerance is justified. Both rates are terminating hundredths (10/100 and 25/100) and both dollar inputs are integers, so each product is an integer dollar.

The restated figures are cent presentations of non-tie quotients, same as the sibling record. The excise of `$0` is exact, not rounded: the owner obligation is fully paid, so `max(0, required − distributed)` is zero.

### Wrong readings checked

All four original wrong readings give a different number:

- 25 percent of the full $12,000 requirement is `$3,000` of excise and `$5,000` total, not `$2,000` and `$4,000`.
- The corrected 10 percent rate on the $8,000 shortfall, without a qualifying correction, is `$800` of excise and `$2,800` total, not `$2,000` and `$4,000`.
- Omitting the early-withdrawal component leaves `$2,000`, not `$4,000`.
- Applying the 10 percent early-withdrawal penalty to an inherited distribution would add 10 percent of that amount. The worksheet excludes inherited distributions, so that addition is zero in the accepted reading and nonzero under the rejected one.

The restated contrast also differs: charging the beneficiary figure as a second unpaid obligation adds `$1,672.30`; the accepted reading charges `$0`.

### Sources

The original composition follows the sources.

IRC 4974(a), Office of the Law Revision Counsel, current through 2026-09-18: "If the amount distributed during the taxable year of the payee ... is less than the minimum required distribution for such taxable year, there is hereby imposed a tax equal to 25 percent of the amount by which such minimum required distribution exceeds the actual amount distributed during the taxable year." Subsection (e)(1) substitutes "10 percent" for "25 percent" only when the taxpayer receives the shortfall amount during the correction window and submits a return reflecting the tax during that window. The fixture elects no relief, so 25 percent is the operative rate. Pub. 590-B (2025), page 30, says the same thing in its own words: a 25 percent excise "on the amount not distributed as required," reduced to 10 percent during the correction window.

IRC 72(t) is the early-withdrawal additional tax; Pub. 590-B (2025), page 29, states the rate the worksheet uses: "The additional tax on early distributions is 10% of the amount of the early distribution that you must include in your gross income." The worksheet's exclusion of inherited distributions is a composition claim of this record, not a new claim of the restatement.

The restated reading of the election year follows the regulation. Treas. Reg. 1.408-8(c)(3), current eCFR: the required minimum distribution "for the calendar year of the election and each subsequent calendar year is determined under section 401(a)(9)(A) with the spouse as IRA owner and not section 401(a)(9)(B) with the surviving spouse as the deceased IRA owner's beneficiary." IRC 4974(b): the minimum required distribution is the amount required under section 408(a)(6) (among others) "as determined under regulations prescribed by the Secretary." Section 408(a)(6) points at 401(a)(9), and 1.408-8 is the regulation that determines the IRA amount. For the election year after the year of death, that determination is one owner RMD under 401(a)(9)(A), not a beneficiary RMD under 401(a)(9)(B) stacked on top of it.

Treas. Reg. 1.408-8(e)(2)(i), current eCFR: "Except in the case of a surviving spouse electing to treat a decedent's IRA as the spouse's own IRA, an IRA that a beneficiary acquires as a result of the death of an individual is not treated as an IRA of the beneficiary but rather as an IRA of the decedent for purposes of this paragraph (e)." The elected IRA is the exception: it is treated as the spouse's own IRA, so it leaves the beneficiary's same-decedent group in (e)(2)(ii). Paragraph (e)(2)(i) is an aggregation rule, not a second distribution requirement. It confirms there is no beneficiary obligation to aggregate once the election is made. It does not itself say the beneficiary figure is unpaid.

The death-year sentence of (c)(3) is the boundary of this reading, and the record states it: the one-obligation claim is for the calendar year the election takes effect after the year of the owner's death. In the year of death the same paragraph requires the deceased owner's remaining RMD instead, and no owner RMD as owner.

The 14.8 divisor used for the beneficiary counterfactual is Pub. 590-B (2025) Appendix B, Table I (Single Life Expectancy), age 75, life expectancy 14.8. The 24.6 divisor is Table III, age 75, as in the sibling record.

### Record consistency

The statement and formula still say what the original worksheet derives: 10 percent of a pre-age-59½ taxable traditional withdrawal, plus the section 4974 excise on `max(0, required − distributed by deadline)` at the stated rate, default 25 percent, once per obligation, outside tax, AGI, and MAGI. Inherited distributions are excluded from the early penalty.

The restated sentence does not overclaim. It says that in the election year, after the year of the owner's death, the elected IRA owes only its owner RMD under 1.408-8(c)(3) and leaves the beneficiary's same-decedent group under (e)(2)(i), so it is put in no beneficiary obligation. That is what (c)(3) and 4974(b) produce. The limit then gives the pinned numbers and the counterfactual `$1,672.30`, and it says the beneficiary figure stays on the account's evidence as the trigger only. It does not say the engine's ordinary shortfall arithmetic changed, and the worksheet says no input, arithmetic, or expected value changed.

The limits still name the original fixture's assumptions: the component producers, the simulatePlan ledger year with its zero-rate calculator, and the inherited-distribution exclusion asserted as a rule. Nothing in the restatement adds a new approximation to the original $4,000 composition.

### Evidence binding

`packages/engine/src/projection/internal/annualFundingCandidateEvaluation.evidence.test.ts` asserts the original headline values: early-withdrawal penalty 2,000 on a 20,000 withdrawal, shortfall 8,000, excise 2,000, published penalties 4,000, tolerance exact on the component calls. It also asserts the inherited-distribution penalty is 0, and that the published composition is not 5,000, 2,800, or 2,000. The ledger cross-check uses the engine's annual-funding tolerance rather than exact equality, which the test comment discloses; that is the original fixture, unchanged by this restatement.

The new case is asserted in `simulate.spousalElectionYearOwnerRmd.test.ts`. The block headed "election-year section 4974 obligation" sets the accepted reading to 0 and the rejected reading to `(99_000 / 14.8) × 0.25`. It asserts the owner required amount `100_000 / 24.6` close to 4,065.04, credit of 1,000, settled amount equal to the owner required amount minus 1,000, the evidence row's required amount close to `99_000 / 14.8`, a single shortfall-excise detail whose tax is 0 and whose obligation id contains `owned-iras`, no detail whose obligation id contains `inherited`, and `rmdShortfallExciseTax` equal to the accepted reading of 0. It also asserts the rejected reading is close to 1,672.30. That is the pinned case the restatement describes. The test was not run.

### Verdict

Approve. The unchanged composition matches exactly, every wrong reading produces a different number, and the restated election-year reading follows Treas. Reg. 1.408-8(c)(3) and IRC 4974(a) and (b): one owner RMD that year, excise zero when it is paid, and `$1,672.30` only if the beneficiary figure were charged as a second unpaid obligation. The record says that, and does not say the original $4,000 fixture changed.
