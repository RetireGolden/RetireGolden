# Hawaii (HI) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (graduated, 1.4%–11.0%, 12 brackets; widened by Act 46, SLH 2024)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: preferential — capped at 7.25% (modeled as ordinary; flagged)
- Retirement income: employer-funded pensions fully exempt; **IRA/401(k) distributions fully taxable**

## Proposed StateTaxParams (2025)
- code: "HI"
- name: "Hawaii"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 4400, marriedFilingJointly: 8800 }
- brackets.single:
  - { lowerBound: 0, ratePct: 1.4 }
  - { lowerBound: 9600, ratePct: 3.2 }
  - { lowerBound: 14400, ratePct: 5.5 }
  - { lowerBound: 19200, ratePct: 6.4 }
  - { lowerBound: 24000, ratePct: 6.8 }
  - { lowerBound: 36000, ratePct: 7.2 }
  - { lowerBound: 48000, ratePct: 7.6 }
  - { lowerBound: 125000, ratePct: 7.9 }
  - { lowerBound: 175000, ratePct: 8.25 }
  - { lowerBound: 225000, ratePct: 9.0 }
  - { lowerBound: 275000, ratePct: 10.0 }
  - { lowerBound: 325000, ratePct: 11.0 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 1.4 }
  - { lowerBound: 19200, ratePct: 3.2 }
  - { lowerBound: 28800, ratePct: 5.5 }
  - { lowerBound: 38400, ratePct: 6.4 }
  - { lowerBound: 48000, ratePct: 6.8 }
  - { lowerBound: 72000, ratePct: 7.2 }
  - { lowerBound: 96000, ratePct: 7.6 }
  - { lowerBound: 250000, ratePct: 7.9 }
  - { lowerBound: 350000, ratePct: 8.25 }
  - { lowerBound: 450000, ratePct: 9.0 }
  - { lowerBound: 550000, ratePct: 10.0 }
  - { lowerBound: 650000, ratePct: 11.0 }
- retirement: { kind: "none" }

## Retirement-income detail
Hawaii has a 12-bracket graduated tax from 1.4% to 11.0%. Brackets were
**substantially widened for 2025** by Act 46, SLH 2024 (single 1.4% bracket now
runs to $9,600; 11% top rate starts at $325,000). MFJ brackets are exactly **2×**
the single brackets (verified). The 2025 standard deduction is **$4,400 (single) /
$8,800 (MFJ)** (doubled from $2,200/$4,400 under Act 46).

Social Security is fully exempt. Hawaii fully exempts **employer-funded pension**
distributions (public and private) where the employee did not contribute. However,
distributions from traditional **IRAs and 401(k)/deferred-compensation** plans are
treated as a return on individual investment and are **fully taxable**. Because the
common modern retiree's IRA/401(k) income is taxed, this maps to
`retirement: { kind: "none" }` (conservative for those with a true non-contributory
employer pension).

## Simplifications / not modeled
- Fully-employer-funded pension exemption not modeled (`none` overstates tax for retirees with a traditional non-contributory pension). The model targets the dominant IRA/401(k) case, which Hawaii taxes.
- Capital gains: Hawaii caps the long-term capital-gains rate at **7.25%**; we set `capitalGainsAsOrdinary: true`, which overstates tax for high-bracket filers with large gains.
- Employee-contributed pensions are partially taxable (pro-rata); not modeled.
- Standard deduction continues to rise in phases through 2031 under Act 46; we hold the 2025 amount.

## Citations
- https://learn.valur.com/hawaii-income-tax/ — 2025 single and MFJ brackets (1.4%–11.0%, 12 tiers); MFJ = 2× single.
- https://files.hawaii.gov/tax/news/announce/ann24-03.pdf — Hawaii DOTAX Announcement 2024-03: Act 46 bracket/standard-deduction changes effective 1/1/2025.
- https://support.taxslayer.com/hc/en-us/articles/360029385331-Is-my-retirement-income-taxable-to-Hawaii — employer pensions exempt; IRA/401(k) taxable; SS exempt.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — Tax Foundation 2025 cross-check (HI 1.4%–11.0%, std deduction $4,400/$8,800).
