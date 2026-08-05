# Arizona (AZ) — state income tax for retirement planning

Tax year: **2026** for the rate, which is a flat statutory figure with no
sunset; **2025** for the standard deduction, because Arizona has published no
2026 amount. Researched 2026-08-05 against primary sources only — the Arizona
Revised Statutes via `azleg.gov` and the Department of Revenue via `azdor.gov`.
The previous version of this file was sourced to the Tax Foundation, SmartAsset
and annuityexpertadvice; it carried a standard deduction Arizona never used, a
military exemption repealed in 2018, and no mention of the exclusion that
matters most to an Arizona retiree.

## Summary
- Broad individual income tax: **yes** — flat **2.5%** of Arizona taxable
  income (A.R.S. §43-1011(A)(9)), operative since tax year **2023**, not 2025
- Base: **federal adjusted gross income** (§43-1001(2)), modified by §§43-1021
  and 43-1022, less the §43-1023 exemptions and the standard or itemized
  deduction
- Taxes Social Security benefits: **no** — the whole IRC §86 amount is
  subtracted, along with railroad retirement (§43-1022(10))
- Capital gains: **preferential** — 25% of net long-term gain is subtracted, but
  **only** gain from an asset acquired after December 31, 2011, and none at all
  where the acquisition date cannot be verified (§43-1022(22)(c))
- Private pensions, annuities and traditional IRA/401(k) distributions: **fully
  taxable**. §43-1022's list of subtractions is closed and no paragraph reaches
  them.
- **Uniformed-services retired or retainer pay: fully excluded** since tax year
  **2021** (§43-1022(26)(c)) — uncapped, un-age-tested, and available to a
  surviving spouse
- Federal, Arizona state and Arizona local government pensions: **$2,500 per
  taxpayer** (§43-1022(2)). A public pension from another state qualifies for
  nothing.
- Age 65 or older: a **$2,100 per-person exemption** (§43-1023(E)), taken above
  the deduction line. It is **not** an addition to the standard deduction and
  **nothing indexes it**.
- The standard deduction is **Arizona's own** amount (§43-1041(A)) adjusted for
  inflation "in the same manner" as the federal one (§43-1041(H)) — a borrowed
  method, not an incorporated amount
- Arizona does not conform to any IRC change enacted after January 1, 2025
  (§43-105(A))

## Proposed StateTaxParams (2026)
- code: "AZ"
- name: "Arizona"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true — Arizona has no preferential *rate*, only a
  partial subtraction, so the share that reaches the base is taxed at the flat
  2.5% like everything else
- capitalGainsTaxablePct: 75 (approximate — see Simplifications)
- standardDeduction: { single: 15750, marriedFilingJointly: 31500 } and **no**
  `standardDeductionConformity` tag. These are Arizona's published 2025 amounts,
  the latest it has published. The tag would assert a legal link that
  §43-1041 does not create, and it would additionally attach the **federal**
  age-65 additional standard deduction under IRC 63(c)(3) — relief Arizona does
  not grant in that form at all.
- brackets.single: [{ lowerBound: 0, ratePct: 2.5 }]
- brackets.marriedFilingJointly: [{ lowerBound: 0, ratePct: 2.5 }]
- retirement (private): { kind: "none" }
- retirement (public): { kind: "full" } — carried in the pack's
  `PUBLIC_PENSION_OVERRIDES` map, driven by the uniformed-services exclusion.
  Being in that map also leaves `retirementRuleShared` false, which is right for
  Arizona: §43-1022's paragraphs are independent, and the private bucket must
  keep getting nothing.

## Rate structure and its base
§43-1011(A)(9): "the tax is 2.5% of taxable income". The paragraph is
conditioned on a revenue notice under §43-243(B)(2); §43-243(D) then directs the
department to use paragraph 9 from the following taxable year, and §43-243(E)
makes each notice a one-time event, so the rate cannot ratchet back. AZDOR
announced the flat rate for tax year 2023 and the X and Y tax tables became
obsolete; 2025 Form 140 line 46 still reads "Multiply line 45 by 2.5% (.025)".

Arizona taxable income = federal AGI (§43-1001(2)) ± the §§43-1021/43-1022
modifications = Arizona adjusted gross income, less the §43-1023 exemptions and
the §43-1041 standard deduction (or §43-1042 itemized deductions).

## Standard deduction — read this before touching the pack
§43-1041(A) sets **Arizona's own** amounts: $12,200 single or married filing
separately, $18,350 head of household, $24,400 joint. §43-1041(H) then directs
the department to adjust those "for inflation in the same manner in which the
federal basic standard deduction is adjusted for inflation pursuant to section
63 of the internal revenue code." That is a borrowed *method*, not an
incorporated *amount*: nothing in Title 43 says the Arizona deduction equals the
federal one, and §43-105(A) expressly excludes from Arizona's conformity any
change to the Code enacted after January 1, 2025.

