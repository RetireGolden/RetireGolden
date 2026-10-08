## 9. State and local income tax

- State tax packs cover all 50 states plus DC using the big planning levers: income-tax presence, brackets,
  standard deduction, Social Security taxation, private/public retirement-income exclusions, and capital-gain
  inclusion. Values are transcribed from the per-state research files in
  [state-tax-research/](../state-tax-research/).
- Eight jurisdictions — CO, DC, IA, ID, MO, MT, ND, NM — define their standard deduction by reference to the
  federal one rather than publishing their own. Their packs carry a copy of the federal figure tagged
  `standardDeductionConformity: 'federal'`, and `conformStateStandardDeduction` moves that copy by exactly
  the factor `indexFederalTaxPack` applied to the original, so one engine never holds two values for one statutory
  amount in a projected year (`irc-63-c-7-B-ii-conformed-state-deduction-tracks-federal`). Whole-federal adoption
  also implies the IRC 63(c)(3) age-65 addition. A state that publishes its own fixed statutory age addition
  instead carries it in `standardDeductionAge65Addition` without either conformity tag (Delaware:
  `de-code-30-1108-standard-deduction`). Nothing else in the pack moves: brackets and retirement-exclusion
  caps are state figures under state law. SC decoupled for 2026 and is deliberately untagged for both basic and
  age-addition conformity. Maine decoupled the basic for 2026 — published **$15,700 / $31,400** without the
  whole-federal tag — but separately tags `standardDeductionAge65AdditionConformity: 'federal'` so only the federal
  age-65 additional amount ($2,050 unmarried / $1,650 per eligible person married) is attached without federally
  scaling Maine's basic (`mrs-36-5124-c-1-b-decoupled-standard-deduction`). Maine's §5124-C(2)
  proportional phase-out of the combined basic-plus-age total is modeled through
  `standardDeductionPhaseout` and `phaseOutStandardDeduction`
  (`mrs-36-5124-c-2-standard-deduction-phaseout`), using a modeled Maine-AGI proxy rather than
  certified Form 1040ME AGI. AZ left the whole-federal list on
  2026-08-05, because A.R.S. §43-1041(A) sets Arizona's own amounts and (H) borrows only the federal indexation
  *method*, and the tag was additionally attaching an IRC 63(c)(3) age-65 addition Arizona does not grant
  (`ars-43-1041-standard-deduction-published-amount`; Arizona's own age-65 relief is the unmodelled $2,100
  exemption of `ars-43-1023-e-age-65-exemption`).
- Capital gains default to federal conformity unless a state pack says otherwise. CA, MN, and NJ document
  ordinary state taxation of capital gains. PA uses current-year-only capital-loss conformity: federal
  prior-year carryforward losses do not offset PA-taxable current-year gains in the planning model. The raw
  current-year capital field remains signed, but PA floors that current-year-only input at zero. ND excludes
  40% of net long-term gain by statute and carries `capitalGainsTaxablePct: 60`
  (`ndcc-57-38-30-3-2-d-long-term-gain-exclusion`); the parallel 40% exclusion for qualified dividends has no
  field and is registered as a gap (`ndcc-57-38-30-3-2-d-2-qualified-dividend-exclusion`). AR excludes 50% of
  net capital gain and carries `capitalGainsTaxablePct: 50`
  (`aca-26-51-815-b-2-fifty-percent-capital-gain-exclusion`), with its full exemption of gain above $10,000,000
  registered as a gap (`aca-26-51-815-b-3-ten-million-dollar-gain-exemption`). AZ subtracts 25% and carries
  `capitalGainsTaxablePct: 75`, but only for an asset acquired after 2011 — a condition the engine cannot see
  and which is registered as a gap running toward the taxpayer
  (`ars-43-1022-22-long-term-capital-gain-subtraction`).
- ND and AR are the states whose figures are neither fixed by statute nor on a legislated ramp: N.D.C.C.
  §57-38-30.3(1)(g) makes the tax commissioner publish a cost-of-living-adjusted schedule that applies *in lieu
  of* the printed one every year, so the department's form — not the Century Code — carries the operative
  figures (`ndcc-57-38-30-3-1-g-commissioner-indexed-rate-schedule`), and A.C.A. §26-51-201(d)(1) and
  §26-51-430(c) say the same of Arkansas's brackets and of its standard deduction
  (`aca-26-51-201-published-indexed-rate-schedule`, `aca-26-51-430-c-published-indexed-standard-deduction`).
  Re-read all of them every autumn.
