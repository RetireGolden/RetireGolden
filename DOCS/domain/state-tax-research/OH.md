# Ohio (OH) — state income tax for retirement planning

Tax year: 2026. Researched 2026-06-13; TY2026 nonbusiness schedule corrected 2026-09-08.

> **2026 update:** Ohio Rev. Code §5747.02(A)(3) for taxable years beginning in 2026
> imposes no tax when the individual nonbusiness balance B is at most $26,050, and
> §5747.02(A)(3)(c) sets tax at **$332.00 plus 2.75%** of the amount in excess of
> $26,050. H.B. 96 suspended inflation indexing for TY2025 and TY2026, so the
> threshold remains $26,050. The enacted LSC H.B. 96 tax Greenbook confirms a single
> bracket for TY2026. Division (A)(3) supplies one schedule for individuals without a
> filing-status branch; single and married filing jointly share the breakpoint, base,
> and rate. The Ohio Department of Taxation 2026 IT 1040 ES estimated-payment worksheet
> still prints the prior-year $342 / 2.75% / 3.125% table and conflicts with enacted
> law; that administrative artifact is disclosed but does not control the pack.

## Summary
- Broad individual income tax: **yes** (0% to $26,050, then $332 + 2.75% above)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): generally taxed; only small retirement-income credit (≤$200), no broad exclusion

## Proposed StateTaxParams (2026)
- code: "OH"
- name: "Ohio"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single:
  - { lowerBound: 0, ratePct: 0 }
  - { lowerBound: 26050, ratePct: 2.75, baseTax: 332 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 0 }
  - { lowerBound: 26050, ratePct: 2.75, baseTax: 332 }
- retirement: { kind: "none" }

## Nonbusiness tax (modeled)
Ohio gross nonbusiness tax before credits is measured by balance B — Ohio adjusted
gross income minus taxable business income and applicable taxpayer, spouse, and
dependent exemptions. The engine models B as ordinary income (plus capital gains
where applicable) with no standard deduction, no personal exemptions, and no
business-income split. At B ≤ $26,050 tax is $0; above that, tax is $332 plus
2.75% of (B − $26,050). This is pre-credit liability only.

## Retirement-income detail
Ohio has **no standard deduction**; it uses personal/dependent exemptions instead
(not modeled). Social Security benefits are **fully exempt** (not part of Ohio
AGI). Private and public pensions and IRA/401(k) distributions are **taxable**;
Ohio offers only a small **Retirement Income Credit** (up to $200, for retirement
income $500–$8,000, phased out above $100,000 MAGI) and a senior credit — too
small to model as an exclusion, so `retirement: { kind: "none" }`.

## Simplifications / not modeled
- **No standard deduction or personal exemptions** — Ohio uses personal exemptions
  ($2,400–$2,900 per exemption, income-tiered); not modeled. The 0% band to
  $26,050 partly compensates for the missing exemption modeling.
- **Retirement Income Credit** (≤$200), **senior citizen credit**, and **joint-filer
  credit** not modeled; `none` slightly overstates tax for retirees who qualify.
- **Military retirement pay** is fully exempt; not modeled.
- **Municipal (city) income taxes** (commonly ~1.5%–3%) are significant in Ohio but
  generally do not apply to pension/SS/IRA retirement income — not modeled.
- **Taxable business income** under §5747.02(A)(4) and exemptions under
  §5747.025 that reduce B are not modeled.
- Capital gains taxed as ordinary (no Ohio preference) — matches actual treatment.

## Citations
- https://codes.ohio.gov/ohio-revised-code/section-5747.02 — §5747.02(A)(3) zero
  bracket and §5747.02(A)(3)(c) $332 + 2.75% for TY2026+.
- https://www.lsc.ohio.gov/assets/legislation/136/hb96/en0/files/hb96-tax-greenbook-as-enacted-136th-general-assembly.pdf —
  enacted H.B. 96 single bracket and suspended indexing for TY2025–TY2026.
- https://dam.assets.ohio.gov/image/upload/v1768492539/tax.ohio.gov/forms/ohio_individual/individual/2026/ites-instructions-fi.pdf —
  2026 IT 1040 ES worksheet (conflicting prior-year table; disclosed only).
- https://tax.ohio.gov/individual/file-now/ohio-tax-credits-and-their-required-documentation — Retirement Income Credit (≤$200) and senior credit.
- https://www.edelmanfinancialengines.com/education/tax/ohio-tax-social-security/ — Social Security exempt from Ohio income tax.
