# Delaware (DE) — state income tax for retirement planning

Tax year: 2026. Researched 2026-09-05 (standard deduction corrected); prior pack 2026-06-13.

## Summary
- Broad individual income tax: **yes** (graduated, 0%–6.6%; same bracket thresholds for single and MFJ)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): exclusion up to $12,500 per person at age 60+ ($2,000 if under 60)
- Standard deduction (2026): **$3,250 single / $6,500 MFJ**, plus **$2,500 per qualifying taxpayer or spouse age 65+** (nonblind, standard-deduction path)

## Proposed StateTaxParams (2026)
- code: "DE"
- name: "Delaware"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 3250, marriedFilingJointly: 6500 }
- standardDeductionAge65Addition: { single: 2500, marriedFilingJointly: 2500 }
- brackets.single / brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 0.0 }
  - { lowerBound: 2000, ratePct: 2.2 }
  - { lowerBound: 5000, ratePct: 3.9 }
  - { lowerBound: 10000, ratePct: 4.8 }
  - { lowerBound: 20000, ratePct: 5.2 }
  - { lowerBound: 25000, ratePct: 5.5 }
  - { lowerBound: 60000, ratePct: 6.6 }
- retirement: { kind: "capped", capPerPerson: 12500, minAge: 60 }

## Standard deduction — operative law

30 Del. C. § 1107 elects the standard deduction unless the resident itemizes under § 1109. Section 1108(a)(3) sets the basic amounts at **$3,250** for an individual (or each spouse filing separately) and **$6,500** for spouses filing jointly. Section 1108(b) adds **$2,500** in each enumerated circumstance, including when the taxpayer has attained age 65 before the close of the taxable year (and parallel limbs for a spouse and for blindness).

The [2026 Form PIT-EST instructions](https://revenuefiles.delaware.gov/2025/PITForms_Instructions/Instructions/PIT-EST_Instructions_2026-01.pdf) (line 3) repeat those figures: $3,250 for single, divorced, widow(er), or head of household; $6,500 if married filing jointly; $3,250 if married or civil-union filing separately; plus additional standard deduction allowance(s) of $2,500 for taxpayer and/or spouse age 65 or over or blind when taking the standard deduction.

### Erroneous $5,700 / $11,400 figures

An earlier pack and this note once cited **$5,700 / $11,400** while referencing the [Justia mirror](https://law.justia.com/codes/delaware/title-30/chapter-11/subchapter-ii/section-1108/) of § 1108; that mirror now displays **$3,250 / $6,500** under § 1108(a)(3). The mistaken amounts match **House Bill 89** ([BillDetail/130098](https://www.legis.delaware.gov/BillDetail/130098)), which proposed those figures for tax years after 2023 but was **never enacted** (status: “Out of Committee 5/2/23” with no chapter law or effective date). Operative law remains **$3,250 / $6,500** per the official Code and 2026 PIT-EST instructions.

## Bracket rate note (separate defect)

The 2026 PIT-EST instructions print **5.55%** for the $25,000–$60,000 band; the modeled pack still carries **5.5%**. That discrepancy is disclosed separately and is outside the standard-deduction repair.

## Retirement-income detail

Delaware has a graduated tax with a $0 first bracket (first $2,000 untaxed) up to 6.6%. Bracket **thresholds are identical for single and MFJ** — verified, not assumed.

Delaware fully exempts Social Security. Taxpayers **age 60 or older** may exclude up to **$12,500 per person** of eligible retirement income; those under 60 may exclude up to $2,000 of pension income. Modeled as `kind: "capped"`, `capPerPerson: 12500`, `minAge: 60`.

## Simplifications / not modeled
- The $12,500 exclusion covers a broad set of investment income, not just pension/IRA; modeled narrowly as the pension/IRA cap.
- Under-60 $2,000 pension exclusion not modeled.
- Blindness additional standard deduction not modeled (age count only).
- Personal credits and other credits not modeled.
- Itemization election (§ 1107 / § 1109) not modeled.
- **Qualifying surviving spouse:** PIT-EST groups widow(er) with the $3,250 basic amount ($5,750 at age 65 with the $2,500 addition). The engine maps QSS to joint parameters ($6,500 / $9,000 in the 2026 pack); that reachable gap is registered as the `approximated` rule `de-pit-est-2026-qss-standard-deduction-joint-mapper`. No runtime correction is included in this registry-only slice.

## Citations
- https://delcode.delaware.gov/title30/c011/sc02/index.html — 30 Del. C. §§ 1107–1108 (operative basic and age-65 amounts).
- https://revenuefiles.delaware.gov/2025/PITForms_Instructions/Instructions/PIT-EST_Instructions_2026-01.pdf — Delaware Division of Revenue, 2026 PIT-EST instructions, line 3.
- https://www.legis.delaware.gov/BillDetail/130098 — HB 89 (unenacted source of erroneous $5,700 / $11,400).
- https://www.incometaxpro.com/tax-rates/delaware.htm — bracket structure cross-check.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — Tax Foundation cross-check.
