# Louisiana (LA) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (flat 3.0%, new for 2025)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income (flat 3.0%)
- Retirement income (pension, IRA, 401k): up to $12,000 per person excluded at age 65+ (certain government/state pensions fully exempt)

## Proposed StateTaxParams (2025)
- code: "LA"
- name: "Louisiana"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 12500, marriedFilingJointly: 25000 }
- brackets.single: [ { lowerBound: 0, ratePct: 3.0 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 3.0 } ]
- retirement: { kind: "capped", capPerPerson: 12000, minAge: 65 }

## Retirement-income detail
For tax periods beginning on/after January 1, 2025, Louisiana replaced its
graduated rates with a flat **3.0%** individual income tax (2024 reform). The
standard deduction was raised substantially to **$12,500** single / **$25,000**
MFJ (inflation-adjusted from 2026). Social Security benefits are not taxed.

Louisiana allows persons **age 65 or older** to exclude up to **$12,000 of
annual retirement income** (pension and annuity income otherwise included in
federal income) per person — both spouses 65+ on a joint return may each exclude
up to $12,000. Mapped to `retirement: { kind: "capped", capPerPerson: 12000,
minAge: 65 }`. Certain federal and Louisiana state/local government retirement
benefits (and federal railroad/SS) are fully exempt separately.

## Simplifications / not modeled
- Full exemption of qualifying federal/Louisiana state/local government pensions approximated by the $12,000 cap (conservative for those retirees).
- The $12,000 exclusion is CPI-adjusted from 2025; the 2025 nominal $12,000 is held forward.
- Standard deduction is also CPI-adjusted starting 2026; 2025 nominal amounts used.

## Citations
- https://revenue.louisiana.gov/tax-education-and-faqs/faqs/income-tax-reform/what-are-the-individual-income-tax-rates-and-brackets/ — flat 3% for periods on/after 1/1/2025.
- https://www.mgocpa.com/perspective/louisiana-enacts-significant-tax-changes/ — standard deduction $12,500 single / $25,000 MFJ; retirement exemption raised to $12,000.
- https://www.law.cornell.edu/regulations/louisiana/La-Admin-Code-tit-61-SS-I-1311 — annual retirement income exemption, age 65+, up to $12,000 per person.
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — LA flat 3.0%.
