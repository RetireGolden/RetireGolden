# Arkansas (AR) — state income tax for retirement planning

Tax year: **2026** (the schedule and standard deduction the Department of
Finance and Administration published for 2026 on Form AR1000ES). Researched
2026-08-05 against primary sources only — enrolled acts via `arkleg.state.ar.us`
and DFA forms and instructions via `www.dfa.arkansas.gov`. The previous version
of this file was sourced to the Tax Foundation, Kiplinger, SmartAsset and
legalclarity; five of its figures were wrong and one of its stated
simplifications described the opposite of what the pack did. Nothing from it
survives except by re-derivation.

**Arkansas is the state where "primary source" cannot mean the codified
statute.** The Arkansas Code and Constitution of 1874 is published by LexisNexis
under contract; the legislature links out to `advance.lexis.com` for it, and
that host is commercial, JavaScript-only, and serves no statutory text to a
verifier. Statutory language below is therefore quoted from the **enrolled act**
that produced it, which prints the amended section in full, and every indexed
dollar amount is quoted from **DFA**, which is its only publisher.

## Summary
- Broad individual income tax: **yes** — a five-rate schedule, 0% / 2% / 3% /
  3.4% / 3.9% (A.C.A. §26-51-201(a)(3)(A)). A separate two-rate schedule in
  §26-51-201(a)(3)(B) applies **only** above roughly $94,700 of net income; that
  is the schedule this pack used to carry for every Arkansan.
- Bracket thresholds are **indexed annually** by the DFA Secretary and apply "in
  lieu of" the printed ones (§26-51-201(d)(1)). Never carry a prior year's
  thresholds forward.
- The standard deduction is **indexed annually** too, rounded to the nearest $10
  and capped at 3% (§26-51-430(c)). It is Arkansas's own figure and has nothing
  to do with the federal one.
- Taxes Social Security benefits: **no** — Social Security, railroad retirement,
  VA benefits and workers' compensation are outside the definition of gross
  income altogether (§26-51-404(b)(6)(B))
- Capital gains: **50% of net capital gain is exempt** (§26-51-815(b)(2)(C)),
  and net capital gain above **$10,000,000** is exempt in full (§26-51-815(b)(3))
- Private pensions, employer plans and IRAs: **the first $6,000 per taxpayer is
  exempt** (§26-51-307(a)(1)) — one $6,000 across every source, not one per
  source (§26-51-307(b)(1)(B))
- **Public civil-service pensions get the same $6,000 and nothing more.** APERS,
  ATRS, county, municipal, police and fire pensions are inside
  §26-51-307(a)(1)'s "public or private employment-related retirement systems,
  plans, or programs".
- **Uniformed-services** retirement and survivor benefits are **fully exempt**
  (§26-51-307(e)); a taxpayer whose military exemption is under $6,000 may use
  the balance against other retirement income (§26-51-307(f)(2))
- IRA distributions qualify for the $6,000 only at **age 59½**, or on death or
  disability (§26-51-307(a)(2)); employer-plan benefits carry no age condition
  and the recipient need not be retired

## Proposed StateTaxParams (2026)
- code: "AR"
- name: "Arkansas"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true — Arkansas has no preferential *rate*, only a
  partial exclusion, so the half that reaches the base is stacked with ordinary
  income
- capitalGainsTaxablePct: 50
- standardDeduction: { single: 2470, marriedFilingJointly: 4940 } and **no**
  `standardDeductionConformity` tag. This is Arkansas's own published figure,
  indexed on Arkansas's own schedule; tagging it would move it with IRC 63(c)
  and hand the Arkansas base a federal age-65 addition Arkansas does not grant.
- brackets.single and brackets.marriedFilingJointly (the published 2026
  schedule; Arkansas runs the same thresholds for both):
  - { lowerBound: 0, ratePct: 0 }
  - { lowerBound: 5600, ratePct: 2 }
  - { lowerBound: 11200, ratePct: 3 }
  - { lowerBound: 16000, ratePct: 3.4 }
  - { lowerBound: 26400, ratePct: 3.9 }
- retirement (private): { kind: "capped", capPerPerson: 6000 }
- retirement (public): the same, because Arkansas is **not** in the pack's
  `PUBLIC_PENSION_OVERRIDES` map. Absence from that map is also what sets
  `retirementRuleShared`, which is what §26-51-307(b)(1)(B)'s single
  per-taxpayer ceiling requires: one $6,000 across both buckets, never one each.

## Rate structure and its base
§26-51-201(a)(3), as amended by Act 1 of the Second Extraordinary Session of
2024, sets two schedules for tax years beginning on or after January 1, 2024:
subdivision (A) for a filer at or below the statutory net-income threshold
(0% / 2% / 3% / 3.4% / 3.9%) and subdivision (B) for one above it, at two rates.
Subdivision (C) phases out the (B) benefit over a narrow band just above the
threshold.

