# South Carolina (SC) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (graduated, 0% / 3% / 6%; top rate 6.0% for 2025)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: preferential — 44% net-LTCG deduction (remainder taxed as ordinary income)
- Retirement income (pension, IRA, 401k): retirement-income deduction ($3k under 65 / $10k at 65+) plus a $15,000 age-65 deduction

## Proposed StateTaxParams (2025)
- code: "SC"
- name: "South Carolina"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 15000, marriedFilingJointly: 30000 }
- brackets.single:
  - { lowerBound: 0, ratePct: 0 }
  - { lowerBound: 3560, ratePct: 3.0 }
  - { lowerBound: 17830, ratePct: 6.0 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 0 }
  - { lowerBound: 3560, ratePct: 3.0 }
  - { lowerBound: 17830, ratePct: 6.0 }
- retirement: { kind: "capped", capPerPerson: 10000, minAge: 65 }

## Retirement-income detail
South Carolina's income tax starts from **federal taxable income**, so the
federal standard deduction ($15,000 single / $30,000 MFJ for 2025) is already
baked in; we record those amounts as the standard deduction. Brackets for 2025
are 0% (up to $3,560), 3% ($3,560–$17,830), and **6%** above $17,830. The top
rate was cut from 6.2% (2024) to **6.0%** for 2025. Bracket thresholds are the
**same for all filing statuses** (not doubled for MFJ).

Social Security is fully exempt. Capital gains: SC allows a **44% deduction of
net long-term capital gain**, so only 56% is taxed (at ordinary rates). Per the
template convention we set `capitalGainsAsOrdinary: true` and describe the
preference here / below (the model has no field for a partial CG exclusion).

Retirement income: SC offers a retirement-income deduction of up to **$3,000
per person under age 65** and up to **$10,000 per person at age 65+**, applied
to pension/IRA/401(k) income. Separately, at age 65+ a resident may deduct
**$15,000** against any income (reduced by any retirement-income deduction
claimed). Modeled as `kind: "capped"`, `capPerPerson: 10000`, `minAge: 65`
(the age-65 retirement-income tier). The additional $15,000 general age-65
deduction is noted under Simplifications.

## Simplifications / not modeled
- Capital gains: the 44% net-LTCG deduction is not represented (`capitalGainsAsOrdinary: true` overstates tax on LTCG by ~44% of the gain).
- The $15,000 age-65 general deduction (offset against the retirement-income deduction) is not modeled — `none`-of-it understates the available deduction, so the model overstates tax for 65+ retirees.
- Under-65 $3,000 retirement-income deduction not modeled (we only encode the 65+ $10,000 tier via minAge: 65).
- Military and certain first-responder retirement have larger/full exemptions; not modeled.

## Citations
- https://dor.sc.gov/sites/dor/files/forms/SC1040Instr_2025.pdf — 2025 SC1040 instructions: brackets 0%/3%/6%, starts from federal taxable income, retirement and age-65 deductions.
- https://dor.sc.gov/sites/dor/files/Documents/Policy%20Manuals/SCTIED-2025-Chapter%203.pdf — 2025 individual income tax policy manual: top rate 6.0%, $10,000 / $15,000 deductions, 44% net capital gain deduction.
- https://law.justia.com/codes/south-carolina/title-12/chapter-6/section-12-6-1150/ — SC Code §12-6-1150, 44% net capital gain deduction.
- https://dor.sc.gov/tax-tips/retirees-lower-your-individual-income-tax-bill-these-five-tips — SS exempt; retirement-income and age-65 deductions.
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — SC top rate 6.0%.
