# California (CA) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (graduated, 1%–12.3%, plus 1% Mental Health Services surcharge over $1M)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income (no preferential rate)
- Retirement income (pension, IRA, 401k): generally taxed; no broad exclusion

## Proposed StateTaxParams (2025)
- code: "CA"
- name: "California"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 5540, marriedFilingJointly: 11080 }
- brackets.single:
  - { lowerBound: 0, ratePct: 1.0 }
  - { lowerBound: 11079, ratePct: 2.0 }
  - { lowerBound: 26264, ratePct: 4.0 }
  - { lowerBound: 41452, ratePct: 6.0 }
  - { lowerBound: 57542, ratePct: 8.0 }
  - { lowerBound: 72724, ratePct: 9.3 }
  - { lowerBound: 371479, ratePct: 10.3 }
  - { lowerBound: 445771, ratePct: 11.3 }
  - { lowerBound: 742953, ratePct: 12.3 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 1.0 }
  - { lowerBound: 22158, ratePct: 2.0 }
  - { lowerBound: 52528, ratePct: 4.0 }
  - { lowerBound: 82904, ratePct: 6.0 }
  - { lowerBound: 115084, ratePct: 8.0 }
  - { lowerBound: 145448, ratePct: 9.3 }
  - { lowerBound: 742958, ratePct: 10.3 }
  - { lowerBound: 891542, ratePct: 11.3 }
  - { lowerBound: 1485906, ratePct: 12.3 }
- retirement: { kind: "none" }

## Retirement-income detail
California fully exempts Social Security benefits. Private and public pensions
and traditional IRA/401(k) distributions are **fully taxable** as ordinary income
with no age-based exclusion, so this maps to `retirement: { kind: "none" }`.
California taxes long-term capital gains at full ordinary rates (no preferential
treatment), so `capitalGainsAsOrdinary: true`. The 2025 standard deduction is
$5,540 (single) / $11,080 (MFJ). The MFJ brackets are exactly 2× the single
brackets (verified against the Schedule X single thresholds).

## Simplifications / not modeled
- The 1% Mental Health Services Tax surcharge on taxable income over $1,000,000 (pushing the top effective rate to 13.3%) is omitted — out of range for the planner's audience.
- Personal/dependent exemption credits ($149/$461 for 2025) not modeled.
- Standard-deduction and exemption-credit phase-outs at high income not modeled.
- California has no preferential capital-gains rate; modeled correctly as ordinary.

## Citations
- https://www.ftb.ca.gov/forms/2025/2025-540-tax-rate-schedules.pdf — 2025 Schedule X (single) bracket thresholds and rates 1%–12.3%.
- https://www.ftb.ca.gov/forms/2025/2025-540-instructions.html — 2025 Form 540 instructions; standard deduction $5,540 / $11,080; SS exempt.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — Tax Foundation 2025 cross-check (CA 1%–12.3% graduated).
