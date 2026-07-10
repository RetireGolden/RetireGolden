# West Virginia (WV) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (graduated, 2.22%–4.82%)
- Taxes Social Security benefits: **partially** in 2025 — 65% of benefits exempt (phasing to fully exempt in 2026); full exemption below income thresholds — see detail
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): generally taxed; age-65+ may deduct up to $8,000 per person from any income

## Proposed StateTaxParams (2025)
- code: "WV"
- name: "West Virginia"
- hasIncomeTax: true
- taxesSocialSecurity: true
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single:
  - { lowerBound: 0, ratePct: 2.22 }
  - { lowerBound: 10000, ratePct: 2.96 }
  - { lowerBound: 25000, ratePct: 3.33 }
  - { lowerBound: 40000, ratePct: 4.44 }
  - { lowerBound: 60000, ratePct: 4.82 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 2.22 }
  - { lowerBound: 10000, ratePct: 2.96 }
  - { lowerBound: 25000, ratePct: 3.33 }
  - { lowerBound: 40000, ratePct: 4.44 }
  - { lowerBound: 60000, ratePct: 4.82 }
- retirement: { kind: "capped", capPerPerson: 8000, minAge: 65 }

## Retirement-income detail
West Virginia taxes income at graduated rates from 2.22% to 4.82% for 2025
(reduced ~5.9% from the prior 2.36%–5.12% schedule). Bracket thresholds are
**the same for single and MFJ** (not doubled). WV has **no standard deduction**;
it uses $2,000-per-person personal exemptions instead (set `standardDeduction: 0`,
noted below).

**Social Security** is being phased out of taxation: for 2025, 65% of federally
taxable benefits are exempt (35% still taxed); 2026 reaches full exemption.
Benefits are already fully exempt if federal AGI is ≤$50,000 (single) /
≤$100,000 (MFJ). Because some benefits remain taxable in 2025 above those
thresholds, set `taxesSocialSecurity: true` — this overstates tax (only 35% is
taxed, and only for higher incomes); flagged below.

Residents **age 65+** (or permanently disabled) may deduct **up to $8,000 per
person** of income from any source. Mapped to
`retirement: { kind: "capped", capPerPerson: 8000, minAge: 65 }`.

## Simplifications / not modeled
- Social Security: `taxesSocialSecurity: true` treats benefits as fully taxed,
  but only 35% is taxable in 2025 and only above $50k/$100k AGI (fully exempt in
  2026). Overstates WV SS tax materially. A future enhancement could model the
  phase-out / partial exemption.
- No standard deduction; $2,000-per-person personal exemptions not modeled.
- The $8,000 senior deduction applies to any income source, not just
  pension/IRA; mapping it to `retirement` is an approximation.
- Government/military pension subtractions (federal/state law-enforcement, etc.)
  not separately modeled.

## Citations
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — 2025 brackets 2.22%–4.82% at 0/10,000/25,000/40,000/60,000 (same for single and MFJ); no standard deduction.
- https://tax.wv.gov/Individuals/SeniorCitizens/Pages/SeniorCitizenSocialSecurityModification.aspx — 2025 Social Security 65% modification; full exemption at AGI ≤$50k single / ≤$100k MFJ; full phase-out by 2026.
- https://support.taxslayer.com/hc/en-us/articles/360049021311-What-s-new-in-2025-for-West-Virginia — $8,000 age-65/disabled deduction; $2,000 personal exemptions.
