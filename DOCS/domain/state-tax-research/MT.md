# Montana (MT) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (two brackets, 4.7% and 5.9%)
- Taxes Social Security benefits: **yes** (starts from the federally taxable amount; income-based subtraction exempts lower-income retirees)
- Long-term capital gains: **preferential** — separate lower CG rates (3.0% / 4.1%); modeled as ordinary, noted
- Retirement income (pension, IRA, 401k): mostly taxed; only a small ($5,500 per person) age-65 subtraction

## Proposed StateTaxParams (2025)
- code: "MT"
- name: "Montana"
- hasIncomeTax: true
- taxesSocialSecurity: true
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 15750, marriedFilingJointly: 31500 }
- brackets.single:
  - { lowerBound: 0, ratePct: 4.7 }
  - { lowerBound: 20500, ratePct: 5.9 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 4.7 }
  - { lowerBound: 41000, ratePct: 5.9 }
- retirement: { kind: "none" }

## Retirement-income detail
Montana overhauled its income tax for 2024+, now using just two brackets: **4.7%**
and **5.9%** (5.9% begins at $20,500 single / $41,000 MFJ for 2025). Montana
conforms its standard deduction to the **federal** amount ($15,750 single /
$31,500 MFJ for 2025).

Montana **taxes Social Security**: it begins from the federally taxable benefit
amount, with an income-based subtraction that fully exempts SS for low-income
retirees (AGI under $25k single / $32k MFJ), partially for moderate income, and
only 15% deductible above the upper limits. Following the MN convention, modeled
as `taxesSocialSecurity: true` (tax the federally taxable share) — this
overstates tax for lower-income retirees (flagged below).

For 2025 Montana **repealed** its former partial pension/annuity/IRA subtraction
and replaced it with a flat **$5,500 per person** subtraction for taxpayers age
65+. Pension, IRA, and 401(k) distributions are otherwise fully taxable. Because
there is no broad pension/IRA exclusion, mapped to `retirement: { kind: "none" }`.

## Simplifications / not modeled
- Income-based **SS subtraction** simplified to "fully taxed" (`taxesSocialSecurity: true`) — overstates tax for low/moderate-income retirees.
- $5,500 (single) / $11,000 (MFJ, both 65+) **age-65 subtraction** not modeled (`none` is conservative — overstates tax for seniors).
- **Capital gains preference**: Montana taxes net long-term capital gains at lower rates (3.0% on the first ~$21,100, 4.1% above) rather than the 4.7%/5.9% ordinary rates. We set `capitalGainsAsOrdinary: true` (no preference) — overstates tax on LTCG.
- Standard deduction source conflict: some references list MT's own $14,600/$29,200 amounts; we use the federal-conformed $15,750/$31,500 — re-verify against the final 2025 Form 2 instructions.
- Bracket thresholds inflation-adjusted annually; 2025 values held forward.

## Citations
- https://www.taxcompare.org/state/montana/brackets — 2025 brackets 4.7% (to $20,500 single / $41,000 MFJ) and 5.9%.
- https://accountinginsights.org/does-montana-tax-social-security-benefits/ — SS starts from federally taxable amount; income-based subtraction tiers ($25k/$32k full; partial above).
- https://americantaxservice.org/senior-tax-deductions-in-montana/ — 2025 repeal of partial pension/IRA subtraction; new $5,500/$11,000 age-65 subtraction.
- https://nationaltaxreports.com/montana-tax-on-capital-gains/ — preferential net long-term capital-gains rates (3.0% / 4.1%).
