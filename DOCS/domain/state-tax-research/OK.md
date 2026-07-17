# Oklahoma (OK) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

> **2026 update (staleness sweep, 2026-07-16):** HB 2764 (2025) collapsed Oklahoma's six brackets into
> three from 2026 — 0% replaces the old sub-2.75% bands, then **2.5% / 3.5% / 4.5%** at $3,750 / $4,900
> / $7,200 (single; doubled MFJ), top rate down from 4.75% — with a stated path to further cuts. The
> 2026 pack encodes this structure. Do not hold OK forward at refresh time. Sources: Tax Foundation
> "State Tax Changes Taking Effect January 1, 2026" + 2026 tables (accessed 2026-07-16).

## Summary
- Broad individual income tax: **yes** (graduated, 0.25%–4.75%)
- Taxes Social Security benefits: no (federally taxable SS is subtracted)
- Long-term capital gains: taxed as ordinary income (an in-state-asset CG deduction exists; not modeled)
- Retirement income (pension, IRA, 401k): excluded up to $10,000 per person

## Proposed StateTaxParams (2025)
- code: "OK"
- name: "Oklahoma"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 6350, marriedFilingJointly: 12700 }
- brackets.single:
  - { lowerBound: 0, ratePct: 0.25 }
  - { lowerBound: 1000, ratePct: 0.75 }
  - { lowerBound: 2500, ratePct: 1.75 }
  - { lowerBound: 3750, ratePct: 2.75 }
  - { lowerBound: 4900, ratePct: 3.75 }
  - { lowerBound: 7200, ratePct: 4.75 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 0.25 }
  - { lowerBound: 2000, ratePct: 0.75 }
  - { lowerBound: 5000, ratePct: 1.75 }
  - { lowerBound: 7500, ratePct: 2.75 }
  - { lowerBound: 9800, ratePct: 3.75 }
  - { lowerBound: 14400, ratePct: 4.75 }
- retirement: { kind: "capped", capPerPerson: 10000 }

## Retirement-income detail
Oklahoma's individual income tax is graduated, with six brackets topping out at
**4.75%** (2025). Social Security benefits are fully exempt — the federally
taxable portion is subtracted on the Oklahoma return. Pensions, IRA, and 401(k)
distributions share a single **$10,000-per-person** retirement-income
exclusion; amounts above that are taxed on the regular schedule. Modeled as
`kind: "capped"`, `capPerPerson: 10000`, no age gate. Standard deduction is
$6,350 (single) / $12,700 (MFJ). MFJ bracket thresholds are double the single
thresholds (verified against the OK MFJ tax table), so the structure is
monotonic and parallel.

## Simplifications / not modeled
- The $10,000 exclusion has source-specific sub-limits and ordering rules (e.g. separate treatment for federal/military/state government pensions, each capped); approximated by the single $10k cap.
- Beginning in tax year 2026 the retirement-income exemption rises to $40,000; we hold the 2025 $10,000 figure for this tax year.
- HB 2764 (signed 2025) cuts the top rate to 4.5% and consolidates to three brackets effective TY2026; not applied to TY2025.
- Capital gains: Oklahoma allows a deduction for gains on qualifying Oklahoma-located property / Oklahoma-company stock; we set `capitalGainsAsOrdinary: true` (overstates tax for those specific gains).

## Citations
- https://oklahoma.gov/content/dam/ok/en/tax/documents/forms/individuals/current/511-Pkt.pdf — 2025 Form 511 packet: standard deduction $6,350 single; bracket rates 0.25%–4.75%.
- https://www.tax-brackets.org/oklahomataxtable/married-filing-jointly — 2025 single and MFJ bracket thresholds.
- https://www.law.cornell.edu/regulations/oklahoma/OAC-710-50-15-49 — $10,000 retirement-income deduction.
- https://smartasset.com/retirement/oklahoma-retirement-taxes — Social Security exempt; $10,000 per-person retirement exclusion.
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — OK top rate 4.75%.