- ND, AR, AZ, IN and NY are the cases where the public-pension bucket is coarser than the state's law, and the flag
  cannot be right for both populations in any of them. ND subtracts military and 20-year peace-officer
  retirement and no other public pension, so `{ kind: 'full' }` also exempts the CSRS, FERS and state PERS
  pensions ND taxes (`ndcc-57-38-30-3-2-closed-subtraction-list`). AZ subtracts uniformed-services retired pay
  in full and caps a civil-service pension at $2,500, and carries `full` for the same reason and with the same
  residual (`ars-43-1022-2-government-pension-exclusion`). AR is the mirror image: only uniformed-services
  retirement is fully exempt there and every other public pension gets the same $6,000 as a private one, so the
  bucket carries the cap and a military pension is over-charged instead
  (`aca-26-51-307-e-uniformed-services-full-exemption`). IN is the mirror image at its limit — military
  retirement is deducted in full and *every* other public pension, INPRS/PERF, TRF, municipal police and fire
  alike, gets nothing at all, so the bucket carries `none` and a characterized military row takes the
  pack's `militaryRetirementExclusion` instead (`ic-6-3-2-4-military-retirement-deduction`; only a caller that
  hands over the coarse bucket alone still over-charges it), with the capped and Social-Security-offset civil
  service annuity registered beside it as `ic-6-3-2-3-7-civil-service-annuity-age-62`. NY subtracts qualifying New York
  State, local, and federal-government pensions in full and limits Optional Retirement Program members to the
  employment-attributable portion, but `{ kind: 'full' }` removes every routed `publicPensionIncome` dollar
  without issuer or ORP portion checks (`ny-government-pension-issuer-qualification-not-modeled`). ND, AZ, and
  NY **understate** tax on the coarse `{ kind: 'full' }` bucket — the dangerous direction. AR and IN
  **overstate** it.
- **Local income tax is a caller input, and Indiana is where that hurts.** `computeStateTaxDetail` applies a
  flat `localRatePct` to state taxable income, but no `StateTaxParams` field carries a per-state default and
  both `assumptions.localIncomeTaxPct` and a relocation candidate's `localRatePct` default to zero. All 92
  Indiana counties levy on the identical base — about $1,400 a year at a mid-range 2% on $70,000, against
  $2,065 of state tax — so an Indiana projection under-charges unless the rate is supplied by hand
  (`ic-6-3-6-2-2-county-income-tax-shares-the-state-base`). No default was invented: the published rates span
  sixfold and Indiana publishes no statewide figure to stand for them.
- **State personal exemptions are not folded into the standard deduction.** The `standardDeduction` slot holds a
  state's *standard deduction*, or for CO and ND the federal-taxable-income converter, and no pack entry folds a
  separate per-person exemption into it; the states whose exemptions are modeled carry their own block (CT, IL,
  MA, VA, VT, WI, WV, and NJ's `newJerseyPersonalExemptions`: $1,000 per taxpayer and joint spouse, $1,000 each
  65 or older, $1,000 each blind or disabled, $6,000 each veteran, read as the owner of a military retirement
  pension, with no dependents: `nj-stat-54a-3-1-personal-exemptions`). IN has no standard deduction at all and instead subtracts $1,000 per filer,
  $1,000 per person aged 65+, $1,000 per person blind and $500 more below $40,000 of AGI
  (`ic-6-3-1-3-5-exemptions-not-a-standard-deduction`); MS stacks $6,000/$12,000 plus $1,500 per person aged
  65+ on top of a standard deduction the pack does carry
  (`ms-27-7-21-personal-and-age-65-exemptions`). Both overstate tax, and both would turn into an
  *understatement* for a household under 65 if the age-conditioned half were folded into a per-filing-status
  field.
- **MS is the state where the sign of the error flips with the household's age**, so its records are never
  netted. The unmodelled exemptions and the unmodelled combined-return per-spouse schedule over-charge the
  modal Mississippi retiree, whose pension and Social Security are outside the base already
  (`ms-27-7-21-personal-and-age-65-exemptions`, `ms-combined-return-runs-the-schedule-per-spouse`). The
  unconditional `{ kind: 'full' }` exclusion under-charges the pre-59½ drawdown, because Mississippi does not
  exempt a distribution bearing the federal IRC 72(t) additional tax
  (`ms-early-or-excess-distribution-not-exempt`). `minAge` is deliberately refused as a proxy for that: the
  exclusion reads it against the whole household, and the statutory test is the federal additional tax rather
  than an age, so a substantially-equal-periodic-payment series would be denied an exemption it keeps.
