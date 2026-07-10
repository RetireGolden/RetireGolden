# Vermont (VT) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (graduated, 3.35%–8.75%)
- Taxes Social Security benefits: **yes** (federally taxable amount; full exemption below income thresholds) — see detail
- Long-term capital gains: taxed as ordinary income (with a partial gains exclusion — see Simplifications)
- Retirement income (pension, IRA, 401k): generally taxed (no broad exclusion)

## Proposed StateTaxParams (2025)
- code: "VT"
- name: "Vermont"
- hasIncomeTax: true
- taxesSocialSecurity: true
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 7400, marriedFilingJointly: 14850 }
- brackets.single:
  - { lowerBound: 0, ratePct: 3.35 }
  - { lowerBound: 47900, ratePct: 6.6 }
  - { lowerBound: 116000, ratePct: 7.6 }
  - { lowerBound: 242000, ratePct: 8.75 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 3.35 }
  - { lowerBound: 79950, ratePct: 6.6 }
  - { lowerBound: 193300, ratePct: 7.6 }
  - { lowerBound: 294600, ratePct: 8.75 }
- retirement: { kind: "none" }

## Retirement-income detail
Vermont taxes income at graduated rates from 3.35% to 8.75% (2025). Vermont
**taxes Social Security** (the federally taxable portion), but provides a full
exemption for filers below an AGI threshold (~$50,000 single / $65,000 MFJ),
phasing out above it. Modeled as `taxesSocialSecurity: true` (the federally
taxable amount), which overstates tax for income-eligible retirees — flagged
below.

No broad pension/IRA exclusion for typical private retirees (Vermont exempts
certain government/military pensions and offers a limited civil-service/CSRS
exclusion only), so `retirement: { kind: "none" }`.

Standard deduction is $7,400 (single) / $14,850 (MFJ) for 2025; Vermont also
grants a $5,250 personal exemption per person (not modeled — see Simplifications).

## Simplifications / not modeled
- Social Security exemption (full below ~$50k single / $65k MFJ AGI, phasing
  out) simplified to fully taxed — overstates VT tax for many retirees.
- $5,250-per-person personal exemption not modeled (the $7,400/$14,850 figures
  are the standard deduction only).
- Partial capital-gains exclusion (Vermont allows the greater of a flat $5,000
  exclusion or up to 40% on certain assets, capped) not modeled;
  `capitalGainsAsOrdinary: true` overstates tax slightly for affected gains.
- Limited CSRS/military pension exclusions not modeled.

## Citations
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — 2025 Vermont brackets (single 0/47,900/116,000/242,000; MFJ 0/79,950/193,300/294,600) and standard deduction $7,400/$14,850.
- https://tax.vermont.gov/individuals/income-tax-returns/social-security-exemption — Social Security taxed, full exemption below income thresholds (~$50k single / $65k MFJ).
- https://ljfo.vermont.gov/assets/Publications/Issue-Briefs/GENERAL-379202-v2-How_Vermont_Taxes_Social_Security_Benefits-v2.pdf — income-based SS exemption mechanics.
