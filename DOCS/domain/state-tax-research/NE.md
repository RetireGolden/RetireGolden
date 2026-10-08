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
- Taxes Social Security benefits: no (fully exempt as of tax year 2024)
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

**Social Security is fully exempt** beginning with tax year 2024 (taxpayers
subtract 100% of the federally taxable SS amount) → `taxesSocialSecurity: false`.
There is **no broad exclusion** for private pensions, IRAs, or 401(k)
distributions — they are taxed at ordinary graduated rates → `retirement: { kind:
"none" }`. (Military retirement, federal civil-service annuities, and Railroad
Retirement benefits are fully exempt, but these are special cases not covered by
the big-levers private-retiree model.)

## Simplifications / not modeled
- Exemption of military retirement and federal civil-service (CSRS/FERS)
  annuities not modeled (`none` overstates tax for those retirees). Railroad
  Retirement comes off in full, as in every state, under 45 U.S.C. 231m
  (`usc-45-231m-state-tax-bar`, 2026-09-30).
- Nebraska's top rate is **phasing down** under LB 754 (5.20% in 2025 → 4.55% in
  2026 → 3.99% in 2027); the 2025 nominal rates are held forward — re-check at the
  2026 transcription point. (2026-09-28: rates three and four at 3.99% from 2027,
  Neb. Rev. Stat. 77-2715.03(2)(b)(iii) and (2)(c)(vi), are loaded for 2027 in
  `params/state/data/enacted2027.ts` on the 2026 thresholds, which stand in until the
  Tax Commissioner publishes the 2027 schedule.)
- Bracket thresholds inflation-adjusted annually; 2025 values held forward.
- Personal-exemption credit (per-person nonrefundable credit) not modeled.

## Citations
- https://www.incometaxpro.com/tax-rates/nebraska/single.htm — 2025 single brackets ($4,030 / $24,120 / $38,870; 2.46%/3.51%/5.01%/5.20%).
- https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/drafts/2025_Tax_Calculation_Schedule_Draft.pdf — 2025 MFJ brackets ($8,040 / $48,250 / $77,730).
- https://www.nebraskalegislature.gov/laws/statutes.php?statute=77-2716 — § 77-2716(14)(a)(iv), 100% of federally included Social Security benefits subtracted for tax years beginning on or after 2024-01-01.
- https://blog.turbotax.intuit.com/income-tax-by-state/nebraska-108625/ — standard deduction $8,600 / $17,200; private pensions/IRA/401(k) taxable; military/federal/railroad exempt.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — cross-check 2025 rates 2.46%–5.20%.

## Part-year residents (2026-10-08)

Method (b), 1040N 2025 and Schedule III: a percentage of the tax a resident with the same income owes. The form divides Nebraska-source income as stated federally by federal AGI with Nebraska's adjustments; the ratio here divides federal AGI items on both sides. The retirement treatment for a part year was not determined (316 NAC 22). The 2026 figures carry it as `partYear: { method: 'incomePercentage', ratioBasis: 'federalAgi' }` (params/state/data/year2026.ts), priced by tax/stateTax.ts#computeSplitYearResult on the income tax/statePartYear.ts#allocateSplitYear gives the months resident: a dated distribution or QCD transfer whole in the slice of its month, Social Security by the months paid, everything else by the months. Leaving Nebraska's adjustments out of the denominator makes the ratio higher than the form's when they add to income and lower when they subtract, so the figure errs in either direction.

A single filer of 50 with $100,000 of ordinary income spread over 2026, resident six months in Nebraska and six in Texas, owes $1,923.23 for the Nebraska months, the same as before. With a $40,000 Roth conversion on top, the slice is $3,642.72 when the conversion falls in the months resident and $2,023.73 when it falls in Texas's, where the months share of the year gave $2,833.23 either way.

The limits every state shares (days priced as months, undated income spread by months, nonresident-period source income, the credit for tax paid to the other state, special accrual and the full-year elections not modeled) are in `va-code-58-1-322-03-2-personal-exemptions`; the worked figures are in packages/engine/src/tax/statePartYear*.rules.test.ts.