Those statutory dollar amounts are never the operative ones. §26-51-201(d)(1)
directs the Secretary to "prescribe annually ... tables that shall apply in lieu
of the ... tables contained in subsection (a)", increasing each bracket's
minimum and maximum by the cost-of-living adjustment, rounded to the nearest
$100, without changing any rate. What DFA publishes is what governs:

| Year | 0% up to | 2% from | 3% from | 3.4% from | 3.9% from | (B)-schedule zone | Std. ded. (single / MFJ) |
|---|---|---|---|---|---|---|---|
| 2024 | 5,499 | 5,500 | 10,900 | 15,600 | 25,700 | 92,301+ | 2,410 / 4,820 |
| 2025 | 5,599 | 5,600 | 11,200 | 16,000 | 26,400 | 94,701+ | 2,470 / 4,940 |
| 2026 | 5,599 | 5,600 | 11,200 | 16,000 | 26,400 | 94,701+ | 2,470 / 4,940 |

2026 repeats 2025 because that year's cost-of-living adjustment rounded to zero
at $100 granularity — not because the document is stale. The 2024→2025 move was
large, and the 2026 AR1000ES carries revision stamps of 10/14/2025 and
10/17/2025. Re-check in autumn 2026.

The base is Arkansas net taxable income: total income less the AR1000ADJ
adjustments, less the greater of the standard deduction or itemized deductions.
There is no federal-taxable-income starting point, so `standardDeductionConformity`
must stay unset and no federal age-65 addition attaches.

DFA's published table computes each band at its midpoint and rounds, so a
formula and the table differ by a dollar or two inside a band; the pack applies
the marginal schedule, which is what the "If you use a formula" note on the
Indexed Tax Brackets sheet contemplates.

## Retirement-income detail
§26-51-307(a)(1) exempts the first $6,000 of benefits received from an
individual retirement account, or the first $6,000 of retirement benefits from
"public or private employment-related retirement systems, plans, or programs,
regardless of the method of funding". §26-51-307(b)(1)(B) caps the taxpayer at
one $6,000 per year in total, and the 2025 instructions restate it as a total
across the employer-plan and IRA items alike.

IRA distributions qualify only "after reaching fifty-nine and one-half (59½)
years of age", or on death or disability (§26-51-307(a)(2)(A)–(C)). Employer-plan
benefits carry no age condition, and the recipient need not be retired.

Uniformed-services retirement and survivor benefits are exempt in full
(§26-51-307(e), from Act 141 of 2017, effective TY2018; the Space Force was
added by Act 508 of 2025). §26-51-307(f)(1) makes that exemption and the $6,000
alternatives rather than additions; since Act 358 of 2023, (f)(2) lets a taxpayer
whose military exemption is *less* than $6,000 claim the difference against
other retirement income.

Social Security, railroad retirement, VA benefits and workers' compensation are
outside gross income altogether (§26-51-404(b)(6)), and §26-51-307(b)(2) keeps
the $6,000 rule from being spent on them. Railroad retirement is separately
defined by the department to cover tier I, tier II, vested dual benefits and
supplemental annuities — but *not* a private pension from a railroad company.

## Capital gains
§26-51-815(b)(2)(C) exempts fifty percent of a taxpayer's net capital gain for
gains on and after July 1, 2016. §26-51-815(b)(3) exempts net capital gain above
$10,000,000 from a gain realized on or after January 1, 2014 in full. Form
AR1000D implements both: line 7b caps the figure at $10,000,000 and line 8
multiplies it by fifty percent. **Net short-term capital gain gets no exclusion**
and is added back in full at line 11.

## Simplifications / not modeled
- **Uniformed-services retirement.** The pack's public bucket is one flag, and
  in Arkansas it is dominated by civil-service pensions the state exempts only
  to $6,000, so the bucket carries the capped rule and a military pension is
  over-charged above $6,000. **Overstates tax**, deliberately: the alternative —
  `{ kind: 'full' }`, which the pack carried until 2026-08-05 — is exact for the
  military retiree and exempts every teacher, trooper and state employee's
  pension in Arkansas along with them. Registered as
  `aca-26-51-307-e-uniformed-services-full-exemption`.
- **The 59½ condition on IRA distributions.** `minAge` gates the whole bucket
  and cannot see whether the income came from an IRA or an employer plan, so
  setting 59.5 would deny the exemption to an under-59½ Arkansan drawing an
  employer pension, which Arkansas allows. Left unset. **Understates tax** on a
  premature IRA withdrawal. Registered as
  `aca-26-51-307-a-2-ira-age-fifty-nine-and-a-half-gate`.
