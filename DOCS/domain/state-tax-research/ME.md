# Maine (ME) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

> **2026 update (PR #23 review, 2026-07-17):** Maine **decoupled from the federal standard deduction**
> for tax years from 2026 (36 M.R.S. §5124-C 1-B). Per the MRS revised 2026 rate schedule (rev.
> 2026-05-20): standard deduction **$15,700 / $31,400**; brackets 5.8% / 6.75% / 7.15% at
> **$27,400 / $64,850** single and **$54,850 / $129,750** MFJ; plus a new **2% surcharge** on taxable
> income over $1,000,000 single / $1,500,000 MFJ (encoded in the pack as an equivalent 9.15% top
> bracket; surcharge thresholds index from 2027). The statement below that the deduction is federal is
> obsolete for 2026. Source (primary): MRS 2026 rate schedule PDF (rev. May 20, 2026), accessed
> 2026-07-17.

## Summary
- Broad individual income tax: **yes** (graduated, 5.8%–7.15%)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): excluded up to $48,216 per person (2025), reduced by Social Security/Railroad Retirement received

## Proposed StateTaxParams (2025)
- code: "ME"
- name: "Maine"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 15000, marriedFilingJointly: 30000 }
- brackets.single:
  - { lowerBound: 0, ratePct: 5.8 }
  - { lowerBound: 26800, ratePct: 6.75 }
  - { lowerBound: 63450, ratePct: 7.15 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 5.8 }
  - { lowerBound: 53600, ratePct: 6.75 }
  - { lowerBound: 126900, ratePct: 7.15 }
- retirement: { kind: "capped", capPerPerson: 48216 }

## Retirement-income detail
Maine has three graduated brackets for 2025: 5.8%, 6.75%, and 7.15%. Single
thresholds are $26,800 and $63,450; MFJ thresholds are $53,600 and $126,900 (per
the official Maine Revenue Services 2025 rate schedules). Standard deduction is
$15,000 single / $30,000 MFJ. Social Security benefits are fully exempt.

Maine offers a **pension income deduction** of up to **$48,216 per eligible
recipient** for 2025, covering employer pensions and IRA/401(k) distributions
(the deduction is per person, so both spouses can claim it on a joint return).
The deduction is **reduced dollar-for-dollar by Social Security and Railroad
Retirement benefits** received. Mapped to `retirement: { kind: "capped",
capPerPerson: 48216 }`, no age gate (Maine's pension deduction is not strictly
age-conditioned for the general non-military deduction).

## Simplifications / not modeled
- The pension deduction's reduction by SS/Railroad Retirement received is not modeled — modeling the full $48,216 cap understates Maine tax for retirees with large SS benefits.
- Military retirement pay is fully exempt (separate, uncapped); approximated by the $48,216 cap (conservative for military retirees).
- Standard deduction phase-out for high earners and the personal exemption ($5,150) not modeled.
- Brackets are CPI-adjusted annually; 2025 nominal figures used.

## Citations
- https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/ind_tax_rate_sched_2025.pdf — Maine Revenue Services 2025 rate schedules (single $26,800/$63,450; MFJ $53,600/$126,900; standard deduction $15,000/$30,000).
- https://www.pressherald.com/2026/02/02/what-are-the-maine-income-tax-brackets-for-2025/ — 2025 brackets 5.8%/6.75%/7.15%.
- https://blog.turbotax.intuit.com/income-tax-by-state/maine-108205/ — $48,216 max non-military pension deduction (2025), reduced by SS/RR; SS not taxed.
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — ME 5.8%–7.15%.
