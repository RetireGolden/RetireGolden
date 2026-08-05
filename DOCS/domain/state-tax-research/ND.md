# North Dakota (ND) — state income tax for retirement planning

Tax year: **2026** (the commissioner's published 2026 rate schedules; 2025
figures are shown alongside where they are what a reader would otherwise
assume). Researched 2026-08-05 against primary sources only — the North Dakota
Century Code and the enrolled session bills via `ndlegis.gov`, and the Office of
State Tax Commissioner via `www.tax.nd.gov`. The previous version of this file
was sourced to the Tax Foundation, Valur and AARP, and three of its figures were
wrong; nothing from it survives except by re-derivation.

## Summary
- Broad individual income tax: **yes** — graduated 0% / 1.95% / 2.50%, imposed
  on *federal taxable income* as adjusted (N.D.C.C. §57-38-30.3(1), (2))
- Taxes Social Security benefits: **no** — subtracted in full, with no
  adjusted-gross-income test, no age condition and no cap (§57-38-30.3(2)(s)).
  The $50,000 / $100,000 thresholds enacted in 2019 were repealed by S.B. 2351
  of the November 2021 special session, for taxable years beginning after 2020.
- Long-term capital gains: **preferential** — 40% of net long-term gain is
  excluded, so 60% is taxed at ordinary North Dakota rates
  (§57-38-30.3(2)(d)(1)). 40% of qualified dividends is likewise excluded
  ((2)(d)(2)) and is **not modeled** — see Simplifications.
- Private pensions, annuities, traditional IRA/401(k): **fully taxable**, with
  no exclusion, cap or age test of any kind
- Military retirement pay: **fully excluded** (§57-38-30.3(2)(r))
- Retired peace-officer benefits, at 20 years' service or a medical retirement:
  **fully excluded** (§57-38-30.3(2)(t))
- Bracket thresholds are **republished every year** by the tax commissioner
  under §57-38-30.3(1)(g). Never carry a prior year's thresholds forward.

## Proposed StateTaxParams (2026)
- code: "ND"
- name: "North Dakota"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true — North Dakota has no preferential *rate*, only a
  partial exclusion, so the share that reaches the base is stacked with ordinary
  income
- capitalGainsTaxablePct: 60
- standardDeduction: { single: 16100, marriedFilingJointly: 32200 } with
  `standardDeductionConformity: 'federal'`. **This is not a North Dakota
  figure.** North Dakota publishes no standard deduction of its own; the field
  is the engine's gross → federal-taxable-income conversion, and the amount is
  the federal standard deduction for the pack year. It has to be cited to a
  federal source, never to a North Dakota one.
