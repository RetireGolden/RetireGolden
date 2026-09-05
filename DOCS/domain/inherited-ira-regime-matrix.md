# Inherited IRA regime matrix — authority, facts, and the supported-regime boundary

**Status:** Authored 2026-08-07 for WS1 of the *Inherited IRA compliance depth* plan
(`enhancements/inherited-ira-compliance-depth.md` in the RetireGolden-Docs repo). Folded into ground
truth at WS5 (2026-08-08); this document remains the normative boundary for regime-law changes. The
executed-and-surfaced summary lives in [taxes.md](../features/taxes.md),
[domain-rules-reference.md](domain-rules-reference.md), and
[tax-strategy-coverage-inventory.md](tax-strategy-coverage-inventory.md). Later workstreams (schema,
table engine, ledger execution) implement against this matrix; they must not widen it silently.

Scope note: this matrix classifies planning regimes for inherited traditional and Roth IRAs. It is
implementation ground truth, not legal or tax advice, and nothing here is filing-grade.

Abbreviations used throughout: **RBD** — required beginning date, April 1 after the owner attains
the applicable age (IRC §401(a)(9)(C)); **EDB** — eligible designated beneficiary (IRC
§401(a)(9)(E)(ii)); **LE** — life expectancy.

## 1. Authority matrix

Primary authorities, what each controls, and the dates that bind. Citations name the operative
subparagraph; a bare section number is never a pin.

