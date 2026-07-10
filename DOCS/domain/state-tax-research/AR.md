# Arkansas (AR) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (two-bracket, 2%–3.9%)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: preferential — 50% of net long-term gains excluded (taxed at ordinary rate on remainder)
- Retirement income (pension, IRA, 401k): excluded up to $6,000 per person

## Proposed StateTaxParams (2025)
- code: "AR"
- name: "Arkansas"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 2410, marriedFilingJointly: 4820 }
- brackets.single:
  - { lowerBound: 0, ratePct: 2.0 }
  - { lowerBound: 4500, ratePct: 3.9 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 2.0 }
  - { lowerBound: 4500, ratePct: 3.9 }
- retirement: { kind: "capped", capPerPerson: 6000 }

## Retirement-income detail
Arkansas fully exempts Social Security. Private pensions and IRA/401(k)/403(b)
distributions are excluded up to **$6,000 per person** per year; amounts above
that are taxed. Each spouse with qualifying retirement income gets a separate
$6,000 exclusion, so MFJ is naturally handled per-person. Mapped to
`kind: "capped"`, `capPerPerson: 6000`, no age gate (the exclusion is not strictly
age-conditioned for most plans). Public pensions (military, police, fire,
state/local) are fully exempt — not separately modeled.

Note the bracket structure: Arkansas uses a low-income tax table and a
two-bracket schedule. For 2025 the top rate is **3.9%**, applying above roughly
$4,500 of taxable income for both single and MFJ; the MFJ threshold is not 2×
single because Arkansas brackets apply per return at the same thresholds.

## Simplifications / not modeled
- 50% long-term capital-gains exclusion not modeled (`capitalGainsAsOrdinary: true` overstates tax on LTCG).
- Public/military pension full exemption approximated by the $6,000 cap (conservative).
- Arkansas's low-income tax tables and bracket-adjustment ("bracket relief") for incomes near thresholds simplified to the standard two-bracket schedule.
- $29/$58 personal tax credits not modeled.

## Citations
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — 2025 two-bracket schedule (2.0% / 3.9% above $4,500), standard deduction $2,410/$4,820.
- Kiplinger / SmartAsset / legalclarity — SS exempt; $6,000 pension+IRA exclusion per person; public pensions fully exempt; 50% LTCG exclusion.
