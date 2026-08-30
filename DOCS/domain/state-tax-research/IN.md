# Indiana (IN) — state income tax for retirement planning

Tax year: **2026**. Researched 2026-08-05 against primary sources only — the
Indiana Code via `iga.in.gov`, DOR forms via `forms.in.gov`, and DOR
departmental notices and information bulletins via `www.in.gov/dor/files`. The
previous version of this file was sourced to nationaltaxreports, Kiplinger, AARP
and the Tax Foundation. Three of its statements were wrong, one of them
described the pack as doing the opposite of what it did, and the largest defect
in the pack came straight from it. Nothing survives except by re-derivation.

**Indiana needs three publisher hosts, and the third is the one nobody would
guess.** See "Host notes" at the bottom before refreshing anything: on this
state the naive URL fails silently rather than loudly, twice over.

## Summary
- Broad individual income tax: **yes** — one flat rate on Indiana adjusted gross
  income, no brackets and no variation by filing status (IC 6-3-2-1(b))
- 2026 rate: **2.95%** (IC 6-3-2-1(b)(7)). 2027 through 2029: **2.9%** ((b)(8)).
  Then a *conditional* 0.05-point ratchet in each even-numbered year 2030–2043
  ((b)(9)–(16)) that fires only on a budget-agency certification no projection
  can evaluate. **Never hold this rate forward.**
- **County income tax is not optional.** All 92 counties levy one; 2026 rates run
  0.5% (Porter) to 3.0% (Randolph). It is imposed on the *same* base as the
  state tax and follows the county of residence on January 1 (IC 6-3.6-2-2;
  Schedule CT-40 line 1 is "Enter the amount from IT-40, line 7")
- Taxes Social Security benefits: **no** — the federally taxable portion is
  subtracted (IC 6-3-1-3.5(a)(8)), and Railroad Retirement rides in the same
  subdivision rather than needing one of its own
- Long-term capital gains: **taxed as ordinary income**, with no preferential
  rate, exclusion or holding-period rule of any kind
- Private pensions, annuities and IRA/401(k)/403(b) distributions: **fully
  taxable**, no exclusion and no age gate
- **State and local government pensions are fully taxable too.** INPRS/PERF, TRF
  and municipal police and fire pensions get nothing; Indiana has no general
  public-pension deduction
- **Military** retirement and survivor's benefits: **fully deducted** from
  TY2022, no age condition (IC 6-3-2-4(a)(2))
- **Federal civil service** annuity: the first **$16,000 minus** all Social
  Security and railroad retirement received, and only at **age 62 or over**
  (IC 6-3-2-3.7) — age 62, not 65, and often zero in practice
- Indiana has **no standard deduction**. It has flat per-person exemptions
  instead: $1,000 per filer ($2,000 MFJ), $1,000 per person aged 65+, $1,000 per
  person blind, and $500 more per person aged 65+ below $40,000 of federal AGI

## StateTaxParams (2026), as shipped
- code: "IN"
- name: "Indiana"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true — **correct, and not the North Dakota / Arkansas /
  Arizona defect.** Indiana's base is federal AGI under IC 6-3-1-3.5(a), which
  already carries net capital gain, and the closed modification list that
  follows reaches no gain at all. A reviewer sweeping for that pattern must
  leave Indiana alone. No `capitalGainsTaxablePct`.
- standardDeduction: `{ single: 0, marriedFilingJointly: 0 }` and **no**
  `standardDeductionConformity` tag. Zero is a true statement about the field it
  sits in — Indiana publishes no standard deduction, and Form IT-40 runs
  deductions and exemptions as separate lines with no third. The tag would be
  wrong twice: no Indiana provision adopts IRC 63(c)'s dollar amount, and the
  tag additionally attaches the federal age-65 addition, which Indiana does not
  grant either. See "Why the exemptions are not in that field" below.
- brackets.single / .marriedFilingJointly: `[ { lowerBound: 0, ratePct: 2.95 } ]`
- retirementPrivate: `{ kind: "none" }`
- retirementPublic: `{ kind: "none" }`, and `retirementRuleShared: true` — set by
  Indiana's **absence** from `PUBLIC_PENSION_OVERRIDES`. Indiana carried
  `{ kind: 'full' }` there until 2026-08-05, which exempted every public pension
  in the state outright.
