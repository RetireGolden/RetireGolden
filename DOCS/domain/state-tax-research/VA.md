# Virginia (VA) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (graduated, 2%–5.75%)
- Taxes Social Security benefits: no (fully exempt / subtracted)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): generally taxed, but an age-65 income-based deduction of up to $12,000 per person applies

## Proposed StateTaxParams (2025)
- code: "VA"
- name: "Virginia"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 8750, marriedFilingJointly: 17500 }
- brackets.single:
  - { lowerBound: 0, ratePct: 2.0 }
  - { lowerBound: 3000, ratePct: 3.0 }
  - { lowerBound: 5000, ratePct: 5.0 }
  - { lowerBound: 17000, ratePct: 5.75 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 2.0 }
  - { lowerBound: 3000, ratePct: 3.0 }
  - { lowerBound: 5000, ratePct: 5.0 }
  - { lowerBound: 17000, ratePct: 5.75 }
- retirement: { kind: "capped", capPerPerson: 12000, minAge: 65 }

## Retirement-income detail
Virginia taxes income at graduated rates from 2% to 5.75% (2025). Bracket
thresholds are **the same for single and MFJ** (not doubled). Social Security
benefits are fully subtracted, so `taxesSocialSecurity: false`.

Virginia has no dedicated pension/IRA exclusion, but residents **age 65+**
(born after Jan 1, 1939) may take an **age deduction of up to $12,000 per
person** against any income. For those born after Jan 1, 1939 the deduction is
income-based: it is reduced $1 for every $1 of "adjusted federal AGI"
(AGI minus taxable Social Security) above $50,000 (single) / $75,000 (MFJ).
Modeled as `retirement: { kind: "capped", capPerPerson: 12000, minAge: 65 }`,
which captures the age gate and cap but not the income phase-out (flagged below).

Standard deduction is $8,750 (single) / $17,500 (MFJ) for 2025.

## Simplifications / not modeled
- The age deduction's income phase-out (reduced above $50k/$75k adjusted AGI)
  is not modeled — overstates the deduction (understates tax) for higher-income
  age-65 retirees.
- The age deduction applies to any income source, not just pension/IRA; mapping
  it to `retirement` is an approximation.
- Military retirement subtraction and disability income subtraction not modeled.
- Local income taxes: Virginia has none at the locality level (not applicable).

## Citations
- https://www.tax.virginia.gov/news/new-virginia-tax-laws-july-1-2025 — 2025 standard deduction $8,750 single / $17,500 MFJ.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — 2025 brackets 2%/3%/5%/5.75% at 0/3,000/5,000/17,000 (same for single and MFJ).
- https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.03/ — $12,000 age-65 deduction; income-based reduction above $50,000 (single) / $75,000 (MFJ); Social Security subtracted.
