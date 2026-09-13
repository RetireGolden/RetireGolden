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

An early distribution with Form 1099-R Box 7 code 1 or a federal premature-distribution penalty does not qualify for the pension exclusion, including the age-60-plus branch. Unknown classification is incomplete, not eligibility. The latest final TY2025 instructions are carried forward for TY2026 because enacted SB219 does not change this classification; final TY2026 instructions must be checked when published.

Authority: [2025 PIT-RES instructions, p.6, Line 6 pension exclusion](https://revenuefiles.delaware.gov/2025/PITForms_Instructions/Instructions/PIT-RES_Instructions_2025-01.pdf).

> An early distribution from an IRA or pension fund for emergency reasons or following a separation from employment does not qualify for the pension exclusion. If the distribution code listed in Box 7 of your 1099 R is a 1 (one), or if you were assessed an early withdrawal penalty on federal 1040, Schedule 2, Line 8 for the distribution, then that distribution DOES NOT qualify for the pension exclusion.

## Validation boundary

Source records above require discriminating positive and negative fixtures through the state calculation entry point, followed by actual `simulatePlan` event/basis integration. The source record alone does not establish those results. Annual parameters and generated rule/quote ledgers must be refreshed by the integration owner.

## Additional source history
- https://delcode.delaware.gov/title30/c011/sc02/index.html — 30 Del. C. §§ 1107–1108 (operative basic and age-65 amounts).
- https://delcode.delaware.gov/title30/c011/sc01/index.html — 30 Del. C. § 1102(a)(14) (5.55% $25,000–$60,000 band).
- https://revenuefiles.delaware.gov/2025/PITForms_Instructions/Instructions/PIT-EST_Instructions_2026-01.pdf — Delaware Division of Revenue, 2026 PIT-EST instructions, line 3 and rate table.
- https://www.legis.delaware.gov/BillDetail/130098 — HB 89 (unenacted source of erroneous $5,700 / $11,400).