- No local rate. `assumptions.localIncomeTaxPct` must be set by hand for any
  Indiana household; leaving it at zero understates the total by 0.5–3.0
  percentage points of the identical base.

## Rate structure and its base
IC 6-3-2-1(b): "Each taxable year, a tax at the following rate of adjusted gross
income is imposed upon the adjusted gross income of every resident person, and
on that part of the adjusted gross income derived from sources within Indiana of
every nonresident person". The schedule the statute then gives is a ramp:

| Taxable years | Rate | Cite |
|---|---|---|
| after 2022, before 2024 | 3.15% | IC 6-3-2-1(b)(4) |
| after 2023, before 2025 | 3.05% | (b)(5) |
| after 2024, before 2026 | 3.00% | (b)(6) |
| **after 2025, before 2027** | **2.95%** | **(b)(7)** |
| after 2026, before 2030 | 2.90% | (b)(8) |
| 2030–2043, conditional | −0.05 pt per even year | (b)(9)–(15) |
| after 2043 | frozen at the 2042 rate | (b)(16) |

The 2.95% and 2.90% figures were enacted by P.L.201-2023, SEC.95. **P.L.80-2025,
SEC.1 did not change either of them**: diffing the 2024 and 2026 code editions of
IC 6-3-2-1 shows it left (b)(1)–(7) untouched, bounded (b)(8) at January 1 2030,
and added (b)(9)–(16) plus subsection (e). That diff is the evidence; the bill
number behind the public law is not recoverable from iga (see host notes) and
would be a paraphrase if anyone wrote one down.

The conditional ratchet turns on the budget agency certifying four consecutive
years of state general fund revenue growth of at least 3.5% together with a
forecast of the same. **Nothing lets a projection know a post-2029 rate.** Carry
2.90% for 2027–2029 and hold it with a note; do not guess at the ratchet.
IC 6-3-2-1(e) requires DOR to publish each determination by November 1 of every
odd-numbered year, in Departmental Notice #1 — which is the autumn document to
re-verify against.

The base is IC 6-3-1-3.5(a): federal AGI as defined by IRC 62, modified by 38
enumerated items. Form IT-40 runs: line 1 federal AGI, line 2 add-backs
(Schedule 1), line 4 deductions (Schedule 2), line 6 exemptions (Schedule 3),
line 7 Indiana AGI, line 8 state tax, line 9 county tax.

## County income tax (the "LIT")
IC 6-3.6-2-2 defines the LIT base by reference to IC 6-3-1-3.5, and Schedule
CT-40 line 1 is literally "Enter the amount from IT-40, line 7" — so the county
tax runs on Indiana AGI *after* both the deductions and the exemptions, which is
the same number the state rate runs on. **A flat percentage of state taxable
income is therefore the correct model shape, and it is the shape the engine
already has**: `computeStateTaxDetail` multiplies `localRatePct` by exactly that
base. The only error a planner can make is leaving the rate at zero, and that is
what happens by default — `assumptions.localIncomeTaxPct` defaults to 0 and a
relocation candidate documents omission as 0.

The pack publishes no per-state default and none was invented. `StateTaxParams`
has no field for one, the 92 published rates span sixfold, and Indiana publishes
no statewide figure to stand for them; an average computed in this repo would be
a number with no publisher. Rates are re-adopted by county fiscal bodies and
republished by DOR every January and October in Departmental Notice #1. County
of residence on **January 1** governs the whole year, so a retiree who moves
counties mid-year still pays the old county's rate.

At a mid-range 2% on $70,000 of Indiana AGI the county tax is about **$1,400 a
year**, against $2,065 of state tax. It is the single largest number missing
from an Indiana projection, and Indiana is the worst case of this in the pack:
the levy is universal and the state rate is low, so the local share is the
majority of the story.

## Retirement-income detail
**Social Security and Railroad Retirement.** IC 6-3-1-3.5(a)(8) subtracts "the
amount of federal Social Security and Railroad Retirement benefits included in a
taxpayer's federal gross income by Section 86". Indiana does *not* follow the
federal exclusion — it starts from federal AGI, which **includes** the taxable
portion, and removes that portion here. The distinction matters because the
amount subtracted is the federally taxable amount, not the gross benefit.

