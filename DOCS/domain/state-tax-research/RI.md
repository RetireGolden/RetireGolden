# Rhode Island (RI) — state income tax for retirement planning

Tax year: 2026. Researched 2026-06-13; deduction and bracket schedule corrected 2026-09-07.

## Summary
- Broad individual income tax: **yes** (graduated, 3.75%–5.99%; same thresholds for all filing statuses)
- Taxes Social Security benefits: **yes** (taxed above income thresholds; exempt for retirees below them)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): income-limited exclusion up to $20,000 per person at full retirement age

## Proposed StateTaxParams (2026)
- code: "RI"
- name: "Rhode Island"
- hasIncomeTax: true
- taxesSocialSecurity: true
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 11200, marriedFilingJointly: 22400 }
- brackets.single:
  - { lowerBound: 0, ratePct: 3.75 }
  - { lowerBound: 82050, ratePct: 4.75 }
  - { lowerBound: 186450, ratePct: 5.99 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 3.75 }
  - { lowerBound: 82050, ratePct: 4.75 }
  - { lowerBound: 186450, ratePct: 5.99 }
- retirement: { kind: "capped", capPerPerson: 20000, minAge: 67 }

## 2026 inflation adjustments — operative law

The Rhode Island Division of Taxation published [ADV 2025-22](https://tax.ri.gov/sites/g/files/xkgbur541/files/2025-11/ADV_2025_22_Inflation_Adjustments.pdf) for tax years beginning on or after January 1, 2026. It sets:

- Standard deduction: **$11,200** (single / married filing separately) and **$22,400** (married filing jointly / qualifying surviving spouse).
- Uniform rate schedule: **3.75%** to **$82,050**, **4.75%** to **$186,450**, **5.99%** above $186,450 (same thresholds for all statuses).
- Standard-deduction phase-out range: $261,000–$290,800 for 2026 (not modeled).

These are **annual TY2026 values**; do not assume they continue unchanged in later tax years without a subsequent advisory.

### Historical context

The 2025 pack carried $10,900 / $21,800 deductions and $79,900 / $181,650 bracket thresholds from the prior inflation cycle. The 2026 pack now reflects ADV 2025-22.

## Retirement-income detail
Rhode Island's individual income tax has three brackets (3.75% / 4.75% / 5.99%). Unusually, the bracket thresholds are **identical for all filing statuses** — single and MFJ both step up at $82,050 and $186,450 for 2026.

Social Security: RI **does tax** federally taxable Social Security, but exempts it for taxpayers who have reached full retirement age and whose federal AGI is below the annual limit. Because the big-levers model can't represent the income-tested cliff, we set `taxesSocialSecurity: true` (conservative — overstates tax for lower-income retirees who qualify for the exemption; flagged below).

Pension/IRA/401(k): an income-limited modification excludes up to **$20,000 per person** ($40,000 joint) of qualifying pension/annuity income for taxpayers at full retirement age, subject to AGI ceilings. Modeled as `kind: "capped"`, `capPerPerson: 20000`, `minAge: 67`. The income-tested retirement and Social Security modifications remain **approximated**; this parameter correction does not close that gap.

## Simplifications / not modeled
- SS taxation and the $20,000 pension exclusion are both phased off by a federal-AGI ceiling and require full retirement age; the model applies the cap unconditionally and taxes SS unconditionally. Net effect: overstates tax for retirees under the AGI ceiling, understates SS handling nuance for those above.
- Standard deduction phases out at high income ($261,000–$290,800 for 2026); not modeled.
- Personal exemptions not modeled.
- The $20,000 cap is inflation-adjusted; we hold the registered approximation figure.
- Whole-return accuracy not claimed.

## Citations
- https://tax.ri.gov/sites/g/files/xkgbur541/files/2025-11/ADV_2025_22_Inflation_Adjustments.pdf — RI Division of Taxation ADV 2025-22 (TY2026 standard deduction, bracket schedule, phase-out range).
- https://tax.ri.gov/sites/g/files/xkgbur541/files/2025-10/2025%20Tax%20Rate%20and%20Worksheets_d.pdf — RI Division of Taxation 2025 tax rate schedule (prior-year cross-check).
- https://tax.ri.gov/sites/g/files/xkgbur541/files/2024-10/ADV_2024_26_Inflation_Adjustments.pdf — 2025 inflation-adjusted bracket thresholds and standard deductions (historical).
