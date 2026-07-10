# New Jersey (NJ) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (graduated, 1.4%–10.75%)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): large age-62+ exclusion — up to $100,000 MFJ / $75,000 single, but only if total income ≤ $150,000 (see below)

## Proposed StateTaxParams (2025)
- code: "NJ"
- name: "New Jersey"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single:
  - { lowerBound: 0, ratePct: 1.4 }
  - { lowerBound: 20000, ratePct: 1.75 }
  - { lowerBound: 35000, ratePct: 3.5 }
  - { lowerBound: 40000, ratePct: 5.525 }
  - { lowerBound: 75000, ratePct: 6.37 }
  - { lowerBound: 500000, ratePct: 8.97 }
  - { lowerBound: 1000000, ratePct: 10.75 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 1.4 }
  - { lowerBound: 20000, ratePct: 1.75 }
  - { lowerBound: 50000, ratePct: 2.45 }
  - { lowerBound: 70000, ratePct: 3.5 }
  - { lowerBound: 80000, ratePct: 5.525 }
  - { lowerBound: 150000, ratePct: 6.37 }
  - { lowerBound: 500000, ratePct: 8.97 }
  - { lowerBound: 1000000, ratePct: 10.75 }
- retirement: { kind: "capped", capPerPerson: 50000, minAge: 62 }

## Retirement-income detail
New Jersey has **no standard deduction** (it uses personal exemptions and
deductions instead). Social Security benefits are **fully exempt** from NJ tax.

NJ's signature feature is the **Retirement Income Exclusion** for taxpayers age
62+ (or disabled): pension, annuity, and IRA/401(k) income can be excluded up to
**$100,000 (married filing jointly)**, **$75,000 (single)**, or **$50,000 (married
filing separately)** — but ONLY if total income for the year is ≤ $150,000, and
the excludable amount phases down in tiers above $100,000 of income. Modeled as
`kind: "capped"`, `minAge: 62`, with **capPerPerson: 50000** so that a married
couple (two eligible persons) reaches the ~$100,000 MFJ cap and a single filer
reaches ~$50,000 — a deliberate per-person approximation of NJ's per-return caps
(see flags). The income cap is not represented by the per-person model.

NJ's MFJ bracket schedule is genuinely different from single (it inserts a 2.45%
bracket and shifts thresholds — it is NOT simply 2× the single thresholds).

## Simplifications / not modeled
- **Income cap on the exclusion**: the exclusion fully applies only when total
  income ≤ $100,000 (full), partially $100k–$150k, and disappears above $150,000.
  The `capped` model ignores this phase-out — **overstates the exclusion (understates
  tax) for retirees with income above ~$100k**.
- **Per-person vs per-return**: NJ's caps are per-return ($100k MFJ / $75k single),
  not per-person. We use capPerPerson: 50000 so two filers approximate the $100k MFJ
  cap; a single filer gets only $50,000 vs NJ's actual $75,000 — conservative
  (overstates tax) for higher-income single retirees.
- NJ has **no standard deduction**; personal exemptions ($1,000 each, extra for 65+)
  not modeled.
- Top 8.97%/10.75% brackets retained but are out-of-range for most retirees.
- Local wage taxes: none statewide of note for retirees.

## Citations
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — 2025 single & MFJ brackets (1.4%–10.75%, MFJ 2.45% bracket); no standard deduction.
- https://www.nj.gov/treasury/taxation/njit7.shtml — Retirement Income Exclusion: $100k MFJ / $75k single / $50k MFS, age 62+, income ≤ $150,000 with phase-down; SS exempt.