- A current-year signed capital loss joins the opening carryforward pool before the annual ordinary-income
  deduction. Legacy taxable withdrawals, individually owned taxable ordinary-withdrawal actions, rebalances,
  and taxable annuity/TIPS funding share the same uncapped aggregate-basis economics; actions calculate it in
  exact cents while legacy paths use the planning-dollar helper. Basis above value therefore produces a loss
  instead of being silently capped at zero. Full sales explicitly exhaust both fair market value and remaining
  aggregate basis. Pennsylvania's current-year-only input receives this raw signed annual result before its
  state-specific zero floor.
- West Virginia’s 2026 pack rates are **§11-21-4j(a)** — **2.11% / 2.81% / 3.16% / 4.22% / 4.58%** at shared
  **$0 / $10,000 / $25,000 / $40,000 / $60,000** bounds for single and MFJ (`wv-code-11-21-4j-graduated-income-tax-rate-schedule`).
  The sole pack also stands in outside 2026 under the existing fallback; statutory authority is 2026+, not a
  historical §11-21-4i proof. Personal exemptions and senior any-income/disability/pension-subtype items remain
  unmodeled.
- **2026 parameter corrections (CA, DE, HI, LA, MN, OH, OR, RI, UT):** nine registry records now carry TY2026
  figures transcribed from primary sources — California's 2026 Form 540-ES estimated-tax worksheet standard
  deduction ($5,706 / $11,412; `ca-ftb-2026-540-es-standard-deduction`, [CA.md](../state-tax-research/CA.md);
  retained 2025 Schedule X/Y brackets, continuous lower-income schedule behavior, and whole-return figures outside
  the settled deduction record), Delaware §1102(a)(14) 5.55% (`de-code-30-1102-a-14-rate-schedule`,
  [DE.md](../state-tax-research/DE.md)), Hawaii §235-2.4(a)(2)(F) $8,000/$16,000 through tax years beginning
  after 2025 (`hi-hrs-235-2-4-a-2-f-2026-standard-deduction`, [HI.md](../state-tax-research/HI.md); the
  §235-2.4(a)(2)(G) phase from 2028 is not carried), Louisiana La. R.S. 47:294 CPI-indexed standard deduction
  ($12,875 / $25,750; `la-ldr-it540es-2026-standard-deduction`, [LA.md](../state-tax-research/LA.md); retirement
  cap CPI indexing remains approximated — `la-rs-47-44-1-retirement-exemption`), Minnesota DOR TY2026 deduction
  ($15,300 / $30,600) and whole-dollar bands (`mn-dor-2026-rate-schedule-and-standard-deduction`,
  [MN.md](../state-tax-research/MN.md); §290.0132 subd. 26 Social Security subtraction remains approximated with
  zero runtime subtraction — `mn-stat-290-0132-subd-26-social-security-inclusion`), Ohio §5747.02(A)(3)(c) $332
  plus 2.75% above $26,050 for gross nonbusiness tax before credits on the same individual schedule for supported
  single/MFJ (`oh-rev-code-5747-02-a-3-c-2026-nonbusiness-rate-schedule`, [OH.md](../state-tax-research/OH.md);
  exemptions, credits, business income, municipal tax, and whole-return accuracy remain outside that settled
  record), Oregon LRO Report #1-26 TY2026 deduction ($2,910 / $5,820) and indexed breakpoints
  (`or-lro-2026-rate-schedule-and-standard-deduction`, [OR.md](../state-tax-research/OR.md); continuous marginal
  rates do not replicate LRO printed whole-dollar base taxes; HOH/credits/unmodeled inputs unsupported), Rhode
  Island ADV 2025-22 TY2026 deduction and schedule (`ri-dot-adv-2025-22-2026-deduction-and-rate-schedule`,
  [RI.md](../state-tax-research/RI.md); re-read ADV each autumn), and Utah S.B. 60 / §59-10-104 4.45%
  (`ut-code-59-10-104-2026-individual-rate`, [UT.md](../state-tax-research/UT.md)). State-only plan fixtures pin
  the modeled subtotal; whole-return accuracy is not claimed. Calendar-year CA, LA, MN, OH, and OR records expire
  after 2026; later plan years may reuse the latest 2026 pack as a planning stand-in.
