# Delaware (DE) — state income tax for retirement planning

Tax year: 2026. Authority reconciliation: 2026-09-12.

## Current calculation contract

The following source-specific contracts supersede older aggregate assumptions. A rule record identifies the calculator boundary; it does not certify that a projection fixture or a release gate has passed. Missing eligibility, source, allocation or state-basis facts must remain visible as incomplete.

### Delaware pension exclusions distinguish age, source and tax year

Record: `de-code-30-1106-social-security-retirement-subtractions`. Classification: `approximated`.

For TY2026, each recipient under 60 takes the greater of qualifying ordinary pension capped at $2,000 or U.S. military pension capped at $12,500; the two amounts are not added. At 60 or older, the $12,500 pension/eligible-retirement-income cap applies separately to each owner. Source, age, and early-distribution facts must establish eligibility. SB219 (85 Del. Laws ch.426), signed August 17, 2026, increases future military tiers beginning in 2027; it does not increase the 2026 cap. The broad aggregate retirement path remains an approximation of qualifying source and owner allocation.

Authority: [30 Del. C. §1106(b)(3)b-c](https://delcode.delaware.gov/title30/c011/sc02/index.html).

> For persons age 60 or older, amounts received, not to exceed $12,500, as pensions from employers, the United States, this State, or any subdivision of this State, or as eligible retirement income. … Amounts received, not to exceed $2,000, as pensions from employers, the United States, this State, or any subdivision of this State; or … Amounts received, not to exceed $12,500, as a United States military pension.

### Delaware early-distribution gate applies before pension exclusions

Record: `de-early-distribution-gate`. Classification: `unsettled`.

An early distribution with Form 1099-R Box 7 code 1 or a federal premature-distribution penalty does not qualify for the pension exclusion, including the age-60-plus branch. Unknown classification is incomplete, not eligibility. A distribution made to a beneficiary after the employee's death is excepted from the federal penalty by IRC 72(t)(2)(A)(ii) at any age (Form 1099-R code 4), so the projection marks a row whose cause is death (a distribution from an inherited account, unless a surviving spouse's treat-as-own election has made it the spouse's own that year, a survivor pension, an annuity paid after its owner's death) not premature unless the plan asserts the disqualifier true. Until 2026-11-03 such a row under 59 and a half was unknown: a 45-year-old taking $10,000 from an inherited 401(k) lost the $2,000 under-60 exclusion, about $111 of tax, with the year incomplete (tax/stateDeathCauseEarlyDistribution.rules.test.ts). A beneficiary under 60 who receives a deceased employee's employer-plan or government pension distribution takes the under-60 exclusion: 30 Del. C. 1106(b)(3) reaches amounts received as pensions from employers, the United States, this State or its subdivisions, without requiring that the employer be the recipient's own, and the instructions count pensions of a deceased taxpayer among them (quoted below). That is the engine's reading, not a settled one: neither text says in terms that "a deceased taxpayer" includes a decedent who is not on the return, or that a death distribution from an employer plan is the beneficiary's pension, and if final TY2026 instructions read the limb as the employee's own pension the engine overstates the exclusion by up to $2,000 for each beneficiary under 60 while reporting the year complete. An IRA is not a pension from an employer, inherited or not, so the under-60 limb never reaches one (the engine's under-60 limb reaches the employer and government pension source kinds only); at 60 or older an IRA distribution is eligible retirement income. The latest final TY2025 instructions are carried forward for TY2026 because enacted SB219 does not change this classification; final TY2026 instructions must be checked when published.

Authority: [2025 PIT-RES instructions, p.6, Line 6 pension exclusion](https://revenuefiles.delaware.gov/2025/PITForms_Instructions/Instructions/PIT-RES_Instructions_2025-01.pdf).

> An early distribution from an IRA or pension fund for emergency reasons or following a separation from employment does not qualify for the pension exclusion. If the distribution code listed in Box 7 of your 1099 R is a 1 (one), or if you were assessed an early withdrawal penalty on federal 1040, Schedule 2, Line 8 for the distribution, then that distribution DOES NOT qualify for the pension exclusion.

> Amounts received as pensions from employers (including pensions of a deceased taxpayer) may qualify for an exclusion from Delaware taxable income, subject to the limitations described below.

## Validation boundary

Source records above require discriminating positive and negative fixtures through the state calculation entry point, followed by actual `simulatePlan` event/basis integration. The source record alone does not establish those results. Annual parameters and generated rule/quote ledgers must be refreshed by the integration owner.

## Additional source history
- https://delcode.delaware.gov/title30/c011/sc02/index.html — 30 Del. C. §§ 1107–1108 (operative basic and age-65 amounts).
- https://delcode.delaware.gov/title30/c011/sc01/index.html — 30 Del. C. § 1102(a)(14) (5.55% $25,000–$60,000 band).
- https://revenuefiles.delaware.gov/2025/PITForms_Instructions/Instructions/PIT-EST_Instructions_2026-01.pdf — Delaware Division of Revenue, 2026 PIT-EST instructions, line 3 and rate table.
- https://www.legis.delaware.gov/BillDetail/130098 — HB 89 (unenacted source of erroneous $5,700 / $11,400).

## Part-year residents (2026-10-08)

Method (b), PIT-NON 2025: line 42 taxes all income; line 43 divides line 30a, modified Delaware-source income, by line 30b, Delaware AGI; the pension exclusion's Delaware column is the exclusion times the Delaware share of the pension income (de-code-30-1106-social-security-retirement-subtractions). The 2026 figures carry it as `partYear: { method: 'incomePercentage', ratioBasis: 'stateIncome', exclusionCap: 'retirementShare' }` (params/state/data/year2026.ts), priced by tax/stateTax.ts#computeSplitYearResult on the income tax/statePartYear.ts#allocateSplitYear gives the months resident: a dated distribution or QCD transfer whole in the slice of its month, Social Security by the months paid, everything else by the months.

A single filer of 50 with $100,000 of ordinary income spread over 2026, resident six months in Delaware and six in Texas, owes $2,684.50 for the Delaware months, the same as before. With a $40,000 Roth conversion on top, the slice is $5,148.64 when the conversion falls in the months resident and $2,860.36 when it falls in Texas's, where the months share of the year gave $4,004.50 either way.

The limits every state shares (days priced as months, undated income spread by months, nonresident-period source income, the credit for tax paid to the other state, special accrual and the full-year elections not modeled) are in `va-code-58-1-322-03-2-personal-exemptions`; the worked figures are in packages/engine/src/tax/statePartYear*.rules.test.ts.

## Qualifying surviving spouse row (2026-11-03)

Since 2026-11-03 each state pack can declare the row a federal qualifying surviving spouse files under (`qualifyingSurvivingSpouseFilesAs`, read by `stateFilingRowFor`); Delaware, Georgia, Kansas and Virginia do, and a pack that declares none falls back to the federal joint mapping. Delaware declares `marriedFilingJointly`, the federal mapping, so the engine still gives a widow(er) the $6,500 joint deduction where § 1108 and PIT-EST give $3,250; that is the disclosed approximation `de-pit-est-2026-qss-standard-deduction-joint-mapper`, unchanged in figures. Declaring `single` is the whole fix when it is taken.