- **The $10,000,000 capital-gain exemption.** `capitalGainsTaxablePct` is one
  share with no ceiling above which it falls to zero. **Overstates tax**, for a
  population this engine will essentially never see. Registered as
  `aca-26-51-815-b-3-ten-million-dollar-gain-exemption`.
- **Short-term capital gain.** Arkansas taxes it in full; the engine has one
  included-share field and it applies to the whole modeled gain, so a
  short-term gain is under-taxed by half. **Understates tax.** Not separately
  registered: the engine's `capitalGains` input is modeled as long-term
  throughout, so this is a property of the input model rather than of the
  Arkansas entry.
- **The $6,000 is per taxpayer, and the engine pools.** `capPerPerson` is
  multiplied by the household's head count and applied to combined retirement
  income, so a couple where one spouse has all the retirement income gets
  $12,000 where Arkansas gives $6,000. **Understates tax** for that household.
- **Filing status 4** ("Married Filing Separately on the Same Return") gives each
  spouse a separate bracket run and a separate $2,470 deduction, and Arkansas
  taxpayers choose freely between it and status 2. The pack models status 2.
  **Overstates tax** for a two-pension couple; `PerStatus` cannot express "per
  person within MFJ".
- **Low Income Tax Tables** zero out tax at low incomes but are unavailable to
  anyone using the $6,000 retirement exclusion or the military exclusion — a
  genuine either/or the engine cannot see. **Overstates tax** for a low-income
  retiree.
- **Bracket-adjustment band** $94,701–$97,800 (§26-51-201(a)(3)(C)): not
  modeled. **Overstates tax** by at most a few hundred dollars inside a
  $3,100-wide band.
- **$29 / $58 personal credits**, the $29 dependent credit and the $29
  blind / deaf / over-65 / "65 Special" credits: credits are outside the pack's
  scope. For an Arkansas retiree they are a meaningful share of a small
  liability. The over-65 credit is also conditional — it is available only to a
  taxpayer who does *not* claim the $6,000 retirement exemption.
- **Railroad Retirement**: the engine has no input for it. Narrow population,
  **overstates tax** for a railroad retiree.
- **Both the brackets and the standard deduction are indexed by statute.**
  Arkansas belongs on the same "re-verify every autumn" list as North Dakota and
  the legislated-ramp states. DFA publishes the next year's schedule in the
  AR1000ES instructions each October.
- **Not investigated**, and flagged so nobody assumes otherwise: the Texarkana
  border-city exemption (AR1000ADJ), part-year and nonresident proration on
  AR1000NR, lump-sum distribution averaging (AR1000TD), the 10% additional tax
  on early distributions (AR1000F line 32), the pass-through entity tax
  interaction, and the AR1000TC credits.

## Citations (primary only)
- brackets — https://www.dfa.arkansas.gov/wp-content/uploads/2026_Final_AR1000ES.pdf
  — the 2026 Tax Rate Schedule: "If your NET TAXABLE INCOME is less than $5,599,
  your tax is zero percent (0%) of your net taxable income", and the schedule's
  own income column, `$ 5,600.00 11,200.00 16,000.00 26,400.00 ...`. The rates
  paired with their bands are on the 2025 Indexed Tax Brackets sheet,
  https://www.dfa.arkansas.gov/wp-content/uploads/2025_TaxBrackets.pdf. The
  indexation mandate that makes a published schedule rather than the Code's
  operative is §26-51-201(d)(1), from Act 532 of 2023, § 2,
  https://arkleg.state.ar.us/Home/FTPDocument?path=%2FACTS%2F2023R%2FPublic%2FACT532.pdf.
  The current rates are from Act 1 of the Second Extraordinary Session of 2024,
  https://arkleg.state.ar.us/Home/FTPDocument?path=%2FACTS%2F2024S2%2FPublic%2FACT1.pdf.
- standard deduction — §26-51-430(c), from Act 1 of the Second Extraordinary
  Session of 2021, § 9,
  https://arkleg.state.ar.us/Home/FTPDocument?path=%2FACTS%2F2021S2%2FPublic%2FACT1.pdf
  — annual indexation, rounded to $10, capped at 3%. The amounts are DFA's:
  the 2026 AR1000ES worksheet line 2 ($2,470 per taxpayer) and the 2025
  AR1000F/AR1000NR Standard Deduction table ($2,470 / $4,940),
  https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000F_and_AR1000NR_Instructions.pdf.
- Social Security — 2025 AR1000F/AR1000NR instructions, Exempt Income item 8
  (same URL); §26-51-404(b)(6)(B), from Act 141 of 2017, § 5,
  https://arkleg.state.ar.us/Home/FTPDocument?path=%2FACTS%2F2017R%2FPublic%2FACT141.pdf.