- Michigan’s 2026 ordinary retirement deduction is a **combined qualifying** public/private ceiling of
  **$67,610** single/MFS / **$135,220** MFJ (`mi-mcl-206-30-retirement-and-ss`), not a blanket full
  exemption. The pack carries one shared capped rule; pre-1946 unlimited qualifying federal/Michigan public
  benefits, source qualification, (9)/(10)/(11) elections, and return-level versus per-person ceiling remain
  approximated. Social Security stays on the separate settled sibling
  (`mi-mcl-206-30-f-iii-social-security`).
- Maine’s 2026 pension-income deduction maximum is **$49,824** per person before the §5122(2)(M-2)(1)(a)
  gross Social Security/Railroad Retirement reduction and the M-3 federal-AGI phaseout
  (`me-mrs-36-5122-2-m2-m3-2026-pension-deduction`, [ME.md](../state-tax-research/ME.md); [MRS 2026 Form
  1040ES-ME Instructions, revised July 2026](https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/26_1040es_fillable.pdf)).
  The flat pack cap does not verify plan qualification, subtract gross SS/RRB, or apply M-3; personal
  exemption, modeled Maine-AGI proxy limits, and whole Form 1040ME accuracy remain outside this bounded claim.
  Military retirement plan benefits come off in full under (M-2)(1)(b), outside the cap
  (`me-mrs-36-5122-2-m-2-1-b-military-retirement-deduction`).
- Virginia has no retirement-income exclusion. Its relief at 65 is the **age deduction** of Va. Code
  §58.1-322.03(5), **$12,000** per qualifying taxpayer against income of every kind, reduced $1 for each $1 of
  adjusted federal AGI above **$50,000** single or **$75,000** married, as Form 760's Age 65 and Older
  Deduction Worksheet computes it: AFAGI is federal AGI less the taxable Social Security and Tier 1 benefits
  in it, a couple takes one reduction on their joint AFAGI and splits the result, and a taxpayer born on or
  before January 1, 1939 takes the full amount with no income test
  (`va-code-58-1-322-03-age-deduction-and-social-security`, [VA.md](../state-tax-research/VA.md)). The pack
  carries it as `virginiaAgeDeduction`, with `retirement: { kind: 'none' }`.
- Kansas subtracts only the retirement systems K.S.A. 79-32,117 names, by plan code on a public, federal civil
  service, military survivor or government survivor pension; a public pension without a code is incomplete. A
  pension tagged Military retirement needs no code: the source names the armed-forces system (c)(vii) names. Washburn
  University's plan is a 403(b), so an employer plan coded `KS-WASHBURN` is subtracted and a 403(b) or
  undeclared employer plan without a code is incomplete. An IRA, a private pension, and a 401(k), 401(a) or
  457(b) plan are never a named system, so no code changes their tax and a missing one is not flagged
  (`ks-stat-79-32-117-public-pension-exclusion`, [KS.md](../state-tax-research/KS.md)).