**Everything else is taxed unless a named item reaches it.** Indiana's
deductions are a closed list: Schedule 2 lines 1–10 (renter's, homeowner's
property tax, state tax refund, U.S. obligation interest, taxable Social
Security, taxable railroad retirement, active military service, private
school/homeschool, Indiana NOL, nontaxable unemployment) plus the named
three-digit codes on line 11. Nothing in it reaches a private pension, an
annuity, or a traditional IRA/401(k)/403(b) distribution, and nothing in it
reaches a general public pension. Information Bulletin #26 puts private
retirement on the taxable side directly.

**INPRS/PERF, TRF, and municipal police and fire pensions are fully taxable.**
The only public-retirement relief in Indiana law is the two items below.

**Military retirement and survivor's benefits — full.** IC 6-3-2-4(a)(2) sets
the deduction at the lesser of the benefits or "$6,250 plus … one hundred
percent (100%) of the amount of the benefits in excess of six thousand two
hundred fifty dollars ($6,250)" for taxable years after 2021 — i.e. the whole
amount, with **no age condition**. National Guard and reserve *regular* pay is
likewise fully deductible from 2023 (code 621). Active-duty service pay gets
only $5,000 (IC 6-3-2-4(a)(1)), which is a different and much smaller item.

**Federal civil service annuity — capped, offset, age 62.** IC 6-3-2-3.7 gives
the first $16,000 minus *all* Social Security and railroad retirement benefits
received, and only if the individual "is at least sixty-two (62) years of age
before the end of the taxable year"; a surviving spouse has no age test. For a
retiree with meaningful Social Security this deduction is often zero. The
previous version of this file said age 65 and called it "small"; both were
wrong, in opposite directions.

## Exemptions (Indiana's substitute for a standard deduction)
Schedule 3, per IC 6-3-1-3.5(a)(3)–(5):
- $1,000 per filer; $2,000 on a joint return
- $1,000 per dependent, $1,500 per additional qualifying dependent child,
  $3,000 per adopted child
- $1,000 each for the taxpayer and the spouse if aged 65 or over
- $1,000 each for the taxpayer and the spouse if blind
- $500 more per person aged 65+ if federal AGI is under $40,000 ($20,000 MFS)

A married couple both 65 or over subtracts **$4,000**, or $5,000 below the AGI
threshold. The amounts are fixed in statute and are **not indexed**. The previous
version of this file mentioned only the $1,000 base and the $500 add-on, omitting
the $1,000 age-65 exemption — which is larger than the $500 it did mention and
has no income test at all.

### Why the exemptions are not in the `standardDeduction` field
Two reasons, and either alone would be enough. The pack models **no** state
personal exemption anywhere — that slot holds a state's *standard deduction*, or
for Colorado and North Dakota the federal-taxable-income converter — so using it
here would make Indiana an unmarked exception to a fifty-one-state convention.
And the field is per filing status while half the Indiana amount is per person
and conditioned on age: any single figure that priced a 65+ household correctly
would over-deduct for one under 65, turning a conservative over-charge into a
flattering under-charge. Registered as
`ic-6-3-1-3-5-exemptions-not-a-standard-deduction`, with the direction it runs.

## Simplifications / not modeled
- **County income tax.** No per-state default; the caller must supply the rate.
  Understates tax for every Indiana household. Registered.
- **Military retirement deduction.** The public bucket is one flag and it now
  carries `none`, which is right for INPRS/PERF, TRF and municipal retirees and
  over-charges a military one on the whole pension. The direction was chosen
  rather than inherited — `full` is exact for the veteran and exempts every
  teacher, trooper and state employee alongside them. Registered.
- **Federal civil service annuity deduction.** No exclusion shape offsets one
  income stream against another. Over-charges. Registered.
- **The Schedule 3 exemptions**, all of them. Over-charges. Registered.
- Disability retirement deduction, $5,200 per qualifying individual
  (IC 6-3-2-9; Schedule 2 code 602).
- National Guard / reserve regular-income deduction (code 621).
- Homeowner's residential property tax deduction, the lesser of $2,500 or the
  tax paid (IC 6-3-1-3.5(a)(13)), and the renter's deduction, the lesser of
  $3,000 or rent paid — between them these reach nearly every Indiana retiree.