- capital gains — §26-51-815(b)(2)(C) and (b)(3), from Act 1173 of 2015, §§ 1–2,
  https://arkleg.state.ar.us/Acts/FTPDocument?path=%2FACTS%2F2015R%2FPublic%2F&file=1173.pdf&ddBienniumSession=2015%2F2015R.
  Operational confirmation: 2025 Form AR1000D lines 7b and 8,
  https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000D_CapitalGains.pdf.
- retirement exemption ($6,000, and its reach over public plans) —
  §26-51-307(a)(1), from Act 141 of 2017, § 3 (URL above); 2025
  AR1000F/AR1000NR instructions, Line 17, Line 18A, and the note to Exempt
  Income items 12 and 13.
- IRA age condition — §26-51-307(a)(2)(A), same act; 2025 instructions, Line 17.
- uniformed services — §26-51-307(e)(1), same act; §26-51-307(f)(1), from Act 358
  of 2023, § 1,
  https://arkleg.state.ar.us/Home/FTPDocument?path=%2FACTS%2F2023R%2FPublic%2FACT358.pdf;
  2025 instructions, Line 17. The Space Force was added to §26-51-307(e)(2) by
  Act 508 of 2025, § 49,
  https://arkleg.state.ar.us/Home/FTPDocument?path=%2FACTS%2F2025R%2FPublic%2FACT508.pdf.

### Host notes for whoever refreshes this
- An act URL of the form `/Acts/FTPDocument?...&file=ACT<N>.pdf` returns **HTTP
  200 with a zero-byte body**, not a 404. The working forms are
  `/Home/FTPDocument?path=%2FACTS%2F<SESSION>%2FPublic%2FACT<N>.pdf` for recent
  sessions and `/Acts/FTPDocument?...&file=<N>.pdf&ddBienniumSession=...` for
  sessions before about 2016 — which is why the 2015 capital-gains act carries
  the older shape above. Session codes run `2023R`, `2023S1`, `2024F`, `2024S2`,
  `2025R`, `2026F`; there is no `2024S1` or `2023S2`.
- `https://dfa.arkansas.gov/...` answers **301** to `www.dfa.arkansas.gov`, and
  every form lives in one flat directory, `/wp-content/uploads/<FILE>.pdf`. A
  missing file there returns HTTP 404 with a 51 KB HTML error page, so "did I
  get bytes?" is not a check.
- `/Acts/CodeSection?section=26&ddBienniumSession=<biennium>%2F<session>` lists
  every Title 26 section amended in a session, with act numbers. That is how the
  negative was proved: no §26-51-201 amendment in the 2025 regular session or
  the 2026 fiscal session, so the 2024 rates still stand.
- Enrolled acts print a line number in the margin of every line, and the text
  layer carries them, so a quotation spanning printed lines carries them too.
  They are reproduced in the registry rather than deleted, alongside the
  strike-through and underline an amendment sets ("received by any a resident").

## Cross-checks (not authority)
None. Every figure above was read out of an enrolled act or a DFA publication.

The citations this file previously carried —
`taxfoundation.org/data/all/state/state-income-tax-rates/`, Kiplinger,
SmartAsset and legalclarity — are recorded here as the provenance of the errors
rather than as cross-checks. Between them they supplied a two-bracket schedule
that Arkansas applies only above ~$94,700, a 2024 standard deduction presented
as current, a claim that public pensions are fully exempt (true only of the
uniformed services), a claim of no age gate (wrong for IRAs), and a
"simplification" note that described the pack as conservative when it was
exempting Arkansas public pensions outright. The first two hosts are in the
`SECONDARY_AGGREGATORS` set the conformance suite holds permanently
inadmissible.

## Registered rules
Every lever above is registered in
`packages/engine/src/rules/records/statesSouthCentral.ts` under `jurisdiction: 'state:AR'`:

| Rule id | Classification |
|---|---|
| `aca-26-51-201-published-indexed-rate-schedule` | settled |
| `aca-26-51-430-c-published-indexed-standard-deduction` | settled |
| `aca-26-51-307-six-thousand-retirement-exemption` | settled |
| `aca-26-51-307-a-1-public-pension-inside-the-six-thousand` | settled |
| `aca-26-51-404-b-6-social-security-exclusion` | settled |
| `aca-26-51-815-b-2-fifty-percent-capital-gain-exclusion` | settled |
| `aca-26-51-307-e-uniformed-services-full-exemption` | approximated (overstates tax) |
| `aca-26-51-307-a-2-ira-age-fifty-nine-and-a-half-gate` | approximated (understates tax) |
| `aca-26-51-815-b-3-ten-million-dollar-gain-exemption` | approximated (overstates tax) |