| Authority | What it controls | Effective / applicability | Standing |
|---|---|---|---|
| IRC §401(a)(9)(B)(i) | At-least-as-rapidly rule: death on/after the RBD keeps annual distributions running. | Statutory; as construed by the 2024 final regs for 10-year-rule beneficiaries. | Controlling |
| IRC §401(a)(9)(B)(ii)–(iii) | 5-year rule and the life-expectancy exception for deaths before the RBD. | Statutory. | Controlling |
| IRC §401(a)(9)(C); SECURE 2.0 §107 | Required beginning date: April 1 after attaining the applicable age — 70½ (born before 7/1/1949, a birth-*date* test), 72 (SECURE), 73 (attaining 72 after 12/31/2022), 75 (attaining 74 after 12/31/2032). The enacted §107 text places the born-1959 cohort in both the 73 and 75 buckets; Treas. Reg. §1.401(a)(9)-2(b)(2)(v) is [Reserved]; Prop. Reg. §1.401(a)(9)-2(b)(2)(v) (REG-103529-23) would resolve it to 73. The cited Announcement 2026-7 sentence addresses anticipated applicability for amendments to §§1.401(a)(9)-4, -5, and -6. | Age-73 tier from 2023. Born-1959 resolution: proposed only. | Controlling, except born-1959 → unsettled |
| IRC §401(a)(9)(E)(i)–(iii) | Designated beneficiary; the five eligible-designated-beneficiary (EDB) classes; EDB status fixed at the date of the owner's death; minor child loses EDB status at majority with a 10-year tail. | SECURE Act §401; deaths after 12/31/2019. | Controlling |
| IRC §401(a)(9)(H)(i)–(vi) | The 10-year rule replacing the 5-year rule for designated beneficiaries; life-expectancy exception reserved to EDBs; successor 10-year rule after an EDB's death; IRAs treated as defined-contribution plans for these rules ((H)(vi)). | Deaths after 12/31/2019 (SECURE Act §401(b)(1)); pre-effective-date decedents' beneficiaries handled by SECURE Act §401(b)(5). | Controlling |
| Treas. Reg. §1.401(a)(9)-3(c) | Death before RBD: 5-year rule (c)(2), 10-year rule (c)(3) — full distribution by the end of the calendar year that includes the tenth anniversary of death; life-expectancy rule (c)(4); defaults and elections (c)(5): non-EDB → 10-year, EDB → life expectancy, no designated beneficiary → 5-year; plan-permitted elections in (c)(5)(iii). | T.D. 10001 final regs; distribution calendar years on/after 1/1/2025. | Controlling from 2025 |
| Treas. Reg. §1.401(a)(9)-3(d) | Sole-beneficiary surviving spouse may delay commencement to the end of the calendar year the owner would have attained the applicable age. | Same. | Controlling from 2025 |
| Treas. Reg. §1.401(a)(9)-4(c) | Beneficiary determination: designated as of death, standing not disqualified by September 30 of the year after death (predecease/disclaimer/full payout). | Same. | Controlling from 2025 |
| Treas. Reg. §1.401(a)(9)-4(e) | EDB definitions: minor child of the owner (§152(f)(1)) with majority at the 21st birthday ((e)(3)); disabled ((e)(4), tracking §72(m)(7) with an under-18 standard and an SSI deemed-disability rule); chronically ill ((e)(5), §7702B(c)(2) with practitioner certification); not-more-than-10-years-younger measured birth-date to birth-date ((e)(6)); disability/chronic-illness documentation due October 31 of the year after death ((e)(7)). | Same. | Controlling from 2025 |
| Treas. Reg. §1.401(a)(9)-5(d)(1) | Death on/after RBD: annual beneficiary RMDs continue every year after the year of death ((d)(1)(i)); denominator is the greater of the designated beneficiary's and the owner's remaining life expectancy ((d)(1)(ii)); owner-only expectancy when there is no designated beneficiary ((d)(1)(iii)). | Same; for 2021–2024 the annual amounts for 10-year-rule beneficiaries are the notice-waived "specified RMDs" below. | Controlling from 2025 |
| Treas. Reg. §1.401(a)(9)-5(d)(3) | Life-expectancy mechanics: Single Life Table only ((d)(3)(i)); owner's expectancy set in the death year then reduced by one ((d)(3)(ii)); non-spouse beneficiary's expectancy set at the age attained in the year after death then reduced by one ((d)(3)(iii)); sole-spouse expectancy redetermined annually until the spouse's death ((d)(3)(iv)). | Same. | Controlling from 2025 |
| Treas. Reg. §1.401(a)(9)-5(d)(2) | Death before the RBD under the life-expectancy rule: the applicable denominator is the designated beneficiary's remaining life expectancy — no greater-of-owner arm. | Same. | Controlling from 2025 |
| Treas. Reg. §1.401(a)(9)-5(e) | General outer deadlines whenever §401(a)(9)(H) applies, regardless of death-vs-RBD timing: full distribution by the **earliest** of ((e)(1)) — the year including the 10th anniversary of death for a non-EDB designated beneficiary ((e)(2)); the year including the 10th anniversary of an EDB's death ((e)(3)); the year including the 10th anniversary of a minor child reaching majority ((e)(4)). | Same. | Controlling from 2025 |
| Treas. Reg. §1.401(a)(9)-5(g)(3) | SECURE 2.0 §327 spouse-as-employee treatment. Final reg: (g)(3)(i) is a plan-permissive election; (g)(3)(ii) is **[Reserved]**. Prop. Reg. §1.401(a)(9)-5(g)(3)(ii)(A) (REG-103529-23, 89 FR 58644, July 19, 2024) would make the treatment **automatic (opt-out)** where the owner died before the RBD, the spouse is sole beneficiary under the life-expectancy rule, and the first spouse-LE year is 2024 or later. §327 reaches IRAs through §408(a)(6) incorporation; what is unresolved is the governing text, not the incorporation. | §327 statutorily applies to calendar years after 2023; the implementing regs are proposed only, and Announcement 2026-7 defers them (see applicability note below). | Unsettled — see S1/S4 |
| Treas. Reg. §1.401(a)(9)-9(b), (c) | The Single Life Table and Uniform Lifetime Table (the 2022 tables, T.D. 9930). | Distribution calendar years beginning on/after 1/1/2022 (§1.401(a)(9)-9(f)(1)). | Controlling |
| Treas. Reg. §1.401(a)(9)-9(f)(2) | Transition reset: (f)(2)(i) triggers the reset for an employee (or spouse) who died before January 1, 2022 with a fixed subtract-one expectancy; (f)(2)(ii)(A) states the mechanics — redetermine under the 2022 Single Life Table at the age attained in the original lookup year, then reduce by one for each subsequent year; (f)(2)(ii)(B) works the example (2019 death, 76-year-old beneficiary, 2022 denominator 12.1 = 14.1 − 2). Pin confirmed against the eCFR regulatory text 2026-08-08 (WS3), resolving WS1's `VERIFY:` flag. | Same. | Controlling |
| Treas. Reg. §1.408-8(a)(1) | IRAs take the §401(a)(9) rules of §§1.401(a)(9)-1 through -9 except as §1.408-8 provides otherwise. | T.D. 10001. | Controlling from 2025 |
| Treas. Reg. §1.408-8(b)(1)(i)–(ii) | An IRA owner's RBD is April 1 of the year after attaining the applicable age — no still-working deferral ((b)(1)(i)). Roth IRAs are not subject to lifetime RMDs ((b)(1)(ii)). | Same. | Controlling from 2025 |
| Treas. Reg. §1.408-8(e)(4)(i) | Year-of-death RMD: the decedent's unsatisfied RMD for the calendar year of death must still come out, allocated across the decedent's IRAs to their beneficiaries. T.D. 10001 adds an automatic §4974 waiver when it is taken by the later of the beneficiary's filing deadline for the death year or the end of the following calendar year. | Same. | Controlling from 2025 |
| Treas. Reg. §1.408-8(c) | Spouse treat-as-own: a surviving spouse may redesignate the account as their own ((c)(1)(i)), with eligibility — sole beneficiary plus an unlimited withdrawal right — in (c)(1)(ii) (subparagraph pins verified against the eCFR text 2026-08-08); the timing bar and late-election catch-up are (c)(1)(iii)–(iv); a deemed election occurs on a missed beneficiary RMD or an owner-style contribution ((c)(2)); after election the spouse is owner for all Code purposes ((c)(3)). | Same. | Controlling from 2025 |
| Treas. Reg. §1.408-8(e)(2)(ii) | A beneficiary aggregates RMDs only across IRAs inherited from the same decedent, never with owned IRAs or other decedents' IRAs. | Same. | Out of scope v1 (single-account model) |
| IRC §408(d)(3)(C) | No rollover of an inherited IRA — except a surviving spouse's, which is not "inherited" for this purpose ((C)(ii)). | Statutory. | Controlling |
| IRC §72(t)(2)(A)(ii) | Death exception: beneficiary distributions are never subject to the 10% early-distribution addition. | Statutory. | Controlling |
| Treas. Reg. §1.408A-6, A-14 | Roth IRAs: no lifetime RMDs (A-14(a)); post-death rules apply with the owner treated as having died **before** the RBD (A-14(b)); non-qualified amounts taxed under the A-4 ordering rules (A-14(c)). The pre-SECURE text's 5-year framing is superseded by §401(a)(9)(H) via §408(a)(6). | Pre-SECURE regulation; before-RBD treatment carried forward by the final-reg framework. | Controlling |
| Notices 2022-53, 2023-54, 2024-35 | Excise-tax waiver for "specified RMDs": annual amounts in 2021–2024 for a designated beneficiary of an owner who died in 2020–2023 on/after the RBD and who is not using the life-expectancy exception. (The notices' second prong — successor beneficiaries of EDBs — is inapplicable here because successors are unsupported, X2.) Notice 2024-35 §III fixes final-reg applicability at calendar years on/after 1/1/2025. | 2021–2024 distribution years. | Controlling for relief years |
| SECURE 2.0 §302; IRC §4974(a) | Excise tax on missed RMDs: 25%, reduced to 10% within the correction window, for taxable years beginning after 12/29/2022. | Statutory. | Out of scope v1 (named, not modeled) |
| IRS Pub 590-B (current edition) | Plain-language explanation of beneficiary distribution rules. | Annual. | Secondary only — never the pin |

T.D. 10001 identification: final RMD regulations published July 19, 2024 (89 FR 58886), applicable
to distribution calendar years beginning on or after January 1, 2025 — corroborated by Notice
2024-35 §III. For 2020–2024 distribution years the operative interpretation is the 2022 proposed
regulations (87 FR 10504) plus the three relief notices; the engine models those years by the
final-reg method with the relief years' annual amounts marked non-enforced, and states so in
evidence rather than pretending the final regs governed then.

**Applicability posture as of 2026.** Two layers coexist. The T.D. 10001 *finalized* text applies
from the 2025 distribution calendar year and every "Controlling from 2025" cell above rests on it.
The SECURE 2.0 overlay — the automatic spouse-as-employee rule, the born-1959 applicable-age fix in
Prop. Reg. §1.401(a)(9)-2, and the other paragraphs T.D. 10001 reserved — exists only in
REG-103529-23 (89 FR 58644), and Announcement 2026-7 defers those future final regs (amending
§§1.401(a)(9)-4, -5, and -6) to the distribution calendar year beginning no earlier than 6 months
after their eventual publication, with a reasonable good-faith interpretation standard in the
interim. Every regime this matrix marks **unsettled** for that reason publishes a disclosure field;
none of them may be presented as filing-grade.

## 2. Fact model

The minimum explicit facts a plan must carry before the classifier may choose a regime. A missing
or contradictory fact yields `needs-review/unsupported` — the classifier never guesses a legal
status from age, relationship, or account history.

| Fact | Values | Unknown handling |
|---|---|---|
| Account class | `inherited-traditional` \| `inherited-roth` | Required; no default. |
| Owner death year | Calendar year | Required; death before 2020 → `legacy-planning-approximation` (pre-SECURE regimes are not modeled). |
| Owner birth date | Date; year alone suffices only when the applicable-age tier and the RBD comparison are unambiguous at year precision | Required for RBD derivation and the §1.401(a)(9)-5(d)(1)(ii) greater-of test when death is on/after the RBD. Born 1949 (the 70½ boundary is July 1, 1949) or any case where the before/on-after-RBD answer flips within the birth year → month/day required, else `needs-review`. Born 1959: retain candidate RBD dates April 1, 2033 (age 73) and April 1, 2035 (age 75); refuse only when those candidates disagree on before/on-after RBD; outside both candidate RBD years resolve when the asserted fact agrees; at the same candidate RBD year the year-only asserted-status tie-break applies (applicable age remains contested — see §1 authority row). Unknown → `needs-review` for post-RBD deaths. |
| Death before or on/after RBD | Derived: April 1 after the year the owner attained the applicable age (IRC §401(a)(9)(C), SECURE 2.0 §107; no still-working deferral for IRAs, §1.408-8(b)(1)(i)). Roth IRAs: always treated as before the RBD (§1.408A-6, A-14(b)) — the fact is not consulted. | Underivable at the available birth-date precision → `needs-review`, never a guessed side. |
| Owner's year-of-death RMD satisfied? | boolean | Required when death is on/after the RBD: the decedent's unsatisfied death-year RMD (Uniform Lifetime denominator at the owner's age) passes to the beneficiary (§1.408-8(e)(4)(i)). `false`/unknown → the schedule's year-0 entry carries it; the engine never assumes it was taken. |
| Beneficiary class | `designated-individual` \| `estate` \| `trust` \| `entity` \| `successor-beneficiary` | Required. Non-individual and successor classes → `unsupported` (fail closed). The user asserts the class; the September 30 / disclaimer mechanics of §1.401(a)(9)-4(c) are not adjudicated by the engine. |
| EDB category | `none` \| `surviving-spouse` \| `minor-child` \| `disabled` \| `chronically-ill` \| `not-more-than-10-years-younger` | Required when beneficiary is a designated individual. Asserted, not inferred: the engine may *check* the 10-years-younger arithmetic from birth dates (§1.401(a)(9)-4(e)(6)) and the minor-child age (21st birthday, (e)(3)), and must refuse a contradiction, but it never promotes a beneficiary into `disabled`/`chronically-ill` — those turn on §72(m)(7)/§7702B(c)(2) determinations and the (e)(7) documentation deadline the engine cannot see. |
| Beneficiary birth year | Calendar year | Required for any regime with an annual life-expectancy amount and for consistency checks. |
| Sole beneficiary? | boolean | Required for spouse regimes and any annual-RMD regime; `false` (multiple beneficiaries, no separate-account facts) → `unsupported` (separate-account rules of §1.401(a)(9)-8 are out of scope). |
| Spouse unlimited withdrawal right? | boolean | Required for the treat-as-own election (§1.408-8(c)(1)); `false` or unknown → the election classifies `needs-review`, never S2. |
| Beneficiary election | Spouse: `none` \| `remain-beneficiary` \| `treat-as-own` \| `ten-year-election`. Non-spouse EDB: `none` \| `ten-year-election`. | Deliberate state, never inferred. Spouse `none` defaults to the life-expectancy rule (S0 → S1) per §1.401(a)(9)-3(c)(5)(i) — a legal default, not a guess. `treat-as-own` is a state transition (regime S2). The §1.408-8(c)(2) *deemed* election is out of scope: the engine models only explicit elections and flags the deemed-election risk in evidence. SECURE 2.0 §327 spouse-as-employee is `unsupported` v1 (S4). |
| Roth 5-taxable-year start | Calendar year of the owner's first Roth contribution | Required for inherited-Roth taxability evidence; unknown → distributions modeled with `needs-review` taxability, never silently assumed qualified. |
| Provenance | Source + as-of date for the above facts | Required by WS2 schema for review workflows. |

## 3. Decision table

Facts → regime. Every row's regime key is the unambiguous identifier WS2–WS4 build against.
Classification column: **settled** (implement + cite + discriminating fixture), **unsettled**
(implement statutory reading, cite both sides, publish a disclosure field), **out-of-scope** (fail
closed with a typed refusal naming the missing rule).

Year-0 obligation, common to every post-RBD-death row: the decedent's unsatisfied year-of-death
RMD passes to the beneficiary (§1.408-8(e)(4)(i)) and appears as the schedule's year-0 entry
whenever the `year-of-death RMD satisfied` fact is not `true`. It is computed on the owner's own
denominator for that year, not the beneficiary's. Death **before** the RBD extinguishes any
pending first-distribution-year amount — the entire interest is then governed by the before-RBD
rules of §1.401(a)(9)-3, so no year-0 entry exists for a before-RBD death even when the owner had
already attained the applicable age.

Match precedence: X rows → S rows → R/K rows. A fact set matching any X condition (pre-2020
death, successor, non-individual, multiple beneficiaries without separate-account facts, missing
or contradictory facts) never reaches an R/S/K row; the R/S/K rows additionally require the
beneficiary to be the account's sole beneficiary. A beneficiary who is the owner's surviving
spouse must be asserted `surviving-spouse` — spousal status dominates every other EDB category,
and the S rows bind before R3/R3a. Asserting a non-spouse EDB category for a beneficiary whose
relationship facts say spouse is an X5 contradiction.

| # | Facts | Regime key | Annual years 1–9 | Final deadline | Citations | Class |
|---|---|---|---|---|---|---|
| R1 | Traditional; death ≥2020 on/after RBD; designated individual; no EDB category | `ten-year-with-annual-rmds` | Yes, from the year after death: start-of-year balance ÷ the greater of the two §4 arms — the arms run on different anchors (beneficiary: unreduced in its lookup year; owner: already −1 that year), see §4. For deaths in 2020–2023, the annual amounts due in 2021–2024 are marked notice-waived | End of the calendar year that includes the 10th anniversary of death | §401(a)(9)(B)(i), (H)(i)–(ii); §1.401(a)(9)-5(d)(1)(i)–(ii), (d)(3)(i)–(iii), (e)(2); Notices 2022-53/2023-54/2024-35 | Settled |
| R2 | Traditional; death ≥2020 before RBD; designated individual; no EDB category | `ten-year-no-annual` | No — voluntary only | End of the calendar year that includes the 10th anniversary of death | §401(a)(9)(B)(ii), (H)(i); §1.401(a)(9)-3(c)(3), (c)(5)(i); §1.401(a)(9)-5(e)(2) | Settled |
| R3 | Traditional; death ≥2020; EDB: `minor-child`, `disabled`, `chronically-ill`, or `not-more-than-10-years-younger`; election `none` | `edb-life-expectancy` | Yes, from the year after death: Single Life, fixed subtract-one. Death before RBD: beneficiary expectancy only (§1.401(a)(9)-5(d)(2)). Death on/after RBD: greater-of-owner test applies (§(d)(1)(ii)) | Expectancy exhaustion while the EDB lives; minor child — EDB until the 21st birthday, then full distribution by the end of the calendar year including that date's 10th anniversary, annual RMDs continuing in the tail (§(e)(4)). The EDB's own death starts a successor 10-year clock (§(e)(3)) that is X2: the engine flags it, never schedules it | §401(a)(9)(B)(iii), (E)(ii)–(iii), (H)(ii); §1.401(a)(9)-4(e); §1.401(a)(9)-3(c)(4), (c)(5)(i); §1.401(a)(9)-5(d)(1)(ii), (d)(2), (d)(3)(iii), (e)(1), (e)(4) | Settled |
| R3a | R3 facts (traditional or Roth EDB), death before RBD (always true for Roth), election `ten-year-election` | `edb-ten-year-elected` | No | End of the calendar year that includes the 10th anniversary of death | §1.401(a)(9)-3(c)(5)(iii) — an IRA-agreement-permitted election the engine cannot confirm | Unsettled (disclosure: election validity depends on the IRA agreement) |
| S0 | Traditional; spouse sole beneficiary; election `none`; no election recorded → the life-expectancy default applies (this row is S1's regime under the legal default) | `spouse-remain-beneficiary` | As S1; evidence flags the §1.408-8(c)(2) deemed-election risk (a missed beneficiary RMD or an owner-style contribution silently converts the account) | As S1 | Death before RBD: §1.401(a)(9)-3(c)(5)(i) (EDB default is the life-expectancy rule). Death on/after RBD: annual continuation is mandatory, not elective (§401(a)(9)(B)(i); §1.401(a)(9)-5(d)(1)) | Settled default; disclosure carries the deemed-election risk |
| S3x | Any `ten-year-election` asserted for a death on/after the RBD (spouse or non-spouse EDB) | `needs-review/unsupported` | — | — | The §1.401(a)(9)-3(c)(5)(iii) election exists only in the death-before-RBD regime; asserting it post-RBD is a contradictory fact set | Fail closed |
| S1 | Traditional; spouse sole beneficiary; election `remain-beneficiary` | `spouse-remain-beneficiary` | Yes. Death before RBD: spouse's Single Life expectancy redetermined annually ((d)(2), (d)(3)(iv)); commencement deferred up to the end of the year the owner would have attained the applicable age. Death on/after RBD: greater of the annually-redetermined spouse arm and the owner's fixed-minus-one arm (§(d)(1)(ii), (d)(3)(ii), (d)(3)(iv)) | Spouse's death triggers successor rules → out of scope beyond flagging | §401(a)(9)(B)(iii)–(iv); §1.401(a)(9)-3(d); §1.401(a)(9)-5(d)(1)(ii), (d)(2), (d)(3)(ii), (d)(3)(iv) | Death on/after RBD: settled. Death before RBD: **unsettled** — Prop. Reg. §1.401(a)(9)-5(g)(3)(ii)(A) would automatically treat the spouse as the employee (Uniform Lifetime Table, materially smaller RMDs) when the first spouse-LE year is ≥2024; v1 models the Single Life reading and publishes a disclosure naming the proposed automatic rule |
| S2 | Traditional or Roth; spouse sole beneficiary with unlimited withdrawal right; election `treat-as-own` | `spouse-treat-as-own-transition` | Account leaves inherited status in the election year and becomes the spouse's own IRA (owner rules; Uniform Lifetime Table for traditional, no lifetime RMDs for Roth (§1.408-8(b)(1)(ii)); contributions/conversions permitted). **Preconditions:** the election is barred in a year the §1.402(c)-2(j)(4) catch-up rules would apply (§1.408-8(c)(1)(iii)), and a late election first requires distributing that year's §1.402(c)-2(j)(4)(ii) hypothetical RMDs (§1.408-8(c)(1)(iv)). The (j)(4) gate reaches only a spouse under the §1.401(a)(9)-3(c)(3) 10-year rule, and its hypotheticals are spouse-as-employee Uniform Lifetime amounts at the spouse's attained age (§1.402(c)-2(j)(4)(iii) via §1.401(a)(9)-5(g)(3)(i)) from the later of the two applicable-age years ((j)(4)(iv)) through the election year — verified against the eCFR text 2026-08-08 (WS3), correcting this row's earlier as-beneficiary description. The (j)(4) hypotheticals are an evidence-only helper for the timing-gate disclosure; catch-up execution is a named residual (the ledger does not force those amounts as taxable distributions before the transition completes). The (j)(4)(ii)–(iii) netting of actual distributions against adjusted balances remains residual ledger work | n/a after a completed transition | IRC §408(d)(3)(C)(ii); §1.408-8(c)(1)(i)–(iv), (c)(3) | Settled as an explicit transition with the (c)(1)(iii)–(iv) gates modeled; the (c)(2) deemed election is never inferred |
| S3 | Traditional or Roth; spouse sole beneficiary; **death before RBD** (always true for Roth); election `ten-year-election` | `spouse-ten-year-elected` | No | End of the calendar year that includes the 10th anniversary of death | §1.401(a)(9)-3(c)(3), (c)(5)(iii) | Unsettled (same disclosure as R3a) |
| S4 | Spouse; SECURE 2.0 §327 spouse-as-employee treatment asserted as governing | `unsupported` | — | — | Final §1.401(a)(9)-5(g)(3)(ii) is [Reserved]; the automatic rule exists only in REG-103529-23, deferred by Announcement 2026-7 | Out-of-scope (refusal names the unfinalized rule; S1's death-before-RBD disclosure points here) |
| K1 | Inherited Roth; designated individual; no EDB category | `roth-ten-year-no-annual` | No — owner is always treated as dying before the RBD | End of the calendar year that includes the 10th anniversary of death | §1.408A-6, A-14(b); §401(a)(9)(H)(i) via §408(a)(6); §1.401(a)(9)-3(c)(3); §1.401(a)(9)-5(e)(2) | Settled |
| K2 | Inherited Roth; EDB; election `none` or spouse `remain-beneficiary` | `roth-edb-life-expectancy` | Yes: Single Life per §1.401(a)(9)-5(d)(2); non-spouse fixed subtract-one ((d)(3)(iii)), sole-spouse redetermined annually ((d)(3)(iv)); no greater-of test (no post-RBD death exists for Roth) | As R3/S1 | §1.408A-6, A-14(b); §1.401(a)(9)-3(c)(4), (d); §1.401(a)(9)-5(d)(2), (d)(3)(iii)–(iv) | Non-spouse arm settled. Spouse arm **unsettled** — the same proposed §327 automatic rule behind S1's disclosure would, for a Roth, treat the spouse as owner with no lifetime RMDs at all (§1.408-8(b)(1)(ii)), a larger swing than S1's; WS3 aligned this cell with S1's unsettled posture (it previously read "settled with disclosure", inconsistent with S1) |
| K3 | Inherited Roth taxability — an evidence contract attached to every K row, not a competing match target | `roth-taxability-evidence` | Distributions are always free of the 10% early-distribution addition (§72(t)(2)(A)(ii)). Taxability follows the A-4 ordering rules: contribution basis comes out first, tax-free; earnings are includible in gross income unless the distribution is qualified (owner's 5-taxable-year period met) | — | §1.408A-6, A-4, A-14(c); IRC §72(t)(2)(A)(ii) | Settled for the ordering skeleton; `needs-review` when the 5-year start fact is absent |
| X1 | Death before 2020 | `legacy-planning-approximation` | Whatever the prior two-field projection produced, visibly labeled | — | SECURE Act §401(b)(1) boundary | Out-of-scope (pre-SECURE regimes not modeled; never mapped onto post-SECURE rules) |
| X2 | Successor beneficiary (beneficiary of a beneficiary), incl. post-S1 spouse death | `unsupported` | — | — | §401(a)(9)(H)(iii); §1.401(a)(9)-5(e)(3); SECURE Act §401(b)(5). The relief notices' successor prong is therefore never applied | Out-of-scope (fail closed) |
| X3 | Estate, trust, or entity beneficiary | `unsupported` | — | — | §1.401(a)(9)-4(f) see-through rules not modeled | Out-of-scope (fail closed) |
| X4 | Multiple beneficiaries without separate-account facts | `unsupported` | — | — | §1.401(a)(9)-8(a) | Out-of-scope (fail closed) |
| X5 | Any required fact missing or contradictory (e.g. claimed minor child aged 30; claimed ≤10-years-younger contradicted by birth years; owner birth-date precision insufficient to place death vs RBD; owner born 1959 when the 73/75 candidates disagree on before/on-after RBD) | `needs-review/unsupported` | — | — | Fact model §2 | Fail closed |

Completeness rule: the classifier is total over §2's fact space. K3 is outside that one-row guarantee: it is an evidence contract that attaches to whichever K row matched, never a match target itself. Every combination matches exactly
one row above, and a combination no row claims is itself an X5 defect — WS3's decision-table test
matrix must enumerate the join and prove it.

## 4. Divisor mechanics

- **Table.** Single Life Table of §1.401(a)(9)-9(b) for every beneficiary expectancy
  (§1.401(a)(9)-5(d)(3)(i)). The Uniform Lifetime Table appears only after a completed
  treat-as-own transition, where the account is no longer inherited. No SSA mortality table, and
  no `baselineRemainingYears`, anywhere in these paths.
- **Initial lookup.** Non-spouse: age attained in the calendar year after the owner's death;
  fixed, then reduced by one each later year (§1.401(a)(9)-5(d)(3)(iii)). Sole-beneficiary spouse:
  redetermined annually at the attained age until the spouse's death (§(d)(3)(iv)).
- **Greater-of test.** Death on/after the RBD only: the denominator is the greater of the
  beneficiary's and the owner's remaining expectancy, the owner's being set at the death-year age
  and reduced by one (§1.401(a)(9)-5(d)(1)(ii), (d)(3)(ii)). The two arms never share a clock: in
  the first distribution year the beneficiary arm is its unreduced table entry while the owner arm
  is already reduced by one, because their lookup years differ. Death before the RBD uses the
  beneficiary's expectancy alone (§(d)(2)) — a WS3 discriminating fixture must separate the two
  arms. This is why the schema must carry the owner's birth date; the greater-of arm binds
  whenever the owner out-lives the beneficiary in expectancy terms.
- **Year-of-death RMD.** For a post-RBD death, year 0 of the schedule is the decedent's own
  unsatisfied RMD passed to the beneficiary under §1.408-8(e)(4)(i) — never the beneficiary's
  Single Life amount. The denominator is the decedent's lifetime denominator: Uniform Lifetime at
  the owner's attained age, except that a sole-beneficiary spouse more than 10 years younger takes
  the Joint and Last Survivor Table (§1.401(a)(9)-5(c)(2)(i)) — a WS3 correction to this bullet's
  earlier unconditional Uniform Lifetime statement. A 2020 death year carries no year-of-death RMD
  at all (IRC §401(a)(9)(I), CARES Act §2203).
- **Spouse treat-as-own catch-up.** A late S2 election first distributes the §1.408-8(c)(1)(iv)
  hypothetical RMDs of §1.402(c)-2(j)(4): spouse-as-employee Uniform Lifetime amounts at the
  spouse's attained age, from the later applicable-age year through the election year (see the S2
  row); the transition completes only after that catch-up is scheduled.
- **2022 table reset.** A fixed expectancy first set before 2022 (death in 2020, first
  distribution year 2021) is redetermined once under the 2022 Single Life Table at the original
  lookup age, then reduced by one per elapsed year (§1.401(a)(9)-9(f)(2)(i), mechanics in
  (f)(2)(ii)(A), worked example in (f)(2)(ii)(B) — pin confirmed against the eCFR text, WS3).
  Because the engine carries only the 2022 tables and always computes a fixed expectancy as the
  current-table entry at the first-distribution-year age minus elapsed years, the reset is the
  formula's natural behavior for a 2020 death from the 2022 distribution year on — a
  discriminating fixture must still pin it. Distribution calendar years before 2022 (a 2020
  death's 2021 first year, and 2020/2021 year-of-death RMDs) were governed by the formerly
  applicable tables (§1.401(a)(9)-9(f)(1)), which the engine does not carry: those amounts are
  published as a typed `pre-2022-tables-not-carried` limitation, never computed from the wrong
  table.
- **Relief years.** For `ten-year-with-annual-rmds`, the 2021–2024 annual amounts are computed and
  published as evidence but marked `notice-waived` (Notices 2022-53/2023-54/2024-35); the final
  sweep deadline is unaffected. The waiver does not extend the 10-year deadline and does not apply
  to EDB life-expectancy payments.

## 5. Penalty integration and remaining out-of-scope mechanics

The projection now prices §4974(a) on an inherited traditional or Roth IRA's computed shortfall: 25% by default,
10% only with explicit same-applicable-plan correction and Form 5329 evidence inside the statutory window, and
zero only for an explicit discretionary grant or the two final-regulation automatic-waiver fact patterns. An
explicit `decedentId` is required before multiple inherited IRAs aggregate; absent identity fails closed per
account. The excise is reported in `penalties`, outside ordinary income and MAGI. Correction evidence does not
itself move account dollars or synthesize the corrective distribution's tax character. If a balance survives a
5-year or 10-year emptying deadline, the entire remaining balance stays required in every subsequent year and the
engine continues pricing each later miss.

Still named so no consumer can assume them: treatment of relief-notice years beyond marking
those annual amounts non-enforced; separate-account rules (§1.401(a)(9)-8(a)); see-through-trust
qualification (§1.401(a)(9)-4(f)); qualified disclaimers and the September 30 / October 31
determination mechanics (§1.401(a)(9)-4(c), (e)(7)); annuitized payouts (§1.401(a)(9)-6); the
same-decedent aggregation election's allocation mechanics beyond the explicit identity group
(§1.408-8(e)(2)(ii)); SECURE 2.0 §327 spouse-as-employee; the
§1.408-8(c)(2) deemed treat-as-own election; successor-beneficiary schedules.

## 6. Reconciliation with what is already shipped

- `treas-reg-1-401-a-9-5-d-3-beneficiary-single-life-denominator` — retained. The shipped fixed
  subtract-one Single Life divisor is exactly R1's beneficiary-side arm; the matrix adds the
  greater-of-owner arm and the regimes around it.
- `treas-reg-1-401-a-9-5-d-1-ii-greater-of-employee-life-expectancy` (approximated: greater-of not
  applied, schema lacks decedent age) — superseded by WS2/WS3: the fact model requires the owner's
  birth date, and R1/R3 apply the greater-of test. The approximation record retires only when the
  new arm's discriminating fixture lands.
- `irc-401-a-9-E-ii-eligible-designated-beneficiary` (approximated: every inherited account
  compressed onto the 10-year rule) — superseded by R3/S1/K2 for plans that state EDB facts.
  Legacy two-field accounts stay on the labeled approximation (X1 handling applies to their
  missing facts) until reviewed; migration never fabricates an EDB category.
- The shipped year-10 sweep (`ownerDeathYear + 10`) matches the final-reg deadline formulation —
  the end of the calendar year that includes the tenth anniversary falls in death-year + 10 for
  any death date — so R1/R2/K1 keep it.

## 7. What WS2–WS5 take from here

WS2 encodes §2's facts and provenance verbatim, with `legacy-planning-approximation` preserved for
existing two-field accounts. WS3 implements §4 with external-golden fixtures against IRS Single
Life Table values and discriminating fixtures for: greater-of vs beneficiary-only, fixed vs
redetermined, before- vs on/after-RBD annual requirements, the year-of-death RMD, and the
minor-child majority flip — plus the §3 completeness-rule join test. WS4 executes §3's schedules
in the exact ledger with `year-of-death` / `required` / `voluntary` / `final-sweep` /
`notice-waived` / `hypothetical-catch-up` evidence and the S2 transition. WS5 surfaces §3's
regime, deadline, disclosures (§327, born-1959, IRA-agreement elections), and §5's refusals in
plain language. Every `unsupported` and `needs-review` outcome is a typed refusal, not a silent
fallback.

**WS4 reconciliation (shipped).** `projection/simulate.ts` consumes `classifyInheritedRegime` and
`inheritedRequirementForYear` from `strategies/inheritedIra.ts` and never re-derives divisors or
deadlines. Classified accounts execute R1/R2/R3/R3a (greater-of owner arm, ten-year sweeps,
EDB life-expectancy, notice-waived annuals), S0/S1 (spouse remain-beneficiary, including annual
redetermination), S2 window-and-flip (synthetic S0 before `treatAsOwnElectionYear`, then owner RMD
aggregation), S3, and inherited-Roth K1/K2 (K1 ten-year sweep; K2 annual life-expectancy). Each
year publishes `InheritedAccountYearEvidence` with regime, matrix row, requirement kind, executed
amounts, limitations, disclosures, and citations; scenario comparison surfaces inherited totals
from the ledger. Schema fact `treatAsOwnElectionYear` (calendar year; parse-optional with
`treat-as-own` for pre-WS4 migration, required by the classifier for a settled S2 row — missing year
is X5 needs-review) gates the S2 flip. Classifier refusals other than X1 (`legacy-planning-approximation`)
project on the labeled legacy two-field path for planning continuity; the evidence row carries the
refusal so no consumer can call the schedule compliant. The `YearResult.inheritedDistribution`
scalar is the **forced** total (its long-standing public contract); voluntary inherited draws are
visible per account on the evidence rows' `voluntaryAmount`. `YearResult.inheritedTraditionalDistribution`
is the traditional-character subset (ordinary income / traditional withdrawals). Named residuals out of
scope: §1.402(c)-2(j)(4) catch-up execution (prior ten-year-election fact not representable; S2 carries
`treat-as-own-timing-gate-unverified` because §1.408-8(c)(1)(iii)–(iv) is not consulted), non-qualified
inherited-Roth earnings taxation (K3 `roth-taxability-needs-review` disclosure only), post-S2
contribution/conversion/QCD enablement for validators that lack a year context (WS5; contributions
remain blocked post-flip because the plan still carries the inherited block and
`acceptsContributions` refuses any inherited traditional or Roth), and Roth S2-flip basis migration
into the owned Roth pool (post-flip draws keep the inherited non-taxed / non-penalized path;
contribution basis was never seeded).
