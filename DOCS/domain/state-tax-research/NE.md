# Nebraska (NE) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

> **2026 update (staleness sweep, 2026-07-16):** the LB 754 ramp consolidated Nebraska to three
> brackets for 2026 — 2.46% / 3.51% / **4.55%** at $4,130 / $24,760 (single; $8,250 / $49,530 MFJ) —
> with the top rate stepping to 3.99% in 2027. The 2026 standard deduction is **$8,850 / $17,700**
> (2025's $8,600/$17,200 indexed; NE DOR chronology + TF 2026 tables). The 2026 pack encodes these
> values. Do not hold NE forward at refresh time. Source: Tax Foundation 2026 state income tax tables
> (accessed 2026-07-16; deduction corrected in PR #23 review, 2026-07-17).

## Summary
- Broad individual income tax: **yes** (graduated, 2.46%–5.20%)
- Taxes Social Security benefits: no (fully exempt as of tax year 2025)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): generally taxed (no broad exclusion; military/federal-civil-service/railroad pensions exempt)

## Proposed StateTaxParams (2025)
- code: "NE"
- name: "Nebraska"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 8600, marriedFilingJointly: 17200 }
- brackets.single:
  - { lowerBound: 0, ratePct: 2.46 }
  - { lowerBound: 4030, ratePct: 3.51 }
  - { lowerBound: 24120, ratePct: 5.01 }
  - { lowerBound: 38870, ratePct: 5.20 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 2.46 }
  - { lowerBound: 8040, ratePct: 3.51 }
  - { lowerBound: 48250, ratePct: 5.01 }
  - { lowerBound: 77730, ratePct: 5.20 }
- retirement: { kind: "none" }

## Retirement-income detail
Nebraska uses a graduated schedule with four brackets, **2.46%–5.20%** (2025).
The top 5.20% rate begins at $38,870 (single) / $77,730 (MFJ). Standard
deduction is $8,600 single / $17,200 MFJ.

**Social Security is fully exempt** beginning with tax year 2025 (taxpayers
subtract 100% of the federally taxable SS amount) → `taxesSocialSecurity: false`.
There is **no broad exclusion** for private pensions, IRAs, or 401(k)
distributions — they are taxed at ordinary graduated rates → `retirement: { kind:
"none" }`. (Military retirement, federal civil-service annuities, and Railroad
Retirement benefits are fully exempt, but these are special cases not covered by
the big-levers private-retiree model.)

## Simplifications / not modeled
- Exemption of military retirement, federal civil-service (CSRS/FERS) annuities,
  and Railroad Retirement not modeled (`none` overstates tax for those retirees).
- Nebraska's top rate is **phasing down** under LB 754 (5.20% in 2025 → 4.55% in
  2026 → 3.99% in 2027); the 2025 nominal rates are held forward — re-check at the
  2026 transcription point.
- Bracket thresholds inflation-adjusted annually; 2025 values held forward.
- Personal-exemption credit (per-person nonrefundable credit) not modeled.

## Citations
- https://www.incometaxpro.com/tax-rates/nebraska/single.htm — 2025 single brackets ($4,030 / $24,120 / $38,870; 2.46%/3.51%/5.01%/5.20%).
- https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/drafts/2025_Tax_Calculation_Schedule_Draft.pdf — 2025 MFJ brackets ($8,040 / $48,250 / $77,730).
- https://blog.turbotax.intuit.com/income-tax-by-state/nebraska-108625/ — standard deduction $8,600 / $17,200; SS fully exempt 2025; private pensions/IRA/401(k) taxable; military/federal/railroad exempt.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — cross-check 2025 rates 2.46%–5.20%.
