# Michigan (MI) — state income tax for retirement planning

Tax year: **2026**. Researched 2026-09-05 (ordinary retirement cap); Social Security
full exemption previously verified.

> **2026 update (ordinary retirement ceiling, 2026-09-05):** For tax year 2026 and
> later, MCL 206.30(10)(d) lets a taxpayer deduct retirement or pension benefits
> under subsection (1)(f), except that amounts deductible under (1)(f)(i) and (ii)
> combined are subject to the same maximum (1)(f)(iv) allows for that year.
> Treasury RAB 2026-1 applies that combined public/private maximum regardless of
> birth year, while preserving unlimited qualifying public benefits for recipients
> born before 1946. The 2026 Withholding Guide (Form 446) publishes the ordinary
> post-1945 qualifying maximum as **$67,610** single or married filing separately,
> or **$135,220** married filing jointly. This is a **combined qualifying-benefit
> ceiling**, not a universal full exemption of all retirement income.
>
> The sole published state pack also stands in for pre-2026 and future projected
> years under the existing pack fallback. Statutory authority for this ordinary
> ceiling is **2026+**; using the pack outside 2026 is a stand-in, not validation
> of the historical 2025 phase-in statute or of a future indexed amount.

**Modeled impact beyond 2026:** The nominal fallback pack means correcting the
ordinary cap also moves modeled Michigan tax in pre-2026 and future projected
years without validating those statutes or future indexation. Regression
comparisons found 36 Michigan-only deltas across 2,448 all-state observations;
two published example cases each show about **$13,913** lower lifetime taxes and penalties
(rounded modeled long-horizon deltas, not statutory oracles). Coarse
qualification, election, pre-1946-public, and return-ceiling residuals remain.

## Summary
- Broad individual income tax: **yes** (flat **4.25%**)
- Taxes Social Security benefits: **no** (fully exempt; separate sibling record
  `mi-mcl-206-30-f-iii-social-security`)
- Long-term capital gains: taxed as ordinary income (flat 4.25%)
- Retirement income (pension, IRA, 401k): ordinary **combined qualifying**
  public/private ceiling **$67,610** single/MFS / **$135,220** MFJ for 2026
  (`mi-mcl-206-30-retirement-and-ss`); not a blanket full exemption

## Current StateTaxParams (2026)
- code: "MI"
- name: "Michigan"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: [ { lowerBound: 0, ratePct: 4.25 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 4.25 } ]
- retirement: { kind: "capped", capPerPerson: 67610 }

## Historical 2025 (distinct; superseded for TY2026+)
- Flat rate **4.25%**; personal exemption **$5,800** (not modeled).
- Under PA 4 of 2023 phase-in, the broad middle tier (born after 1945 and before
  1967) could deduct up to **75%** of the inflation-adjusted maximum:
  **$49,423** single / **$98,846** MFJ (75% of $65,897 / $131,794).
- Keep 2025 figures for historical comparison only; do not treat `$49,423` as the
  current 2026 ordinary cap.

## Retirement-income detail
Michigan taxes income at a flat **4.25%** with **no** modeled standard deduction
(it uses a personal exemption — **$5,900** for 2026 per Guide 446 — not modeled).
Social Security is fully exempt.

For **2026**, the ordinary subsection-(10) path deducts **qualifying** retirement
and pension benefits up to a **combined** public/private return-level ceiling of
**$67,610** (single/MFS) or **$135,220** (MFJ). Qualifying benefits generally
include most Form 1099-R payments (defined-benefit pensions, IRAs, and most
defined-contribution payments); Guide 446 / RAB 2026-1 exclude, among other
items, certain 457 amounts, employee-contribution-only 401(k) amounts, specified
403(b) payments, and premature distributions before plan retirement eligibility.

**Exceptions and elections the coarse pack does not express:**
- Recipients **born before 1946** are not taxed on qualifying **federal or
  Michigan public** benefits; private qualifying benefits still share the ordinary
  ceiling for any remaining room.
- Subsections **(9), (10), and (11)** are elective; public-safety and other special
  paths exist.
- The pack encodes one shared `{ kind: "capped", capPerPerson: 67610 }` rule with
  **no** age/birth gate and **no** `PUBLIC_PENSION_OVERRIDES` split. The engine’s
  per-living-person `agesAlive` proxy approximates the return-level filing-status
  ceiling and can diverge for unusual households.

## Simplifications / not modeled
- Source qualification vs the application’s coarse retirement bucket.
- Pre-1946 unlimited qualifying federal/Michigan public benefits above the shared
  cap; public-safety / surviving-spouse / uncovered-employment facts.
- Elections among subsections (9), (10), and (11).
- Personal exemption (**$5,900**/person for 2026 per Guide 446) not modeled
  (`standardDeduction` remains 0).
- City/local income taxes (Detroit, Grand Rapids, etc.) are a user flat
  `localIncomeTaxPct` input, not a full city rule pack.
