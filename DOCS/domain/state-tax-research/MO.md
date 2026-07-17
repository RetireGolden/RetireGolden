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
$25,000 (single) / $32,000 (MFJ). Because the common private-retiree case is the
$6,000 cap, mapped to `retirement: { kind: "capped", capPerPerson: 6000 }`, no
age gate.

## Simplifications / not modeled
- Public-pension deduction (~$48,000, 2025) not modeled — `capPerPerson: 6000`
  overstates tax for government retirees.
- The $6,000 private exclusion is **income-phased-out** above $25k/$32k MAGI;
  not modeled (the cap is generous for higher-income retirees who would actually
  get less).
- For tax years beginning 2026, Missouri grants a **full** exemption for private
  retirement income (removing the cap/limits) — at the 2026 transcription point
  this likely becomes `kind: "full"`; flag for re-check.
- Brackets are inflation-adjusted annually; 2025 thresholds held forward.

## Citations
- https://dor.mo.gov/taxation/individual/tax-types/income/year-changes/ — 2025 bracket schedule (2%–4.7%, top over $9,191; first $1,313 untaxed); standard deduction $15,750 / $31,500.
- https://callnewspapers.com/social-security-benefits-exempt-from-state-income-tax-in-missouri/ — SS fully exempt all ages from 2024 (SB 190).
- https://smartasset.com/retirement/missouri-retirement-taxes — public-pension deduction (~$48k) vs $6,000 private exclusion with $25k/$32k MAGI phase-out; private IRA/401(k) taxable.
- https://www.billtrack50.com/billdetail/1756255 — 2026 full exemption for privately funded retirement income (future change).
