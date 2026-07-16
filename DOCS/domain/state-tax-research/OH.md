# Ohio (OH) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

> **2026 update (staleness sweep, 2026-07-16):** Ohio's 2025 budget completed the flattening — from
> 2026 a single **2.75%** rate applies above the $26,050 zero bracket (the 3.5% bracket is eliminated).
> The 2026 pack encodes this structure. Source: Tax Foundation "State Tax Changes Taking Effect
> January 1, 2026" (accessed 2026-07-16).

## Summary
- Broad individual income tax: **yes** (graduated, with a large 0% bracket up to ~$26k, then 2.75% / 3.5%)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): generally taxed; only small retirement-income credit (≤$200), no broad exclusion

## Proposed StateTaxParams (2025)
- code: "OH"
- name: "Ohio"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single:
  - { lowerBound: 0, ratePct: 0 }
  - { lowerBound: 26050, ratePct: 2.75 }
  - { lowerBound: 100000, ratePct: 3.5 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 0 }
  - { lowerBound: 26050, ratePct: 2.75 }
  - { lowerBound: 100000, ratePct: 3.5 }
- retirement: { kind: "none" }

## Retirement-income detail
Ohio's 2025 schedule has a **0% bracket on the first $26,050** of Ohio taxable
income, then 2.75% up to $100,000, then 3.5% above. The brackets are the **same
for single and MFJ** (Ohio does not double the thresholds for joint filers).
Ohio has **no standard deduction**; it uses personal/dependent exemptions instead.

Social Security benefits are **fully exempt** (not part of Ohio AGI). Private and
public pensions and IRA/401(k) distributions are **taxable**; Ohio offers only a
small **Retirement Income Credit** (up to $200, for retirement income $500–$8,000,
phased out above $100,000 MAGI) and a senior credit — too small to model as an
exclusion, so `retirement: { kind: "none" }`.

## Simplifications / not modeled
- **No standard deduction** — Ohio uses personal exemptions ($2,400–$2,900 per
  exemption, income-tiered); not modeled. The large 0% bracket partly compensates.
- **Retirement Income Credit** (≤$200), **senior citizen credit**, and **joint-filer
  credit** not modeled; `none` slightly overstates tax for retirees.
- **Military retirement pay** is fully exempt; not modeled.
- **Municipal (city) income taxes** (commonly ~1.5%–3%) are significant in Ohio but
  generally do not apply to pension/SS/IRA retirement income — not modeled.
- Capital gains taxed as ordinary (no Ohio preference) — matches actual treatment.

## Citations
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — 2025 OH brackets: 0% to $26,050, 2.75% to $100,000, 3.5% above (same single & MFJ); no standard deduction.
- https://tax.ohio.gov/individual/file-now/ohio-tax-credits-and-their-required-documentation — Retirement Income Credit (≤$200) and senior credit.
- https://www.edelmanfinancialengines.com/education/tax/ohio-tax-social-security/ — Social Security exempt from Ohio income tax.
