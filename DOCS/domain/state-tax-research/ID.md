# Idaho (ID) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (flat 5.3% above a zero-rate floor)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income (with a partial deduction for certain Idaho property — see Simplifications)
- Retirement income (pension, IRA, 401k): generally taxed; only a narrow age-gated deduction for specific government/military pensions

## Proposed StateTaxParams (2025)
- code: "ID"
- name: "Idaho"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 15000, marriedFilingJointly: 30000 }
- brackets.single:
  - { lowerBound: 0, ratePct: 0 }
  - { lowerBound: 4811, ratePct: 5.3 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 0 }
  - { lowerBound: 9622, ratePct: 5.3 }
- retirement: { kind: "none" }

## Retirement-income detail
Idaho reduced its flat individual income tax rate from 5.695% to **5.3%**
effective January 1, 2025 (HB 40). The structure is effectively a single flat
rate of 5.3% applied to Idaho taxable income above a zero-rate floor of $4,811
(single) / $9,622 (married filing jointly). Social Security benefits are fully
exempt. Idaho conforms to the federal standard deduction ($15,000 single /
$30,000 MFJ for 2025).

Private pensions and IRA/401(k) distributions are **generally taxable**. Idaho's
"retirement benefits deduction" applies only to specific government pensions
(certain federal Civil Service, Idaho firefighter/police, and military
retirement) and only when the recipient is age 65+ (or 62+ and disabled), with
the deduction reduced by Social Security received. Because there is no broad
exclusion for the common private-pension/IRA retiree, this is mapped to
`retirement: { kind: "none" }`.

## Simplifications / not modeled
- Zero-rate floor ($4,811 single / $9,622 MFJ) modeled as a 0% first bracket so brackets remain monotonic.
- Characterized retirement facts apply the qualified-plan deduction only for named eligible systems and its age/disability, filing-status, and Social-Security conditions. Private plans, FERS, and unclassified public income do not qualify merely because a retirement amount is positive.
- Idaho's capital-gains deduction (60% of net gain on qualifying Idaho real/tangible property) not modeled; `capitalGainsAsOrdinary: true` overstates tax for those gains.
- The federal senior deduction applies in Idaho for 2025 to 2028 by conformity (H 559, 2026) and is modeled from 2026-09-28 (`id-h559-2026-conformity-senior-deduction`); the grocery credit and tip/overtime deductions are not modeled.

## Citations
- https://tax.idaho.gov/pressrelease/whats-new-for-2025-income-tax-returns/ — 5.3% rate for 2025, federal-conforming standard deduction, SS exempt.
- https://www.paylocity.com/resources/tax-compliance/alerts/idaho-lowers-2025-state-income-tax-rate/ — HB 40 lowered rate from 5.695% to 5.3% effective 1/1/2025.
- https://remotelaws.com/state-income-tax/us-states/idaho/ — 5.3% flat above $4,811 single / $9,622 MFJ zero-rate floor.
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — ID flat 5.3%.

## Idaho permits only named and individually eligible retirement benefits (verified 2026-09-12)

Eligible CSRS/FSRDS and specified Idaho firefighter/police benefits require age 65 or age 62 and disability. Military has its distinct disabled/age-62/employment-filing test. Married taxpayers must file jointly. FERS and generic private or public plans are excluded. The statutory maximum is reduced by household Social Security and Railroad Retirement benefits and cannot exceed qualifying federally included income. Survivor and remarriage facts remain necessary where applicable.

Registered as `id-code-63-3022a-qualified-retirement-deduction`. Authority: [Idaho Code 63-3022A(1)–(3)](https://legislature.idaho.gov/statutesrules/idstat/title63/t63ch30/sect63-3022a/).

## Idaho taxes a part-year resident on the income of the months resident, with the deduction prorated and the zero band whole (verified 2026-10-07)

A part-year resident files Form 43. Line 38 is the Idaho percentage, line 31 Column B over Column A; line 39 multiplies the deduction by it; line 41 gives Idaho taxable income; and the line 42 tax worksheet subtracts the whole $4,811 ($9,622 joint) before 5.3%, the same zero band a full-year resident has. From 2026-10-07 a slice of a year split between states keeps the zero band whole. From 2026-10-08 the slice is the income received in the months resident, and the deduction takes the Idaho percentage, line 31 Column B over Column A, total adjusted income after the Idaho additions and subtractions, where before the months stood for it (the pack's `partYear`). A single filer of 50 with $100,000 of ordinary income, resident six months and six in Texas: $2,095.86, now $1,968.37.

Registered as `id-form-43-part-year-resident-period`. Authority: [2025 Idaho individual income tax forms and instructions, Form 43](https://tax.idaho.gov/wp-content/uploads/forms/EIN00046/EIN00046_03-02-2026.pdf).

## Part-year residents (2026-10-08)

Method (a), 2025 Form 43: line 38 divides line 31, total adjusted income (AGI with the Idaho additions and subtractions), Column B by Column A, and line 39 applies it to the deduction; the line 42 worksheet subtracts the whole zero band; Form 39NR cuts the retirement benefits deduction to the share received while resident (id-form-43-part-year-resident-period). The 2026 figures carry it as `partYear: { method: 'residentPeriod', standardDeduction: 'incomeRatio', exemptions: 'incomeRatio', ratioBasis: 'stateIncome', exclusionCap: 'retirementShare' }` (params/state/data/year2026.ts), priced by tax/stateTax.ts#computeSplitYearResult on the income tax/statePartYear.ts#allocateSplitYear gives the months resident: a dated distribution or QCD transfer whole in the slice of its month, Social Security by the months paid, everything else by the months.

A single filer of 50 with $100,000 of ordinary income spread over 2026, resident six months in Idaho and six in Texas, owes $1,968.37 for the Idaho months, the same as before. With a $40,000 Roth conversion on top, the slice is $3,966.47 when the conversion falls in the months resident and $2,090.27 when it falls in Texas's, where the months share of the year gave $3,028.37 either way.

The limits every state shares (days priced as months, undated income spread by months, nonresident-period source income, the credit for tax paid to the other state, special accrual and the full-year elections not modeled) are in `va-code-58-1-322-03-2-personal-exemptions`; the worked figures are in packages/engine/src/tax/statePartYear*.rules.test.ts.
