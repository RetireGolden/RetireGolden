# Rhode Island (RI) — state income tax for retirement planning

Tax year: 2026. Researched 2026-06-13; deduction and bracket schedule corrected 2026-09-07; retirement and Social Security modifications corrected, and 2027 and later added, 2026-09-28.

## Summary
- Broad individual income tax: **yes** (graduated, 3.75%–5.99%; same thresholds for all filing statuses)
- Taxes Social Security benefits: **yes** above federal-AGI limits; below them a filer at full retirement age subtracts the benefits (from 2027, at any age)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, annuity): income-limited modification up to $50,000 per person at full retirement age, from tax year 2025

## Proposed StateTaxParams (2026)
- code: "RI"
- name: "Rhode Island"
- hasIncomeTax: true
- taxesSocialSecurity: true
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 11200, marriedFilingJointly: 22400 }
- brackets.single:
  - { lowerBound: 0, ratePct: 3.75 }
  - { lowerBound: 82050, ratePct: 4.75 }
  - { lowerBound: 186450, ratePct: 5.99 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 3.75 }
  - { lowerBound: 82050, ratePct: 4.75 }
  - { lowerBound: 186450, ratePct: 5.99 }
- retirement: { kind: "capped", capPerPerson: 50000, minAge: 67 }
- rhodeIslandSocialSecurityModification: { nonjointAgiLimit: 107000, jointAgiLimit: 133750, minAge: 67 } (the 2025 limits, the latest the Division has published)

## 2026 inflation adjustments — operative law

The Rhode Island Division of Taxation published [ADV 2025-22](https://tax.ri.gov/sites/g/files/xkgbur541/files/2025-11/ADV_2025_22_Inflation_Adjustments.pdf) for tax years beginning on or after January 1, 2026. It sets:

- Standard deduction: **$11,200** (single / married filing separately) and **$22,400** (married filing jointly / qualifying surviving spouse).
- Uniform rate schedule: **3.75%** to **$82,050**, **4.75%** to **$186,450**, **5.99%** above $186,450 (same thresholds for all statuses).
- Standard-deduction phase-out range: $261,000–$290,800 for 2026 (not modeled).

These are **annual TY2026 values**; do not assume they continue unchanged in later tax years without a subsequent advisory.

### Historical context

The 2025 pack carried $10,900 / $21,800 deductions and $79,900 / $181,650 bracket thresholds from the prior inflation cycle. The 2026 pack now reflects ADV 2025-22.

## Retirement-income detail
Rhode Island's individual income tax has three brackets (3.75% / 4.75% / 5.99%). Unusually, the bracket thresholds are **identical for all filing statuses** — single and MFJ both step up at $82,050 and $186,450 for 2026.

Social Security: RI **does tax** federally taxable Social Security, but R.I. Gen. Laws 44-30-12(c)(8) subtracts it for a taxpayer who has reached full retirement age and whose federal AGI is below the annual limit: $80,000 unmarried and $100,000 joint in the statute, indexed from 2000, printed as $107,000 and $133,750 for tax year 2025. The engine models the subtraction (`rhodeIslandSocialSecurityModification`) at the 2025 limits for a filer, or on a joint return either spouse, aged 67 or older; before 2026-09-28 it taxed every filer's benefits. From 2027 the FY 2027 budget (H 7127 Sub A, Article 6) drops the full-retirement-age test (`ri-h7127-2027-social-security-modification-without-age-test`).

Pension and annuity income: 44-30-12(c)(9) allows a modification of up to **$50,000 per person** of taxable pension and annuity income from tax year 2025 (it was $20,000 for 2023 and 2024), for a taxpayer at full retirement age below the same AGI limits as the Social Security modification. The $50,000 ceiling is flat; only the AGI test is indexed. Modeled as `kind: "capped"`, `capPerPerson: 50000`, `minAge: 67` (`ri-gen-laws-44-30-12-c-8-c-9-2026-modifications`); the engine applies the AGI test with the Social Security modification's limits and leaves IRA distributions out, as the Division's instructions say (`ri-gen-laws-44-30-12-social-security-and-pension-modification`, settled since the round-three review of 2026-09-28).

## Simplifications / not modeled
The characterized retirement calculation applies the modeled cap and age gate
separately to each recipient's distributions; the joint maximum requires two
eligible recipients with income. A spouse's unused cap or older age cannot
establish the other recipient's exclusion. Missing ownership or missing or
conflicting age eligibility produces an incomplete disclosure and no exclusion
for the affected recipient. Legacy aggregate inputs do not prove recipient
attribution. The income-test and full-retirement-age approximations remain.

- The pension modification is allowed only below the federal-AGI limit, and the engine applies that test; aggregate retirement income supplied without characterized distributions cannot tell a pension from an IRA and still counts both. The Social Security modification's limits are held at the 2025 amounts, which slightly overstates tax for a filer between them and the indexed 2026 limits.
- Standard deduction phases out at high income ($261,000–$290,800 for 2026); not modeled.
- Personal exemptions not modeled.
- The $50,000 pension ceiling is flat, not inflation-adjusted; only the AGI limits are indexed.
- Whole-return accuracy not claimed.

## 2027 and later

Found by the survey of 2026-09-28 ([later-years-survey-2026-09-28.md](later-years-survey-2026-09-28.md)), all from 2026 H 7127 Sub A (the FY 2027 budget), Article 6, which took effect upon passage:

- A surtax on Rhode Island taxable income over $1,000,000 for every filing status: 1% for 2027, 2% for 2028 and 3% from 2029 (44-30-2.6(c)(3)(A)(I)(2)); the threshold is indexed from 2028 on a 2026 base. Loaded as a band over $1,000,000 at 6.99%, 7.99% and 8.99%, with the threshold held at $1,000,000 until the indexed one is published (`ri-44-30-2-6-high-income-surtax`).
- The Social Security modification without the full-retirement-age test from 2027 (44-30-12(c)(8)(ii)); the pension modification keeps its age test. Loaded (`ri-h7127-2027-social-security-modification-without-age-test`).
- A $330 refundable child tax credit from 2027; not modeled, as the engine models no Rhode Island credit.
- The brackets and standard deduction for 2027 await the Division of Taxation's advisory, usually in November; the 2026 figures stand in until then.

## Citations
- https://tax.ri.gov/sites/g/files/xkgbur541/files/2025-11/ADV_2025_22_Inflation_Adjustments.pdf — RI Division of Taxation ADV 2025-22 (TY2026 standard deduction, bracket schedule, phase-out range).
- https://tax.ri.gov/sites/g/files/xkgbur541/files/2025-10/2025%20Tax%20Rate%20and%20Worksheets_d.pdf — RI Division of Taxation 2025 tax rate schedule (prior-year cross-check).
- https://tax.ri.gov/sites/g/files/xkgbur541/files/2024-10/ADV_2024_26_Inflation_Adjustments.pdf — 2025 inflation-adjusted bracket thresholds and standard deductions (historical).