- Because the 2026 pack is the first stand-in for pre-2026 years and the last
  projected fallback, correcting the ordinary cap also changes modeled
  historical/future years without validating those statutes or future indexation.

## Citations (primary)
- https://www.michigan.gov/taxes/-/media/Project/Websites/taxes/Forms/SUW/TY2026/446_Withholding-Guide_2026.pdf — 2026 ordinary qualifying maximum $67,610 single/MFS / $135,220 MFJ; personal exemption $5,900; qualifying / nonqualifying categories; pre-1946 public exception.
- https://www.michigan.gov/taxes/rep-legal/rab/2026-revenue-administrative-bulletins/revenue-administrative-bulletin-2026-1 — RAB 2026-1: 2026-and-later combined public/private maximum regardless of birth year; pre-1946 public exception; elective (9)/(10)/(11).
- https://www.legislature.mi.gov/mileg.aspx?objectName=mcl-206-30&page=getObject — MCL 206.30(10)(d) and (1)(f) retirement / Social Security limbs.
- Historical 2025 phase-in (not current): https://www.michigan.gov/taxes/iit/tax-guidance/tax-situations/retirement-and-pension-benefits/2025/2025-tier-iii — 2025 75%-of-max middle tier ($49,423 / $98,846).

## Michigan permits both deductions in the 2026–2028 window (verified 2026-09-12)

The subsection (9)(e) treatment allows affected taxpayers both federally included Social Security and the full standard deduction during 2026–2028. It does not make the permanent Social Security subtraction expire and is an evidence constraint, not an assertion that all Michigan retirement elections are calculated.

Evidence limb of `mi-mcl-206-30-f-iii-social-security`; not a separate claim to compute the elective standard retirement deduction. Authority: [Michigan Treasury RAB 2026-1 Issue 11](https://www.michigan.gov/taxes/rep-legal/rab/2026-revenue-administrative-bulletins/revenue-administrative-bulletin-2026-1).


Evidence completion (2026-09-12): The separate mi-mcl-206-30-9-e-nonconditioning evidence record is bounded to TY2026–2028 and taxpayers born after 1952 reaching 67. Full Issue 11 source also preserves the pre-2026/post-2028 reduction rule and the remaining personal-exemption/railroad/military reductions. Elective subsection (9) standard-deduction calculation is explicitly out of scope; permanent Social Security remains indefinite.

## A Roth conversion counts only at 59 and a half (2026-10-06)

Record: `mi-treasury-roth-conversion-at-59-and-a-half`. Classification: `approximated` (needs a conversion date).

Michigan Treasury: the rollover from a regular IRA to a Roth IRA qualifies for the pension subtraction, within the statute's limits, if the individual is at least 59 and a half when the rollover occurs. The engine tests a named conversion on its execution date when the plan gives one and every other conversion on January 1, the earliest it could have happened; in the year the owner reaches 59 and a half an undated conversion therefore gets no subtraction, which can overstate Michigan tax. Until 2026-10-06 the engine subtracted a conversion at any age. Whether an in-plan Roth rollover qualifies at all is not determined.

Authority: [Michigan Treasury FAQ](https://www.michigan.gov/taxes/questions/iit/accordion/roth/are-conversions-from-a-regular-ira-to-a-roth-ira-subject-to-michigan-individual-income-tax-1).

## Part-year residents (2026-10-08)

Method (a), Schedule NR lines 14 to 19 and MCL 206.30(5): Column B, the exemption (not modeled) by Michigan-source adjusted gross income (line 14B) over total adjusted gross income (line 14A), both before Michigan's retirement subtractions; the subtraction caps are not prorated (mi-mcl-206-30-1-e-i-armed-forces-retirement-deduction). The 2026 figures carry it as `partYear: { method: 'residentPeriod', standardDeduction: 'full', exemptions: 'incomeRatio', ratioBasis: 'federalAgi', exclusionCap: 'full' }` (params/state/data/year2026.ts), priced by tax/stateTax.ts#computeSplitYearResult on the income tax/statePartYear.ts#allocateSplitYear gives the months resident: a dated distribution or QCD transfer whole in the slice of its month, Social Security by the months paid, everything else by the months.

A single filer of 50 with $100,000 of ordinary income spread over 2026, resident six months in Michigan and six in Texas, owes $2,125.00 for the Michigan months, the same as before. With a $40,000 Roth conversion on top, the slice is $3,825.00 when the conversion falls in the months resident and $2,125.00 when it falls in Texas's, where the months share of the year gave $2,975.00 either way.

The limits every state shares (days priced as months, undated income spread by months, nonresident-period source income, the credit for tax paid to the other state, special accrual and the full-year elections not modeled) are in `va-code-58-1-322-03-2-personal-exemptions`; the worked figures are in packages/engine/src/tax/statePartYear*.rules.test.ts.
