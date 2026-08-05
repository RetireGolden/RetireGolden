# Mississippi (MS) — state income tax for retirement planning

Tax year: **2026**. Researched 2026-08-05 against primary sources only — the
Mississippi Code as reprinted in bills on `billstatus.ls.state.ms.us`, and MS
DOR via `www.dor.ms.gov`. The previous version of this file was sourced to
ustax.tools, NTU, the TurboTax blog and Kiplinger. Its rate was a year stale,
its exemption list was missing its age-65 item, and it asserted that the pack's
treatment of the married zero band was "correct" when it is not — a defect
documented as verified, which is worse than an undocumented one. Nothing
survives except by re-derivation.

**Mississippi publishes no free `.gov` copy of its own Code.** See "Sourcing
note" and "Host notes" before refreshing anything.

## Summary
- Broad individual income tax: **yes** — 0% on the first $10,000 of taxable
  income, then one flat rate above it (Miss. Code Ann. §27-7-5(1))
- 2026 rate above $10,000: **4%**. Then 3.75% (2027), 3.5% (2028), 3.25% (2029),
  3% (2030 and after), with a revenue-triggered further cut of 0.2–0.3 of a
  point a year from 2031 (§27-7-5.1) and a **self-repeal of the whole individual
  income tax** if the rate ever reaches zero. **Never hold this rate forward.**
- Taxes Social Security benefits: **no** — Social Security and Railroad
  Retirement never enter Mississippi gross income at all (§27-7-15(4)(k))
- Long-term capital gains: **taxed as ordinary income**; the department states
  outright that "Mississippi does not have different tax rates for capital gains"
- **Retirement income is exempt in full** — public *and* private pensions, IRAs,
  401(k)/403(b) and retirement annuities (§27-7-15(4)(k) and (4)(l)) — and the
  exemption survives to the spouse or beneficiary at the retiree's death
- **But an early or excess distribution is not.** A distribution "taxable as
  early or excess distributions under the Federal Internal Revenue Code (see
  Federal Form 5329)" does not qualify and is reported as taxable income. The
  test is the federal IRC 72(t) additional tax, **not** a bare age cutoff: a
  distribution inside a 72(t) exception stays exempt at any age
- Standard deduction: $2,300 single / $4,600 joint or combined / $3,400 head of
  family / $2,300 MFS. **Fixed in statute, never indexed** (§27-7-17(3)(b))
- Personal exemption **on top of** the standard deduction: $6,000 single /
  $12,000 married living together / $9,500 head of family, plus **$1,500 per
  person aged 65+** and $1,500 per person blind, plus $1,500 per dependent
  (§27-7-21)
- A married couple filing a **combined** return runs the whole schedule per
  spouse — two $10,000 zero bands, not one
- Mississippi has **no local income tax**

## Sourcing note
`legislature.ms.gov`'s only link to the Mississippi Code is
`lexisnexis.com/hottopics/mscode/`, which 302s into
`advance.lexis.com/container?config=…` — a cookie-and-JavaScript session app
serving no text to a CLI client, and a commercial host besides. This is the
Arkansas pattern exactly. The operative statutory text is therefore taken from
**bills**, which reprint the affected section in full.

A bill reprint is a reprint, so two guards were applied rather than assumed.
Where possible the citation is to a bill that **brings the section forward**,
which prints it unmarked — §27-7-17 and §27-7-21 below. Where the section was
being amended, Mississippi's markup sets deletions in `<s>` with a hidden span
and a bold `* * *`, and insertions in `<u>`, so the two interleave on
extraction: §27-7-15's paragraphs were cross-checked word for word between two
independent 2026 bills, and §27-7-5's own 2026 subparagraph is the one place a
reconstruction would have been needed, so the 4% figure is quoted from the
department's clean prose instead of from the bill.

## StateTaxParams (2026), as shipped
- code: "MS"
- name: "Mississippi"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true — **correct, and not the North Dakota / Arkansas /
  Arizona defect.** Mississippi is the second state in that sweep (with Indiana)
  where the default is simply right. No `capitalGainsTaxablePct`.
- standardDeduction: `{ single: 2300, marriedFilingJointly: 4600 }` and **no**
  `standardDeductionConformity` tag. These are Mississippi's own amounts, fixed
  by statute with no indexation clause, so unlike Arkansas's or North Dakota's
  they cannot go stale. Tagging would move a frozen state figure with an
  annually rising federal one and hand the Mississippi base a federal age-65
  addition Mississippi does not grant.