In practice AZDOR has published exactly the federal basic standard deduction in
every year checked — $14,600 / $29,200 / $21,900 for 2024 and $15,750 / $31,500 /
$23,625 for 2025, the post-OBBBA federal figures, even though a literal
application of (H) to (A)'s base would have produced roughly $15,000 / $30,000
and even though §43-105(A) should have decoupled them. **That identity is
administrative practice, not a rule of Arizona law**, which is why the pack
carries Arizona's published number untagged rather than the federal one tagged.
Re-verify each autumn against the Form 140 booklet; Arizona had published no
2026 figure as of 2026-08-05.

## Retirement-income detail
Social Security and railroad retirement are subtracted in full (§43-1022(10);
Form 140 line 30), covering tier 1, tier 2, railroad disability, unemployment
and sickness payments.

Uniformed-services retired or retainer pay is subtracted in full
(§43-1022(26)(c), from tax year 2021; $3,500 for 2019–2020 and $2,500 before
that). Each spouse on a joint return may subtract their own, and the department
extends it to a surviving spouse receiving payments from the uniformed services.

Federal, Arizona state and Arizona local government pensions are subtracted up
to $2,500 per taxpayer (§43-1022(2)). The list is closed: the federal
civil-service and foreign-service systems and any other retirement system
established by federal law, ASRS, CORP, PSPRS, EORP, the ABOR and
community-college optional programs, and county, city or town plans. **Pensions
from other states' public systems do not qualify.**

Private pensions, annuities and traditional IRA/401(k) distributions get no
exclusion of any kind.

## Capital gains
§43-1022(22) subtracts a share of net long-term capital gain, but only gain
"derived from an investment in an asset acquired after December 31, 2011", and
(c) sets that share at twenty-five percent from tax year 2015. A transferee by
gift or at death takes the transferor's acquisition date, and where the
acquisition date cannot be verified no subtraction is allowed at all.

## Simplifications / not modeled
- **The $2,500 civil-service subtraction is folded into `retirementPublic:
  full`.** The bucket is one flag and it is set for the sake of the
  uniformed-services exclusion, so a federal, Arizona state or Arizona local
  government pension is exempted outright where Arizona exempts $2,500 of it.
  **Understates tax** — the dangerous direction, and the only one of these that
  runs that way for a common household. Registered as
  `ars-43-1022-2-government-pension-exclusion`. If the engine ever splits
  uniformed-services from civil-service retirement, Arizona is a state that
  needs the split.
- **`capitalGainsTaxablePct: 75` ignores the post-2011 acquisition condition**
  and the "cannot be verified ⇒ no subtraction" rule. For a position bought
  before 2012 the correct figure is 100. **Understates tax** on exactly the
  households most likely to hold one. Registered as
  `ars-43-1022-22-long-term-capital-gain-subtraction`.
- **The $2,100 age-65 exemption is not modeled.** The pack's only age-65 field
  carries the FEDERAL addition and attaches only to a state whose deduction is
  the federal one, which Arizona's is not. **Overstates tax** by 2.5% of $2,100
  per person aged 65 or over — about $53 a year each. Registered as
  `ars-43-1023-e-age-65-exemption`. Modelling it through the conformity tag was
  the alternative and is worse: that path imports a different figure under a
  different statute, indexed every year while Arizona's $2,100 is frozen, so the
  gap widens in every projected year.
- **The 2026 deduction is Arizona's 2025 figure**, because Arizona has published
  no 2026 amount. §43-1041(H) will raise it, so the frozen figure **overstates
  tax** slightly and by more in each projected year. This is the pack's general
  convention for a state figure, not an Arizona-specific defect, and it is why
  Arizona has to be re-read each autumn.
- **Blind exemption** ($1,500, §43-1023(A)): not modeled. **Overstates tax.**
- **Charitable standard-deduction increase** (§43-1041(I) — 34% of qualified
  charitable contributions for 2025, and the percentage is itself indexed): not
  modeled. **Overstates tax.**
- **Dependent tax credit** ($100 / $25) and the family income tax credit:
  credits are outside the pack's scope.
- **Small business income tax election** (Form 140-SBI, §43-1022(28)): not
  modeled. A retiree with Schedule C or E income could in principle elect it.
- **Not investigated**, and flagged so nobody assumes otherwise: part-year and
  nonresident proration (Forms 140PY, 140NR), the credit for increased excise
  taxes, the property-tax credit on Form 140PTC, whether any Arizona
  municipality levies an income tax (Arizona appears to have none, but the
  negative was not verified), and the §43-1042 itemized-deduction path including
  its full-medical-expense rule.

