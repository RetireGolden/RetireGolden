# California (CA) — state income tax for retirement planning

Tax year: 2026 pack (deduction from 2026 Form 540-ES; bracket arrays retained from 2025 Schedule X/Y). Researched 2026-09-07.

## Summary
- Broad individual income tax: **yes** (graduated, 1%–12.3%, plus 1% Mental Health Services surcharge over $1M)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income (no preferential rate)
- Retirement income (pension, IRA, 401k): generally taxed; no broad exclusion

## Proposed StateTaxParams (2026 pack)
- code: "CA"
- name: "California"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 5706, marriedFilingJointly: 11412 }
- brackets.single (retained 2025 Schedule X; not final TY2026):
  - 1% from $0
  - 2% from $11,079
  - 4% from $26,264
  - 6% from $41,452
  - 8% from $57,542
  - 9.3% from $72,724
  - 10.3% from $371,479
  - 11.3% from $445,771
  - 12.3% from $742,953
- brackets.marriedFilingJointly (retained 2025 Schedule Y; not final TY2026):
  - 1% from $0
  - 2% from $22,158
  - 4% from $52,528
  - 6% from $82,904
  - 8% from $115,084
  - 9.3% from $145,448
  - 10.3% from $742,958
  - 11.3% from $891,542
  - 12.3% from $1,485,906
- Engine breakpoints: $11,079 / $26,264 / $41,452 / $57,542 / $72,724 / $371,479 / $445,771 / $742,953 single and $22,158 / $52,528 / $82,904 / $115,084 / $145,448 / $742,958 / $891,542 / $1,485,906 MFJ (continuous mathematical representation of the retained 2025 schedules).
- retirement: { kind: "none" }

## Retirement-income detail
California fully exempts Social Security benefits. Private and public pensions
and traditional IRA/401(k) distributions are **fully taxable** as ordinary income
with no age-based exclusion, so this maps to `retirement: { kind: "none" }`.
California taxes long-term capital gains at full ordinary rates (no preferential
treatment), so `capitalGainsAsOrdinary: true`.

The 2026 estimated-tax worksheet (Form 540-ES line 2b) lists a **$5,706** standard
deduction for single/MFS and **$11,412** for MFJ/HOH/QSS. The pack stores those
published amounts in its supported single/MFJ deduction cells. Bracket arrays
remain the **2025** Schedule X/Y rate schedules carried in `year2026.ts`; a final
TY2026 resident-return schedule was not established in this delivery.

## Simplifications / not modeled
- FTB directs filers to the **tax table through $100,000** of taxable income while
  the engine uses **continuous** Schedule X/Y breakpoints at all incomes. Lower-income
  continuous-schedule behavior is disclosed but is **not** an FTB table oracle and
  is outside the settled deduction record.
- The 1% Mental Health Services Tax surcharge on taxable income over $1,000,000 (pushing the top effective rate to 13.3%) is omitted — out of range for the planner's audience.
- Personal/dependent exemption credits not modeled.
- Standard-deduction and exemption-credit phase-outs at high income not modeled.
- Final 2026 resident-return figures, itemization, credits, unsupported filing-status routing, and whole-return accuracy are outside this delivery.
- Calendar-year record expires after 2026; `stateParamsFor` may reuse the 2026 pack in later plan years as a planning stand-in.

## Citations
- https://www.ftb.ca.gov/forms/2026/2026-540-es-instructions.html — 2026 Form 540-ES estimated-tax worksheet line 2b: $5,706 / $11,412 standard deduction.
- https://www.ftb.ca.gov/forms/2025/2025-540-tax-rate-schedules.pdf — retained 2025 Schedule X/Y bracket thresholds and rates 1%–12.3%.
- https://www.ftb.ca.gov/forms/2025/2025-540-instructions.html — Social Security exempt; tax table through $100,000.