- brackets.single / .marriedFilingJointly:
  `[ { lowerBound: 0, ratePct: 0 }, { lowerBound: 10000, ratePct: 4 } ]` —
  correct for a joint return; a combined return gets a zero band per spouse
- retirementPrivate / retirementPublic: `{ kind: "full" }`, with
  `retirementRuleShared: true` (Mississippi's absence from
  `PUBLIC_PENSION_OVERRIDES`). Here the shared flag is the **law** rather than a
  conservatism: (4)(k) and (4)(l) between them reach all retirement income and
  neither is capped, so there is nothing to double.
- The `full` exclusion is unconditional and Mississippi's is not. See "The
  carve-out" below.

## Rate structure
§27-7-5(1)(a) levies the tax "upon the entire net income of every resident
individual, corporation, association, trust or estate, in excess of the credits
provided". Two clauses then zero the bottom band: (a)(i)6 removes the tax on the
first $5,000 from 2022, and (b)(i) removes it on $5,000–$10,000 from 2023 — two
clauses producing one $10,000 zero band. Above it, (b)(ii) sets the year rate:

| Calendar year | Rate above $10,000 | Cite |
|---|---|---|
| 2024 | 4.7% | §27-7-5(1)(b)(ii)1 |
| 2025 | 4.4% | (b)(ii)2 |
| **2026** | **4%** | **(b)(ii)3** |
| 2027 | 3.75% | (b)(ii)4 |
| 2028 | 3.5% | (b)(ii)5 |
| 2029 | 3.25% | (b)(ii)6 |
| 2030+ | 3% | (b)(ii)7 |
| 2031+ | −0.2 to −0.3 pt/yr on a revenue trigger | §27-7-5.1 |

2024–2026 came from the Mississippi Tax Freedom Act of 2022 (2022 H.B. 531).
2027–2030 and the trigger came from the Build Up Mississippi Act (2025 H.B. 1),
whose §30 makes the relevant sections effective July 1, 2025. The trigger is a
formula, not a schedule: if the Working Cash-Stabilization Reserve Fund is fully
funded and adjusted general fund revenue exceeds the next year's appropriations
by at least 0.85% / 1% / 1.15% of "the cost of a one percent (1%) cut", the rate
falls 0.2 / 0.25 / 0.3 points. §27-7-5(1)(b)(ii)'s closing sentence adds that if
the rate ever reaches zero "the individual income tax shall stand repealed".

**Nothing changed in the 2026 session, and that was proved rather than assumed.**
The bill-status code-section endpoint returns every measure affecting a section
in a session with its final action: every 2026 measure touching §27-7-5
(SB 2869, SB 2870, SB 3031) and every one touching §27-7-15 (HB 204, HB 344,
HB 489, HB 693, HB 842, HB 1072, HB 4014, HB 4099, SB 2836) shows "Died In
Committee". SB 2869 would have repealed the reduction outright, and its printing
of §27-7-5 with the H.B. 1 subparagraphs marked for deletion is an independent
confirmation that 3.75% / 3.5% / 3.25% / 3% are current law.

## Retirement-income detail
§27-7-15(4) is an exclusion from **gross income**, not a deduction: exempt
retirement income never enters the Mississippi base at all, which is also why it
never affects a threshold.

(4)(k) covers Social Security, Railroad Retirement, the Federal Civil Service
Retirement Act, "any other retirement system of the United States government",
the Mississippi Public Employees' Retirement System, the Highway Safety Patrol
Retirement System, and "any other retirement system of the State of Mississippi
or any political subdivision thereof".

(4)(l) covers everything else — "any public or governmental retirement system
not designated in paragraph (k) or any private retirement system or plan of
which the recipient was a member at any time during the period of his
employment". Roth IRA distributions are treated as under the Internal Revenue
Code. Both paragraphs extend the exemption to the spouse or other beneficiary at
the primary retiree's death.

That employment-link qualifier in (4)(l) is worth carrying rather than smoothing
away: a bare individually-established IRA is not obviously a plan of which the
taxpayer "was a member … during the period of his employment". DOR administers
the exemption broadly — Form 80-100's Line 46 instruction says "retirement
income from federal, state, and private retirement systems are exempt in
total" — so the practical answer is the broad one, but the qualifier is where the
department's authority to police the boundary sits.

### The carve-out
Form 80-100's Line 46 instruction is the operative rule:

