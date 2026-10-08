# Kansas (KS) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (two brackets, 5.2% and 5.58%)
- Taxes Social Security benefits: no (fully exempt for all taxpayers since tax year 2024)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): private pensions/IRA/401(k) generally taxed; public (federal/state/KPERS/military/railroad) pensions exempt

## Proposed StateTaxParams (2025)
- code: "KS"
- name: "Kansas"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 3605, marriedFilingJointly: 8240 }
- brackets.single:
  - { lowerBound: 0, ratePct: 5.2 }
  - { lowerBound: 23000, ratePct: 5.58 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 5.2 }
  - { lowerBound: 46000, ratePct: 5.58 }
- retirement: { kind: "none" }

## Retirement-income detail
Kansas (after the 2024 reforms, SB 1 / HB 2036) has a two-bracket structure for
2025: **5.2%** on taxable income up to $23,000 (single) / $46,000 (MFJ), and
**5.58%** above that. Standard deduction is $3,605 single / $8,240 MFJ (2025).

Social Security benefits are **fully exempt** for all taxpayers beginning with
tax year 2024 — Kansas removed the prior $75,000 AGI cliff (SB 1, 2024 special
session). Public pensions are exempt (federal Civil Service, military, railroad
retirement, KPERS state/local). However, **private** pensions and IRA/401(k)
distributions are taxed as ordinary income, so the common private retiree gets
no exclusion → `retirement: { kind: "none" }`.

## Simplifications / not modeled
- Characterized retirement facts distinguish the statutory named public-plan list from private or unclassified public income. Aggregate public-pension income is not proof of a listed plan.
- Kansas personal exemption ($9,160 single / $18,320 MFJ plus $2,320/dependent, 2025) not modeled — only the standard deduction is captured, which understates total deductions/exemptions and overstates tax.
- Age-65 additional standard deduction add-ons not modeled.

## Citations
- https://remotelaws.com/state-income-tax/us-states/kansas/ — 2025 two brackets 5.20%/5.58% at $23,000 single / $46,000 MFJ.
- https://www.ksrevenue.gov/incomebook25.html — Kansas DOR 2025 income tax booklet (rates, standard deduction).
- https://legalclarity.org/kansas-social-security-taxation-rules-exemptions-and-changes/ — SS fully exempt for tax years after 12/31/2023 (SB 1 removed $75k cap).
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — KS 5.2%/5.58%.

## Kansas preserves direct QCD exclusion and separately tests charitable-credit modifications (verified 2026-09-12)

Kansas begins with federal AGI and lists its additions. There is no general direct-QCD addition in the reviewed current enactment, so an eligible federally excluded direct QCD flows through without another subtraction. Covered charitable-credit additions are separate and require actual claimed-credit facts; unknown credit facts produce incomplete status. This bounded inference is not blanket conformity for all transaction types or a presumption that credits were not claimed.

Registered as `ks-direct-qcd-conformity`. Authority: [Kansas 2026 chapter 154, section 2, 79-32,117(a),(b)(vii)](https://www.sos.ks.gov/publications/sessionlaws/2026/Chapter-154-SB-300.html).

## Characterized retirement and evidence scope (2026-09-12)

Named statutory plans, including KPERS, federal service, qualifying city/public-utility systems, Washburn and Overland Park police/fire, are distinguished by plan identity. An unlisted public plan does not become eligible simply because it is public. Unknown identity is incomplete.

The engine subtracts the named-plan amount only from a pension whose source is public, federal civil service, military or a government survivor benefit, and only when it carries a listed plan code, except that a pension tagged Military retirement needs none from 2026-10-07: the source names the armed-forces system (c)(vii) names, so it is read as `US-MILITARY`; a pension of unknown public source, or a public pension with no code, makes the year incomplete (`ks-plan-code-unknown`). An IRA, a private pension, and a 401(k), 401(a) or 457(b) employer plan get no named-plan subtraction whatever code they carry, so from 2026-10-06 a missing code on them is not flagged: before, every Kansas year with an IRA or 401(k) withdrawal was marked incomplete for a fact that could not change its tax. Washburn University's retirement plan (79-32,117(c)(xix)) is a 403(b), as Department of Revenue Notice 08-06 describes it, and the Notice allows the subtraction for the university's supplemental retirement annuity too. So an employer plan coded `KS-WASHBURN` has its federally included amount subtracted (no other code subtracts an employer plan; whether a federal Thrift Savings Plan or a KPERS 457 account is subtracted is not determined, and the engine subtracts neither), and a 403(b), or an employer plan of other, unknown or undeclared type, with a taxable amount and no code makes the year incomplete. A projected employer account passes its declared `employerPlanType` to the row as its plan type, so declaring a 401(k) or 457(b) clears the flag. A named public system's benefit has to be entered as a pension with its plan code to be subtracted.

## Part-year residents (2026-10-08)

Method (b), 2025 K-40 booklet: line 10 is the tax times Schedule S line B23, Kansas-source income with its modifications over Kansas AGI. The 2026 figures carry it as `partYear: { method: 'incomePercentage', ratioBasis: 'stateIncome', exclusionCap: 'viaTaxRatio' }` (params/state/data/year2026.ts), priced by tax/stateTax.ts#computeSplitYearResult on the income tax/statePartYear.ts#allocateSplitYear gives the months resident: a dated distribution or QCD transfer whole in the slice of its month, Social Security by the months paid, everything else by the months.

A single filer of 50 with $100,000 of ordinary income spread over 2026, resident six months in Kansas and six in Texas, owes $2,645.72 for the Kansas months, the same as before. With a $40,000 Roth conversion on top, the slice is $4,836.50 when the conversion falls in the months resident and $2,686.94 when it falls in Texas's, where the months share of the year gave $3,761.72 either way.

The limits every state shares (days priced as months, undated income spread by months, nonresident-period source income, the credit for tax paid to the other state, special accrual and the full-year elections not modeled) are in `va-code-58-1-322-03-2-personal-exemptions`; the worked figures are in packages/engine/src/tax/statePartYear*.rules.test.ts.
