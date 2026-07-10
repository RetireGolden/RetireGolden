# Connecticut (CT) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (graduated, 2%–6.99%)
- Taxes Social Security benefits: **yes** in statute, but fully exempt below AGI $75,000 single / $100,000 MFJ — modeled as taxed, flagged below
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): pension/annuity 100% exempt below the AGI thresholds; IRA 75% exempt in 2025 (100% from 2026)

## Proposed StateTaxParams (2025)
- code: "CT"
- name: "Connecticut"
- hasIncomeTax: true
- taxesSocialSecurity: true
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single:
  - { lowerBound: 0, ratePct: 2.0 }
  - { lowerBound: 10000, ratePct: 4.5 }
  - { lowerBound: 50000, ratePct: 5.5 }
  - { lowerBound: 100000, ratePct: 6.0 }
  - { lowerBound: 200000, ratePct: 6.5 }
  - { lowerBound: 250000, ratePct: 6.9 }
  - { lowerBound: 500000, ratePct: 6.99 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 2.0 }
  - { lowerBound: 20000, ratePct: 4.5 }
  - { lowerBound: 100000, ratePct: 5.5 }
  - { lowerBound: 200000, ratePct: 6.0 }
  - { lowerBound: 400000, ratePct: 6.5 }
  - { lowerBound: 500000, ratePct: 6.9 }
  - { lowerBound: 1000000, ratePct: 6.99 }
- retirement: { kind: "full" }

## Retirement-income detail
Connecticut has a graduated tax from 2% to 6.99%. MFJ brackets are exactly **2×**
the single brackets (verified, not assumed). Connecticut has **no standard
deduction** (it uses personal exemptions/credits instead), so set to 0.

For retirees, Connecticut exempts **100% of pension and annuity income** when
federal AGI is below **$75,000 (single)** / **$100,000 (MFJ)**, phasing out above
those thresholds. Traditional **IRA** distributions are 75% exempt for 2025 under
the same income limits, rising to **100% in 2026**. Since this research feeds
`year2026.ts`, the 2026 state of the law fully exempts both pension/annuity and
IRA income for below-threshold retirees, so this is mapped to
`retirement: { kind: "full" }` (no age gate in statute).

Social Security: fully exempt below AGI $75,000 (single) / $100,000 (MFJ); above
that, up to 25% of benefits are taxable. Because the big-levers model has a single
boolean, `taxesSocialSecurity` is set **true** (SS is taxable above the
thresholds), which overstates tax for below-threshold retirees — flagged below.

## Simplifications / not modeled
- Pension/IRA exemption and SS exemption are **income-tested** (full below $75k single / $100k MFJ, phasing out above). Modeled as a flat full exemption (`kind: "full"`) while `taxesSocialSecurity: true`; this overstates SS tax and understates pension tax for higher-income retirees. A future enhancement could add the AGI phase-out.
- 2025-only nuance: IRA income is 75% exempt in 2025 (vs 100% pension); modeled at the 2026 full-exemption state since the data lands in `year2026.ts`.
- CT personal exemptions, the 3% tax-rate phase-out (benefit recapture), and the property-tax credit not modeled.
- No standard deduction; set to 0.

## Citations
- https://www.incometaxpro.com/tax-rates/connecticut.htm — 2025 single and MFJ brackets (2%–6.99%); MFJ = 2× single thresholds.
- https://cga.ct.gov/2024/rpt/pdf/2024-R-0130.pdf — CT OLR "A Guide to Connecticut's Personal Income Tax" (brackets, no standard deduction).
- https://www.cga.ct.gov/2025/rpt/pdf/2025-R-0152.pdf — IRA deduction phase-in (75% in 2025, 100% in 2026); pension/annuity & SS AGI thresholds $75k/$100k.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — Tax Foundation 2025 cross-check (CT 2%–6.99%).
