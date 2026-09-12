# Missouri (MO) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

> **2026 update (staleness sweep, 2026-07-16):** HB 594 (signed 2025-07-10) makes Missouri the first
> state to fully exempt **individual capital gains** (short- and long-term, 100% deduction of federally
> reported gains) effective tax year 2025 — the pack now sets `capitalGainsAsOrdinary: false`. The
> standard deduction (federal-mirrored) tracks the federal pack's 2026 figure ($16,100/$32,200). Top
> rate stays 4.7% for 2026; a corporate trigger fires if the individual top rate reaches 4.5%. The
> 2026 indexed bracket thresholds are $1,348 steps ($1,348 … $9,436; TF 2026 tables, corrected in the
> PR #23 review, 2026-07-17). Source (primary): MO DOR news release,
> https://dor.mo.gov/news/newsitem/uuid/15044650-59dd-48f4-975a-01988d485255 (accessed 2026-07-16).

## Summary
- Broad individual income tax: **yes** (graduated, 2%–4.7%; first ~$1,313 untaxed)
- Taxes Social Security benefits: no (fully exempt for all ages as of 2024, SB 190)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): private pension/IRA/401(k) exclusion only $6,000 per person (income-limited); public pensions get a larger separate deduction

## Proposed StateTaxParams (2025)
- code: "MO"
- name: "Missouri"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 15750, marriedFilingJointly: 31500 }
- brackets.single:
  - { lowerBound: 0, ratePct: 0.0 }
  - { lowerBound: 1313, ratePct: 2.0 }
  - { lowerBound: 2626, ratePct: 2.5 }
  - { lowerBound: 3939, ratePct: 3.0 }
  - { lowerBound: 5252, ratePct: 3.5 }
  - { lowerBound: 6565, ratePct: 4.0 }
  - { lowerBound: 7878, ratePct: 4.5 }
  - { lowerBound: 9191, ratePct: 4.7 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 0.0 }
  - { lowerBound: 1313, ratePct: 2.0 }
  - { lowerBound: 2626, ratePct: 2.5 }
  - { lowerBound: 3939, ratePct: 3.0 }
  - { lowerBound: 5252, ratePct: 3.5 }
  - { lowerBound: 6565, ratePct: 4.0 }
  - { lowerBound: 7878, ratePct: 4.5 }
  - { lowerBound: 9191, ratePct: 4.7 }
- retirement: { kind: "capped", capPerPerson: 6000 }

## Retirement-income detail
Missouri taxes income on a graduated 2%–4.7% schedule (2025); the first ~$1,313
of taxable income is untaxed (modeled as a 0% bracket). Missouri's brackets are
**not** doubled for MFJ — the same thresholds apply to both filing statuses
(Missouri taxable income is computed per return), so single and MFJ bracket
arrays are identical. The standard deduction mirrors the federal amount
($15,750 single / $31,500 MFJ for 2025).

Social Security is **fully exempt for all ages** as of tax year 2024 (SB 190
removed the prior income limits) → `taxesSocialSecurity: false`. **Public**
pensions get a sizable deduction (up to ~$48,000 in 2025), but **private**
pensions, IRAs, and 401(k) distributions qualify only for the smaller private
retirement exclusion of up to **$6,000 per person**, phased out above MAGI of
$25,000 (single) / $32,000 (MFJ). RSMo § 143.124(1) allows the deduction for
each taxpayer on the combined return; the pack's `capPerPerson: 6000` uses
that person-level unit. Current § 143.124(3) and (4) retain the $6,000 cap
and income phaseout for TY2026; this is not a full private-retirement exemption.
The pack models this as `retirement: { kind: "capped", capPerPerson: 6000 }`,
with no age gate.

## Simplifications / not modeled
- Characterized retirement facts distinguish Missouri public, private, military, and railroad treatment. The pack-level retirement cap remains a coarse fallback when those identities and household-income facts are unavailable.
  overstates tax for government retirees.
- The $6,000 private exclusion is **income-phased-out** above $25k/$32k MAGI;
  not modeled (the cap is generous for higher-income retirees who would actually
  get less).
- Brackets are inflation-adjusted annually; 2025 thresholds held forward.

## Citations
- https://dor.mo.gov/taxation/individual/tax-types/income/year-changes/ — 2025 bracket schedule (2%–4.7%, top over $9,191; first $1,313 untaxed); standard deduction $15,750 / $31,500.
- https://callnewspapers.com/social-security-benefits-exempt-from-state-income-tax-in-missouri/ — SS fully exempt all ages from 2024 (SB 190).
- https://smartasset.com/retirement/missouri-retirement-taxes — public-pension deduction (~$48k) vs $6,000 private exclusion with $25k/$32k MAGI phase-out; private IRA/401(k) taxable.
- https://revisor.mo.gov/main/OneSection.aspx?section=143.124 — current private-retirement deduction, $6,000 cap, and income limits.

## Missouri separates public, private, military and railroad retirement (verified 2026-09-12)

TY2026 public retirement is limited to the $48,967 maximum Social Security benefit less the applicable Social Security subtraction, without the pre-2024 AGI gate. Private retirement is capped at $6,000 per taxpayer and reduced by excess Missouri AGI above $25,000 single/HOH/QSS, $32,000 joint or $16,000 MFS. Military and qualifying Railroad Retirement benefits have separate full-subtraction treatment. Survivor Benefit Plan annuities belong to public pension treatment, not the military subtraction. Characterized source, owner and income facts are required.

Registered as `mo-retirement-income-deduction`. Authority: [Missouri DOR pension FAQ, private maximum and TY2026 public ceiling](https://dor.mo.gov/faq/taxation/individual/pension.html), [RSMo 143.124.5](https://revisor.mo.gov/main/OneSection.aspx?section=143.124).
