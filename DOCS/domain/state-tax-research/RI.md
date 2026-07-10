# Rhode Island (RI) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (graduated, 3.75%–5.99%; same thresholds for all filing statuses)
- Taxes Social Security benefits: **yes** (taxed above income thresholds; exempt for retirees below them)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): income-limited exclusion up to $20,000 per person at full retirement age

## Proposed StateTaxParams (2025)
- code: "RI"
- name: "Rhode Island"
- hasIncomeTax: true
- taxesSocialSecurity: true
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 10900, marriedFilingJointly: 21800 }
- brackets.single:
  - { lowerBound: 0, ratePct: 3.75 }
  - { lowerBound: 79900, ratePct: 4.75 }
  - { lowerBound: 181650, ratePct: 5.99 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 3.75 }
  - { lowerBound: 79900, ratePct: 4.75 }
  - { lowerBound: 181650, ratePct: 5.99 }
- retirement: { kind: "capped", capPerPerson: 20000, minAge: 67 }

## Retirement-income detail
Rhode Island's individual income tax has three brackets (3.75% / 4.75% /
5.99%). Unusually, the bracket thresholds are **identical for all filing
statuses** — single and MFJ both step up at $79,900 and $181,650 (2025
inflation-adjusted). The standard deduction does differ: $10,900 (single) /
$21,800 (MFJ).

Social Security: RI **does tax** federally taxable Social Security, but exempts
it for taxpayers who have reached full retirement age and whose federal AGI is
below the annual limit (2025: ~$107,000 single / ~$133,750 MFJ). Because the
big-levers model can't represent the income-tested cliff, we set
`taxesSocialSecurity: true` (conservative — overstates tax for lower-income
retirees who qualify for the exemption; flagged below).

Pension/IRA/401(k): an income-limited modification excludes up to **$20,000 per
person** ($40,000 joint) of qualifying pension/annuity income for taxpayers at
full retirement age, subject to the same AGI ceilings as the SS exemption.
Modeled as `kind: "capped"`, `capPerPerson: 20000`, `minAge: 67` (full
retirement age approximation).

## Simplifications / not modeled
- SS taxation and the $20,000 pension exclusion are both phased off by a federal-AGI ceiling (~$107k single / ~$133.75k MFJ, 2025) and require full retirement age; the model applies the cap unconditionally and taxes SS unconditionally. Net effect: overstates tax for retirees under the AGI ceiling, understates SS handling nuance for those above.
- Standard deduction phases out at high income; not modeled.
- The $20,000 cap is inflation-adjusted; we hold the 2025 figure.

## Citations
- https://tax.ri.gov/sites/g/files/xkgbur541/files/2025-10/2025%20Tax%20Rate%20and%20Worksheets_d.pdf — RI Division of Taxation 2025 tax rate schedule (brackets 3.75%/4.75%/5.99%, thresholds, standard deduction).
- https://tax.ri.gov/sites/g/files/xkgbur541/files/2024-10/ADV_2024_26_Inflation_Adjustments.pdf — 2025 inflation-adjusted bracket thresholds and standard deductions.
- https://smartasset.com/retirement/rhode-island-retirement-taxes — SS taxed above AGI limits; $20,000 pension/annuity modification at full retirement age; 2025 AGI ceilings $107,000 / $133,750.
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — RI brackets 3.75%–5.99%.