- Credits generally, including the unified tax credit for the elderly
  (IC 6-3-3-9) and the county-tax credit for tax paid outside Indiana
  (IC 6-3.6-8-6). Credits are outside the pack's declared scope.
- The Schedule 1 add-backs, several of which reach retirees — the non-Indiana
  municipal bond interest add-back at IC 6-3-1-3.5(a)(21) in particular.
- Part-year and nonresident proration (IC 6-3-1-3.5(a)(9)); the Perry County /
  Kentucky carve-out (IC 6-3.6-8-7); the reciprocity agreements with Kentucky,
  Michigan, Ohio, Pennsylvania and Wisconsin.

### Net direction
The county gap understates and is large; the military, civil service, exemption
and property-tax gaps overstate and are individually smaller. For a
**private-sector** Indiana retiree the pack now nets to understating by roughly
the county rate. For an Indiana **military** retiree it overstates by the
pension and understates by the county — the two can be the same order of
magnitude, so read the records rather than the net.

## Open items, for whoever refreshes this
1. **Which bills P.L.201-2023 and P.L.80-2025 are.** The Code's source note names
   the public laws but not the bills, and iga's public API carries no
   public-law-to-bill mapping in either direction — the number appears only
   inside free-text `bill_actions` strings. Every `/acts/` URL pattern returns
   the React shell. What P.L.80-2025 changed is nonetheless established by the
   2024-versus-2026 code diff above.
2. **The 2026 tax year has no published DOR forms.** The current individual forms
   are the 2025 set (revision stamps 9/25). The only 2026-dated DOR document is
   Departmental Notice #1 (R46 / 01-26), which is a **withholding** notice — its
   opening line says so — that states the annual rate as a fact because
   IC 6-3-2-1(e) makes it the designated vehicle for doing so. Cite it as one.
3. **Whether IC 6-3-1-3.5(a)(4)(B)'s "$1,000 for each additional amount allowable
   under Section 63(f)" survives federal itemization.** IRC 63(f) amounts are on
   their face increases to the *standard* deduction, so "allowable" is doing work
   Indiana's text does not define. DOR administers the exemption
   unconditionally — Schedule 3 line 4 is a checkbox with no itemizer question —
   and this file follows the department on that basis, but the statute alone does
   not compel it.
4. **The county rate table cannot be quoted.** Departmental Notice #1's list is
   92 rows of a two-column table; any single-string quotation is a reflow. The
   two extremes are recorded as data and the surrounding prose is what the
   registry quotes.

## Host notes for whoever refreshes this
- **`iga.in.gov` serves a 691-byte React shell to any client without a browser
  `User-Agent`** — every path, including `/static/js/*` and `/api/*`, returns the
  same shell with HTTP 200. A fetcher that trusts the status code will silently
  record an empty document as "the statute". With a browser UA the same URLs
  return real content.
- **The Indiana Code is not at the URL a citation would naturally carry.** The
  human-facing address is `iga.in.gov/laws/2026/ic/titles/6/...`, a client-side
  route with no server-rendered text at all. The machine-readable text is at
  `iga.in.gov/ic/{year}/Title_{n}/Article_{a}/Chapter_{c}.pdf` (also
  `Title_{n}.html` and `.json`), a pattern that appears nowhere on the site and
  was recovered from the JS bundle. `{year}` is the **code year**; 2026 exists
  and is current. **A registry record for an Indiana statute must cite the
  `/ic/` PDF**, or the citation resolves to a blank page.
- Those PDFs carry a running **"Indiana Code 2026" page header**, and extraction
  places it mid-sentence wherever a provision spans a page break. IC 6-3-2-3.7(a)
  is the case in this file; the registry quotes it as the two halves the document
  contains, meeting mid-clause.
- **DOR forms are not on `in.gov`.** `www.in.gov/dor/tax-forms/individual/current`
  is a real page, but every form link on it points at
  **`forms.in.gov/Download.aspx?id=NNNN`** — a different registrable host.
  Departmental notices and information bulletins *are* on
  `www.in.gov/dor/files/*.pdf`. So Indiana needs **three** allowlist entries.
  `www.in.gov/dor/individual-income-taxes/` 200s but redirects to
  `/dor/i-am-a/individual/`.
