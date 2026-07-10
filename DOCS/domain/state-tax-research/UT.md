# Utah (UT) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (flat 4.5% for 2025)
- Taxes Social Security benefits: **yes** (federally taxable amount included; offset by an income-phased-out taxpayer credit) — see detail
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): generally taxed (no broad exclusion; small retirement credit instead)

## Proposed StateTaxParams (2025)
- code: "UT"
- name: "Utah"
- hasIncomeTax: true
- taxesSocialSecurity: true
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: [ { lowerBound: 0, ratePct: 4.5 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 4.5 } ]
- retirement: { kind: "none" }

## Retirement-income detail
Utah taxes income at a flat **4.5%** for tax year 2025 (reduced from 4.55%; the
4.5% rate applies to the full 2025 year for annual filers). Utah has **no
standard deduction**; instead it grants a nonrefundable **Taxpayer Tax Credit**
(6% of federal deductions plus personal exemptions) that phases out as income
rises — set `standardDeduction: 0` and noted here.

Utah **does tax Social Security** (the federally taxable portion flows into Utah
taxable income), so `taxesSocialSecurity: true`. A separate Social Security
benefits credit equal to 4.5% of the taxable benefits offsets this, phasing out
above $54,000 (single) / $90,000 (MFJ) for 2025 — not modeled.

There is no broad pension/IRA exclusion for typical private retirees, so
`retirement: { kind: "none" }`. (A small retirement tax credit of up to $450 per
person exists with the same income phase-outs; not modeled.)

## Simplifications / not modeled
- Utah's Taxpayer Tax Credit (de facto progressive effective rate via phase-out)
  approximated by the flat rate with no standard deduction — overstates tax for
  lower-income retirees.
- Social Security credit (4.5% of taxable benefits, phased out above
  $54k/$90k) not modeled — overstates tax for income-eligible retirees.
- Up-to-$450 retirement tax credit not modeled.

## Citations
- https://incometax.utah.gov/paying/tax-rates — flat 4.5% rate for 2025 (Jan 1, 2025–current).
- https://taxfoundation.org/location/utah/ — Utah flat individual income tax; no standard deduction (taxpayer credit instead).
- https://blog.turbotax.intuit.com/income-tax-by-state/utah-111986/ — Social Security taxed but offset by credit; 2025 phase-out thresholds $54,000 single / $90,000 MFJ.