## Citations (primary only)
- rate — A.R.S. §43-1011(A)(9), **https://www.azleg.gov/ars/43/01011.01.htm**.
  Note the URL: see the host notes below. The trigger is §43-243(D),
  https://www.azleg.gov/ars/43/00243.htm, and the operative confirmation is 2025
  Form 140 line 46,
  https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140Booklet.pdf.
  The rate was dated to tax year 2023 from the 2023 Form 140 booklet,
  https://azdor.gov/sites/default/files/2023-12/FORMS_INDIVIDUAL_2023_140Booklet.pdf.
- standard deduction — §43-1041(A) and (H), https://www.azleg.gov/ars/43/01041.htm;
  conformity date §43-105(A), https://www.azleg.gov/ars/43/00105.htm; the
  published amounts are AZDOR's, 2025 Form 140A line 18 (booklet URL above).
- Social Security and railroad retirement — §43-1022(10),
  https://www.azleg.gov/ars/43/01022.htm; 2025 Form 140 instructions, Line 30.
- uniformed-services retirement — §43-1022(26) (same URL); 2025 Form 140
  instructions, Line 29b.
- government pensions — §43-1022(2) and (2)(b) (same URL); 2025 Form 140
  instructions, Line 29a, including the note that out-of-state public pensions
  do not qualify.
- no private-retirement exclusion — the closed enumeration opening §43-1022
  (same URL), and Form 140 line 29a, whose only pension exclusion is the
  government one.
- capital gains — §43-1022(22) and (22)(c) (same URL); 2025 Form 140
  instructions, Line 24.
- age 65 — §43-1023(E), https://www.azleg.gov/ars/43/01023.htm; §43-1022(1),
  which is how it enters the return; 2025 Form 140 line 38.

### Host notes for whoever refreshes this
- **§43-1011 exists in two published versions**, because Laws 2021 chapters 411
  and 412 both amended it and were never blended. `/ars/43/01011.htm` — the URL
  any reasonable citation would use — is the chapter 411 version, whose rate
  table stops at the 2019–2021 graduated schedule and **never prints paragraph
  9**. The 2.5% flat rate is only on `/ars/43/01011.01.htm`. The `.01` is a
  versioning artifact in the filename; there is no A.R.S. §43-1011.01. A
  conformance check on host and status alone would accept the wrong page for the
  single most important Arizona claim in the pack.
- `azleg.gov` and `www.azleg.gov` both serve directly with no redirect. AZDOR is
  the mirror image: `https://www.azdor.gov/...` answers **301** to the bare
  `azdor.gov`, which is the host every document URL carries.
- AZDOR document paths are not stable across years — the 2023 booklet is under
  `/sites/default/files/2023-12/` and the 2024 and 2025 booklets under
  `/sites/default/files/document/`. Start a refresh from the form landing page,
  `https://azdor.gov/forms/individual/form-140-arizona-resident-personal-income-tax-booklet`.
- azleg publishes no session-law history for most of Title 43; only §43-1011's
  two versions carry a source note. Effective years elsewhere rest on each
  statute's own "for taxable years beginning from and after" language.
- The 2025 booklet's "What's New" carries the heading "2025 New Tax Rate of 2.5%
  for All Income Levels and Filing Status" — the 2023 heading with the year
  swapped. The rate did not change in 2025. Do not cite it for an effective date.

## Cross-checks (not authority)
None. Every figure above was read out of the Arizona Revised Statutes or an
AZDOR form.

The citations this file previously carried —
`taxfoundation.org/data/all/state/state-income-tax-rates/`, SmartAsset and
annuityexpertadvice — are recorded here as the provenance of the errors rather
than as cross-checks. Between them they supplied a $15,000 / $30,000 "Arizona"
standard deduction that is the pre-OBBBA federal figure Arizona did not use, a
$2,500 military-retirement cap that has not been the law since tax year 2018,
and no mention of the §43-1023(E) age-65 exemption. The first host is in the
`SECONDARY_AGGREGATORS` set the conformance suite holds permanently
inadmissible.

## Registered rules
Every lever above is registered in
`packages/engine/src/rules/taxRuleRegistry.ts` under `jurisdiction: 'state:AZ'`:

| Rule id | Classification |
|---|---|
| `ars-43-1011-a-9-flat-rate` | settled |
| `ars-43-1041-standard-deduction-published-amount` | settled |
| `ars-43-1022-10-social-security-railroad-exclusion` | settled |
| `ars-43-1022-26-uniformed-services-exclusion` | settled |
| `ars-43-1022-no-private-retirement-exclusion` | settled |
| `ars-43-1022-2-government-pension-exclusion` | approximated (understates tax) |
| `ars-43-1022-22-long-term-capital-gain-subtraction` | approximated (understates tax) |
| `ars-43-1023-e-age-65-exemption` | approximated (overstates tax) |