- `in.gov` is a shared executive portal — the shape refused for Pennsylvania —
  and is admitted deliberately: DOR publishes its notices and bulletins nowhere
  else, IC 6-3-2-1(e) names Departmental Notice #1 as the statutory vehicle for
  the rate, and the county levy's universality has no code section to quote. The
  allowlist holds hosts and cannot narrow to `/dor/files/`.
- `pdftotext -layout` on `dn01.pdf` emits `Invalid entry in bfchar block in
  ToUnicode CMap` warnings and renders the bullet glyph as a replacement
  character. Cosmetic; the words are intact.

## Cross-checks (not authority)
None. Every figure above was read out of the Indiana Code, a DOR form, or a DOR
departmental notice or information bulletin.

The citations this file previously carried — `nationaltaxreports.com`,
`kiplinger.com`, `states.aarp.org` and the Tax Foundation — are recorded here as
the provenance of the errors rather than as cross-checks. Between them they
supplied a 2025 rate presented as current for a 2026 pack, an age-65 civil
service deduction that is age 62, an exemption list missing its largest item,
and a "simplification" note claiming military retirement was not modelled and
that `none` was conservative — while the pack was in fact exempting every
Indiana public pension outright. `taxfoundation.org` and `kiplinger.com` are both
in the `SECONDARY_AGGREGATORS` set the conformance suite holds permanently
inadmissible.

## Registered rules
Every lever above is registered in
`packages/engine/src/rules/records/statesMidwest.ts` under `jurisdiction: 'state:IN'`:

| Rule id | Classification |
|---|---|
| `ic-6-3-2-1-flat-rate-ramp` | settled |
| `ic-6-3-1-3-5-a-8-social-security-railroad-subtraction` | settled |
| `ic-6-3-2-no-general-retirement-deduction` | settled |
| `ic-6-3-2-4-military-retirement-deduction` | approximated (overstates tax) |
| `ic-6-3-2-3-7-civil-service-annuity-age-62` | approximated (overstates tax) |
| `ic-6-3-6-2-2-county-income-tax-shares-the-state-base` | approximated (understates tax) |
| `ic-6-3-1-3-5-exemptions-not-a-standard-deduction` | approximated (overstates tax) |

## Citations (primary only)
- IC 6-3-2 (rate ramp, military deduction, civil service annuity, deductions):
  https://iga.in.gov/ic/2026/Title_6/Article_3/Chapter_2.pdf
- IC 6-3-1 (adjusted gross income; exemptions; the Social Security subtraction):
  https://iga.in.gov/ic/2026/Title_6/Article_3/Chapter_1.pdf
- IC 6-3.6-2 (local income tax definitions):
  https://iga.in.gov/ic/2026/Title_6/Article_3.6/Chapter_2.pdf
- IC 6-3.6-8 (local income tax administration):
  https://iga.in.gov/ic/2026/Title_6/Article_3.6/Chapter_8.pdf
- IC 6-3-2 (2024 edition), used only to diff IC 6-3-2-1 and establish what
  P.L.80-2025 added:
  https://iga.in.gov/ic/2024/Title_6/Article_3/Chapter_2.pdf
- DOR Departmental Notice #1, effective Jan. 1 2026 (state rate + all 92 county
  rates): https://www.in.gov/dor/files/dn01.pdf
- 2025 Form IT-40 instruction booklet (the Schedule 2 three-digit code list):
  https://forms.in.gov/Download.aspx?id=16915
- 2025 Form IT-40: https://forms.in.gov/Download.aspx?id=16914
- 2025 Schedule 2 (Deductions), State Form 53996:
  https://forms.in.gov/Download.aspx?id=16933
- 2025 Schedule 3 (Exemptions), State Form 53997:
  https://forms.in.gov/Download.aspx?id=16936
- 2025 Schedule CT-40 (County Tax Schedule), State Form 47907:
  https://forms.in.gov/Download.aspx?id=16902
- Income Tax Information Bulletin #6, June 2025 (civil service annuity;
  military retirement): https://www.in.gov/dor/files/ib06.pdf
- Income Tax Information Bulletin #26, January 2023 (the elderly; the county
  levy's universality): https://www.in.gov/dor/files/ib26.pdf
- Income Tax Information Bulletin #27, June 2025 (military personnel and
  spouses): https://www.in.gov/dor/files/ib27.pdf