- **A state's own military retirement rule** is the pack's `militaryRetirementExclusion`, applied per
  recipient to characterized Military retirement rows (and to Military survivor benefit rows where the
  state's law reaches them) before the state's general retirement rules, which see only what it leaves
  (`militaryRetirementSubtraction` in tax/stateRailroadAndMilitary.ts). In full: IN, ME, MN and WI, survivor
  annuities included; MI, which also lowers its general maximum by it, and OK and PA, whose law does not
  plainly reach a survivor annuity, so it keeps the general rule. Capped: CO $15,000 under 55 through 2028,
  then the (4)(f) pension subtraction; GA $17,500 under 62, $35,000 with more than $17,500 of wages, a
  veteran's survivor benefit in full, and $65,000 under 65 from 2027 (HB 266); MD $12,500 under 55 and
  $20,000 from 55, the rest open to the pension exclusion; NM $30,000 per retiree or surviving spouse; MT
  50% (retired pay no more than the wages on the return), in five years from the later of 2024 and the
  pension's first payment, which is approximated
  (`mt-mca-15-30-2120-3-n-military-retirement-subtraction`). LA excludes military pay and survivor annuities
  under 47:44.2 in its own branch; KS reads a military retirement row as US-MILITARY; DC excludes a survivor
  annuity at 62 under (N)(ii); MO prices a survivor annuity under the capped public-pension subtraction, which
  needs no Missouri income from 2024. Military retired pay and survivor annuities are never subject to the
  72(t) penalty, so the projection marks them not premature at any age (SC 12-6-1171, DE 1106(b)(3)). The
  states the engine still misses are the stated limits of `state-enacted-tax-year-figures`.
- **A Roth conversion is marked on the state retirement row.** Both conversion paths set `rothConversionAmount`
  (the taxable conversion dollars, without splitting an account's event) and
  `rothConversionAmountAtAge59HalfOrOlder` (read on a named conversion's execution date, otherwise on January 1),
  and each state's rule decides whether a conversion counts: Maine never
  (`me-1040me-roth-conversion-not-pension-income`); Pennsylvania never taxes an IRA conversion, at any age
  (`pa-40-roth-ira-conversion-not-taxable`); South Carolina counts it at any age, as no premature penalty applies
  (`sc-code-12-6-1170-roth-conversion-not-premature`); Michigan and New York only at 59 and a half at the
  conversion (`mi-treasury-roth-conversion-at-59-and-a-half`, `ny-tsb-m-98-7-i-roth-conversion-at-59-and-a-half`,
  approximated for an undated conversion in the half-birthday year); Connecticut by its federal-AGI schedule for IRA
  distributions (`ct-cgs-12-701-20-b-xxviii-xxix-ira-distribution-schedule`); New Jersey like any IRA payment under
  its income-tested exclusion (`nj-stat-54a-6-10-retirement-income-exclusion`); every other state like a
  withdrawal. The limits that stay are stated in each state's record: Georgia's 62 to 64 tier, the Delaware and
  Arkansas date edges, in-plan rollovers in Maryland, Rhode Island, Mississippi and Pennsylvania, and Ohio and
  Hawaii, where the answer is not determined.
- Mid-year state moves price each state's slice of the year by that state's own
  part-year method, read from its 2025 part-year or nonresident return (the pack's
  `partYear`; DOCS/calculations/taxes/state-enacted-tax-year-figures.md, Part-year
  residents). The slice's income is what the months resident received: a dated
  distribution or QCD transfer in the slice of its month, Social Security by the
  months it is paid, everything else by the months. Eighteen states tax that
  income on their ordinary schedule (method (a); Pennsylvania's method (c) has
  nothing to prorate), the standard deduction and exemptions prorated by months,
  by the state's income ratio or not at all, as each return does. Twenty-four
  take the tax on the whole year's income as if resident times the state's
  income ratio (method (b); Maine, Ohio and Iowa through a credit that comes to
  the same), on federal AGI items or on the state's own income after its
  modifications, as each form divides. Taxable Social Security is computed once
  on the full-year federal base. The slice receives the year's household facts
  (Oregon's retirement income credit after the ratio, as OR-40-P takes it); a
  capped retirement exclusion follows each state's rule for a part year, and
  where the return does not state one (Arkansas, Colorado, Rhode Island,
  Missouri) the slice takes the year's exclusion by the months and the year is
  incomplete only where the whole cap would give the slice a different income.
  The limits that remain are in `va-code-58-1-322-03-2-personal-exemptions`:
  days are priced as months; only a dated distribution or QCD goes whole into
  its slice, so income without a date, a named Roth conversion included, is
  spread by months; the forms' ratio rounding, their tax tables (New Jersey,
  Hawaii, California) and California's rounded effective rate are not applied;
  Nebraska's and Wisconsin's federal-AGI proxies err in whichever direction
  their left-out adjustments set; nonresident-period source income, the credit
  for tax paid to the other state, special accrual and the full-year elections
  are not modeled; a QCD in a split year leaves the year incomplete, its state
  adjustment not applied; a California or New Jersey slice that is not the
  year-end state is incomplete when the year has HSA facts; and a residency
  whose segments do not give 12 months or name a state twice, or a state
  without published parameters, marks the year incomplete.
- Optional local income tax is a user-entered flat percentage applied to computed state taxable income. This
  is planning support for common local layers, not a locality rule pack.
- Sources: the per-state research in [state-tax-research/](../state-tax-research/) and the own-state revenue,
  statute and forms sources cited in each file. Those are the authority.
  [Tax Foundation's state income-tax rates](https://taxfoundation.org/data/all/state/state-income-tax-rates/)
  is a cross-check and a change-detector only — `taxfoundation.org` is one of the hosts
  `taxRuleRegistry.conformance.test.ts` holds permanently inadmissible as authority, so a state figure whose
  only source is that page cannot be registered as a rule. See
  [state-tax-research/TEMPLATE.md](../state-tax-research/TEMPLATE.md) § Sourcing rules.
