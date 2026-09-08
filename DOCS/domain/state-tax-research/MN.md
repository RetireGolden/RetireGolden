# Minnesota (MN) — state income tax for retirement planning

Tax year: 2026 (TY2026 DOR inflation-adjusted amounts). Researched 2026-09-07.

## Summary
- Broad individual income tax: **yes** (graduated, 5.35%–9.85%)
- Taxes Social Security benefits: **yes** in the pack (`taxesSocialSecurity: true`); statutory subtraction **wholly unimplemented**
- Long-term capital gains: taxed as ordinary income (plus a net-investment-income tax above $1M, omitted)
- Retirement income (pension, IRA, 401k): generally taxed (no broad exclusion)

## Proposed StateTaxParams (TY2026)
- code: "MN"
- name: "Minnesota"
- hasIncomeTax: true
- taxesSocialSecurity: true
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 15300, marriedFilingJointly: 30600 }
- brackets.single (DOR whole-dollar bands):
  - 5.35% for $0–$33,310
  - 6.80% for $33,311–$109,430
  - 7.85% for $109,431–$203,150
  - 9.85% from $203,151
- brackets.marriedFilingJointly (DOR whole-dollar bands):
  - 5.35% for $0–$48,700
  - 6.80% for $48,701–$193,480
  - 7.85% for $193,481–$337,930
  - 9.85% from $337,931
- Engine breakpoints: $33,310 / $109,430 / $203,150 single and $48,700 / $193,480 / $337,930 MFJ (continuous mathematical representation of the published ranges).
- retirement: { kind: "none" }

## Retirement-income detail
Minnesota allows the greater of a simplified subtraction of federally taxable
Social Security or an alternate subtraction under Minn. Stat. §290.0132 subd. 26.
For TY2026 the DOR inflation table supplies indexed simplified-subtraction
phaseout thresholds of **$86,410** single/HOH and **$110,780** MFJ/surviving
spouse (MFS **$55,390**). The same table marks alternate
maxima **$4,560** single/HOH, **$5,840** MFJ/surviving spouse, and **$2,920** MFS
as **Not Indexed**.

The pack encodes `taxesSocialSecurity: true` and **subtracts nothing**, so it
overstates Minnesota tax for retirees who qualify for either subtraction. No broad
pension/IRA exclusion, so `retirement: { kind: "none" }`.

## Simplifications / not modeled
- §290.0132 subd. 26 simplified and alternate Social Security subtractions are **wholly unimplemented** — the pack taxes the federally taxable share with zero subtraction (`mn-stat-290-0132-subd-26-social-security-inclusion`, approximated / overstatesTax).
- 1% net investment income tax over $1M omitted.
- Standard deduction phase-out for high earners omitted.
- Subdivision 34 qualified-public-pension subtraction omitted.
- Calendar-year record expires after 2026; `stateParamsFor` may reuse the 2026 pack in later plan years as a planning stand-in.

## Citations
- https://www.revenue.state.mn.us/minnesota-income-tax-rates-and-brackets — TY2026 whole-dollar rate bands.
- https://www.revenue.state.mn.us/sites/default/files/2025-12/inflation-adjusted-amounts-2026.pdf — TY2026 standard deduction ($15,300 / $30,600), simplified-subtraction thresholds, and alternate maxima marked Not Indexed.
- https://www.revisor.mn.gov/statutes/cite/290.0132 — Minn. Stat. §290.0132 subd. 26 Social Security subtraction structure.
