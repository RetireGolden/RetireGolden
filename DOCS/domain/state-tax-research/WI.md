# Wisconsin (WI) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (graduated, 3.5%–7.65%)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: **preferential** — 30% of net long-term gain is excluded (only 70% taxed at ordinary rates) — see detail
- Retirement income (pension, IRA, 401k): generally taxed; age-67+ may subtract up to $24,000 per person of qualifying retirement income

## Proposed StateTaxParams (2025)
- code: "WI"
- name: "Wisconsin"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 13560, marriedFilingJointly: 25110 }
- brackets.single:
  - { lowerBound: 0, ratePct: 3.5 }
  - { lowerBound: 14680, ratePct: 4.4 }
  - { lowerBound: 50480, ratePct: 5.3 }
  - { lowerBound: 323290, ratePct: 7.65 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 3.5 }
  - { lowerBound: 19580, ratePct: 4.4 }
  - { lowerBound: 67300, ratePct: 5.3 }
  - { lowerBound: 431060, ratePct: 7.65 }
- retirement: { kind: "capped", capPerPerson: 24000, minAge: 67 }

## Retirement-income detail
Wisconsin taxes income at graduated rates from 3.5% to 7.65% (2025). Social
Security benefits are fully exempt, so `taxesSocialSecurity: false`. Standard
deduction is income-tested (slides down as income rises); the maximum amounts
are $13,560 (single) / $25,110 (MFJ) for 2025 — modeled as the maximum, noted
below.

**Capital gains**: Wisconsin allows a **30% exclusion** of net long-term capital
gain (assets held more than one year; 60% for farm assets), so only 70% is taxed
at ordinary rates. This is a preferential treatment; per the template convention
`capitalGainsAsOrdinary: true` is set and the 30% exclusion is flagged under
Simplifications (the model omits the preference and overstates tax on gains).

**Retirement income**: For 2025, taxpayers **age 67+** by Dec 31 may subtract up
to **$24,000 per person** of qualifying retirement income (pensions, annuities,
IRA distributions), subject to a federal-AGI ceiling ($30,000 single / $60,000
MFJ for full benefit). Mapped to
`retirement: { kind: "capped", capPerPerson: 24000, minAge: 67 }`.

## Simplifications / not modeled
- **30% long-term capital-gains exclusion** not modeled (`capitalGainsAsOrdinary:
  true`) — overstates WI tax on long-term gains. A future enhancement could
  apply a 0.70 factor to long-term gains.
- The $24,000 retirement subtraction has a federal-AGI ceiling ($30k single /
  $60k MFJ) above which it is lost; the income cap is not modeled (overstates
  the deduction for higher-income retirees).
- Standard deduction is income-phased; modeled at the maximum, which understates
  tax for higher-income filers.
- Married-couple max retirement subtraction is $48,000 (both spouses 67+),
  captured per-person as $24,000.

## Citations
- https://www.revenue.wi.gov/Pages/FAQS/pcs-taxrates.aspx — 2025 brackets: single 0/14,680/50,480/323,290; MFJ 0/19,580/67,300/431,060 at 3.5%/4.4%/5.3%/7.65%.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — 2025 Wisconsin standard deduction $13,560 single / $25,110 MFJ; Social Security exempt.
- https://www.revenue.wi.gov/TaxForms2025/2025-ScheduleSB-Inst.pdf — 30% long-term capital-gain exclusion (60% farm); $24,000 age-67 retirement income subtraction with AGI ceiling.