> Pensions and annuities that are taxable as early or excess distributions
> under the Federal Internal Revenue Code (see Federal Form 5329) do not
> qualify for exemption from Mississippi income tax. Such income should be
> reported on this line as taxable income. Separation pay is not retirement
> income and does not qualify for exemption. Deferred compensation plan
> distributions received prior to attainment of retirement age and/or service
> requirements are taxable for Mississippi purposes and should be reported on
> this line.

Three distinct exclusions from the exemption, then: anything carrying the
federal early- or excess-distribution tax, separation pay, and deferred
compensation taken before the plan's retirement age or service requirement. The
first is the one that matters for planning, and it keys off **federal Form
5329** — so a distribution qualifying for an IRC 72(t) exception (59½, death,
disability, a substantially-equal-periodic-payment series, and the rest) carries
no additional tax and remains Mississippi-exempt. A pre-59½ withdrawal with no
exception is fully Mississippi-taxable. The department restates it plainly in its
FAQ: "Early distributions are not considered retirement income and may be
subject to tax."

**This is not modelled, and `minAge` is deliberately refused as a proxy.** Two
independent reasons. `retirementExclusion` reads `minAge` against the
*household* — if any person alive meets it, the whole bucket is excluded — so a
62-year-old spouse would restore the exemption for a 58-year-old's withdrawal.
And an age test is not the statutory test: a SEPP series bears no additional tax
and stays exempt at any age, which an age gate would deny. `minAge` is a
different wrong rather than a smaller one. Registered as
`ms-early-or-excess-distribution-not-exempt`, with its direction.

## Deductions and exemptions
Form 80-105 runs: line 13 Mississippi AGI → line 14 standard or itemized
deductions → line 15 exemptions → line 16 Mississippi taxable income → line 17
tax from the Schedule of Tax Computation. **Lines 13 through 16 are per spouse**
(Column A / Column B) on a combined return.

Standard deduction (§27-7-17(3)(b), unindexed): $4,600 married joint or
combined, $2,300 married filing separately, $3,400 head of family, $2,300
single. On a combined return "the standard deduction authorized may be divided
in any manner they choose".

Personal and additional exemptions (§27-7-21): $6,000 single, $12,000 married
living together (one joint exemption, "but one (1) personal exemption … against
their aggregate income"), $9,500 head of family, $1,500 per dependent, $1,500
each for the taxpayer and the spouse aged 65 or over, and the same again for
blindness. DOR prints head of family as $8,000 plus the one required dependent's
$1,500, which reaches the same total.

A married couple both 65 or over therefore subtracts $4,600 + $12,000 + $3,000 =
**$19,600** before the $10,000 zero band even starts. The pack models the first
$4,600 of that and nothing else.

### Why the exemptions are not in the `standardDeduction` field
The same two reasons as Indiana. The pack models no state personal exemption
anywhere — that slot holds a state's *standard deduction*, or for Colorado and
North Dakota the federal-taxable-income converter — so folding Mississippi's in
would make one state an unmarked exception to a fifty-one-state convention. And
the $3,000 age-65 half is per person and conditioned on age while the field is
per filing status, so a figure that priced a 65+ couple right would over-deduct
for one under 65.

## The combined return
Mississippi married couples choose among three methods: "Married persons may
file tax returns in any of these three methods: 1) joint, 2) combined or 3)
separate. Choose the method which results in the least amount of tax." Form
80-105 runs Column A (Taxpayer) / Column B (Spouse) from line 13 through line 16,
and the Schedule of Tax Computation applies the $10,000 zero band **in each
column**. DOR says it outright: "If filing a combined return (both spouses work),
each spouse can calculate their tax liability separately and add the results",
with the worked example "$10,000 + $10,000 = $20,000 X 0% = $0".

So a two-income married couple gets a **$20,000** zero band, not $10,000. The
pack's single band is exact for a joint return and over-charges a combined one
by up to $400 a year. `PerStatus<StateTaxBracket[]>` has one schedule per filing
status and no notion of a per-spouse column, and doubling the married thresholds
would be wrong for a single-income couple, who cannot use the combined method —
so this is registered rather than closed.

**One thing the sources do not settle.** DOR's parenthetical is "(both spouses
work)" and the Form 80-100 text is "both spouses having earned incomes", while
§27-7-17 and §27-7-21 say only "having separate incomes". Whether a retired
couple whose only non-exempt income is interest, dividends and capital gains may
file combined is genuinely open on everything retrievable — and it decides this
record's magnitude for exactly the households this engine models. It is the kind
of question Title 35 Part III would probably answer, which is unreachable.

