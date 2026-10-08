# New York (NY) — state income tax for retirement planning

Tax year: 2025. (Completed example — already in `year2026.ts`.)

> **2026 update (staleness sweep, 2026-07-16):** the 2025 enacted budget's middle-class cuts take
> effect for 2026 — the five brackets through 6% each drop 10bp (4% → **3.9%**, 4.5% → **4.4%**,
> 5.25% → **5.15%**, 5.5% → **5.4%**, 6% → **5.9%**); 6.85% and 9.65% are unchanged, and the 10.3%/10.9%
> brackets at $5M/$25M remain omitted from the pack as out of the planner's audience range. The 2026
> pack encodes the reduced rates. Source: Tax Foundation 2026 state income tax tables (accessed
> 2026-07-16).

## Summary
- Broad individual income tax: **yes** (graduated, 4%–10.9%)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income
- Retirement income: qualifying NY/local/federal-government and military pensions fully exempt through a coarse `{ kind: 'full' }` public bucket; private pension & IRA/401(k) excluded up to $20,000 per person at 59½+

## Proposed StateTaxParams (2025)
- code: "NY"
- name: "New York"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 8000, marriedFilingJointly: 16050 }
- brackets.single:
  - { lowerBound: 0, ratePct: 4.0 }
  - { lowerBound: 8500, ratePct: 4.5 }
  - { lowerBound: 11700, ratePct: 5.25 }
  - { lowerBound: 13900, ratePct: 5.5 }
  - { lowerBound: 80650, ratePct: 6.0 }
  - { lowerBound: 215400, ratePct: 6.85 }
  - { lowerBound: 1077550, ratePct: 9.65 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 4.0 }
  - { lowerBound: 17150, ratePct: 4.5 }
  - { lowerBound: 23600, ratePct: 5.25 }
  - { lowerBound: 27900, ratePct: 5.5 }
  - { lowerBound: 161550, ratePct: 6.0 }
  - { lowerBound: 323200, ratePct: 6.85 }
  - { lowerBound: 2155350, ratePct: 9.65 }
- retirement: { kind: "capped", capPerPerson: 20000, minAge: 59 }

## Retirement-income detail
NY fully exempts Social Security. Qualifying New York State, local, and
federal-government pensions — including military pensions under the United
States or its agencies — are subtracted in full when correctly routed to
`publicPensionIncome`; see [Information for retired persons](https://www.tax.ny.gov/pit/file/information_for_seniors.htm).
The pack models that path as `retirementPublic: { kind: 'full' }` through
`PUBLIC_PENSION_OVERRIDES`, without issuer or Optional Retirement Program
employment-attributable portion checks
(`ny-government-pension-issuer-qualification-not-modeled`). Private pensions
and IRA/401(k) distributions are excluded up to **$20,000 per person** once
the recipient is 59½+; modeled as `kind: "capped"`, `capPerPerson: 20000`,
`minAge: 59`. Top brackets above ~$1.08M (5M MFJ tiers at 10.3%/10.9%) are
omitted as out-of-range for the planner's audience.

## Simplifications / not modeled
The characterized retirement calculation applies the private cap and modeled
age gate separately to each recipient's distributions. A spouse's unused cap
or older age cannot establish the other recipient's exclusion. Missing
ownership or missing or conflicting age eligibility produces an incomplete
disclosure and no exclusion for the affected recipient. Legacy aggregate
inputs do not prove recipient attribution. Governmental source qualification
and the half-year age issue remain separate limitations below.

- Coarse `{ kind: 'full' }` public bucket subtracts every routed `publicPensionIncome` dollar without validating governmental issuer or ORP employment-attributable portion; understates tax when a routed amount is not qualifying or includes non-qualifying ORP excess — not a claim that every out-of-state public pension is taxable.
- Private $20,000 cap uses integer age 59 rather than 59½ (`ny-tax-612-c-3-a-pension-annuity-exclusion`).
- NYC/Yonkers local income taxes not modeled.
- Top 10.3%/10.9% millionaire brackets omitted; tax-benefit recapture omitted.

## Citations
- https://www.tax.ny.gov/pit/file/information_for_seniors.htm — governmental pension subtraction, Optional Retirement Program limitation, Social Security exempt.
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — NY.

## Roth conversion income is excluded only at 59 and a half at the conversion (2026-10-06)

Record: `ny-tsb-m-98-7-i-roth-conversion-at-59-and-a-half`. Classification: `approximated` (needs a conversion date).

TSB-M-98(7)I: up to $20,000 of conversion income is excluded if the taxpayer is 59 and a half at the time of the conversion. The engine tests a named conversion on its execution date when the plan gives one and every other conversion on January 1, so in the year the owner reaches 59 and a half an undated conversion gets no exclusion, which can overstate New York tax. Until 2026-10-06 the engine excluded it whenever the owner was 59 at the end of the year. Whether an in-plan Roth rollover qualifies, when the instructions allow only periodic payments from a 401(k), is not determined.

Authority: [TSB-M-98(7)I](https://www.tax.ny.gov/pdf/memos/income/m98_7i.pdf).

## Part-year residents (2026-10-08)

Method (b), IT-203-I 2025: the base tax as a full-year resident times line 45, line 31 New York column over federal column, both New York AGI after the modifications; the $20,000 pension exclusion is per taxable period, not prorated (ny-tsb-m-98-7-i-roth-conversion-at-59-and-a-half). The 2026 figures carry it as `partYear: { method: 'incomePercentage', ratioBasis: 'stateIncome', exclusionCap: 'full' }` (params/state/data/year2026.ts), priced by tax/stateTax.ts#computeSplitYearResult on the income tax/statePartYear.ts#allocateSplitYear gives the months resident: a dated distribution or QCD transfer whole in the slice of its month, Social Security by the months paid, everything else by the months.

A single filer of 50 with $100,000 of ordinary income spread over 2026, resident six months in New York and six in Texas, owes $2,429.88 for the New York months, the same as before. With a $40,000 Roth conversion on top, the slice is $4,641.27 when the conversion falls in the months resident and $2,578.48 when it falls in Texas's, where the months share of the year gave $3,609.88 either way.

The limits every state shares (days priced as months, undated income spread by months, nonresident-period source income, the credit for tax paid to the other state, special accrual and the full-year elections not modeled) are in `va-code-58-1-322-03-2-personal-exemptions`; the worked figures are in packages/engine/src/tax/statePartYear*.rules.test.ts.
