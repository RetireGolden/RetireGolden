# Michigan (MI) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (flat 4.25%)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income (flat 4.25%)
- Retirement income (pension, IRA, 401k): large age/birth-year-tiered deduction (2025: ~75% of max, ≈$49,423 per person) phasing to full exemption by 2026

## Proposed StateTaxParams (2025)
- code: "MI"
- name: "Michigan"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: [ { lowerBound: 0, ratePct: 4.25 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 4.25 } ]
- retirement: { kind: "capped", capPerPerson: 49423 }

## Retirement-income detail
Michigan taxes income at a flat **4.25%** (2025) with **no** standard deduction
(it uses a personal exemption, $5,800 for 2025, not modeled). Social Security is
fully exempt. Under the "Lowering MI Costs Plan" (PA 4 of 2023), Michigan is
phasing back the pre-2012 retirement-income exemption. For 2025, taxpayers in
the broad middle tier (born after 1945 and before 1967) may deduct up to **75%**
of the inflation-adjusted maximum: **$49,423 single / $98,846 MFJ** (75% of
$65,897 / $131,794). Modeled as `kind: "capped"`, `capPerPerson: 49423`, no age
gate — the typical retiree qualifies. (Those born before 1946 already get a full
exemption; the plan reaches full exemption for all by 2026.)

## Simplifications / not modeled
- Michigan's deduction is a **three-tiered, birth-year-dependent** system with
  alternative computations (e.g., the standard age-67 senior exemption against
  all income). We model only the 2025 75%-of-max middle tier per person; this
  understates the exclusion for those born before 1946 (full) and overstates it
  for some who must use a smaller alternative.
- The exemption fully phases in by tax year 2026 — at the 2026 transcription
  point this likely becomes `kind: "full"`; flag for re-check.
- Personal exemption ($5,800/person, 2025) not modeled (standard deduction = 0).
- Some cities (Detroit, Grand Rapids, etc.) levy a **local income tax**; not
  modeled.

## Citations
- https://www.michigan.gov/taxes/iit/tax-guidance/tax-situations/retirement-and-pension-benefits/2025/2025-tier-iii — 2025 tiered retirement deduction; 75%-of-max for born after 1945/before 1967; max $65,897 single / $131,794 MFJ.
- https://www.michigan.gov/ors/faqs-for-public-act-4-of-2023---retirement-state-tax-changes — Lowering MI Costs Plan phase-in (65%/75% in 2025 by tier; full by 2026); SS exempt.
- https://www.michigan.gov/taxes/-/media/Project/Websites/taxes/Forms/SUW/TY2025/446_Withholding-Guide_2025.pdf — 2025 flat 4.25% rate; personal exemption $5,800.