## Simplifications / not modeled
- **The early/excess-distribution carve-out.** The unconditional `full`
  exemption treats a pre-59½ IRA or 401(k) withdrawal as tax-free when
  Mississippi taxes it. Understates tax for exactly the population a
  bridge-to-Social-Security or Rule-of-55 plan models. Registered.
- **Personal and age-65 exemptions.** $12,000 + $3,000 for a 65+ couple, none of
  it modelled. Overstates tax by about $600 a year on $40,000. Registered.
- **The combined-return per-spouse schedule.** Only the single $10,000 band is
  modelled. Overstates by up to $400 a year. Registered.
- Separation pay and pre-retirement-age deferred compensation distributions,
  which are likewise outside the exemption. Understates; narrow.
- The §27-7-9(f)(10) reduction for gains on Mississippi-entity ownership
  interests; the National Guard / Reserve $15,000 exclusion (§27-7-15(4)(m));
  the credit for tax paid to another state (Form 80-160) — credits are outside
  the pack's declared scope.
- The full §27-7-15(4) exclusion list beyond (d), (k), (l) and (m); itemized
  deductions and the state-income-tax add-back; the catastrophe savings account
  regime; nonresident and part-year proration under §27-7-17(3)(c) and
  §27-7-21(i).

### Net direction, and why it must not be netted
**The sign of the error flips with the household's age, and the flip point sits
exactly where a retirement planner's most interesting decisions get made.**

For a **65-plus Mississippi household living on exempt retirement income plus a
modest investment portfolio** — the modal Mississippi retiree — the pack
**overstates** by $600–$1,000 a year, because the carve-out never fires for
them. For an **early retiree drawing accounts before 59½**, the carve-out
dominates and the pack **understates** by roughly the whole state tax on the
withdrawal. Reading a blended direction for Mississippi would hide both, which
is why each record carries its own sign rather than a net one.

## Open items, for whoever refreshes this
1. **Title 35, Part III of the Mississippi Administrative Code — the DOR's own
   income tax regulations — could not be retrieved at all.** It is published only
   at `www.sos.ms.gov/adminsearch/ACCode/00000158c.pdf`, and that host returns
   HTTP 403 to every client tried: browser User-Agent, Referer from the linking
   DOR page, plain `http`, and the apex domain. This matters specifically for the
   early/excess-distribution rule — the regulation is where a `regulation`-tier
   authority for it would live, and without it the record rests on a form
   instruction and an FAQ. **Anyone with a real browser should pull that PDF and
   check whether Part III adds an age or plan-qualification test the instructions
   only gesture at.**
2. **Session-law chapter numbers are not recorded.** Bill status gives the bill
   number and its actions but not the chapter under which the act was published,
   and DOR's legislation page describes bills by number only. Any "2025 Miss.
   Laws ch. NNN" citation would be a paraphrase; the registry cites the bill and
   its effective-date section instead, both verbatim.
3. **The extraordinary sessions were not checked.** The code-section endpoint
   under `20251E` / `20261E` returns "Document not found", which reads as "no
   measures on this section" but is indistinguishable from "no such session" in
   the response. Not confirmed another way.
4. **Whether a SEPP series stays exempt.** The natural reading is yes — a SEPP is
   reported on Form 5329 with an exception code and bears no additional tax — but
   no Mississippi source says so directly. Flagged because the engine models SEPP
   explicitly, so this is live rather than academic.
5. **No 2026-tax-year Mississippi forms are published yet.** The current
   individual forms are the 2025 set (revisions 09/25 and 12/25). The 2026 rate
   is established by statute and by the department's Tax Rates page, not by a
   form.

## Host notes for whoever refreshes this
- `billstatus.ls.state.ms.us` **works cleanly** and needs no special headers,
  serving both `/documents/<year>/html/<CHAMBER>/<range>/<BILL><stage>.htm` and a
  `/pdf/` twin. **Prefer the HTML**: the PDF flattens the strike/underline markup
  that tells you which words are current law.
- Those HTML pages are Microsoft Word exports, and the **indent characters
  between sentences survive extraction as U+FFFD replacement characters**. A
  quotation that crosses a sentence or subparagraph boundary is therefore a
  passage the page does not contain, however faithfully it was transcribed.
  Every Mississippi quote in the registry is one sentence or one subparagraph
  for that reason — splitting rather than eliding, because an elision would say
  text was dropped and what sits between those sentences is not text.