- brackets.single (the commissioner's published 2026 schedule):
  - { lowerBound: 0, ratePct: 0 }
  - { lowerBound: 49575, ratePct: 1.95 }
  - { lowerBound: 250400, ratePct: 2.5 }
- brackets.marriedFilingJointly (published 2026 schedule):
  - { lowerBound: 0, ratePct: 0 }
  - { lowerBound: 82800, ratePct: 1.95 }
  - { lowerBound: 304850, ratePct: 2.5 }
- retirement (private): { kind: "none" }
- retirement (public): { kind: "full" } — carried in the pack's
  `PUBLIC_PENSION_OVERRIDES` map, which also stops the public rule being copied
  onto the private bucket

## Rate structure and its base
§57-38-30.3(1) imposes the tax on "North Dakota taxable income", which
§57-38-30.3(2) defines as "the federal taxable income of an individual, estate,
or trust as computed under the Internal Revenue Code of 1986, as amended,
adjusted as follows". Form ND-1 line 1b is literally "Federal taxable income
from Form 1040 or 1040-SR, line 15", and the return reaches North Dakota taxable
income at line 18 by subtracting lines 5 through 16. There is no deduction line
on the return, because there is no North Dakota deduction.

The schedules printed in the Century Code are the 2023 amounts enacted by
H.B. 1158 — single $0 / $44,725 / $225,975, joint $0 / $74,750 / $275,100 —
effective for taxable years beginning after December 31, 2022. §57-38-30.3(1)(g)
then directs the tax commissioner to prescribe cost-of-living-adjusted schedules
that apply "in lieu of" those, holding each rate fixed. The published schedules
are what govern:

| Filing status | Year | 0% up to | 1.95% up to | 2.50% over |
|---|---|---|---|---|
| Single | 2025 | 48,475 | 244,825 | 244,825 |
| Single | 2026 | 49,575 | 250,400 | 250,400 |
| MFJ / QSS | 2025 | 80,975 | 298,075 | 298,075 |
| MFJ / QSS | 2026 | 82,800 | 304,850 | 304,850 |
| MFS | 2026 | 41,400 | 152,425 | 152,425 |
| Head of household | 2026 | 66,400 | 277,600 | 277,600 |

Estates and trusts use a separate, much tighter schedule — 0% to $3,000, 1.95%
to $10,750, 2.50% above (§57-38-30.3(1)(e), printed unindexed).

## Retirement-income detail
**Social Security** is subtracted in full: "Reduced by the amount of social
security benefits included in a taxpayer's federal adjusted gross income under
section 86 of the Internal Revenue Code" (§57-38-30.3(2)(s)). The exclusion was
created in 2019 by H.B. 1174 *with* adjusted-gross-income thresholds of $50,000,
or $100,000 married filing jointly. S.B. 2351 of the November 2021 special
session struck them, effective for taxable years beginning after December 31,
2020. A summary written before that date describes a phase-out North Dakota no
longer has. (The 2021 *regular* session's two Social Security bills, H.B. 1129
and H.B. 1237, both failed; the change came from the special session.)

**Military retirement pay** is subtracted in full under §57-38-30.3(2)(r), from
2019 H.B. 1053, effective for taxable years beginning after December 31, 2018,
and the subtraction reaches benefits paid to a surviving spouse. The 2025 Form
ND-1 instructions extend it to retirement benefits for federal civil-service
employment as a dual-status military technician under Title 32 or Title 10.

**Retired peace-officer benefits** are subtracted in full for an officer with at
least twenty years' combined service or a medical retirement
(§57-38-30.3(2)(t), from 2023 S.B. 2147, effective for taxable years beginning
after December 31, 2022).

Those two are the only retirement subtractions the statute grants. **Private
pensions, annuities and traditional IRA/401(k) distributions get no exclusion at
all** — no age test, no cap, no tier. The subtraction list is closed
(§57-38-30.3(2)(a) through (t)) and Form ND-1's subtraction lines 5 through 16
enumerate the same set: US obligations, the net long-term capital gain
exclusion, Native American exempt income, US Railroad Retirement Board benefits,
the licensed peace-officer retirement exclusion, Servicemembers Civil Relief Act
income, the military pay exclusion, ND College SAVE, the qualified dividend
exclusion, the military retirement benefit exclusion, the Social Security
exclusion, and Schedule ND-1SA. Neither list contains a general retirement item.

**US Railroad Retirement Board** retirement benefits are subtracted (Form ND-1
line 8), resting on §57-38-30.3(2)(a)'s exclusion for income exempt from state
income tax under federal statute.

A note on lettering, because the citations otherwise look inconsistent:
H.B. 1031 of the 69th Assembly (2025) relettered subsection 2, moving military
retirement to (2)(r), Social Security to (2)(s) and retired law enforcement to
(2)(t). The enrolled bills above amended those provisions under their former
letters.

## Simplifications / not modeled
- **Qualified dividends**: North Dakota excludes 40% (§57-38-30.3(2)(d)(2)), or
  30% of all dividends where they were not taxed federally at a preferential
  rate. `StateTaxParams` has one included-share field and it governs capital
  gains, so qualified dividends enter the North Dakota base in full.
  **Overstates tax.** Registered as
  `ndcc-57-38-30-3-2-d-2-qualified-dividend-exclusion`.
- **Public pensions other than military and peace-officer**: the pack's public
  bucket is a single flag, so `{ kind: 'full' }` — set for (2)(r) and (2)(t) —
  also exempts CSRS, FERS, state PERS and teachers' pensions, which North Dakota
  taxes in full. The same flag is why the twenty-year service condition in
  (2)(t) is not tested. **Understates tax**, the dangerous direction, and the
  only one of these gaps that does. Registered as
  `ndcc-57-38-30-3-2-closed-subtraction-list`.
- **US Railroad Retirement Board benefits**: not modeled; the engine has no
  input for them. Narrow population, overstates tax for a railroad retiree.
- **Marriage penalty credit** (§57-38-01.28) and the **credit for tax paid to
  another state** (§57-38-30.3(4)): credits are outside the pack's scope.
- **Estate and trust schedule** (§57-38-30.3(1)(e)) and **farm income
  averaging** (§57-38-30.3(9)): not modeled.
- **Married filing separately and head of household** schedules are published
  but not carried; the pack holds `single` and `marriedFilingJointly` for every
  state.
- **Bracket thresholds are indexed by statute.** North Dakota belongs on the
  same "re-verify every autumn" list as the legislated-ramp states: a pack that
  holds a prior year's thresholds forward over-taxes at the margin, and the
  correct figures are published by the department each year.
- **Not investigated**, and flagged so nobody assumes otherwise: local or city
  income taxes (North Dakota appears to have none, but the negative was not
  verified), part-year and nonresident proration under §57-38-30.3(1)(f), the
  Minnesota and Montana reciprocity agreements referenced on Form ND-1 item F,
  and the additions on Schedule ND-1SA.

## Citations (primary only)
- brackets — https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/28709-form-nd-1es-2026.pdf
  — "2026 Forms ND-1 and ND-EZ Tax Rate Schedules": single 0 / 49,575 / 250,400,
  joint 0 / 82,800 / 304,850. The indexation mandate that makes this schedule
  rather than the Century Code's operative is §57-38-30.3(1)(g),
  https://ndlegis.gov/cencode/t57c38.pdf. The 2023 statutory schedule and its
  effective date are in 2023 H.B. 1158 (enrolled), §§ 4, 8,
  https://ndlegis.gov/assembly/68-2023/regular/documents/23-0351-06000.pdf.
- standard deduction — **NOT SOURCED to North Dakota, and cannot be.** North
  Dakota publishes no standard deduction; the pack's figure is the federal one
  under IRC 63(c), carried because the state's base is federal taxable income
  (§57-38-30.3(2), https://ndlegis.gov/cencode/t57c38.pdf). It must be cited to
  the federal pack's own authority. A North Dakota publication narrating the
  federal figure is not authority for it.
- Social Security — https://ndlegis.gov/cencode/t57c38.pdf — §57-38-30.3(2)(s)
  subtracts the whole federally taxable amount with no condition. Threshold
  repeal: 2021 S.B. 2351 (special session, enrolled), §§ 2, 3,
  https://ndlegis.gov/assembly/67-2021/special/documents/21-1097-02000.pdf.
  Original enactment with thresholds: 2019 H.B. 1174 (enrolled),
  https://ndlegis.gov/assembly/66-2019/documents/19-0115-05000.pdf.
- capital gains — https://ndlegis.gov/cencode/t57c38.pdf — §57-38-30.3(2)(d)(1)
  reduces the base by forty percent of net long-term gain over net short-term
  loss. Operational confirmation: the "Worksheet For Net Long-Term Capital Gain
  Exclusion (Form ND-1, line 6)" line 8, "Multiply line 7 by 40% (.40)",
  https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/2025-individual-income-tax-booklet.pdf.
- qualified dividends — https://ndlegis.gov/cencode/t57c38.pdf —
  §57-38-30.3(2)(d)(2); Form ND-1 line 13 instruction in the booklet above.
- retirement exclusion (military) — https://ndlegis.gov/cencode/t57c38.pdf —
  §57-38-30.3(2)(r). Enactment: 2019 H.B. 1053 (enrolled), § 2,
  https://ndlegis.gov/assembly/66-2019/regular/documents/19-0357-02000.pdf.
- retirement exclusion (peace officer) — https://ndlegis.gov/cencode/t57c38.pdf
  — §57-38-30.3(2)(t). Enactment: 2023 S.B. 2147 (enrolled), § 2,
  https://ndlegis.gov/assembly/68-2023/regular/documents/23-0019-03000.pdf.
- retirement exclusion (private pensions, IRA, 401(k)) — none exists. The
  closed subtraction list is §57-38-30.3(2)(a) through (t),
  https://ndlegis.gov/cencode/t57c38.pdf; the return's subtraction lines are
  Form ND-1 lines 5 through 16,
  https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/28702-form-nd-1-2025.pdf.

## Cross-checks (not authority)
None. Every figure above was read out of the Century Code, an enrolled bill, or
a department form; nothing was taken from an aggregator, and no aggregator was
consulted to find one.

The three citations this file previously carried —
`taxfoundation.org/data/all/state/state-income-tax-rates/`,
`learn.valur.com/north-dakota-capital-gains-tax/` and
`aarp.org/states/north-dakota/state-tax-guide/` — are recorded here as the
provenance of the errors rather than as cross-checks. Between them they supplied
a $15,000 / $30,000 "North Dakota" standard deduction that is a federal figure
North Dakota does not publish, 2025 brackets presented as current for a 2026
pack, and no mention of either uniformed-retirement exclusion. The first two
hosts are in the `SECONDARY_AGGREGATORS` set the conformance suite holds
permanently inadmissible.

## Registered rules
Every lever above except the standard deduction and the two unmodeled items is
registered in `packages/engine/src/rules/taxRuleRegistry.ts` under
`jurisdiction: 'state:ND'`:

| Rule id | Classification |
|---|---|
| `ndcc-57-38-30-3-federal-taxable-income-base` | settled |
| `ndcc-57-38-30-3-1-g-commissioner-indexed-rate-schedule` | settled |
| `ndcc-57-38-30-3-2-s-social-security-subtraction` | settled |
| `ndcc-57-38-30-3-2-d-long-term-gain-exclusion` | settled |
| `ndcc-57-38-30-3-2-r-military-retirement-exclusion` | settled |
| `ndcc-57-38-30-3-2-t-retired-peace-officer-exclusion` | settled |
| `ndcc-57-38-30-3-2-closed-subtraction-list` | approximated (understates tax) |
| `ndcc-57-38-30-3-2-d-2-qualified-dividend-exclusion` | approximated (overstates tax) |
