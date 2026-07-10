# North Dakota (ND) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (graduated, very low: 0% / 1.95% / 2.5%, with a large 0% bracket)
- Taxes Social Security benefits: no (fully exempt since 2021)
- Long-term capital gains: preferential — 40% of net long-term gains excluded (taxed as ordinary on the remaining 60%)
- Retirement income (pension, IRA, 401k): generally taxed at ND's low rates; no broad exclusion

## Proposed StateTaxParams (2025)
- code: "ND"
- name: "North Dakota"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 15000, marriedFilingJointly: 30000 }
- brackets.single:
  - { lowerBound: 0, ratePct: 0 }
  - { lowerBound: 48475, ratePct: 1.95 }
  - { lowerBound: 244825, ratePct: 2.5 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 0 }
  - { lowerBound: 80975, ratePct: 1.95 }
  - { lowerBound: 298075, ratePct: 2.5 }
- retirement: { kind: "none" }

## Retirement-income detail
North Dakota's 2023 reform created a very flat, very low schedule: a **0% bracket**
covering the first **$48,475 (single) / $80,975 (MFJ)** of taxable income, then
1.95%, then 2.5% on income over ~$245k / ~$298k. (ND's bracket thresholds are
defined on federal taxable income, which already nets out the federal standard
deduction; the $15,000 / $30,000 standard deduction is shown for the model's
structure.)

Social Security benefits are **fully exempt** (since 2021). Private pensions and
IRA/401(k) distributions are taxable but at these very low rates with the big 0%
bracket; there is no separate broad pension/IRA exclusion, so
`retirement: { kind: "none" }`.

## Simplifications / not modeled
- **Capital gains**: ND excludes **40% of net long-term capital gains** (only 60%
  taxed). We set `capitalGainsAsOrdinary: true` (no preference) — overstates tax on
  long-term gains. Given ND's tiny rates the dollar impact is small.
- **Standard-deduction double-counting risk**: ND's published bracket thresholds
  are on federal taxable income (post-federal-standard-deduction). If the engine
  also subtracts the $15,000/$30,000 standard deduction before applying these
  brackets, it would double-count — flag for the code-transcription step. Setting
  standardDeduction to 0 with these thresholds may be more accurate depending on
  engine conventions.
- Top 2.5% bracket retained but rarely reached by retirees.

## Citations
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — 2025 ND brackets: 0% then 1.95% (over $48,475 single / $80,975 MFJ) then 2.5% (over $244,825 / $298,075); standard deduction $15,000 / $30,000.
- https://learn.valur.com/north-dakota-capital-gains-tax/ — 40% long-term capital gains exclusion.
- https://www.aarp.org/states/north-dakota/state-tax-guide/ — Social Security fully exempt.