- `…/perl/<session>p_cs.pl?title=27&chapter=7&section=<n>&sub=` is the
  machine-readable "Locate by Code Section" endpoint: every measure affecting a
  section in a session, with its final action. It is how the negatives above were
  proved.
- `www.dor.ms.gov` works cleanly. Its forms live under
  `/sites/default/files/tax-forms/individual/…` with **space characters in the
  filenames** — a citation must keep the `%20`, and `80100251%202.pdf` is one
  file rather than two.
- **`www.sos.ms.gov` returns HTTP 403 to every non-browser client**, so the
  Mississippi Administrative Code is out of reach from a CLI entirely. Do not
  cite Title 35 from an automated pass; it cannot be verified.

## Cross-checks (not authority)
None. Every figure above was read out of a bill reprinting the Code, a DOR form
or instruction, or a DOR page.

The citations this file previously carried — `ustax.tools`, `ntu.org`,
`blog.turbotax.intuit.com` and `kiplinger.com` — are recorded here as the
provenance of the errors rather than as cross-checks. Between them they supplied
a 2025 rate held forward into a 2026 pack, an exemption list missing the $1,500
age-65 item, a claim that the retirement exemption applies "regardless of age"
without the carve-out that qualifies it, and an assertion that modelling one
$10,000 zero band for married filers is "correct". `kiplinger.com` is in the
`SECONDARY_AGGREGATORS` set the conformance suite holds permanently
inadmissible.

## Registered rules
Every lever above is registered in
`packages/engine/src/rules/taxRuleRegistry.ts` under `jurisdiction: 'state:MS'`:

| Rule id | Classification |
|---|---|
| `ms-27-7-5-rate-ramp` | settled |
| `ms-27-7-15-4-retirement-income-excluded-from-gross-income` | settled |
| `ms-27-7-17-standard-deduction-unindexed` | settled |
| `ms-capital-gains-taxed-as-ordinary` | settled |
| `ms-early-or-excess-distribution-not-exempt` | approximated (understates tax) |
| `ms-27-7-21-personal-and-age-65-exemptions` | approximated (overstates tax) |
| `ms-combined-return-runs-the-schedule-per-spouse` | approximated (overstates tax) |

## Citations (primary only)
- 2025 H.B. 1 (Build Up Mississippi Act), as sent to Governor — §27-7-5 as
  amended, the §27-7-5.1 trigger, and the effective date:
  https://billstatus.ls.state.ms.us/documents/2025/html/HB/0001-0099/HB0001SG.htm
- 2022 H.B. 531 (Mississippi Tax Freedom Act of 2022), as sent to Governor:
  https://billstatus.ls.state.ms.us/documents/2022/html/HB/0500-0599/HB0531SG.htm
- 2026 S.B. 2869, as introduced (died in committee) — prints §27-7-5 with the
  H.B. 1 subparagraphs marked for deletion, and names §27-7-5.1:
  https://billstatus.ls.state.ms.us/documents/2026/html/SB/2800-2899/SB2869IN.htm
- Miss. Code Ann. §27-7-15 (gross income; the retirement exclusions), reprinted
  in 2026 H.B. 489:
  https://billstatus.ls.state.ms.us/documents/2026/html/HB/0400-0499/HB0489PS.htm
  cross-checked word for word against 2026 H.B. 693:
  https://billstatus.ls.state.ms.us/documents/2026/html/HB/0600-0699/HB0693IN.htm
- Miss. Code Ann. §27-7-17 (deductions; the standard deduction), brought forward
  in 2026 H.B. 866:
  https://billstatus.ls.state.ms.us/documents/2026/html/HB/0800-0899/HB0866IN.htm
- Miss. Code Ann. §27-7-21 (exemptions), brought forward in 2026 H.B. 1996:
  https://billstatus.ls.state.ms.us/documents/2026/html/HB/1900-1999/HB1996IN.htm
- MS DOR, Individual Income Tax — Tax Rates, Exemptions, Deductions:
  https://www.dor.ms.gov/individual/tax-rates
- 2025 Form 80-100 instructions (the Line 46 carve-out, the Line 40 capital-gain
  rule, the Schedule of Tax Computation, the three filing methods):
  https://www.dor.ms.gov/sites/default/files/tax-forms/individual/80100251%202.pdf
- 2025 Form 80-105 (the per-spouse column structure; exemptions line):
  https://www.dor.ms.gov/sites/default/files/tax-forms/individual/80105258%201.pdf
- MS DOR, Individual Income Tax FAQ:
  https://www.dor.ms.gov/individual/individual-income-tax-frequently-asked-questions
