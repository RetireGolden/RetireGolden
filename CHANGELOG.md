# RetireGolden Changelog

This is a high-level, time-ordered summary of changes to the system, synthesized from git commit history and the project documentation. Focus is on material additions, refactors, and shifts in scope or architecture. See git history for full detail and code diffs. Enhancements plans (historical intent) are preserved in `DOCS/enhancements/`.

## Unreleased

- Prepared **`@retiregolden/engine` 0.4.3** (2026-10-08) — a **patch**: part-year phase 2
  and the bundle headroom it needed (the entries below). Plans stay schema 7, and no export is
  removed. One exported type changes again: the state pack's `partYear` descriptor (new in
  0.4.2) becomes a union on `method` (`residentPeriod` or `incomePercentage`) with a
  `ratioBasis` and an optional `exclusionCap`, and `rateSchedule` goes, since a
  resident-period state always prices its slice on the whole-year schedule. Three optional
  facts are added (`distributionDate`, `transferDate`, `paidMonths`). Neither
  RetireGolden-MCP, RetireGolden-Pro nor the site reads the descriptor. planner-ui's
  `^0.4.0` range admits 0.4.3; its worker now loads the Optimize channel on first use, a
  change that reaches hosts with the next planner-ui release. **Not yet published**; the
  owner tags `engine-v0.4.3` and approves the `npm-publish` environment.
- **Changed: a year split between states is priced by each state's own part-year method,
  on the income the months resident received, with the year's household facts** (engine
  0.4.3, 2026-10-08). Phase 2 of the part-year work; phase 1 (0.4.2) set the rate schedule
  and deduction method of twelve resident-period states. What changed:
  - **The slice's income** (`tax/statePartYear.ts`): a distribution or QCD transfer dated in
    the year goes whole into the slice of its month; Social Security by the months it is paid
    (an own retirement claim's first year carries `paidMonths`); everything else by the
    months, the pensions, annuities and wages the projection pays for whole years among it.
    The result reports the income spread by months (`partYear.undatedIncomeSpreadByMonths`)
    and how each slice was priced (`partYear.slices`). A split row scales its amounts
    together; the state basis pools are committed once for the year, after the slices.
  - **Method (b)**: CA, NY, CT, DE, WV, VT, RI, MN, OR, WI, CO, UT, MT, NM, ND, NE, KS, OK,
    MO, AR and NC, and ME, OH and IA through their credits, take the tax on the whole year's
    income as if resident times their income ratio, on federal AGI items or on the state's own
    income after its modifications, as each 2025 form divides (`partYear.ratioBasis`). Until
    now the months stood for every ratio.
  - **Method (a)**: the twelve phase-1 states plus GA, IL, IN, MI, MA and PA tax the
    resident-period income; a deduction or exemption a return prorates by an income ratio
    (`'incomeRatio'`, new beside `'full'` and `'months'`) takes the state's ratio.
  - **Household facts reach every slice**: the Illinois and Massachusetts exemptions are
    prorated by their ratios; the Connecticut and Wisconsin exemptions, Utah's credits and
    Iowa's alternate tax sit in the full-year tax the ratio prorates; Oregon's retirement
    income credit comes after the ratio, on the pension received while resident (OR-40-P
    line 45, then lines 50 to 53); South Carolina's SCIAD phases on the year's federal AGI;
    New Jersey's veteran and disabled exemptions read who qualifies from the year's rows,
    wherever they fall, and prorate by the months.
  - **Retirement-exclusion caps** follow each state's part-year rule (`partYear.exclusionCap`):
    whole (NY, OK, SC, LA, MI, AL, AZ, and KY, whose 2025 Schedule P takes the pension income
    received while resident up to the whole $31,110), the year's exclusion by the months (MD,
    NJ, DC, VA's age
    deduction), by the share of retirement income received while resident (DE, GA, ID, ME), by
    the income ratio (WI), or in the full-year tax (the other method (b) states), never more
    than the slice's own receipts earn. The blanket months scaling is gone.
  - **Wisconsin's slice-only path is gone**: method (b) prices it with the same figure.
  - **`state-rich-split-year-adapter-required` no longer marks a fully priced year.** It stays,
    with a narrower message, in these cases. Arkansas, Colorado, Rhode Island and Missouri do
    not state how a capped retirement exclusion applies to a part year: their slices take the
    year's exclusion by the months, and the year is marked only where the whole cap on the
    slice's own receipts would give the slice a different income (with income spread evenly,
    where the slice's qualifying retirement income exceeds the months' share of the cap). A
    California or New Jersey slice that is not the year-end state, in a year with HSA facts,
    would need HSA facts of its own, the year's being the year-end state's. A residency whose
    segments do not give the year's 12 months, or that names a state twice (the projection
    builds neither), is priced as given, each repeated state's basis pools committed once. And
    a state whose parameters carry no method (none does). A state with no published
    parameters marks the year `state-pack-unavailable`, as the annual path does, where it
    used to be skipped.

  Before and after, a single filer of 50 resident six months in the state and six in Texas
  (every state's figures are worked in `packages/engine/src/tax/statePartYear*.rules.test.ts`):
  - $100,000 of ordinary income spread over the year: no state moves (New York $2,429.88,
    Hawaii $2,395.20, Wisconsin $2,232.31, Illinois $2,475.00 without its exemption).
  - The same and a $40,000 Roth conversion, in the resident months / in Texas's, against the
    months share before: New York $4,641.27 / $2,578.48 (was $3,609.88); California $5,739.42 /
    $3,188.56 ($4,463.99); Oklahoma $3,292.00 / $2,057.50 ($2,899.75); Hawaii $5,340.34 /
    $2,477.49 ($3,907.20); New Jersey $3,574.90 / $1,242.38 ($2,347.38); Virginia $4,567.33 /
    $2,411.08 ($3,489.20); Kentucky $1,943.55 / $1,632.40 ($2,332.40); Pennsylvania, Illinois
    and Mississippi, whose rules take the conversion off, $1,535.00, $2,475.00 and $1,554.00
    either way ($2,149.00, $3,465.00, $2,354.00).
  - With household facts: Illinois $2,402.61 (was $2,475.00), Massachusetts $2,390.00
    ($2,500.00), Wisconsin $2,213.76 ($2,232.31); South Carolina $1,639.00 with its SCIAD phased
    out on the year's $100,000 ($1,248.25 on the unphased $15,000); Oregon, for a pensioner of
    66 with $20,000 of income, $363.19 after its retirement income credit ($588.19, the credit
    dropped).

  The "Moving in retirement" example does not move: its July 2029 move from Florida to
  Kentucky splits income that is spread evenly, so its lifetime tax stays $732,506.95; its
  2029 is no longer marked incomplete. The review L7 household U1 (Kentucky to Florida in
  November 2026, `packages/planner-ui/src/planner/preStartEvents.figures.test.ts`) does move:
  its annuity's effect from a 2026 start is -$151,691.59, was -$147,615.81, because Kentucky's
  pension exclusion now meets the in-plan Roth conversion received while resident, up to the
  whole $31,110, as it does for a full-year resident (the record income-annuity-annual says
  so). Of the relocation comparisons the bundle-headroom harness ran over the example library
  (five candidates each, listed in the script), five move, by their split year's
  Kentucky, Pennsylvania or California slice: the example couple's moves to Florida in 2030,
  Arizona in 2028 and Pennsylvania in 2031 by -$1,098.71, -$1,132.36 and -$2,190.78 of
  lifetime state and local tax, and the two California allocation plans' move to Pennsylvania
  in 2031 by -$1,198.18 and -$1,198.38.
  `DOCS/calculations/taxes/scripts/part-year-split-years.mjs` lists each of those split years'
  states, months, rows and slice taxes, before and after (its output beside it). Remaining
  limits, stated in `va-code-58-1-322-03-2-personal-exemptions`: days are priced as months.
  Only a dated row goes whole into the slice of its month: retirement distribution evidence
  with a `distributionDate`, and a QCD with its transfer date. Everything else is spread by
  the months, a named Roth conversion included: its execution date does not reach its
  account's annual row. The forms' rounding of the ratio is not applied, nor California's
  separately rounded effective rate (540NR line 36); the packs' continuous rate schedules
  stand in where a form mandates its tax table (NJ-1040 line 43 and Hawaii N-15 line 44 below
  $100,000 of taxable income, California's at $100,000 or less). Nebraska's ratio and
  Wisconsin's subtraction share are taken on federal AGI items, leaving out adjustments whose
  sign sets which way the figure errs. A QCD in a split year leaves the year incomplete, and
  its state adjustment is not applied. Nonresident-period source income, the credit for tax
  paid to the other state, special accrual and the SC, DE and MO full-year elections are not
  modeled. Exported types: `StateTaxParams['partYear']` loses `rateSchedule` and gains
  `method`, `ratioBasis` and `exclusionCap`, with the new `StatePartYearRatio`,
  `StatePartYearRatioBasis` and `StatePartYearExclusionCap`; `StateTaxComputationResult` gains
  `partYear` (the new `StatePartYearSlice`); `ComputeStateTaxOptions` gains `partYearSlice`, a
  slice's shares and the year's rows its caps and person facts read;
  `computeStateTaxableIncomeResult` also returns `stateIncome` and `newJerseyGrossIncome`; the
  state fact types gain `distributionDate`, `transferDate` and `paidMonths`.
- **Changed: room in the app bundle for the part-year work, with no cap raised** (2026-10-08,
  decision D-BUNDLE-HEADROOM). Three editor-only engine modules leave the engine simulation
  core for the retirement-action editor's lazy chunk; the worker loads the Optimize channel
  on its first request; the historical return series ships as rows of three numbers decoded
  at load. The moves alone, measured on the 0.4.2 head: worker 1,146.9 to 1,084.4 KiB (of
  1,150), core 894.9 to 866.2 KiB (of 900), all JS 5,063.1 to 5,055.9 KiB (of 5,100), with
  identical figures from the built bundles over the 29 example plans
  (DOCS/operations/bundle-budget.md). With the part-year work this release builds to worker
  1,092.4, core 874.2 and all JS 5,071.9 KiB.
- Prepared **`@retiregolden/engine` 0.4.2** (2026-10-08) — a **patch**: the state tax and
  inherited-IRA corrections below and the dependency re-resolve. Plans stay schema 7, and no
  export is removed. One exported type changes: the state pack field `partYearRateSchedule`
  (`@retiregolden/engine/params/state`), added in 0.4.1, becomes the `partYear` descriptor.
  Neither RetireGolden-MCP, RetireGolden-Pro nor the site reads it. planner-ui's `^0.4.0` range
  already admits 0.4.2, so planner-ui is not re-released; RetireGolden-MCP and
  RetireGolden-Pro move by bumping their exact engine pin. **Not yet published**; the owner tags
  `engine-v0.4.2` and approves the `npm-publish` environment.
- **Changed: the District of Columbia's standard deduction rests on its permanent law, and the
  dated review that was to settle it is closed** (2026-10-08). D.C. Law 26-189, the Fiscal Year 2027
  Budget Support Act of 2026 (D.C. Act 26-418, Bill 26-661), took effect October 2, 2026, when its
  congressional review ended (the Council's legislative record); no resolution disapproving it was
  introduced. It sets D.C. Code 47-1801.04(3A) and (44) in the words the emergency D.C. Act 26-416
  used: a basic deduction of $15,000 single, $22,500 head of household and $30,000 joint plus the
  IRC 63(c)(3) additional amount for 2026 to 2029, indexed from a 2025 base and rounded down to $50,
  and the federal deduction from 2030. Its sec. 7113 applies the subtitle as of January 1, 2025, so
  it governs tax year 2026 whatever the status of the earlier acts. The tracker's "District of
  Columbia congressional review about November 20, 2026" and the emergency act's lapse about
  November 11 are retired: the question settled on 2026-10-02. No figure
  changes, before or after: $15,000 / $30,000 for 2026 ($15,350 / $30,750 for 2027 at 2.5%
  inflation, $16,150 single for 2029, the federal deduction from 2030); a single filer under 65
  with $60,000 of District income pays $2,525.00 for 2026 and a couple with $120,000 $6,050.00. Two
  sources still print the federal deduction, and neither governs: code.dccouncil.gov has not
  codified Law 26-189 (its 47-1801.04 still prints (44)(A)(iv)), and the Office of Tax and
  Revenue's 2026 D-40ES (Rev. 03/2026), written before the act, enters $16,100 / $24,150 / $32,200
  on its estimate worksheet. The one check left is the Office's 2026 D-40 booklet, about January
  2027 (DOCS/maintenance-schedule.md). The earlier acts are history: D.C. Act 26-214 (emergency),
  D.C. Act 26-217 (temporary, D.C. Law 26-89 on the code site) and D.C. Act 26-416 (emergency) set
  the same amounts. The temporary act's status is contested: Pub. L. 119-78 (H.J. Res. 142, February
  18, 2026) disapproved it and the White House said the resolution nullifies it, while the District's
  Attorney General (opinion of February 24, 2026) concluded that the resolution came after the Home
  Rule Act's review period and did not repeal it. The record takes no side; neither reading reaches
  the permanent law's application to 2026. `dc-code-47-1801-04-3a-standard-deduction-2026-2029`
  stays settled and is re-cited: the enrolled act and the Council's legislative record on
  lims.dccouncil.gov (admitted as a District publisher, since the code site lags), Pub. L. 119-78,
  47-1801.04(44)(D) (the deduction prorated by months, as the engine does; the D-40 booklet's
  Calculation C uses days), the code site's text before the law, and the two Office publications.
  The code-site note on D.C. Law 26-89 that a live check found ABSENT on 2026-10-07 is withdrawn.
  All sixteen quotes were checked by a live verify-quotes --refresh run on 2026-10-08 (8
  PDF-WORD-LEVEL, 5 EXACT, 3 ELISION-EXACT), recorded as a dated amendment to the quote-fidelity
  ledger. The report's parameter sources, the District row and the state income tax row, say the
  same; no report figure moves. The `state-enacted-tax-year-figures` record and worksheet, and
  `neb-rev-stat-77-2715-03-3-indexed-brackets-held-nominal`, now name the District's deduction with
  Washington's among those projected on their statute's schedule (the District's every year from 2027
  to 2029, rounded down to $50), and Maine's from 2027 and the District's from 2030 among those that
  follow the federal one, where they said Washington's alone was projected.

- **Fixed: a part-year resident's slice of a split year is priced by the state's own part-year
  method** (2026-10-07). Every state but Virginia scaled its brackets, zero band and standard
  deduction with the months resident, which is the months share of a full-year resident's tax.
  Eleven states tax the resident-period income on the ordinary schedule instead, as each one's
  2025 part-year or nonresident instructions read: New Jersey (NJ-1040), Hawaii (Form N-15),
  South Carolina (Schedule NR), the District of Columbia (D-40), Mississippi (Form 80-100), Idaho
  (Form 43, the zero band whole) and Maryland (Form 502 P) prorate the deduction; Arizona (Form
  140PY), Louisiana (Form IT-540B), Kentucky (Form 740-NP Schedule A) and Alabama (Form 40, the
  exemptions too) allow it whole. The pack's `partYearRateSchedule: 'unscaled'` becomes a
  `partYear` descriptor (the rate schedule, scaled or unscaled; the standard deduction and the
  exemptions, by months or whole), set for those eleven and for Virginia, whose figures do not
  move. Wisconsin's sliding standard deduction was phased on the slice's own income and never
  prorated; the slice now takes the months share of the deduction on the year's income, as Form
  1NPR looks it up by federal income (its Standard Deduction Table, on line 31) and prorates the tax
  (line 32). A single filer of
  50 with $100,000 of ordinary income, resident six months and six in Texas, 2026: New Jersey
  $2,090.03, now $1,242.38; Hawaii $2,941.60, now $2,395.20; South Carolina $1,731.25, now
  $1,248.25; the District $2,812.50, now $2,362.50; Mississippi $1,754.00, now $1,554.00; Arizona
  $1,053.13, now $856.25; Louisiana $1,306.88, now $1,113.75; Idaho $2,095.86, now $1,968.37;
  Alabama $2,405.00, now $2,310.00; Kentucky $1,691.20, now $1,632.40; Maryland $2,268.00, now
  $2,241.75; Wisconsin $1,798.39, now $2,232.31. Every other state's figure stands: its months
  share is the income-percentage method with the months for its own ratio, or, for a state that
  taxes resident-period income at a flat rate, the same figure. The limits that remain are stated
  in `va-code-58-1-322-03-2-personal-exemptions`: a slice receives no household facts, so the
  Illinois, Connecticut, Wisconsin and Massachusetts exemptions and Oregon's, Utah's and Iowa's
  credits drop, and South Carolina's slice deducts its SCIAD unphased; characterized retirement
  rows are not allocated across the move; every retirement cap is prorated by months; and each
  income-percentage state's own ratio is replaced by the months. Pricing an income-percentage
  state from the full-year rich computation waits for the projection to assemble each state's
  facts: it hands the state calculator facts filtered to the year's residence state, so the other
  state of the move cannot be priced from them yet. One library example moves: "Moving in
  retirement (state tax)" goes from Florida to Kentucky in July 2029 and pays $58.80 less that
  year, lifetime tax $732,565.75, now $732,506.95, ending investable $3,880,516.31, now
  $3,880,618.68; its relocation table's Florida row prints "-$145,059" where it printed
  "-$145,118". The pinned pre-start annuity size (U1, a Kentucky couple moving to Florida in
  November 2026) is now -$147,615.81 from a 2026 start, where it was -$147,623.51.
  Each state's part-year method is quoted from its 2025 form or instructions on the record that
  carries it, Idaho's on a new record (`id-form-43-part-year-resident-period`), each quote checked
  against the live document (PDF-WORD-LEVEL in the quote-fidelity ledger).

- **Changed: the stated limits of state military retirement pricing say what is now true**
  (2026-10-07). The `state-enacted-tax-year-figures` record, its worksheet and the
  tax/stateTax.ts header said a state's own military rule was modeled in only fifteen states, with
  Wisconsin "the first known case"; every state with a rule now has it modeled, through its own
  branch, the pack's `militaryRetirementExclusion` or an exclusion that is already full. What
  remains is listed there: North Carolina's 20-year, medical and Bailey limbs, Kentucky's pre-1998
  share and Oregon's pre-October 1991 proration, each needing a service history the plan does not
  hold; Montana's approximated five-year window; earned income read from wage streams only in
  Georgia and Montana; the survivor annuity in Michigan, Oklahoma, Pennsylvania and Kansas, where
  the law does not plainly reach it, Nebraska's full exclusion of one, which may understate, and
  Delaware's unsettled treatment; a survivor's share of a pension tagged Military retirement
  priced as retired pay; New Mexico's 2026 session not checked; Idaho's lawful zero under 62
  marked incomplete; and Vermont's unrounded phase-out ratio. The record's loaded-figures list
  adds Georgia's 2027 military exclusion and the end of Colorado's under-55 subtraction from 2029.
  No figure moves.
- **Fixed: New Jersey's personal exemptions** (2026-10-07). N.J.S.A. 54A:3-1, as amended by
  P.L.2019, c.146, allows $1,000 for the taxpayer and for a spouse on a joint return, $1,000 for
  each 65 or older at the close of the year, $1,000 for each blind or disabled, and $6,000 for
  each honorably discharged veteran; none was modeled. They now come off New Jersey gross income
  after the pension exclusion's income test (the pack's `newJerseyPersonalExemptions`): blindness
  from the plan's stored taxpayer eligibility, disability from a pension marked for a disabled
  recipient, and a veteran inferred for the owner of a pension tagged Military retirement (not its
  survivor), an inference the record states. The $1,500 dependent and $1,000 college-student
  exemptions are a stated limit; the plan collects no dependents. $50,000 of income, 2026: single
  at 60, $1,270.00, now $1,214.75; single at 66, now $1,159.50; joint, both 60, $805.00, now
  $770.00; joint, both 66, now $735.00; a single veteran at 66 with a $30,000 military pension
  beside it, $1,270.00, now $828.00 (`nj-stat-54a-3-1-personal-exemptions`). The ORACLE-009 New
  Jersey worksheet now starts from $121,000 of gross income so its $120,000 of taxable income is
  unchanged. No library example moves: none is in New Jersey.
- **Fixed: Utah's credits are priced in a projected year** (2026-10-07). The projection never
  supplied the 59-10-114 additions that Utah MAGI adds (59-10-1019(1)(e), 59-10-1042(1)(d)), and
  the credit election demanded MAGI even where it could not change the answer, so every projected
  Utah year withheld the retirement, Social Security and military credits and was marked
  incomplete, ordinary plans included. A plan holds none of those additions beyond its tax-exempt
  interest, which MAGI already counts once (the TC-40 worksheets take code 57 back out), so the
  projection now supplies 0 and a stored household-year figure still wins
  (`ut-code-59-10-114-1-additions-in-utah-magi`); and a credit that is zero at any MAGI (no
  claimant born on or before December 31, 1952; no Social Security in Utah taxable income) no
  longer needs it. Single filers, 2026: $100,000 of military pay, $4,450.00 incomplete at every
  age, now $0.00; born 1950 with $25,920 of Social Security and a $20,000 pension, $1,067.11
  incomplete, now $617.11 (the $450 retirement credit); born 1956 with Social Security and $20,000
  of other income, $1,063.55 incomplete, now $890.00; born 1960 with $60,000 of other income,
  $2,670.00 either way, now complete.
- **Changed: Utah's Social Security credit phases out on income after the railroad retirement
  subtraction** (2026-10-07, D-UTAH-RAILROAD-MAGI). The 2025 TC-40 Social Security Credit
  Worksheet starts from line 9, after the code 78 subtraction of a Railroad Retirement Act
  annuity; the retirement credit worksheet keeps line 6, and so does the engine. Born 1956,
  $32,000 of Social Security, a $20,000 tier II annuity and $20,000 of other income: $1,120.00,
  now $890.00. The record is unsettled: the statute's MAGI keeps the annuity in, and whether 45
  U.S.C. 231m(a) bars counting it at all is undecided
  (`ut-tc-40-social-security-credit-railroad-magi`). No library example moves: none is in Utah.
- **Fixed: a state's own rule for military retired pay and Survivor Benefit Plan annuities, in the
  states the engine priced under their general retirement rules** (2026-10-07). A pension tagged
  Military retirement or Military survivor benefit now takes the state's own subtraction first,
  per recipient, and the state's general retirement rules see only what it leaves (the pack's
  `militaryRetirementExclusion`). Single filer, $100,000 pension, 2026, before and after:
  - **Full subtractions.** Wisconsin 71.05(1)(am), Survivor Benefit Plan included, outside the
    line 16 subtraction: $4,464.62 at 60 and $3,192.62 at 67, now $0.00. Indiana IC 6-3-2-4(a)(2):
    $2,950.00, now $0.00 (`ic-6-3-2-4-military-retirement-deduction` is settled; only a caller that
    passes the coarse public bucket alone still over-charges). Minnesota 290.0132 subd. 21:
    $5,276.61, now $0.00. Louisiana 47:44.2 and code 04E, outside the 65+ exemption: $2,613.75 at 60
    and $2,244.03 at 65, now $0.00. Maine 5122(2)(M-2)(1)(b), outside the $49,824 cap: $2,066.83 at
    60, now $0.00, and $50,000 of military pay with a $50,000 private pension at 70, $1,928.45, now
    $0.00. Michigan 206.30(1)(e)(i), which lowers the general maximum by the amount deducted:
    $1,376.58, now $0.00 (with a $50,000 private pension beside $50,000 of military pay the tax is
    unchanged, as the reduced maximum gives the same total). Oklahoma 2358(E)(17), outside the
    $10,000: $3,549.50, now $0.00 ($50,000 military and $50,000 private at 70: $3,549.50, now
    $1,299.50). Pennsylvania 61 Pa. Code 101.6(c)(3) at any age: $3,070.00 at 45 and 55, now $0.00.
    Michigan, Oklahoma and Pennsylvania leave a Survivor Benefit Plan annuity to their general rule,
    as their law does not plainly reach it.
  - **Capped and age-tested.** Colorado 39-22-104(4)(y), $15,000 under 55 through 2028, and from 55
    the (4)(f) pension subtraction it was kept out of: $3,691.60 at 45 and 60 and $3,403.40 at 65,
    now $3,031.60, $2,811.60 and $2,347.40; a survivor annuity under 55, $3,691.60, now $2,811.60.
    Maryland 10-207(q), $12,500 under 55 and $20,000 from 55, death benefits included, the rest open
    to the pension exclusion: $4,536.00 at every age, now $3,942.25 at 45, $3,586.00 at 60 and
    $1,657.50 at 65. Georgia 48-7-27(a)(5.1), $17,500 under 62 and $35,000 with more than $17,500 of
    wages, read from the recipient's wage streams: $4,241.50 at 60, now $3,368.25; with a $20,000
    wage stream, $5,239.50, now $3,493.00; a veteran's survivor benefit in full at any age, $4,241.50
    under 65 and $998.00 from 65, now $0.00. HB 266, signed May 13, 2025, effective for 2027, is
    loaded in the enacted 2027 figures: under 65, up to $65,000 with no earned-income test. New
    Mexico 7-2-5.13, $30,000 per retiree or surviving spouse: $3,569.10 at 60, now $2,124.30.
    Montana 15-30-2120(3)(n), 50% of retired pay no more than the wages on the return and 50% of a
    survivor benefit, in five years from the later of 2024 and the pension's first payment (the plan
    holds no residency start, so the window is approximated:
    `mt-mca-15-30-2120-3-n-military-retirement-subtraction`): a survivor benefit at 60, $4,289.10,
    now $1,593.30; retired pay with a $20,000 wage stream, $5,419.10, now $4,289.10.
  - **Kansas** reads a Military retirement row as the armed-forces system 79-32,117(c)(vii) names,
    so it needs no plan code: $5,291.44, incomplete, now $0.00, complete. A survivor annuity still
    needs the code.
  - **Survivor annuities.** The District of Columbia excludes one from 62 as a federal survivor
    benefit under 47-1803.02(a)(2)(N)(ii): $5,625.00 at 62, now $0.00. Missouri subtracts only a
    retiree's own military pay in full under 143.121.3(12); a survivor annuity is a public pension
    under 143.124.5, capped at the pack's $48,967 less the Social Security exemption, so the engine no
    longer understates: $0.00 at 60, now $1,461.22. From 2024 that public subtraction needs no
    Missouri income or filing status, so the engine now takes it in a year without Missouri income,
    for a civil service annuity too: $3,666.32 at 70, now $1,364.87 (still incomplete for the
    income-tested private deduction).
  - **Premature-distribution status.** Military retired pay and a survivor annuity are paid under
    title 10, not from a plan 72(t) reaches, so the projection marks them not premature at any age
    (`inferEarlyDistributionDisqualifier`). South Carolina 12-6-1171 under 59½: $4,244.00,
    incomplete, now $0.00, complete. Delaware's $12,500 military limb under 60: $5,369.00,
    incomplete, now $4,544.00, complete.
  - The projection passes each person's wages from wage streams to the state calculation
    (`ownerStateTaxFacts[].wages`), and a military pension row carries the year its payments began
    (`paymentsBeganYear`). New rule records for each state; `state-military-facts-unknown` marks a
    year where a cap turns on an unknown age, wage or first-payment fact. No library example moves:
    none carries a military pension or a Missouri public pension.
- **Changed: the Railroad Tier I pension source says it is the part reported on Form
  RRB-1099-R** (2026-10-07, D-RAILROAD-TIER1-SPLIT, first half). 26 U.S.C. 86(d)(1)(B) and
  (d)(4)(A) make the Social Security equivalent part of a tier I benefit, reported on Form
  RRB-1099, a Social Security benefit; 72(r) makes the rest of tier I, tier II and the
  supplemental annuity, reported on Form RRB-1099-R, benefits under an employer plan. The engine
  prices a pension tagged `railroadTier1` as a pension, which is right for the RRB-1099-R part,
  so planner-ui's label for it now reads "Railroad Tier I, non-Social Security equivalent part
  (RRB-1099-R)", and the pension source help says the RRB-1099 part is entered as Social
  Security. The help and the `usc-45-231m-state-tax-bar` record state the limit: entered that
  way, a state that taxes Social Security taxes it, although 45 U.S.C. 231m bars any state tax
  on it. The plan fact that would let the bar reach an RRB-1099 amount needs a plan schema
  change and is deferred. No figure moves.
- **Fixed: in the year a surviving spouse's treat-as-own election takes effect, each pooled IRA's
  owner RMD is figured on its own balance** (2026-10-07, D-POOLED-ELECTION-REFERENCE-BALANCE).
  When two or more inherited IRAs from one decedent are each elected as the spouse's own, the plan
  checks give them identical election facts, and the engine took every IRA's owner RMD from that
  one shared reference balance. Treas. Reg. 1.408-8(c)(3) makes that year's requirement the
  owner's, 1.408-8(b)(2) bases it on the IRA's own balance at the prior December 31, and
  1.408-8(e)(1)(i) calculates it separately for each IRA. Each IRA in such a pool now takes its
  own balance; the reference still stands in for an IRA alone in its pool,
  and the requirements still aggregate into the owner's one owned-IRA obligation. A $29,600 IRA
  pooled with a $100,000 one under a $100,000 reference, owner aged 75 (divisor 24.6): before,
  $4,065.04 required on the $29,600 IRA and $8,130.08 for the owner; after, $1,203.25 and
  $5,268.29. A distribution taken before the election now counts once toward the pool's total,
  whichever IRA it came from, as 1.408-8(e)(1)(i) lets the total come from any of the IRAs: a
  completed history row to the IRA it names, the pool's one j(4) pre-election figure once for the
  pool, where it had been credited against every IRA. And an IRA's prior December 31 balance is
  its opening balance plus the distributions accepted as taken from it, since the projection never
  debits them; a lone IRA's positive reference still takes precedence. $99,000 and $29,600 IRAs
  under a $100,000 reference, $1,000 paid before the election: before, $3,227.64 forced, so the
  year distributed $4,227.64 of the $5,268.29 required and left $1,040.65 unmet with no shortfall
  reported; after, $4,268.29 forced and $5,268.29 distributed. A lone $99,000 IRA with no reference
  and $1,000 paid before the election now owes $4,065.04 (was $4,024.39). The
  `rmd-uniform-lifetime-divisor` record states the rule and what remains: a gain or loss since the
  prior December 31 is not carried, a pool with any completed history row does not also count its
  j(4) figure, and an IRA whose balance cannot cover its unpaid amount is not made up from another
  IRA. No library example moves: none carries spousal election facts.
- Prepared **`@retiregolden/engine` 0.4.1** (2026-10-06) — a **patch**: the state tax
  corrections below, an additive conversion marker on the state retirement facts, and no
  removed or renamed export. Plans stay schema 7. planner-ui's `^0.4.0` range already admits
  it, so planner-ui is not re-released; RetireGolden-MCP and RetireGolden-Pro move by bumping
  their exact engine pin. **Published 2026-10-07** from the tag `engine-v0.4.1` on 3a6e845b,
  with npm provenance.
- **Changed: Colorado has no TABOR rate cut for 2026** (2026-10-06). The State Controller
  certified on September 8, 2026 that revenue fell $175.9 million short of the Referendum C
  cap, so there is no refund obligation and no temporary rate reduction under C.R.S. 39-22-627,
  and the engine's 4.40% is right for 2026 (Legislative Council Staff, Economic & Revenue
  Forecast, September 2026). The `state-enacted-tax-year-figures` record and worksheet now say
  so and name the next estimate, due October 1, 2027. No figure moves.
- **Changed: the three RetireGolden-MCP output families are engine families** (2026-10-07).
  RetireGolden-MCP 0.11.0 ships MCP #81, so `batch_evaluate`'s `cumulative_tax` and
  `ending_trad` objectives and `compare_scenarios`' ending-estate delta read
  `ProjectionSummary.lifetimeTaxesAndPenalties`, `ProjectionSummary.endingByCategory` and
  `ScenarioHeadlineComparison.endingAfterTaxEstate`. As the census freeze recorded, their kind
  moves from `adapter` to `engine`, each with its `engineSource` (RetireGolden-Docs b93bd7c6, re-imported here):
  engine 192, ui-native 24, ui-transformation 21, adapter 0. No figure moves.
- **Fixed (tooling): a fresh dependency resolve passes the trust policy again** (2026-10-06).
  vitest 5.0.2 and later depend on `why-is-node-running ^3.2.1`; 3.2.2 has no provenance
  attestation while 3.2.0 and 3.2.1 do, so pnpm's `trustPolicy: no-downgrade` refused every
  fresh resolve and the Resolve Gate was red on main from 2026-10-02. A root override scoped to
  the 3.x line holds 3.2.1; the committed lockfile does not move, and `pnpm-workspace.yaml`
  records the reason and when to drop it.
- **Fixed (tooling): `pnpm audit --audit-level=high` is clean again** (2026-10-07). Thirteen
  high advisories sat on five dev-only packages, and Dependabot's security updates failed with
  `security_update_not_possible` on every push to main. Four packages move inside their
  dependents' existing ranges, and nothing else in the lockfile moves: `fast-uri` 3.1.5 to
  3.1.8 (under `ajv`, an engine dev dependency that only the plan-schema test imports, and under
  workbox-build), `undici` 8.10.0 to 8.11.2 (under `jsdom`, whose `^8.9.0` already admits it,
  so jsdom stays 30.0.1), `brace-expansion` 5.0.9 to 5.0.12 (under `minimatch`) and
  `source-map-js` 1.2.1 to 1.2.2 (under `magicast`). The root `sharp` override's floor rises
  from `^0.35.0` to `^0.35.5` for the libheif and librsvg advisories, taking sharp from 0.35.3
  to 0.35.5 with its platform binaries, and its record in `pnpm-workspace.yaml` says why. No
  other manifest changes and no published package's runtime dependencies move; a
  from-scratch resolve passes the trust policy and the seven-day release-age gate. The ten
  moderate and low advisories on the same versions clear with them; one low remains
  (`serialize-javascript` 7.1.1 under workbox-build's terser plugin).
- **Fixed: states treat a Roth conversion by their own rules, not as a withdrawal**
  (2026-10-06). Every state retirement row now marks the taxable conversion dollars
  (`rothConversionAmount`) and the part converted at 59 and a half or older
  (`rothConversionAmountAtAge59HalfOrOlder`, read on a named conversion's execution date,
  otherwise on January 1), on both conversion paths and without splitting an account's event,
  so no federal figure moves. The comment that called conversions "not exclusion-eligible"
  described a coarse bucket the projection no longer reads and now says so.
  - **Maine** (2025 Form 1040ME instructions): a conversion gets no pension income deduction.
    A 70-year-old converting $30,000 had all of it deducted; now none
    (`me-1040me-roth-conversion-not-pension-income`).
  - **Pennsylvania** (2025 PA-40 instructions): a traditional IRA converted in full to a Roth
    IRA is not taxed, at any age. A $40,000 conversion at 50 paid $1,228.00; now $0
    (`pa-40-roth-ira-conversion-not-taxable`). An in-plan Roth rollover keeps the age-60 rule,
    a stated limit.
  - **South Carolina** (S.C. Code 12-6-1170(A)(2), IRC 408A(d)(3)(A)(ii)): a conversion carries
    no premature penalty, so it counts toward the $3,000 deduction at any age. A $20,000
    conversion at 50 got no deduction and an incomplete year; now $3,000 and a complete year
    (`sc-code-12-6-1170-roth-conversion-not-premature`).
  - **Michigan** (Treasury FAQ) and **New York** (TSB-M-98(7)I): a conversion counts only if
    made at 59 and a half. A $30,000 conversion at 55 in Michigan had all of it subtracted, and
    one in New York by an owner 59 at year end but not 59 and a half on January 1 had $20,000
    excluded; now none. An undated conversion in the half-birthday year is read on January 1
    and gets nothing, so both records are approximated, needing the conversion date
    (`mi-treasury-roth-conversion-at-59-and-a-half`,
    `ny-tsb-m-98-7-i-roth-conversion-at-59-and-a-half`). One library figure moves: the
    Michigan example `trump-account-head-start`, whose converting owner was born in 2004,
    now executes $13,180.74 of 2027's requested $40,801.60 conversion, was $16,465.61, so its
    cleaned executable schedule is $4,050,076, was $4,053,361; the raw schedule and the other
    years do not move, and no other planner-ui figure does.
  - Stated as limits, not code: Georgia's 62 to 64 tier, the Delaware and Arkansas date edges,
    in-plan rollovers in Maryland, Rhode Island, Mississippi and Pennsylvania, and Ohio and
    Hawaii, where the treatment is not determined. Eleven quotes were added to the
    quote-fidelity ledger (5 EXACT, 2 ELISION-EXACT, 4 PDF-WORD-LEVEL).
- **Fixed: Connecticut subtracts IRA distributions by its federal-AGI schedule** (2026-10-06).
  Conn. Gen. Stat. 12-701(a)(20)(B)(xxviii) and (xxix) give 100% below $75,000 of federal AGI
  ($100,000 joint), stepping to none at $100,000 ($150,000 joint); the engine subtracted every
  IRA dollar at any AGI. A single filer's $30,000 IRA distribution: at $78,000 of federal AGI
  $21,000 comes off, was $30,000; at $120,000 none, was $30,000; joint at $112,000, $16,500.
  A conversion, a row of the traditional IRA it leaves, follows the same schedule. Both clauses
  except a Roth IRA, so a Roth IRA's taxable earnings get nothing: an inherited Roth's $30,000
  of earnings taxed before its five-year clock, at $60,000 of federal AGI, now has $0
  subtracted, was $30,000. The schedule reads the year's whole federal AGI. A year split
  between states never reaches it: each slice is priced without the characterized rows, so the
  Connecticut slice still takes its share of the private retirement income off in full at any
  AGI, and the year stays marked incomplete; the record states the limit. Pensions keep the
  unconditional rule, which the identical (xxi) and (xxii) schedules would also limit
  (`ct-cgs-12-701-20-b-xxviii-xxix-ira-distribution-schedule`).
- **Fixed: New Jersey's pension exclusion is income-tested and per return** (2026-10-06).
  N.J.S.A. 54A:6-10(b) and NJ-1040 line 28a allow it only at New Jersey gross income of $150,000
  or less: up to $100,000 joint or $75,000 otherwise at $100,000 or less, then 50% / 37.5% of the
  payments to $125,000 and 25% / 18.75% to $150,000, counting only a qualifying spouse's
  payments. The engine gave $50,000 for each household member 62 or older with no income test.
  A single filer of 65 whose $80,000 income is all pension now excludes $75,000, was $50,000; at
  $110,000 with that pension, $30,000; at $200,000, nothing, was $50,000; a couple both 65 with
  $110,000 of pensions, $55,000, was $100,000. The record moves from approximated to settled.
- **Fixed: Virginia's $800 aged exemption counts a January 1 birthday, and a part-year
  resident is taxed as Form 760PY taxes one** (2026-10-06). Va. Code §58.1-322.03(2)(b) gives
  the $800 to an aged taxpayer as IRC 63(f) defines one; the 2025 Form 760 instructions count a
  taxpayer "age 65 or older on or before January 1" of the following year. The engine read
  the age at the end of the year, so a single filer born January 1, 1962 with $70,000 of
  wages lost the $800 for 2026: taxable income $60,320, now $59,520 (tax $46 less). Form
  760PY prorates the standard deduction, the personal exemptions (its Prorated Exemption
  Worksheet) and the age deduction, and taxes the resident-period income on the ordinary rate
  schedule. The split-year path gave the Virginia slice the whole $930 and $800 and scaled
  Virginia's brackets with the months; it now prorates the exemptions and keeps the brackets
  (a new pack field, `partYearRateSchedule: 'unscaled'`, set for Virginia only). A single
  filer under 65 with $60,000 of ordinary income who lived six months in Virginia now owes
  $1,189.20 for the slice, down from $1,291.21; at 70, $1,108.70, down from $1,187.71. Every
  other state still scales its brackets for a split year, which overstates the tax where the
  part-year return taxes the resident-period income on the ordinary schedule, as New Jersey's
  does; the Virginia and New Jersey records state it as a limit. The record
  `va-code-58-1-322-03-2-personal-exemptions` cites both instructions (four rows added to the
  quote-fidelity ledger, PDF-WORD-LEVEL).
- **Fixed: the Kansas plan-code warning names its record** (2026-10-06). `ks-plan-code-unknown`
  carried the ruleId `ks-named-public-pension-exclusion`, which the registry does not hold; it
  now names `ks-stat-79-32-117-public-pension-exclusion`. No figure moves.
- **Fixed: Virginia's age deduction is applied again, to income of every kind and with its
  income test** (2026-10-06). Va. Code §58.1-322.03(5) allows $12,000 for each taxpayer born
  on or before January 1, 1939, and $12,000 for each later-born taxpayer who has attained 65,
  reduced $1 for each $1 of adjusted federal AGI above $50,000 single or $75,000 married. Since
  #710 (2026-09-13) no projected Virginia year took it: the projection always supplies
  characterized retirement rows, Virginia's branch for them had no age deduction, and the pack's
  $12,000 retirement-income cap sat on the coarse path the projection no longer took. The engine
  now computes it as Form 760's Age 65 and Older Deduction Worksheet does: adjusted federal AGI
  is federal AGI less the taxable Social Security and Tier 1 benefits in it; a couple takes one
  reduction on their joint figure and splits the result; a taxpayer whose 65th birthday is
  January 1 qualifies for the year before; a part-year resident's deduction is prorated. A
  couple both 70 with $60,000 of pensions and no Social Security now pays $622.00 of 2026
  Virginia tax, down from $1,987.30 (taxable income $15,040, was $39,040); with $80,000 of
  pensions and Social Security, $2,044.80, down from $3,137.30 (taxable $40,040, was $59,040).
  A single filer of 65 or older with $40,000 of wages and no retirement income gets the $12,000
  the old retirement-income cap never gave (taxable $17,520, was $29,520). The VA pack's
  `retirement` is now `none` beside a new `virginiaAgeDeduction`, and the record
  `va-code-58-1-322-03-age-deduction-and-social-security` moves from approximated to settled,
  citing the 2025 Form 760 instructions beside the statute (four rows added to the
  quote-fidelity ledger, all PDF-WORD-LEVEL). Not modeled: Virginia conformity adjustments to
  federal AGI, and the disability subtraction and low-income and earned income credits a
  taxpayer may take instead. The personal-exemptions fixture moves its single filer from
  $60,000 to $70,000 so the age deduction is fully phased out there and the exemptions remain
  the only difference it prices. No library example is in Virginia, so none moves.
- **Fixed: Kansas flags a missing plan code only where the code decides the tax, and
  subtracts Washburn University's 403(b)** (2026-10-06). K.S.A. 79-32,117 subtracts named
  retirement systems (KPERS, federal civil service and military, and the listed city, utility,
  Washburn and Overland Park plans). An IRA, a private pension, and a 401(k), 401(a) or 457(b)
  employer plan is none of them, yet since #710 a missing code on them raised
  `ks-plan-code-unknown`, so most Kansas plans showed incomplete years for a fact that could
  not change the tax; those rows are now complete. Washburn's plan, (c)(xix), is a 403(b)
  (Department of Revenue Notice 08-06, one row added to the quote-fidelity ledger,
  PDF-WORD-LEVEL), and the engine gave an employer plan no subtraction whatever its code: a
  $12,000 distribution from an employer plan coded `KS-WASHBURN` now comes off Kansas taxable
  income in full, was taxed; no other code subtracts an employer plan (whether a federal Thrift
  Savings Plan or a KPERS 457 account is subtracted is a stated limit). A 403(b), or an
  employer plan of other, unknown or undeclared type, with a taxable amount and no code is
  still flagged; the warning's `missingFacts` lists what clears it, `planSystemCode` for a
  declared 403(b) and `planSystemCode` or `qualifiedPlanType` for the others. A projected
  employer account now passes its declared `employerPlanType` to the state row as
  `qualifiedPlanType` when the state evidence gives none, as the annuity path already did, so
  a declared 401(k) or 457(b) is complete and an undeclared one is flagged.
  The same plan type lets Virginia's subtraction for basis taxed by a prior state treat a
  declared 401(k) or 457(b) account as the §401 or §457 plan Va. Code §58.1-322.02(11)
  enumerates, as it already did an annuity's; that needs prior-state basis evidence, which no
  library example carries. A 403(b) is not enumerated, and Virginia's two predicates (the
  subtraction and its basis pool) accepted every declared employer-plan type but other and
  unknown: a 403(b) with $4,000 federally included and $6,000 of basis taxed by California had
  $4,000 subtracted. It now gets none, and only 401(a), 401(k), 457(b) and IRA types qualify
  (`va-code-58-1-322-02-11-basis`). A public, federal civil service, military or
  government survivor pension without a code, or one of unknown public source, is flagged as
  before; a pension of unknown public source now lists `sourceKind` among its missing facts,
  and only `sourceKind` once it carries a code, which cannot clear it. No library example is
  in Kansas.
- Prepared **`@retiregolden/planner-ui` 0.11.0** (2026-10-06) — a **minor** bump, because
  its engine dependency is now `^0.4.0`. A host on planner-ui 0.10.0 resolves engine 0.3.x
  for the planner, which refuses the schema 7 plans engine 0.4.0 writes. So RetireGolden-MCP
  and RetireGolden-Pro can move to engine 0.4.0 only together with this release. It carries
  every planner-ui change in this file since 0.10.0, which npm has served since 2026-09-04
  (tag `planner-ui-v0.10.0`). Its exports map and peer
  ranges are unchanged. **Not yet published**; the owner tags `planner-ui-v0.11.0` and
  approves the `npm-publish` environment. The publish job's pack smoke resolves engine 0.4.0
  from npm.
- Prepared **`@retiregolden/engine` 0.4.0** (2026-09-30) — a **minor** bump, because
  plans it writes carry `schemaVersion` 7 and engine 0.3.x refuses them as
  `newer_than_app` (it migrates only up to 5). It carries every engine change in this file
  since 0.3.0 (2026-09-04), including the 0.3.1 patch, which was prepared but never
  published and is folded in here. **Published 2026-10-06** from the tag `engine-v0.4.0` on
  c9444031, with npm provenance.
- **The planner-ui range moves to `^0.4.0`**, the same coordinated floor as 0.3.0 and
  0.3.1. Its own version moves to 0.11.0 in the entry above. Its source reads schema 7 plans and the
  engine figures relocated from the UI (`enteredBalanceSheet`,
  `MonteCarloSummary.medianFirstDepletionYear`, `bridgeLaddersTotalCost` and others), which
  0.3.x never exported. Its README now names the floor by reference to `package.json`
  instead of repeating the number. `accountStartAgeBounds.ts` re-exports the three
  start-age constants from `model/plan.ts` instead of restating them: its comment gated
  that on an engine with the constants reaching npm, and 0.3.0 did.
- **Downstream to coordinate:** RetireGolden-MCP and RetireGolden-Pro move their engine
  pin to 0.4.0 together with planner-ui 0.11.0 (the entry above), never the engine pin
  alone: a host that keeps planner-ui 0.10.0 runs its planner on engine 0.3.x. Until a
  host moves, a plan saved by 0.4.0 does not open in it. Now that npm serves 0.4.0,
  planner-ui's pack smoke in `auto` mode resolves it from the registry.
- **Changed (2026-09-13, #710, recorded 2026-10-06): state income tax in every projection year now
  applies each state's retirement rules per owner and per source, Roth conversions count toward
  those exclusions, several 2026 state amounts changed, and many plans now report incomplete
  years.** This entry was missing when engine 0.4.0 shipped, and 0.4.0 includes #710; it is added
  after the fact. The PR description says the final review found no existing monetary value
  changed, but that compared against an intermediate capture inside the PR, not against main
  before it, and the PR's own report golden for the example couple moved. Measured against main
  before #710 (4e74f68ad), on the library examples run in their own states and moved into each of
  the 51 jurisdictions: figures move in 26 states, and in Kansas for a pension entered as
  "public". The federal tax computation and the states with no income tax do not move. Of the 29
  library examples, 27 keep every figure (three of those now report incomplete years) and two
  move. "State tax on the same income" below re-prices each year of the #710 projection with both
  versions of the state calculation, so it separates the rule change from its effect on later
  withdrawals.
  - **One exclusion per owner, not a household pool.** Before, a capped exclusion was the cap
    times the number of living spouses who met its age test, shared across the household's
    pensions and traditional withdrawals. Now each owner's distributions meet only that owner's
    cap, so a spouse with nothing to exclude no longer shelters the other. This is the default
    rule for Alabama, Georgia, Kentucky, Maine, New York, Oklahoma and Rhode Island; Arkansas,
    Colorado, Delaware, Louisiana, Maryland, Missouri, South Carolina and West Virginia apply their
    own per-owner rules; New Jersey stays pooled and Michigan stays one return-level limit. It
    raises tax for a couple whose withdrawals come from one spouse's account in a year: for the
    library couple with a 401(k) each, drawn one at a time, state tax on the same income over the
    projection rises by $54,587.06 in Maine, $23,400.45 in Georgia, $21,103.33 in New York,
    $13,597.08 in Rhode Island and $10,822.05 in Oklahoma. The code states the per-recipient
    reading in a comment; the rule records were not changed to say it.
  - **Roth conversions now count toward state retirement exclusions.** Before, a conversion was
    left out of the retirement income the exclusions read, by design; the code comment "Roth
    conversions are excluded (not exclusion-eligible)" is still there. #710 passes each conversion
    to the state calculation as an IRA or employer-plan distribution, so every exclusion that
    reaches IRAs takes it: in full in Connecticut, Illinois, Iowa, Michigan, Mississippi, New
    Jersey and Pennsylvania, and up to the owner's cap in Alabama, Arkansas, Colorado, Delaware,
    Georgia, Kentucky, Louisiana, Maine, Maryland (employer plans only), New York, Oklahoma, Rhode
    Island, South Carolina and Wisconsin. No rule record in #710 cites an authority for treating a
    conversion as an eligible distribution in any of these states. The example couple converts
    $189,820 in 2028; that year's state tax on the same income goes from $11,760.97 to $1,653.84
    in Connecticut, $11,797.63 to $2,401.55 in Illinois and $7,197.47 to $1,370.01 in
    Pennsylvania. Over the projection it falls by $56,570.79 in Connecticut, $50,641.86 in
    Illinois, $40,733.67 in Mississippi, $37,679.28 in New Jersey and $37,830.56 in Iowa.
  - **Kentucky.** The standard deduction is $3,360 once per return, so a joint return takes $3,360
    instead of $6,720 (Kentucky DOR's 2026 standard deduction announcement; Form 740 instructions,
    line 10: one standard deduction on a joint return; `ky-dor-2026-standard-deduction-once-per-return`),
    which is $117.60 more tax a year. The $31,110 pension and retirement exclusion (KRS
    141.019(1)(g)1.b, `ky-krs-141-retirement-and-social-security`, not edited by #710) is now per
    owner and reaches conversions. For the example couple, state tax on the same income: 2026,
    both working, $6,799.80 to $6,917.40; 2028, a $189,820 conversion from one spouse's account,
    $8,081.92 to $7,110.67 (one $31,110 exclusion, $1,088.85); 2036, $101,980 withdrawn from one
    spouse's account, $1,156.39 to $2,362.84 (the second $31,110 no longer applies). Over the
    projection, lifetime taxes and penalties go from $431,348.91 to $433,212.27, conversions from
    $1,014,366.37 to $1,017,094.47, and the ending after-tax estate from $3,697,353.40 to
    $3,701,888.29. It affects every Kentucky joint return, and Kentucky plans with conversions or
    with one spouse drawing more than $31,110.
  - **Maryland.** The pension exclusion no longer reaches IRAs, applies per recipient aged 65 or
    older, and is reduced by that recipient's Social Security and railroad benefits; the 2026
    maximum is $40,600, not $41,200 (Md. Tax-General 10-209; the Comptroller's 2026 maximum;
    `md-tax-10-209-pension-exclusion`). State tax on the same income rises by $19,178.51 to
    $50,994.02 across the library plans moved to Maryland, $46,103.02 for the RMD-and-IRMAA example;
    the example couple in 2036 goes from $695.60 to $4,609.60.
  - **Virginia's age deduction is no longer applied.** The Virginia path #710 added handles
    military retirement, Tier I and basis taxed by another state, and returns without the $12,000
    age-65 amount the pack carries, with no warning; `va-code-58-1-322-03-age-deduction-and-social-security`
    (Va. Code 58.1-322.03(5)) still describes the pack as applying it. A couple both 65 or older
    pays $1,380.00 more a year (the example couple in 2036: $3,397.48 to $4,777.48); the
    survivor-years example moved to Virginia pays $27,040.00 more over the projection. Not
    registered as a limit.
  - **Missouri and West Virginia hold back deductions until household facts are given.** Missouri's
    $6,000 private and its public pension deductions (RSMo 143.124.5 and .7,
    `mo-retirement-income-deduction`) need Missouri income and filing status; without them
    neither applies and the year is incomplete. West Virginia's $8,000 age-65 modification (W. Va.
    Code 11-21-12(c)(9), `wv-code-11-21-12-c9-age-disability-residual`) needs each owner's
    eligibility and prior modifications, and is not applied without them. The example couple in
    2036: Missouri $1,919.36 to $2,483.36, West Virginia $3,234.07 to $3,966.87.
  - **South Carolina.** Public pensions are no longer fully exempt: the blanket public override
    is removed, since S.C. Code 12-6-1171 fully deducts only military retirement. The 12-6-1170(A)
    deduction is per owner, $3,000 under 65 and $10,000 from 65; the SCIAD deduction of 2026 Act
    110 ($15,000 single, $30,000 joint) now phases out with federal AGI; and the 12-6-1170(B)
    age-65 deduction needs each owner's remaining South Carolina income, so it is withheld and the
    year is incomplete. The example couple in 2026, working, with AGI past the phase-out:
    $7,943.10 to $9,506.10.
  - **Colorado.** Pension and Social Security share one cap per recipient, raised to the
    recipient's taxable Social Security from 65 (C.R.S. 39-22-104(4)(f)(III),
    `co-crs-39-22-104-social-security-inclusion`, `co-crs-39-22-104-federal-base-and-pension-cap`);
    before, taxable Social Security was taxed and only pensions used the cap. A single filer with
    Social Security pays much less: the coast-fire example's lifetime taxes and penalties go from
    $1,707,504.36 to $1,634,909.14 and its ending after-tax estate from $7,592,621.78 to
    $7,766,215.63. For a couple who both receive Social Security, the engine does not split the
    taxable amount between them, counts none, and marks the year incomplete. Federal AGI of
    $300,000 or more adds back the federal deduction above $1,000 or $2,000 (C.R.S.
    39-22-104(3)(p.7)).
  - **Massachusetts, Vermont, Wisconsin and Louisiana amounts.** Massachusetts personal
    exemptions of $4,400 single and $8,800 joint, plus $700 for each person 65 or older, now
    apply (Mass. Gen. Laws ch. 62 §3(b)): $440.00 less a year for a joint return. Vermont's 2026
    standard deduction is $7,850 single and $15,700 joint (was $7,400 and $14,850) with indexed
    brackets (32 V.S.A. 5811(21) and 5822). Wisconsin's 2026 brackets apply and its standard
    deduction now phases down with income (maximum $13,960 single and $25,840 joint, zero at
    $136,453 and $159,690; 2026 Form 1-ES); before, the maximum applied at every income.
    Louisiana's age-65 exemption is $12,324, the $12,000 base indexed by 2.7% (La. R.S.
    47:44.1(A)). The example couple in 2026: Massachusetts $10,050.00 to $9,610.00, Vermont
    $9,687.53 to $9,477.05, Wisconsin $8,540.25 to $9,848.31.
  - **A pension entered as "public" is now an unidentified public source.** States whose
    exclusion names particular systems or needs contributory status no longer exclude it, and
    usually mark the year incomplete: Kansas (K.S.A. 79-32,117(c), named systems only), Louisiana
    (La. R.S. 47:44.2 names federal and railroad retirement), Massachusetts (ch. 62
    §2(a)(2)(E)), New Jersey, Delaware, Colorado, Arkansas, Iowa, Maryland and South Carolina.
    The survivor-years example's $4,000 a month pension, entered as public, over the projection:
    Kansas $0.00 to $47,028.02, Massachusetts $0.00 to $38,380.00, Delaware $6,258.75 to
    $33,932.00, New Jersey $0.00 to $16,660.00, Louisiana $0.00 to $15,018.75. Delaware also
    withholds its exclusion from a distribution whose early-distribution status is unknown
    (`de-early-distribution-gate`, unsettled). The 1040 import now enters a line 5b pension as an
    unconfirmed private source instead of private.
  - **Many plans now report incomplete years.** A year is incomplete when a state rule needs a
    fact the plan does not hold; its figure leaves out the relief that fact would decide. On the
    library plans: every plan in Connecticut (personal exemption needs Connecticut AGI), Missouri,
    Montana (long-term gains rate schedule), South Carolina, Utah (retirement, Social Security and
    military credits), Vermont, West Virginia and Wisconsin (exemption counts); most plans in
    Illinois, Kansas, Massachusetts and Oregon (retirement credit); some in Colorado, Delaware and
    Iowa; every year with a QCD in each income-tax state except Arkansas and Hawaii, whose QCD
    policy is recorded (`state-direct-qcd-conformity-policies`); every year of a California or New
    Jersey plan with an HSA; and the year of a mid-year move. Kansas flags every IRA and 401(k)
    distribution as missing a named-plan code. Tax is unchanged in Utah, Oregon, Montana, Kansas
    (private sources) and the QCD-only states. An incomplete year has three effects: the
    optimizer publishes no recommendation (the example couple moved to Utah went from keeping its
    own strategy among 21 candidates to no winner, 34 incomplete years), relocation compare
    suppresses its driver attribution for that state, and the Optimize page shows guidance pointing
    to the new state tax facts worksheet.
  - **A spouse's treat-as-own election needs the new election facts.** Owner treatment now comes
    only from the annual election gate (Treas. Reg. 1.408-8(c)(3) and 1.402(c)-2(j)(4)), which
    needs the decedent's identity, the date of death, an affirmative election and the spouse's
    contribution history. A plan
    with `election: 'treat-as-own'` and an election year but no such facts stays on the
    beneficiary schedule, and every year is incomplete. The library's inherited-IRA example
    reduced to its $300,000 spouse IRA, elected as own in 2025: the 2026 owner RMD of $14,218.01
    is gone, and lifetime taxes and penalties go from $29,908.32 to $28,655.09, the remain-a-
    beneficiary figure.
  - **Inherited Roth withdrawals are taxed unless the decedent's five-year clock is known.**
    Before, every inherited Roth withdrawal was tax-free. Now it is characterized under Treas. Reg.
    1.408A-6 (`treas-reg-1-408A-6-inherited-roth-nonqualified-earnings`): with
    `roth5YearStartYear` and its provenance, or an inherited Roth tax-character pool, a qualified
    withdrawal stays tax-free; without them the whole withdrawal is ordinary income and the year
    is incomplete. A single filer inheriting a $150,000 Roth in 2024 under the 10-year rule: tax
    on $83,267 withdrawn in 2027 goes from $0.00 to $7,594.85, lifetime taxes and penalties from
    $0.00 to $13,553.68; with a 2010 clock it stays $0.00.
  - **Added without moving an existing plan.** Each needs new plan facts that existing plans do
    not have: HUD-validated HECM openings (2026 maximum claim amount $1,249,125 under Mortgagee
    Letter 2025-22; initial MIP 2% and annual MIP 0.5% under Mortgagee Letter 2017-12 and Handbook
    4000.1; `hud-hecm-mca-mip-limits`), the confirmed
    non-designated five-year schedule (IRC 401(a)(9)(B)(ii)), the post-deadline entire remaining
    benefit with ordinary §4974 excise (Treas. Reg. 54.4974-1(e)), prior designated Roth
    deferrals counted toward the Roth catch-up (T.D. 10033, §1.414(v)-2(b)(1) and (d)(6)) with
    `employerPlanId` grouping, `stateTaxFacts`, `inheritedRothTaxCharacterPools`,
    `employerElectiveDeferralHistory`, characterized pension sources, and the planner's state tax
    facts worksheet. The plan schema stays version 5; the new collections default to empty. The
    2026 pack also pins the Part D out-of-pocket threshold ($2,100), the annual gift exclusion
    ($19,000) and the basic exclusion amount ($15,000,000), none of which the engine computes with.
  - **Exported API.** `spouseTreatAsOwnCatchUp` (`strategies/inheritedIra`) now takes the
    one-reference-balance input of `determineSection402c2j4CatchUp` and returns a determination;
    called with the old `priorYearEndBalancesByYear` input it returns incomplete instead of
    evidence rows. `createStateTaxCalculator` gains `computeResult`; `combineTaxCalculators`
    passes federal AGI, deduction and taxable Social Security to the state calculator; `YearResult`
    gains `taxComputation`, `acceptedTaxInput`, `hecmComputation` and
    `electionYearOwnerRmdObligations`.

  - **Corrected in 0.4.1 (the entries at the top of this section).** Virginia's age deduction is
    applied again, with its income test; Kansas no longer marks IRA and 401(k) years incomplete
    for a plan code that cannot change its tax; and a Roth conversion now follows each state's
    own rule, derived from its statute or form instructions: Maine and Pennsylvania give it no
    exclusion and no tax respectively, South Carolina counts it at any age, Michigan and New York
    only at 59½, Connecticut and New Jersey under their income tests, and the other states that
    reach IRA distributions keep counting it, now with a citation.
- **Changed: every one of the 237 frozen output families is complete** (2026-09-30). The
  output census froze at 237 families (RetireGolden-Docs 5881834); every family has a record,
  every record passes every catalog gate, and every record has an independent review from a
  different agent family. The eleven records this change adds or restates were reviewed by
  Codex (GPT-6-Sol) and Grok (grok-4.7), all approved (`DOCS/calculations/reviews/REVIEW-2026-09-30-round3-*.md`).
- **Fixed: no phantom §4974 excise in the year a surviving spouse elects to treat an
  inherited IRA as their own** (2026-09-30, found by the reach-spec work). Treas. Reg.
  1.408-8(c)(3), as amended by T.D. 10001, sets that year's requirement under 401(a)(9)(A)
  with the spouse as owner, and 1.408-8(e)(2)(i) takes the elected IRA out of the
  beneficiary's same-decedent group, so the year has one obligation, the owner RMD. The engine
  also charged an unpaid beneficiary obligation: on the reproduction, $1,672.30 of excise on a
  $6,689.19 requirement while the $4,065.04 owner RMD was paid. `annualInheritedIraDistributions`
  now leaves an election-year account out of the §4974 grouping, and the check comes before
  every five-year deadline branch, so such an account enters no deadline obligation either,
  completed or live (a combination no parsed plan can build, pinned by a unit test). No
  library example moves.
  Registered as a limit, not fixed here: when two or more IRAs in one pool are elected, each
  takes its owner RMD from the pool's shared reference balance rather than its own prior
  year-end balance (`rmd-uniform-lifetime-divisor`, pinned by a test).
- **Changed (tests): every equivalence reach spec is held at exit 0.** Eleven blocks-corpus
  members reach the production lines no member reached (11 specs exited 1 on main); 24 lines
  that no valid plan can execute, at 16 places in six specs, are documented exclusions; the three proofs that pin the corpus were re-measured (identity
  only). `scripts/equivalence/reachGuard.test.mjs` runs all 32 specs in the engine suite.
- **Changed: the three RetireGolden-MCP output families have calculation records, each
  against an engine function that already computes it; no engine function was added and no
  figure moves** (2026-09-30). `mcp-batch-cumulative-tax-objective` is
  `projection/compare.ts#summarizeProjection`'s `lifetimeTaxesAndPenalties`,
  `mcp-batch-ending-traditional-objective` its `endingByCategory.traditional`, and
  `mcp-compare-ending-after-tax-estate-delta` is
  `scenarios/comparison.ts#compareScenarioPlans(...).headline.endingAfterTaxEstate.delta`.
  Each record has a worksheet with worked cases and wrong readings, an evidence test that
  also checks the adapter's own arithmetic at the census pin, and an executed mutation
  receipt. They are derived by Claude and reviewed by Codex (GPT-6-Sol), all approved
  (`DOCS/calculations/reviews/REVIEW-2026-09-30-round3-codex.md`), so the three families
  are complete. One stated limit: the comparison delta
  is nominal, so two plans that end in different years are subtracted in two different
  years' dollars (the worksheet's plans: +200,000.00 nominal, +6,579.93 in the Compare
  page's start-year dollars).
- **Docs: the five check scripts worksheets cited as "not yet published" are in the
  repository** under `DOCS/calculations/<group>/scripts/` (`fi_spending_base.py`,
  `joint_survival_2023.py`, `claim_month_rb.py`, `claim_month_rc.py`, and `run-base.mjs`
  with its model and data), each with no local path, reading nothing from `packages/`, and
  reproducing its worksheet's figures when run from the repository root with no arguments.
- **Follow-ups outside this repository.** RetireGolden-MCP: its main already reads the three
  figures from the engine (RetireGolden-MCP #81, unreleased): `summarizeProjection` for
  `lifetimeTaxesAndPenalties` and `endingByCategory.traditional`, and `compareScenarioPlans`
  (`@retiregolden/engine/scenarios/comparison`) for `headline.endingAfterTaxEstate.delta`;
  its next release ships that, and its next engine bump must pass `summarizeProjection` its
  third argument (the schema v7 follow-up below). RetireGolden-Docs: the output census
  should make the three families kind `engine`, naming those functions, and the engine's
  census copy is re-imported once that lands.

- **Changed: the five figures the output census froze as still computed in the planner now
  come from the engine, and none of them prints differently** (B2-P1 under D-UI-SS; census
  RetireGolden-Docs 6af6441 plus the relocation patch). The household map's "As entered"
  assets, debts and net are `model/enteredBalanceSheet.ts#enteredBalanceSheet` of the accounts
  shown; the Monte Carlo summary publishes `medianFirstDepletionYear` and `lastingPathCount`,
  which the "Why this number?" panel prints, and the depletion chart's label reads the
  engine's failing-path count instead of adding up the year counts; the Social Security
  page's add-ladders total is `ladder/bridge.ts#bridgeLaddersTotalCost`; and the downloadable
  report's "Trailed … by $X" is `projection/candidateTrailingEstate.ts#candidateTrailingEstateAmount`.
  Each has a calculation record, reviewed by Codex (GPT-6-Sol) and approved
  (`REVIEW-2026-09-30-round3-codex.md`), a worksheet, an evidence test and an executed
  mutation receipt, and a parity test shows every figure equal to the page's retired
  arithmetic, bit for bit, on the 29 example plans. All 45 UI families are now relocated.
- **Fixed: the ending-balance histogram's accessible label says what the chart shows.** It
  described the histogram of ending investable balances and then gave the median ending
  estate, a different measure (example-couple: $2.59M against a median ending investable
  balance of $1.61M). It now reads "Histogram of ending investable balances: how many of the N
  simulated paths ended in each balance range." The estate median stays in the verdict
  paragraph.
- **Fixed: no state taxes a railroad retirement annuity** (2026-09-30, the orchestrator's
  decision after the D-OOS-INPUTS fix below). 45 U.S.C. 231m(a) bars every state, so the
  subtraction is one federal rule (`usc-45-231m-state-tax-bar`), applied at the top of
  `characterizedRetirementDelta` for every state with an income tax, less the railroad
  sources a state's own law already subtracts under its own record (Arkansas, Colorado,
  Iowa, Kansas, Louisiana, Massachusetts, Missouri, Utah and Vermont all three; Virginia
  and West Virginia tier I). Twenty-four jurisdictions subtracted nothing before (AZ, CA,
  CT, DC, GA, HI, ID, IL, IN, KY, ME, MD, MI, MN, MS, MT, NE, NJ, NM, NC, ND, OH, OK, PA),
  West Virginia now takes tier II and the other annuities off too, and Delaware, which
  counted the annuity in its pension exclusion, and New Jersey keep railroad out of their
  pension pools. Single filer, 100,000 dollars with a 20,000 dollar tier II annuity, 2026:
  Pennsylvania 3,070.00 to 2,456.00, Delaware 4,544.00 to 4,049.00, West Virginia 3,690.90
  to 2,774.90. A sweep of all 42 income-tax jurisdictions in
  `tax/stateRailroadAndMilitary.rules.test.ts` shows each railroad source coming off exactly
  once at 60 and 70 and every retirement pool left to other income. No example figure
  changes. Military retirement is not extended: the state-tax module doc and a limit on
  `state-enacted-tax-year-figures` now name the fifteen states whose own military rule the
  engine models and say the rest are not modeled yet, starting with Wisconsin's full
  subtraction of U.S. military retirement pay. The New York issuer record no longer says a
  pension's source is only private or public.
- **Fixed: Utah keeps its Social Security credit when the household has a railroad
  annuity** (2026-09-30, review of #771). The household facts left Utah's Social Security
  credit base and its railroad overlap unknown whenever any railroad pension existed, so the
  Utah Code 59-10-1042(2) credit was dropped and the year marked incomplete. The credit base
  is the Social Security the engine includes federally, IRC 86 on the Social Security streams
  alone, and every railroad pension, tier 1 included, is priced as pension income outside it,
  so the 59-10-114(2)(d) subtraction removes none of the base: the overlap is 0 whenever the
  railroad ledger is known. A joint return at 70 with 50,000 of other income, 13,350 of
  Social Security and a 20,000 tier II, tier 1 or other railroad annuity, its Utah MAGI
  additions stated: a 504.96 credit and 2,225.00 of Utah tax, not 2,729.96. Utah MAGI, which phases the credit
  out, still counts the annuity, as the engine reads Utah's definition (federal AGI plus the
  excluded interest and the 59-10-114 additions). Plan-level tests
  (`projection/simulate.stateRailroadProduction.test.ts`) price a tier II pension through
  `simulatePlan` in Utah, Pennsylvania and New Jersey at 65 and find each state's tax equal
  to the same plan's without the annuity, with the household railroad aggregates carried;
  the state-facts adapter test covers the three railroad sources. The 42-jurisdiction sweep
  in `tax/stateRailroadAndMilitary.rules.test.ts` now builds its household facts with the
  production builders (`deriveAnnualStateRailroadBenefits`, `buildAnnualStateHouseholdFacts`),
  so every state is priced with the railroad aggregates a plan carries: each railroad source
  still comes off exactly once, alone and beside a private pension, and adds no warning. No
  example figure changes.
- **Fixed: a railroad retirement annuity is not taxed in Alabama, New York, Oregon, Rhode
  Island, South Carolina, Virginia or Wisconsin, and Rhode Island subtracts a military
  pension in full** (2026-09-30, the D-OOS-INPUTS grouping, group 1). 45 U.S.C. 231m(a)
  forbids any state tax on an annuity under the Railroad Retirement Act, and each of these
  states' instructions subtracts it. A pension tagged Railroad Tier I, Railroad Tier II or
  Railroad Retirement Act (other) was priced there as ordinary income, outside every
  retirement exclusion (Virginia already subtracted tier I). It now comes off the state base
  in full (`tax/stateRailroadAndMilitary.ts`). Rhode Island's 44-30-12(c)(11) subtracts a
  pension tagged Military retirement or Military survivor benefit with no age or income
  test, and keeps it out of the (c)(9) pension modification, where the engine had put it:
  at 62 with 100,000 dollars and a 40,000 dollar military pension a single filer pays
  1,830.00 dollars for 2026, not 3,397.50. For a single filer with a 20,000 dollar tier II
  annuity the 2026 state tax falls by the annuity at the marginal rate: Wisconsin 7,839.36
  to 6,779.36 at 160,000 dollars; New York 4,859.75 to 3,723.00, Rhode Island 3,397.50 to
  2,580.00, Virginia 4,935.90 to 3,785.90, Alabama 4,810.00 to 3,810.00 and Oregon 8,176.38
  to 6,426.38 at 100,000; South Carolina 7,370.00 to 6,328.00 at 160,000. The nine records
  that called these pensions inexpressible (the plan has carried the sources for some time)
  are settled, each citing the federal statute or the Rhode Island law with its state's
  instructions and pricing both readings in `tax/stateRailroadAndMilitary.rules.test.ts`.
  Railroad unemployment and sickness benefits still have no income type. None of the 29
  examples has a railroad or military pension, so no example figure changes.
- **Changed: the WEP and GPO repeal record is settled** (2026-09-30, the D-OOS-INPUTS
  grouping, group 5). Public Law 118-273, signed January 5, 2025, repealed both for benefits
  payable after December 2023, so the unreduced benefit the engine pays is what the law
  requires; a WEP or GPO input could only trigger the repealed reductions. A worked case
  pins it (`projection/wepGpoRepeal.rules.test.ts`): a worker with a 2,000 dollar PIA and a
  3,000 dollar monthly pension from uncovered work is paid 24,000 dollars at 67, not the
  17,856 WEP would have paid, and a spouse with that pension the 12,000 dollar spouse
  benefit, not nothing. With the federal railroad rule above, the registry counts 582
  records, 375 settled and 78 out of scope (581, 364 and 88 before).
- **Changed: every calculation record has an independent review from a different agent
  family, and every record passes every catalog gate; 149 families were complete on main
  before, and with the 2026-09-30 entries above all 237 are** (decision
  D-DIFFERENT-FAMILY-REVIEWS, 2026-09-29 and 2026-09-30). 108 records said
  `reviewedBy: 'unreviewed'`. Codex (GPT-6-Sol) reviewed the 81 derived by Claude and Grok
  (grok-4.7) the 27 derived by Codex, each by read-only recomputation from the worksheets and
  their sources. 88 approved at once; the 20 rejects were fixed once and all approved on a
  targeted re-check. The eleven reports and the reviewers' scripts are under
  `DOCS/calculations/reviews/`, and each worksheet cites its report. The fixes are text,
  worksheet and evidence changes except the IRMAA table below. The census scanner also resumed
  inside a test title with a substitution and missed every test after it, so two fixtures
  registered none; it now skips the whole title, and a freshness test requires every record's
  fixture to register a test.
- **Changed: committed evidence names no local machine path** (decision
  D-LOCAL-PATHS-IN-EVIDENCE). Mutation receipts write the checkout path from the repository
  root, quote-ledger notes give each saved source's fetch date and SHA-256, and a conformance
  test (`rules/localPaths.conformance.test.ts`) fails the engine suite on any local path in a
  tracked file.
- **Fixed: the Medicare income-related (IRMAA) premiums come from CMS's published table,
  not from the standard premium times the applicable percentage** (2026-09-29, after the
  Codex review of `spending-healthcare-annual`). The engine priced each IRMAA tier's Part B
  premium as $202.90 times 35, 50, 65, 80 or 85 over 25: $284.06, $405.80, $527.54, $649.28
  and $689.86 a month. CMS applies those percentages to the unrounded actuarial rate and
  publishes $284.10, $405.80, $527.50, $649.20 and $689.90 ("2026 Medicare Parts A & B
  Premiums and Deductibles", read on cms.gov on 2026-09-29), so four of the five tiers were
  off by 4 or 8 cents a month a person. The 2026 parameters now carry CMS's totals and the
  ledger, the optimizer's IRMAA cost and the IRMAA insight read them; a year after the
  latest CMS publication grows them as it grows the standard premium. The Part D amounts
  ($14.50 to $91.00) were already loaded from CMS's table and were right. A first-tier
  person now pays $3,409.20 of Part B a year (was $3,408.72), and the worked healthcare
  household of `spending-healthcare-annual` $8,832.00 (was $8,831.20). Sixteen of the 29
  examples have a year at a tier that differs; their ending figures move by cents to a few
  hundred dollars through the compounding (example-couple's ending after-tax estate
  $3,701,888.29 to $3,701,875.52, rmd-irmaa's $1,208,827.56 to $1,208,800.91,
  aggressive-saver's up $470.78, trump-account-head-start's up $162.65); no depletion year
  and no Monte Carlo success rate moves, and the IRMAA insight's premium cliff moves by a
  few dollars (aggressive-saver $13,738 to $13,735, barista-fire $14,110 to $14,116). The
  bracket-fill-roth walkthrough's 2029 figures move by cents (its 2028 is at tier 1): the
  conversion 210,091.84 to 210,091.90 and the investable total 979,946.09 to 979,944.52.
  The parameter source appendix of the report now lists the Part B IRMAA totals.

- **Fixed: the Social Security earnings test is charged month by month, as the law
  charges it, by one year function the projection and the Social Security analysis page
  share; the analysis page now counts it (example-couple's benefits-only headline at 2%
  moves from claim at 70 / 62, $865k, to 70 / 63, $860k; no projection figure of the 29
  examples moves)** (decision D-SS-ANALYSIS-EARNINGS-TEST, 2026-09-29; derivation and
  independent check in RetireGolden-Docs `evidence/ss-earnings-test-*.md`). The ledger
  tested one annual amount against each person's own benefit. It now follows 42 U.S.C.
  403(b) and (f) and 20 CFR 404.415 to 404.440: a worker's excess is charged first against
  the family benefit on his record, the spouse benefit included, with the rest of a partial
  month shared two to one; in the year of full retirement age only the wages of the months
  before the full-retirement-age month count, and that month comes from the birth date;
  the excess is floored to the dollar; no month before a benefit's first month of
  entitlement is charged (403(f)(1)(A)), so the months of a claim year the plan pays
  before the claim month are paid in full; each month with a deduction in a benefit's
  reduction period is one crediting month, and the adjustment takes effect in the
  full-retirement-age month, not in January; a widow(er) benefit is credited only before
  the survivor full retirement age; the deceased's own crediting months raise the widow's
  limit; a couple member is paid on a living ex's record from the January after the
  spouse's death; and a former spouse's survivor benefit that a remarriage before 60
  barred until the current spouse's death is reduced from that January, not from the
  claimant's earlier claim (POMS RS 00207.003 A). A worker earning $60,000 at 62 whose spouse claims at 62 on his record
  (worksheet case E5) is now paid $2,893.33 in 2026 and the spouse $4,186.67, where the
  ledger paid $0 and $8,040. The analysis page's break-even chart, benefits-only ranking,
  survivor switching and paid-in panel price every year with the same function and the
  plan's wages, and name each person whose wages hold part of a benefit back at the claim
  ages shown; survivor switching also adjusts a widow(er) benefit started before 62 at 62
  for the months withheld before it (20 CFR 404.412(b)). On the 29 examples no projection year moves (every year array is
  bit-identical) and no Monte Carlo rate moves; on the analysis page only example-couple
  changes: 28 of its 63 benefits-only rows (Alex at 64 or 65, Sam at 62 or 63), the headline
  at 15 of the 17 slider steps (4%: 69 / 62 to 69 / 63), and Sam's break-even chart, whose
  claim at 62 is withheld while she works from September 2026 (62 against 67 now crosses at
  75.2 rather than 75.7 at a 0% return, 62 against 70 at 77.4 rather than 77.5). The five
  other couple examples' benefits-only rows differ by at most 2e-15 of their value, a
  floating-point effect of summing the paths in a different order; no displayed figure,
  rank or headline moves. Stated limits: wages are whole years
  spread evenly over their months (no grace year), income entered as other income is not
  tested (new record `usc-42-403-f-5-earnings-counted`), a couple member's remarriage before
  60 is read as the current marriage and a person living alone's as ended before the claim,
  and benefits are not floored to the dollar as
  20 CFR 404.304(f) floors them. New records `usc-42-403-b-1-worker-excess-charged-to-family`,
  `usc-42-403-f-3-fra-year-months-before-fra`, `cfr-20-404-412-b-arf-effective-fra-month`,
  `poms-rs-00615-320-b-2-c-deceased-crediting-months`, `usc-42-403-f-5-earnings-counted` and
  `usc-42-402-b-1-C-divorced-spouse-after-widowhood`; the earnings-test, crediting and
  analysis records restated, all unreviewed. After the review of pull request 769: a
  worker also paid a survivor benefit on a former spouse's record has a month his excess
  only partly covers charged to each record in proportion to what it pays him, and only
  what is left on his own record is shared two to one (POMS RS 02501.145 B.2; 20 CFR
  404.439), where the engine shared two to one over everything he was paid (a worker
  earning $60,000 at 62 with a $2,389.29 widower's benefit, whose wife is paid $390 on his
  record: 2026 pays him $13,277.54 and her $5,673.89, where it paid $13,251.43 and
  $5,700); a person paid on two records has her own excess charged on both in proportion,
  so both benefits have a crediting month, as the engine already credited them (RS
  02501.145 B.2; RS 00615.482 B.3 note); the claim-milestone insight prices a former
  spouse's survivor benefit as the ledger does; the other-income note on the analysis
  page follows each claimant's full retirement age; and the benefits-only ranking keeps
  nothing between calls. The engine adds `priceBenefitsOnlyRanking(plan, startYear)` and
  `weighBenefitsOnlyRanking(priced, discountRate)`; `benefitsOnlyRanking` keeps its
  signature and now prices on every call, so a host that re-weights one plan at several
  rates prices once and weighs each rate. No exported signature changes. None of the 29
  examples moves further: every ledger year, Monte Carlo rate and analysis row equals the
  branch before the review.

- **Fixed: what 1 January 2027 would have changed without a word, now held or said (decision
  D-2027-ROLLOVER; derivation and independent check in the validation program's staging,
  `rollover-2027/{derivation,check}.md`).** Measured by `rollover-2027/impl` on this branch against
  main (5224c5d0), today's clock against a clock faked to 2027-01-15:
  - **Library examples run from 2026, the year their copy is written for.** On main all 29 KPI
    bars, 10 money-lasts years, 16 Market success percentages and all 10 scenarios move on
    1 January, and every example gains "Plan last saved in 2026". Here none of the 29 examples or
    their 10 scenarios moves: the whole result, warnings, Insights and Market success are
    byte-identical (`examples.nextYearClock.test.ts` holds it). The banner says the example is set
    in 2026 and, from 2027, what Save to my plans changes; its money labels read "2026 dollars".
    Compare Plans lists the examples opened on this device: two examples run from 2026, and an
    example beside a user plan runs from the clock's year, which the page says. Example text dates
    its figures ("two years from retirement in 2026"), and the walkthrough evidence JSON (version 3)
    carries its start year. Three builders' literal years are relative to `EXAMPLE_FIXED_YEAR`.
  - **A pension lump sum elected for a year that has passed.** On main a plan saved in 2026 with a
    2026 election opened in 2027 and refused its next autosave with "Could not store locally",
    losing every later edit on reload; at 22:00 on New Year's Eve in New York the UTC save stamp
    refused an election the projection still modeled, and at 05:00 on New Year's morning in Tokyo
    the save accepted one the projection had stopped modeling. Now the check runs against the
    year the plan starts (`model/asOfIssues.ts`) on load, edit and save; the plan opens as stored,
    the chip reads "Fix 1 issue to store" and names both restatements, and a refused save is
    never reported as a storage failure. Nothing is repaired: dropping the election on load would
    pay a pension the household gave up if the lump sum was taken.
  - **Plan events dated before the start year are named, and a sale or payoff dated earlier runs
    in the first year.** One-time goals and incomes, recurring incomes that ended, annuity
    purchases of every kind, TIPS-ladder purchases (with the cost the ledger prices), HECM lines
    dated to open earlier, a Roth window that ended, manual Roth conversion rows, and named Roth
    conversions, QCDs and withdrawals (each by amount, person, account and execution date, and
    two that would still read the same are numbered, "the first of two identical entries", so two
    are two warnings; the second verification's V3) each get a warning saying what the projection
    assumed. A purchase dated earlier is
    still treated as already paid; when the funding balance was typed before the purchase that
    counts the premium twice (the derivation's U1 annuity: -$147,622.51 from a 2026 start,
    +$454,836.90 from a 2027 start, now pinned in `preStartEvents.figures.test.ts`), so the warning
    names the amount to lower it by, and the limit is registered in `income-annuity-annual` and
    `income-tips-ladder-and-ladder-value-annual`. A property still on the plan with a past sale
    year is sold in the first year, and its carrying costs stop from that same year
    (`projection/propertySaleYear.ts`, the independent review's H1): main held the house to the
    end with its tax and insurance dropped, +$1,017,839 on the review's case. A debt payoff dated
    earlier is paid in the first year, as before, and is named with the amount. A property at $0 is
    not sold, so its warning says only that its property tax and insurance stop from the first year
    (PR #768 review issue 9). Every dated editor field with a pre-start meaning now has a note.
  - **An example's other "today" labels, and a plan left open across New Year.** On an example,
    Accounts reads "Balances as of the start of 2026", and the whole-life cash value and the
    funded-ratio values name 2026; two example bodies name their contribution amounts instead of
    claiming the maximum. The headline Monte Carlo caches and the Social Security analysis are
    keyed on the start year, so a plan open at midnight on 31 December runs again from the new
    year; the workspace and Compare Plans render again at the local New Year with no click
    (`useClockYear`), so Compare runs both plans from the new year and a plan whose pension
    election has just gone stale reads "Fix 1 issue to store" at once (PR #768 review issues 3, 4
    and 8). Undated lines are dated (the Trustees' depletion year, Learn's ACA years, the report's
    parameter appendix, a walkthrough row), and Compare's unreachable start-year message is gone.
  - **"Plan last saved in 2026" east of UTC.** The save stamp is read on the start year's calendar
    (`DetectorContext.planSavedOn`), so a Tokyo save at 04:59:50 on 1 January is not a 2026 save.
  - **Clock- and zone-fragile tests.** The QCD-authoring file pins its clock (one test failed and
    one asserted nothing on a 2027 clock); two New Year tests build local instants, so they pass
    in Bangkok, Tokyo and Auckland.
- **Changed: the published figures are split by publisher, and projected years are marked.**
  `params/components.ts` gives every figure one publisher (IRS income tax, IRS retirement-plan
  limits with the QCD limit and QLAC cap, IRS HSA limits, SSA, CMS, HUD, the premium tax credit's
  coverage years, statute, tables and defaults), each with its own published years;
  `packForYear` composes a year from each publisher's latest year and every reader scales a
  figure from its own publisher's year. The named-QCD gate waits only on the QCD limit. A
  state deduction that follows the federal one (Colorado's) conforms to the year's federal
  figure, loaded or projected, and the District's and Washington's statutory indexing runs at
  the plan's inflation from the state figures' year, so landing the IRS's income-tax figures
  alone moves neither (`tax/stateDeductionLanding.test.ts`; the second verification's V1).
  Nothing is left to move at the first landing (PR #768 review issues 1 and 7): the widow's-penalty
  insight prices the survivor's tables at the income-tax figures' own factor, the law-pack insight
  compares the save year with the latest year a publisher's figures for the plan's first year are
  loaded for and names them (so a plan saved in 2026 and run from 2027 now reads "2027 rules need
  a plan review" for the loaded 2027 HSA limits and premium tax credit figures), and the IRMAA
  tier-edge insight and the optimizer LP read Medicare through CMS's own component.
  `params/landing.readers.test.ts` lands the IRS's figures alone and CMS's alone, and
  `params/baseYearReaders.contract.test.ts` fails on any new read of the base pack's year in engine
  source not listed with its reason. Every publisher's latest year is 2026, so no figure moves: the equivalence corpus (150 members, four
  modes) against 5224c5d0 differs only in two members' new pre-start warnings (a QCD dated 2025
  and a HECM line dated 2022, each in a 2026 run). The HSA component reads `hsaLimitYears.ts`
  (from the state-tax change, #762), so 2027's HSA limits show as loaded and are projected only
  from 2028. Results marks each projected year and says which figures are projected and from
  when, that each is projected until RetireGolden loads the agency's own figures, that Medicare
  premiums grow at the plan's healthcare inflation (its inflation plus its healthcare premium)
  while the rest grow at its inflation, and that a later year's state income tax is each state's
  enacted schedules where loaded and otherwise its 2026 figures held without growth, except a
  standard deduction that follows the federal one (it moves with it) and the District of
  Columbia's from 2027 and Washington's from 2029 (their statutes index them at the plan's
  inflation; the second verification's V2); the ledger CSV gains a
  "Parameter figures" column; the report, the Assumptions page and card, the assumptions export,
  the Optimizer and the Disclaimer and its source panel say it too (the panel's column is
  "Loaded for", and its introduction points to that column instead of calling every row "the
  ones loaded for 2026": the second verification's V4). The published v7 plan schema (current since #765) no longer states the
  election rule `parsePlan` dropped; v1 to v6 are historical and unchanged. Copy that described later years wrongly is reworded (the Assumptions hint, the source panel, the Part B help, the Disclaimer),
  Learn's current-figure headings are dated 2026, and HowTested's parity line says when it last
  ran.
- **Changed (tests): a clock for the rollover run, and tests that tell the start years apart.**
  `scripts/rollover/shiftClock.setup.mts` shifts every `Date` (a `Proxy`, so `new Date()`,
  `Date()` and `Date.now()` all read it) to `RG_ROLLOVER_CLOCK` and applies `RG_ROLLOVER_TZ`; the
  engine, planner-ui and app vitest configs load it only when either is set, and
  `.github/workflows/rollover.yml` runs the three suites weekly at next 15 January, New Year's
  Eve in New York and New Year's morning in Tokyo. `examples.nextYearPages.test.tsx` renders an
  example's KPI bar, Insights, Results, Report, Scenarios and Monte Carlo pages at a 2027 clock;
  `params/index.ts#withParameterComponents` lands one publisher's year end to end, so each reader
  is held to its own publisher; and every surface that prints the projected-year mark is checked.
  The independent review's mutants B01-B07, G09-G12, G14, H04, H06, H07, I01, I04, I06-I09, A07
  and E13 are killed. The equivalence corpus builds again under plan schema v7: #765 left two
  blocks members refused (j1's spending phases named no person, v3's three annuities no
  annuitant), so `equivalence.mjs corpus` exited 2; each now names p1, the person the v7
  migration names, and the three proofs that pin `corpus/blocks.mjs` move only their corpus
  identity. `scripts/equivalence/corpusParses.test.mjs` parses every corpus member in the
  unfiltered engine suite, so a schema change that refuses one now fails CI.
- **Follow-ups outside this repository:**
  - RetireGolden-MCP: the default start year follows the clock (as Pro's `guiStartYear()`), with
    the protocol baseline regenerated; `update_plan` and `build_plan` run `asOfIssues` against
    `session.startYear`, and `update_plan` stops re-stamping from the real clock; `build_plan`'s
    frozen `2026-01-01` build stamp comes from an injected clock; run_monte_carlo,
    batch_evaluate, run_optimizer and solve_max_spending forward the baseline projection's
    warnings (they drop the pension warning today). Every projecting tool echoes the `startYear`
    it ran from (run_monte_carlo, batch_evaluate, solve_max_spending, compare_scenarios,
    explain_modeled_result and update_plan do not today); the `startYear` schema field gets a
    description; and `plan-json.md` and SKILL.md tell agents to pass it. Its engine and
    planner-ui pins move after the next engine release.
  - RetireGolden-Pro: review and CRM due dates on the local date, not UTC; 2026 checklist items
    lose Approve once their tax year has ended; the CRM export skips findings whose validity is
    not current; a review finalized after 1 January judges validity against its scan's start
    year; the cockpit goes stale when its start year differs from the clock's (a cockpit left
    open across midnight on 31 December keeps a 2026 start); its records store `startYear` and
    the projected components beside the "law 2026/2026" labels; and the pin bump that brings
    pinned examples and the as-of save check.
  - The methodology site needs a version-3 reader for the walkthrough evidence before anything
    else here reaches it: this change writes `DOCS/operations/walkthroughs/*.json` at format
    version 3 (`WALKTHROUGH_EVIDENCE_VERSION`), and the site's refresh refuses a version it does not
    know before staging anything, so its three walkthrough pages stop following the engine until
    that reader ships (PR #768 review issue 10). With it, the walkthrough pages say each example
    runs "from a fixed 2026 start", read from the evidence files' `startYear`; `about.astro`'s "models current law"
    says that later years use projected figures until RetireGolden loads each agency's; and the
    58 re-verification dates `tax-rules.astro` prints fall due on 1 January 2027.
  - RetireGolden-MCP and RetireGolden-Pro pin an engine that prices no 2027 premium tax credit
    (the check's spec 0): each pin bump's pull request should say that 2027 ACA credits were
    unpriced in that host until then.
- **Changed: what the people-order, FI and scenario fixes move on screen, measured
  against main at 068a5968 (its figures are #762's, 4fa0c842) on all 29 examples at a
  2026 start (1,000 Monte Carlo paths, the default seed): the FI number and Coast-FIRE
  on 5, the Monte Carlo longevity mode on 3 couples (its rate on 1), the funded-ratio
  card on 2, and on survivor-years the Compare depletion age, the annuity sweep and the SPIA
  candidate; no ledger figure, headline success rate or "How much can I spend?" answer on
  any** (decisions
  D-PEOPLE-ORDER, D-FI-CONVERSION-TAX and D-SCENARIO-JSON-LOSS, 2026-09-28). FI number:
  example-couple $4,406,941 to $3,552,680, bracket-fill-roth $3,420,040 to $2,521,740 and
  early-retiree-aca $1,071,826 to $1,014,200 (the priced year's Roth-conversion tax is no
  longer capitalised); annuity-purchases-estate $2,698,543 to $2,749,157 and
  no-annuity-brokerage $2,698,543 to $2,684,851 (Taylor's later retirement, 2027, priced
  without its conversion). Coast-FIRE moves with them (example-couple $4,153,964 to
  $3,348,741; the Jordan and Taylor pair to $2,671,678 and $2,609,184). FI year and FI age
  move on none. The same FI numbers move on six Scenarios rows. With stochastic
  longevity, survivor-years goes from 33.2% to 33.8% (the canonical draw order; Chris,
  listed second, is older); brokerage-bridge-401k keeps 34.3% with 17 paths changed
  (joint contributions) and example-couple 83.9% with 10; and survivor-years' care mode
  changes 111 paths at 0%. The Results and Report FI paragraph adds a sentence
  naming the year it prices, why that year, whose retirement it is for a couple, and when
  a conversion's tax was left out (all 29); the annuitization insight names the annuitant
  and age (4 examples). A copy of a couple example saved before v7 opens with a notice
  naming whose age its spending phases follow (5 examples) and, on
  annuity-purchases-estate, who is the SPIA's and the QLAC's annuitant (Jordan, the
  person the engine already used; no figure moves). Listing a couple's two people the
  other way round used to move Monte Carlo paths on all 7 couples (365 to 1,000 of them in
  the mode it moved most) and, on 5, the solver's answer and three to seven summary figures;
  it now moves none of them. The surfaces that illustrate for one person now use the older
  person, whoever is listed first: the funded-ratio card on annuity-purchases-estate goes
  from 86% to 90% and on no-annuity-brokerage from 70% to 73% (counted from Taylor's 2027
  retirement, the later one, instead of Jordan's 2026); on survivor-years the Compare Plans
  depletion age goes from 81 (Lee) to 83 (Chris), the Monte Carlo annuity sweep starts at
  66 on Chris's life instead of 65 on Lee's (payout rate 7.00% to 7.28%, each point's
  income up 4%; success rates unchanged at 0%), and the Optimize SPIA candidate pays
  $151.67 a month from 66 on Chris's life instead of $145.83 from 65 (evaluated lifetime
  tax $84,621 to $80,419). The other couples' figures are unchanged on those surfaces; the
  rows and cards now name the person, the funded-ratio card calls a couple's floor the
  household's and always says which year it counts from, and the Compare row reads
  "Depletion age (Alex)" instead of "Depletion age (primary)". The independent review's
  fixes, re-measured the same way, move no figure on any example: the Coast-FIRE row names
  the year it grows into the FI target (all 29); the FI sentence no longer says the priced
  year converts (5 examples) and gains the conversion sentence on glidepath-allocation,
  hsa-property-depth and static-allocation-control, which convert only after the priced
  year (their `fiBasis.spendingSource` reads `conversionFreeProjection`, the figure
  unchanged); the funded-ratio insight on guardrails-flex-goals says where its count
  starts; and Compare Plans shows both ages and "different people" instead of a
  depletion-age difference between two people (9 examples against under-saved-single).
  The verification's fixes (a stored annuity bought for a person already dead, a refused
  conversion request, the first year without wages, a person who works through the
  plan) move no figure or sentence on any example, and neither do the fixes from the
  round-one review of #765 (wages paid past a retirement age, "Refine to the month"
  without a pass cap, a failed scenario row's FI figures), re-measured against main at
  81812497.

- **Fixed: the FI number no longer prices a Roth conversion's one-off tax as yearly
  spending, and it prices the household's later retirement, not the first-listed
  person's** (D-FI-CONVERSION-TAX; D-PEOPLE-ORDER rule R4). The FI number divides one
  year's spending, tax and penalties by the withdrawal rate, so a conversion in that year
  was capitalised 25 times at 4%. When the plan converts in any year, the priced year is
  read from the same year of the plan run without its Roth conversions
  (`withoutRothConversions`, `conversionFreeRun`): a conversion's costs reach later years
  too (its income sets the Medicare IRMAA surcharge two years on, and the tax it prepays
  drains an account a later year draws on), so converting more can never lower the
  figure. `ProjectionSummary.fiBasis` publishes the year, its source (`projection`,
  `conversionFreeProjection`, `conversionTaxIncluded` when the caller passes
  `conversionFreeRun: null`, or `baseAnnual`), whose retirement it is, when, and by which
  rule. The year is the household's later retirement, by the one rule the FI figures,
  Coast-FIRE and the funded ratio share (`projection/householdRetirement.ts`): each person
  retires in the first year without their work, their birth year plus retirement age, or
  the year after their last wage year when a wage stream's end age keeps paying past the
  retirement age (the engine pays a stream until its own end age); with no retirement
  age, the year after their last wage year, or the start year when they have no wages in
  the plan; a person who works through the plan (wages through
  their last year alive, or a retirement age past the planning age) is left out, and the
  latest of the rest wins, a tie going to the older person, then the smaller id. When
  nobody retires in the plan no FI number, Coast-FIRE figure or funded ratio is priced
  (`fiNumber` and `coastFireNumber` are null), and the pages say so instead of pricing a
  working year or a year after a death. FI age, Coast-FIRE's horizon and the average
  pre-retirement savings rate follow it; the Results and Report pages say whose year it
  is, by which rule and who works through the plan, and the Coast-FIRE row names the year
  it grows into the FI target. A plan that asks to convert to Roth but whose every request
  was refused is no longer said to convert. New records `projection-summary-fi-spending-base` and
  `household-later-retirement`; restated `projection-summary-fi-number`, `-fi-age`,
  `-coast-fire-number` (receipt re-derived) and `-average-pre-retirement-savings-rate`.

- **Fixed: a pension or annuity is paid on its named owner's age and life, never on
  whoever is listed first** (D-PEOPLE-ORDER rule R2). A "Joint" pension or annuity
  started at the first-listed person's age and ended or reduced at that person's death,
  so reordering the people moved its first and last payments. A pension now names its
  participant and an annuity its annuitant, and the other person is the survivor or
  second annuitant. An annuity bought from an IRA or 401(k) must name that account's
  owner, and a pension lump sum rolls over only into its earner's own traditional
  account. The one exception is a surviving spouse: once the owner's planning age has
  ended, the living spouse may buy an annuity on their own life from what was the owner's
  401(k) or IRA, since a spouse's distribution is treated as if the spouse were the
  employee and a spouse's IRA is not inherited (new tax rule
  `irc-72-c-3-A-annuity-measured-on-named-lives`, quoting IRC 72(c)(3)(A), Treas. Reg.
  1.72-5(b)(1), IRC 408(a) and 408(b)(1), (4), and IRC 402(c)(9) and
  408(d)(3)(C)(ii)(II), each verified against uscode.house.gov or the eCFR). An annuity
  bought for a person whose planning age has ended by its purchase year is refused in
  plain words ("... would never pay: name a person who is alive in ..."); a stored plan
  of that shape still opens, the contract given to the other person when alive in the
  purchase year, the only one who could have bought it, and otherwise removed with its
  premium left where it was, with a notice that the figures change. The pre-start
  contract value, the runtime source-series check, the late-start warning, the pension
  election and the Scenarios levers read the same owner. New record
  `guaranteed-income-owner`.

- **Fixed: a joint account keeps taking contributions while anyone in the household is
  alive** (rule R3). A cash, taxable or equity-compensation account with no owner took
  contributions only while the person listed first was alive and earning. Its plain
  annual contribution now continues while the household has wages, and a contribution
  schedule follows the age of the person it names (`contributionScheduleAgeOf`). New
  record `joint-account-contributions`.

- **Fixed: which person is listed first no longer changes the spending phases, the Monte
  Carlo draws, the amortized-spending horizon or "Refine to the month"** (rules R1, R5
  to R7). Spending phases follow the person `expenses.phasesAgeOf` names, shown on the
  Spending page (new record `spending-phase-person`). Monte Carlo draws each path's deaths
  and care events person by person in a canonical order (earlier birth date, then female,
  male, average, then id; new record `monte-carlo-people-draw-order`). The ABW survival
  horizon walks both people's survival curves to the end of the table: it used to stop
  when the first-listed person passed it, cutting a much younger partner's horizon short
  by up to 55 years, and 21,596 of 52,488 age pairs gave a different year by order (the
  independent check's grid, on SSA's 2022 table; restated
  `joint-survival-percentile-age`, receipt re-derived; on the 2023 life table a man of 70
  with a woman of 35 at 25 percent now reaches 2082 either way round, where the old walk
  stopped at 2076). "Refine to the month", now the engine's
  `decisions/claimAgeSweep.ts#refineClaimMonths`, steps the claimants in the canonical
  order and repeats whole passes until one changes nothing, a combination priced once not
  priced again. There is no pass cap: a changing pass takes a strictly better month, so
  no combination is picked twice and the search always ends at a fixed point (restated
  `social-security-claim-age-monthly-refinement`, new cases R-B, and R-C, which needs
  eight passes); no example's page answer moves. The premium-credit roster's "primary" label follows the canonical order.

- **Fixed: the annuity illustrations, the funded ratio and the Compare depletion age no
  longer read whoever is listed first** (D-PEOPLE-ORDER, on review). The annuitization
  insight, the Monte Carlo annuity sweep and the SPIA and laddered-SPIA candidates name no
  owner in the plan; they are now written on the life of the person
  `model/peopleOrder.ts#canonicalFirstPerson` puts first (the older) and name them. The
  funded-ratio card and the `income-floor-funded` insight count from the household's later
  retirement (`ladder/fundedRatio.ts#fundedRatioStart`, on the shared rule above), say
  whose it is and by which rule, and call a couple's floor the household's (new record
  `funded-ratio-household-start`). The Compare page's depletion age is the older person's
  on each side, labelled with their names; when the two sides' people differ (a different
  name or date of birth) the page shows both ages and no difference
  (`depletionAgeDeltaWithheld: 'differentPeople'`), since two people's ages have none. The
  depletion year stays the household's. The illustrations' records state the tie-break
  past the birth date (the sex order, then the id), as the Monte Carlo record does.

- **Fixed: a scenario survives every save route, and one that changes nothing says so**
  (D-SCENARIO-JSON-LOSS). A loose scenario patch could remove a field with JavaScript
  `undefined`, which the browser's store keeps and every JSON route drops:
  guardrails-flex-goals' "No guardrails" scenario, exported or copied to a JSON library, came back as
  `{"expenses": {}}` and showed the base plan's figures under its own name. The example
  now carries a canonical patch; every load converts such a patch to canonical remove
  operations and reports `legacyScenarioConverted`; both JSON exports make it canonical
  before writing; and the Scenarios page shows "This scenario changes nothing in your
  plan." in place of a row's figures when its applied plan equals the base
  (`ScenarioComparisonRow.changesNothing`). A copy an earlier build already exported
  cannot be recovered, and now says that it changes nothing. A scenario row that fails
  to apply publishes a null FI number and Coast-FIRE figure, not $0.

- **Fixed: reversing or renaming a couple's people now leaves every Monte Carlo path
  identical to the last bit, and the load notices and account help say what the model
  does** (D-PEOPLE-ORDER, on independent review). The year's healthcare adds each person's
  premiums, and the legacy QCD split takes each owner's share, in the canonical people
  order instead of list order or id order: floating-point addition is not associative, and
  at 1,000 paths the last bit differed on 4 no-annuity-brokerage paths in every mode and on
  1 annuity-purchases-estate care path. A test pins both couples in the headline,
  longevity and care modes. Every load repair that moves a figure now says "your figures
  change" (six do). The owner help on a joint cash, taxable or equity-compensation account
  says that a flat contribution needs wages while a schedule does not, and speaks to one
  person as "you".

- **Breaking (engine and planner-ui).** Plan schema v7 (`schema/plan.v7.json`,
  `@retiregolden/engine/schema/v7`; v1 to v6 unchanged): an older engine refuses a v7
  document with `newer_than_app`. New optional `expenses.phasesAgeOf` and
  `contributionScheduleAgeOf` (taxable, cash and equity-compensation accounts). A pension
  or annuity's `ownerPersonId` may no longer be null, so the "Joint" choice is gone for
  both. New validations refuse a couple's spending phases or scheduled joint account that
  names no one, an owner-less pension or annuity, a qualified annuity purchase named for
  anyone but its funding account's owner, and a lump sum rolled into another person's
  account. Migration 6 to 7 is the identity; the every-load repair names the person the
  engine already used and reports the new `spendingPhasesPersonNamed`,
  `contributionSchedulePersonNamed`, `guaranteedIncomeOwnerBackFilled`,
  `annuityOwnerMatchedToFundingAccount`, `annuityOwnerNamedSurvivingSpouse`,
  `annuityOwnerNamedLivingPerson`, `annuityPurchaseDropped` and
  `lumpSumElectionDroppedSpouseTarget` repairs (and the `livingPerson` basis), and
  `legacyScenarioConverted` for a scenario; a validation refuses an annuity bought for a
  person whose planning age has ended. Engine API: `summarizeProjection(plan, result, options)` now requires its third
  argument, `{ conversionFreeRun }`, either a function returning the plan's run without
  Roth conversions (`conversionFreeRun(plan, opts)`) or `null` to price conversion tax in
  and say so (`conversionTaxIncluded`); every caller must pass one or the other.
  `ProjectionSummary.fiNumber` and `coastFireNumber` are `number | null` (null when nobody
  retires in the plan), and `FiSpendingSource` gains `noRetirementInPlan`.
  `ProjectionSummary.fiBasis` (with `retirementRule`, `personLastYearAlive` and
  `notRetiring`) and `ScenarioComparisonRow.changesNothing` are new, as are
  `guaranteedIncomeOwnerId`, `canonicalPeopleOrder`, `withoutRothConversions`,
  `conversionFreeRun`, `convertUndefinedLegacyScenarioPatches` and
  `scenarioChangesNothing`, `canonicalFirstPerson`, `fundedRatioStart(plan, startYear)`
  (whose `fromYear` is null when nobody retires) and, in `projection/householdRetirement`,
  `personRetirement`, `householdRetirement`, `householdRetirementClause`,
  `notRetiringClause` and `RetirementYearRule` (`retirementAge`, `wagesPastRetirementAge`,
  `wagesEnd`, `startYear`).
  `PlanHeadlineComparison.depletionAgePrimary` is renamed `depletionAge` (the older
  person's age on each side, no longer the first-listed person's), beside the new
  `depletionAgePersonId` and `depletionAgeDeltaWithheld`. planner-ui adds
  `planner/fiTargetCopy` (with `coastFireHorizonYear`), `addPartner`,
  `spendingPhasesPerson`, `namePhasesPerson` and `nameContributionSchedulePerson`, and
  `removePartner` clears a schedule person on an account with an owner instead of
  re-pointing it. `decisions/claimAgeSweep.ts#refineClaimMonths` returns `passes`.

- **Follow-ups outside this repository.** RetireGolden-Pro: its library JSON route should
  make legacy scenario patches canonical before writing, as `serializeV2Backup` and
  `serializeSinglePlan` now do, and it needs the planner-ui bump for schema v7 (the FI
  paragraph, the load notices, the named-person editors). RetireGolden-MCP:
  `describe_plan_schema` and its protocol baseline move to v7 (`phasesAgeOf`,
  `contributionScheduleAgeOf`, required pension and annuity owners); its calls to
  `summarizeProjection` no longer compile until each passes a conversion-free run
  (`conversionFreeRun(plan, opts)`, so its FI figures match the app's) or `null` (and then
  publishes `fiBasis.spendingSource: 'conversionTaxIncluded'`); its summaries may now
  carry a null `fiNumber` and `coastFireNumber`, when nobody retires in the plan; and its pension and
  annuity documentation should drop "Joint". The output census's edited compare-page entries
  (the depletion-age selector, its transformation and the field name `depletionAge`) and the
  Results page's nullable FI target are on RetireGolden-Docs main (5d156cf), and the
  engine's copy is re-imported from there.

- **Fixed: 2026 state income tax figures that a survey of every state found wrong
  (displayed numbers change from 2026 for plans in Arkansas, Arizona, Colorado, Idaho,
  Maryland, Virginia, Rhode Island, California and the District of Columbia that meet each
  provision; none of the
  29 examples or their 10 scenarios moves)** (decision D-2027-PUBLISHED-FIGURES, from the
  survey of all 51 jurisdictions on 2026-09-28, recorded state by state in
  `DOCS/domain/state-tax-research/later-years-survey-2026-09-28.md`). Each correction has
  its own rule record, quotes checked live on 2026-09-28, and a fixture that prices both
  readings:
  - **Arkansas.** The top rate is 3.7% from $26,400 for tax years from January 1, 2026
    (Acts 1 and 2 of the 2026 First Extraordinary Session, approved May 6, 2026); the
    engine charged 3.9%. On $50,000 of Arkansas taxable income, $1,530.00 becomes
    $1,482.80.
  - **District of Columbia.** D.C. Act 26-416, an emergency act in force from August 13,
    2026 for no more than 90 days, sets the District's own basic standard deduction for
    2026 to 2029: $15,000 single and $30,000 joint plus the IRC 63(c)(3) additional
    amount, indexed from 2027 and rounded down to $50, and the federal deduction from
    2030 (D.C. Code 47-1801.04(3A) and (44)). The engine carried the federal $16,100 and
    $32,200. A single filer under 65 with $60,000 pays $2,525.00 for 2026, not $2,453.50;
    a couple with $120,000, $6,050.00, not $5,863.00. The permanent act, D.C. Act 26-418,
    is under congressional review with a projected law date of about November 20, 2026,
    when this is revisited; the law in force is loaded, as for Washington's and
    California's votes.
  - **The federal senior deduction in Arizona, Colorado and Idaho, 2025 to 2028.**
    Arizona subtracts it (A.R.S. 43-1022(35), Laws 2026, ch. 140), Colorado's base is
    federal taxable income, and Idaho conforms to the Code as of January 1, 2026 (H 559).
    The engine left it in all three bases: $150, $264 and $318 less tax for each person
    65 or older below the federal phase-out.
  - **Maryland.** The standard deduction is indexed from 2026 (Tax-General 10-217(c)),
    by an adjustment "as determined by the Comptroller": $3,400 single, as the
    Comptroller's withholding guide prints it, and $6,850 joint, computed by the same
    rule; the engine carried 2025's $3,350 and $6,700. The Comptroller's April 2026
    estimated-tax worksheet still prints $3,350 and $6,700, so the record is
    approximated with that as the contrary reading (at most about $11.60 a year joint)
    and is revisited when the 2026 Form 502 instructions publish in January 2027. The 2% tax on net capital gain when federal AGI exceeds $350,000
    (10-105(a)(3)) was missing: $2,000 more for a single filer with $500,000 of federal
    AGI that includes $100,000 of gain. A primary-residence gain on a sale under
    $1,500,000, which the statute leaves out of that base, still reaches it, because the
    state calculation sees a home sale's gain as ordinary capital gain; the record is
    approximated (overstates tax) until the gain carries its source. The public-safety retirement subtraction of
    10-207(mm), $16,000 at 55 or older for 2026 (2026 Md. Laws ch. 686), is now applied
    to a pension the plan marks with the eligibility code `MD-PUBLIC-SAFETY`: $760 less
    tax on a $30,000 police pension at 58. The planner's pension editor does not yet
    offer that marker, so it reaches a plan only through its file or the MCP interface.
  - **Virginia.** Personal exemptions of $930 each, plus $800 for each taxpayer 65 or
    older (Va. Code 58.1-322.03(2)), were missing: $99.48 less tax for a single filer at
    65 and $198.95 for a couple both 65.
  - **Rhode Island.** The pension and annuity modification is capped at $50,000 from
    2025 (44-30-12(c)(9)), not $20,000: $1,125 less tax for a single filer at 67 with
    $50,000 of pension. The Social Security modification (44-30-12(c)(8)), which the
    engine did not model, now subtracts the benefits included in federal AGI at full
    retirement age below $107,000 single and $133,750 joint, the 2025 limits and the
    latest published; on a 2026 joint return where only one spouse has reached full
    retirement age, the modification is that spouse's share, as the Division's worksheet
    prorates it. The pension modification now applies only below those same AGI
    limits, as (c)(9) requires, and leaves IRA distributions out, as the Division's
    instructions say: a single filer at 67 with $150,000 of federal AGI including a
    $60,000 pension pays $5,772.50, where the $50,000 cap without the test gave
    $3,397.50. `RI.md` no longer calls the flat $50,000 ceiling inflation-adjusted.
  - **California.** The military retirement and Survivor Benefit Plan exclusions of
    $20,000 each, tested on AGI, for 2025 to 2029 (RTC 17132.9, 17132.10), were missing:
    up to $1,860 less tax for each at 9.3%.

- **Changed: 2027 and later are priced on the figures already published or enacted for
  them, not on the 2026 figures (displayed numbers change from 2027 on for every plan whose
  HSA contribution reaches the limit and every plan in a state with an enacted later-year
  figure; five of the 29 examples and one of their 10 scenarios move)** (decision
  D-2027-PUBLISHED-FIGURES, from the 2027 rollover check, widened by the survey of every
  state). The engine projected every 2027 figure from 2026, although these were law
  already:
  - **HSA limits.** Rev. Proc. 2026-24, section 3.01(1): "For calendar year 2027, the
    annual limitation on deductions under section 223(b)(2)(A) for an individual with
    self-only coverage under a high deductible health plan is $4,500", and $9,000 for
    family coverage. The engine allowed $4,510 / $8,968.75 at 2.5% inflation and
    $4,576 / $9,100 at 4%. The limits now have their own published years
    (`params/hsaLimitYears.ts`, 2026 from Rev. Proc. 2025-19), read at a scale of 1,
    and a later year grows from the latest published one: 2028 at 2.5% is $4,612.50
    self-only (was $4,622.75). The $1,000 age-55 catch-up is statutory (26 U.S.C.
    223(b)(3)(B)) and unchanged; the revenue procedure's high deductible health plan
    figures ($1,750 / $3,500 deductible, $8,700 / $17,400 out of pocket) are read by
    no calculation.
  - **How the enacted state figures are read.** `stateParamsFor` applies every enacted
    year module at or before the year in order (`params/state/data/enacted2027.ts` to
    `enacted2033.ts`): each field an entry names replaces the field for every filing
    status it carries, a field named as null ends, and every other field keeps the 2026
    figure. Any state field can be enacted, not only rates.
  - **Rates enacted for 2027.** On $100,000 of 2027 state taxable income, married filing
    jointly, the engine overstated the tax by: North Carolina $500 (3.99% for 3.49%,
    Session Law 2026-41, section 44.1(a)); Nebraska $282.63 (4.55% for 3.99% above the
    third threshold, Neb. Rev. Stat. 77-2715.03, on the 2026 thresholds until the 2027
    schedule is final); Mississippi $225 (4% for 3.75% above $10,000, Miss. Code Ann.
    27-7-5(1)(b)(ii)4); Indiana $50 (2.95% for 2.9%, IC 6-3-2-1(b)(8)); and Montana, on
    $150,000, $382.50 ($7,572.50 for $7,190: 4.7% to $130,000 joint, $97,500 head of
    household and $65,000 single or separate, then 5.4%, with the capital-gain breaks at
    the same figures, MCA 15-30-2103 effective January 1, 2027).
  - **Later rate steps.** Mississippi 3.5% for 2028, 3.25% for 2029 and 3% from 2030;
    North Carolina 3.24% for 2030 to 2032 and 2.99% from 2033. On the same $100,000:
    Mississippi $3,150, $2,925 and $2,700 (were $3,375 each), North Carolina $3,240 for
    2030 and $2,990 for 2033 (were $3,490).
  - **Hawaii.** The Act 24 (SLH 2026) rate tables for 2027 and 2029, which replaced the
    Act 46 tables before they took effect: 2.5% and 5% in the second and third bands and
    13% above $500,000 single, $1,000,000 joint and $750,000 head of household, with the
    whole-dollar base taxes the act prints. A single filer with $100,000 of Hawaii
    taxable income pays $5,890 for 2027 and $5,293 from 2029 on those printed bases
    (continuous arithmetic gives $5,889.60 and $5,292.80). The standard deduction steps to
    $9,000 / $18,000 in 2028, $10,000 / $20,000 in 2030 and $12,000 / $24,000 in 2031
    (HRS 235-2.4(a)(2)(G) to (I)).
  - **New York.** The five lowest rates each 0.1 point lower for 2027 to 2032 (3.8%,
    4.3%, 5.05%, 5.3%, 5.8%) and an 8.82% top rate from 2033 above $1,077,550 single and
    $2,155,350 joint (Tax Law 601, paragraphs (viii) and (ix)).
  - **Rhode Island.** A surtax on taxable income over $1,000,000 of 1% for 2027, 2% for
    2028 and 3% from 2029 (44-30-2.6(c)(3)(A)(I)(2)), carried as a top band at 6.99%,
    7.99% and 8.99% with the threshold held at $1,000,000 until the indexed one is
    published; and the Social Security modification without its full-retirement-age test
    from 2027 (44-30-12(c)(8)(ii)). Both from 2026 H 7127 Sub A, Article 6.
  - **Virginia.** The standard deduction is $9,200 / $18,400 for 2027, $9,300 / $18,600
    for 2028 and 2029, and $3,000 / $6,000 from 2030 (Va. Code 58.1-322.03(1)(b)); it
    was $8,750 / $17,500 every year.
  - **Georgia.** The retirement exclusion at 65 or older is $70,000 from 2027 (HB 463,
    division (xiv), no delay clause); it was $65,000.
  - **Delaware.** The military pension subtraction is $15,000 for 2027, $20,000 for 2028
    and $25,000 from 2029, under 60 and, as a new greater-of limb, at 60 and over
    (30 Del. C. 1106(b)(3), S.B. 219).
  - **Illinois.** The basic exemption falls to $1,000 from 2029 (35 ILCS 5/204(b)); it
    was $2,925.
  - **Maine.** The standard deduction equals the federal standard deduction from 2027,
    subject to Maine's phase-out (36 M.R.S. 5124-C(1-D), P.L. 2025, c. 650, Part K).
  - **Maryland.** The public-safety retirement subtraction rises to $17,000 for 2027,
    $18,000 for 2028, $19,000 for 2029 and $20,000 from 2030 (10-207(mm)).
  - **Oregon.** The ORS 316.157 retirement income credit cannot be claimed from 2032
    (Oregon Laws 2009, chapter 913, section 36, as amended in 2025); the engine kept it in
    every year.
  - **California.** The 10.3%, 11.3% and 12.3% bands end from 2031 (Cal. Const. art. XIII,
    sec. 36(f)(2)), and the military and Survivor Benefit Plan exclusions end from 2030.
    Proposition 3 on the November 3, 2026 ballot would keep the bands; the end is loaded
    as current law and is revisited when the vote is decided.
  - **Washington.** A 9.9% tax on federal AGI less long-term capital gains less a
    $1,000,000 deduction per individual or couple, from 2028, with the taxable share of
    Social Security included (ESSB 6346, chapter 238, Laws of 2026); the engine had no
    Washington income tax. Section 316 indexes the deduction: each October of an
    odd-numbered year from 2029 it is multiplied by one plus the 12-month change in the
    consumer price index, rounded to the nearest $1,000 and never reduced, for taxes
    due the next year, read as the tax year of the adjustment (the act's own usage in
    sections 204 and 205, and the Department's under the same words for the capital
    gains tax), and the engine projects that schedule at the plan's inflation
    (`wa-essb-6346-s316-standard-deduction-indexing`, unsettled; the contrary reading,
    from 2030, is a year behind and charges $2,475 more for 2029 on $1,500,000). At 2.5%
    a year the deduction is $1,025,000 for 2029 and 2030 and $1,051,000 for 2031 and
    2032, so a single filer with $1,500,000 owes $47,025 for 2029 and $44,451 for 2031
    rather than $49,500. Initiative 645 on the November
    3, 2026 ballot would repeal the tax; it is loaded as current law and is revisited
    when the vote is decided. Its direct-QCD policy conforms from 2028, because
    section 301 excludes what federal AGI excludes, so a Washington year with a QCD is
    priced exactly rather than marked incomplete (which had set every optimizer
    candidate aside). The optimizer's linear program gives the deduction a zero-rate
    band ahead of the 9.9%, so it no longer front-loads conversions to escape a tax a
    household below the deduction never pays: early-retiree-aca moved to Washington
    converts about $10,500 and $10,763 in 2026 and 2027, as it does elsewhere, where
    the solve had proposed about $44,600 and $45,390. Section 302(3), which adds back
    Washington capital gains for a filer who owes the RCW 82.87 tax, is a stated limit.
  - **Examples.** Against main at `9676392f`, 6 of the 39 plans move. North Carolina's
    all-401k-no-bridge and brokerage-bridge-401k each last a year longer (2068 and
    2069, were 2067 and 2068); lifetime tax and penalties $950,722.50 to $934,906.80
    and $876,459.16 to $865,395.15; the control's penalties $87,045 to $83,312 (still
    2042 to 2045); sustainable spending $71,250 to $71,844 ($71,800 shown); headline
    Market success 28.6% to 29.6% and 29.4% to 30.0% (1,000 paths). The bridge
    conversion scenario: $566,785 to $534,028, lasting to 2071 (was 2070).
    hsa-stealth-retirement, the only example at the HSA cap, puts $10 less in its HSA
    in 2027 and a little less every later working year: ending investable $4,493,650.52
    to $4,493,410.11, lifetime tax and penalties $807,950.50 to $808,136.54, which moves
    two Compare cells against example-couple by one rounding
    step (+$329k, was +$330k; −$332k, was −$331k). California's early-career-match
    pays less tax once the top bands end: the 2060 Roth conversion year $102,308.02 to
    $102,107.38, and 2085 to 2091 between $127.87 and $2,278.21 less a year; ending net
    worth $17,028,288.16 to $17,036,796.98, and the sum of each year's tax
    $2,806,009.29 to $2,798,420.94. bridge-early-retirement (California): $178.38 and
    $370.23 less tax in 2070 and 2071, ending net worth $11,977,572.35 to
    $11,978,172.73. Market success is unchanged for both (100% and 83.6%).
    aggressive-saver (Washington) does not move: its Washington base income peaks at
    $2,023,808 in 2091, below the indexed deduction ($2,148,000 for 2089 and 2090 and
    $2,202,000 for 2091 at its 2.5% inflation), so it never owes the tax. With the deduction held at $1,000,000 it
    would have owed from 2078, $3,310.24 that year rising to $101,357.04 in 2091.
    barista-fire (Oregon) moves no figure, but its tax status for 2058 to 2086 is
    complete where it was incomplete, and the "Oregon retirement credit requires
    characterized pension recipients" warning goes, because the credit ends from 2032.
    Every plan's accepted tax input gains `stateHouseholdFacts.federalSeniorDeduction`.
    The report goldens and example copy state the new figures.
  - **Sources shown.** The report's parameter source appendix and the in-app source
    list gain nineteen rows: the 2027 HSA limits (Rev. Proc. 2026-24) and one row per
    state with enacted figures, each linking the statute or session law that sets them
    (the North Carolina row links Session Law 2026-41's page). The state summary names
    the 2026 corrections, the November 3, 2026 votes and the changes that wait on a
    determination, and points to the survey instead of listing states as if complete.
  - **Records.** New settled records for each loaded figure, each quote checked live on
    2026-09-28; Hawaii's HRS 235-51 2027 and 2029 record is withdrawn in favour of
    `hi-act-24-2026-rate-schedules`. New calculation records
    `hsa-contribution-limit-years` and `state-enacted-tax-year-figures`, each with a
    worksheet, an evidence test and a mutation receipt; the
    `parameter-provenance-catalog` record now counts 40 entries. All are unreviewed.

- **Stated: state changes that wait on a vote or a determination, and what the plan does
  not model (no displayed number changes beyond the entries above)** (decision
  D-2027-PUBLISHED-FIGURES). The engine names each with its trigger and date, and
  `DOCS/maintenance-schedule.md` lists them under "Dated state tax decisions":
  - **Loaded with a vote or approval pending:** Washington's income tax (Initiative 645)
    and the end of California's top bands (Proposition 3), both on the November 3, 2026
    ballot, and the District of Columbia's own standard deduction, whose permanent act
    (D.C. Act 26-418) is under congressional review to about November 20, 2026.
  - **Not loaded until decided:** Colorado's TABOR rate cut (October 1, 2026); Georgia's
    rate, deduction and exemption steps (December
    1, 2026); Minnesota's one-year cut (December 15, 2026); Oklahoma's cuts (December
    2026 and February 2027, for 2028 at the earliest); Michigan's one-year cut (January
    2027); South Carolina's top-rate cut (February 15, 2027); Kansas, Missouri and West
    Virginia (determinations not yet published); and the later Indiana, Mississippi and
    North Carolina triggers.
  - **Held at the latest published figure, now a registered approximation:** a state
    figure its statute indexes stays at its latest published amount in every later
    year, so a long projection overstates state tax by more each year
    (`neb-rev-stat-77-2715-03-3-indexed-brackets-held-nominal`, kind fix). Nebraska is
    the pinned case: in 2046 at 2.5% inflation, $100,000 of Nebraska taxable income is
    charged $3,827.79 on the 2026 brackets against $3,724.18 on indexed ones. The record
    lists every figure the survey found indexed, among them Nebraska's 2027 thresholds
    (draft only), Montana's breaks from 2028, Rhode Island's surtax threshold from 2028
    and Social Security limits, Maryland's deduction from 2027, Illinois's exemption for
    2027 and 2028, and the brackets and deductions of Arkansas, California, Minnesota,
    Missouri, Ohio, North Dakota, Oregon, Maine, Vermont, Wisconsin and others. Only the
    deductions tagged as federal and the Washington and District of Columbia deductions
    are projected; no other state's projection changes in this release.
  - **Optimizer, registered approximation:** the linear program lays a state's brackets
    over federal taxable income, so it uses the federal deduction in place of a smaller
    state deduction and ignores state exemptions
    (`va-code-58-1-322-03-optimizer-state-base-uses-federal-deduction`, understates the
    in-solve state tax; Virginia pinned: $2,266.75 in the solve against $2,635.90 at law
    on $60,000). Only a state deduction larger than the federal one, Washington's, gets
    its zero-rate band. The exact projection re-prices every schedule the solve
    proposes.
  - **Also approximated after the review:** Maryland's capital-gain surtax, which
    reaches a primary-residence gain the statute excludes (overstates tax), and
    Maryland's 2026 deduction, where the Comptroller has printed two amounts.
  - **Follow-up:** a public-safety marker in the pension editor, so that Maryland's
    public-safety retirement subtraction reaches a plan built in the planner and not
    only one edited as a file or through the MCP interface.
  - **Filing status.** The plan models single and married filing jointly only: head of
    household and qualifying surviving spouse need dependents, which the plan does not
    collect, so no state's head-of-household figures are used for a plan. The Household
    page's filing-status help and the state records say so. Delaware's new domicile test
    for the pension subtraction at 60 or older needs a domicile history the plan does not
    hold and is assumed met.

- **Changed: every plan's Monte Carlo draws from one default seed, so every Monte Carlo
  figure moves once, by sampling noise (the headline success rate moves on 20 of the 29
  examples; the mean change across all 29 is 0.7 points, and the largest is 2.3 apart
  from early-retiree-aca, whose 6.2 include the fix below)** (decision D-MC-DEFAULT-SEED, 2026-09-28; diagnosis and
  independent check in RetireGolden-Docs `evidence/mc-example-source-*.md`). The seed was
  a hash of the plan's id, so Save to My Plans, Duplicate and an import drew new markets
  and moved the same plan's rate by about 1.3 points (up to about 4), and two example
  plans meant as an A-B pair ran on different markets (domain rule 12). The engine now
  publishes `DEFAULT_MONTE_CARLO_SEED` (0x5eeded, the Optimize tournament's seed before,
  kept for that reason and not chosen by any outcome) and the headline run's options,
  `headlineMonteCarloOptions` (1,000 paths, the plan's lognormal model at 12 percent), and
  the app uses them everywhere a plan-id seed was: the headline rate, the Monte Carlo page,
  the Insight preview, Scenarios, Social Security, relocation, Optimize and the guardrail
  threshold solve. The page keeps its visible seed and page-local Re-roll. What moves,
  measured on all 29 examples at a 2026 start (1,000 paths): the headline rate on 20
  (the other 9 are at 0% or 100% on both seeds); the ending-balance percentiles, fan,
  histogram and depletion probabilities on every example whose paths differ; the Insight
  preview's Monte Carlo line on bracket-fill-roth (+25.1 to +22.5 points; the retired
  historical preview +30.8 to +25.2), rmd-irmaa (+17.5 to +15.2) and no-annuity-brokerage
  (+0.1 to +0.4); the Social Security page's robustness check (500 paths) on 5 of the 6
  examples it ranks and its bridge comparison on 18 of the 23 it offers, by up to 3.6
  points; and the examples whose 1,000 paths all end at $0 go from five to three
  (brokerage-no-hsa and fixed-target-spending now keep one path each). Measured against
  origin/main at 4d2d9d67, the longevity draws on SSA's 2023 period table. A-B pairs now share
  one draw; an allocated plan still shares only its first year's draws with a
  single-return one, which the example copy and domain rule 12 now say. The Optimize
  page's rate for a proposed schedule runs the headline model (class shocks included)
  instead of a plain lognormal. Risk-based guardrail thresholds store the seed they were
  solved on (`spendingPolicy.balanceThresholdSeed`); thresholds saved before this change
  carry none, and the Spending card says in plain words that they were solved on an older
  draw and offers to solve again. New record `monte-carlo-default-seed`; restated
  `risk-based-guardrail-threshold-solver`, `monte-carlo-success-rate-comparison` and the
  census note for the solved thresholds.

- **Fixed: a plan's provenance no longer changes its numbers; example premium-credit
  contracts follow the premium field on every run (Monte Carlo on early-retiree-aca 60.1%
  to 61.7% on the old seed; no deterministic figure moves at a 2026 start)** (decision
  D-EXAMPLE-SOURCE-SWITCH). The engine read `exampleSourceId` as a switch: it kept an
  example's contract only while its premiums equalled the premium field grown at the
  run's inflation. On a Monte Carlo path the inflation differs, so the contract was
  dropped and the published-year credit refused, on every path from the second year:
  early-retiree-aca's 2027 credit of about $11,000 was missing from its Monte Carlo (10,000
  paths: 60.81% to 62.42%, 161 paths up and none down; with longevity 78.22% to 79.19%).
  Each ACA year contract now carries `premiumBasis`: `'stated'` (the default) is the
  coverage year's actual figures; `'premiumField'` stores only the year and the asserted
  facts, and each run fills the region from the state, the tax family from the people
  alive, the covered members alive and under Medicare age, and each covered month's
  premium and benchmark from the premium field at that run's healthcare inflation. The
  examples carry `'premiumField'` contracts; the switch, its
  `example-contract-input-mismatch` code and the "example's inputs were edited" copy are
  deleted, and a test proves projections and Monte Carlo paths do not depend on the
  field. Editing the premium, or patching it in a scenario, keeps these contracts, so the
  credit is re-priced instead of removed (early-retiree-aca's Learn page now says so, and
  its copy test checks the credit moves by the premium's change to the cent). So do a
  change of state, a move, a date of birth and a planning age, on the Household form and
  in a scenario, because everything but the stored assertions is derived on each run:
  early-retiree-aca moved from Florida to Georgia keeps its 2026 and 2027 credits, where
  the edit used to remove them and the page blamed the planner. A partner added or
  removed, or a new filing status, still removes the contracts (the assertions are facts
  about who is on the return), and every removal is now recorded on the plan
  (`healthcare.acaYearsRemoved`), so the unpriced-credit notes, the Insight preview's
  refusal, the claim-age refusals of the Social Security and Optimize pages and the
  report name the edit ("the details the credit needs were removed when a partner was
  added") instead of saying the planner does not collect them. All 29
  examples at a 2026 start: 230,649 ledger values compared, 13 examples bit-identical, 16
  differing in floating-point last bits only (at most 1.9e-9 dollars), none at the cent;
  every golden holds. Only early-retiree-aca's Monte Carlo moves (and hsa-property-depth
  with longevity on, 20.3% to 20.7%, 4 paths). New record `aca-contract-premium-basis`;
  restated `aca-enrollment-and-applicable-slcsp-premium-annual`, `spending-healthcare-annual`,
  domain rules 01 and 08 and the early-retiree-aca walkthrough.

- **Fixed: the 1 January 2027 clock no longer breaks example contracts (22 of the 29
  examples, from a 2027 start)** (same decision). The stored contracts were written in
  2026 dollars, so from a 2027 start every one of them failed the switch with no
  randomness at all and the page said the example's inputs were edited. From a 2027
  start the 22 examples' 2027 year is now priced (or refused only for its own reason:
  below 100% of the poverty line on four, guardrail spending on one), and
  early-retiree-aca gets its 2027 credit back ($10,265; ending net worth $558,920 to
  $595,129). The example copy's other 2027 problems are a separate derivation
  (D-2027-ROLLOVER).

- **Fixed: a member who has died is no longer charged a stated premium-credit
  contract's premium (Monte Carlo with longevity on a real-contract plan: +1.77 points
  at 10,000 paths)** (decision D-ACA-CONTRACT-PATHS). A plan with real contracts (an
  import, RetireGolden-MCP) kept charging a covered member's premium on every path after
  that member died on it. Coverage ends at death (26 U.S.C. 36B(c)(2)(A)): a covered
  member who is not alive in a year is charged nothing from 1 January of the year after
  the death, the ledger's annual convention (the rest of the death year is a stated
  limit), and the stated tax family that still names that member leaves the year
  unpriced with `tax-family-member-unknown`. Enrollment ends on the date of death (45 CFR
  155.430(d)(7)); charging the rest of the death year is a stated limit worth about 5.5
  months of premium and about 0.15 points of success rate (at most 0.23), measured by the
  independent review on the 2022 period life table. Measured on all-401k-no-bridge with its
  contracts written as stated figures: 28.91% to 30.68% (177 paths up, none down,
  paired SE 0.13); longevity off, no change. Stated premiums stay in nominal dollars on
  every path: they are a coverage year's actual figures, and an estimate belongs in
  `'premiumField'`. The contract fields now carry schema descriptions saying so, which
  MCP callers read from `describe_plan_schema`.

- **Breaking (engine and planner-ui).** Plan schema v6 (`schema/plan.v6.json`,
  `@retiregolden/engine/schema/v6`; v1 to v5 unchanged): an older engine refuses a v6
  document with `newer_than_app`. Migration 5 to 6 rewrites the contracts the example
  recipe wrote, on a plan that carries `exampleSourceId`, to `'premiumField'`: the
  recipe's shape and the recipe's dollars (the premium field times one growth factor per
  plan to the power of the years since 2026, to half a cent). A contract from the recipe
  that no longer matched the plan's premium (the premium, the inflation or the household
  changed after saving, or a quote typed in its shape) was already left out by the v5
  engine, so the migration removes it, records it in `healthcare.acaYearsRemoved` as
  `'exampleNoLongerMatched'` and reports the new `exampleContractsLeftOut` repair; the
  figures do not change (measured against the v5 engine on four such documents: every
  ledger value identical). A contract the v5 engine priced as written (the premium field
  at the stored rates) in the shape the premium-field fill derives becomes `'premiumField'`
  too, even when another factor fits more contracts, so it keeps the deterministic figures
  and follows the premium field on every Monte Carlo path. The rewrite notice now says the
  year-by-year figures stay the same, except in the years the v5 engine was leaving out
  (the repair's new optional `previouslyLeftOut`), and that Monte Carlo now counts the
  credit on every simulated market, which can move the success rate. A contract changed by
  hand out of that shape (a benchmark unlike the premium, say) that the v5 engine priced as
  written stays `'stated'` with the same year-by-year figures, and the new
  `exampleEditedContractsKept` repair says Monte Carlo now counts it at its entered dollars
  on every simulated market, which can move the success rate. A contract not in
  the recipe's shape that the v5 engine refused
  (it did not match the example's premium) stays `'stated'` and is now priced as entered,
  so its year's figures change, and the new `exampleEnteredContractsNowPriced` repair says so.
  The contracts a stored scenario writes are sorted by the same rule in the plan the
  scenario makes, with the removal recorded in the scenario and each repair naming it
  (the optional `scenario` on the three repairs); each operation's `before` is migrated as
  the plan is, so the scenario still applies and gives the v5 engine's figures, or the
  notice says what changes. It reports the new
  `exampleContractsFollowPremiumField` load repair, which carries no `accountId`; the load
  notice words it differently for the library's own demo record, and restoring a v5 backup
  now says the same in the import notice. An unedited converted plan projects to the same
  figures to the cent.
  `AcaYearContract` is now a union discriminated by `premiumBasis` (new
  `AcaStatedYearContract` and `AcaPremiumFieldYearContract`); code that reads a contract's
  roster or premiums must narrow it, and `acaYearContractSchema` is a Zod discriminated
  union, so a caller of its `.shape` or `.extend` breaks. `healthcare.acaYearsRemoved` is
  new (the record of edits that removed contracts; the projection does not read it), and
  so is `YearAcaResult.premiumBasis`. The `example-contract-input-mismatch` support code
  and its user copy are removed.
  `spendingPolicy.balanceThresholdSeed` is new. In planner-ui, `seedFromPlanId` is
  deleted from `planner/useProjection` (nothing needs it), `isHeadlineMcConfig` no
  longer takes the plan, `invalidateAcaEvidence` takes the edit that removes contracts,
  and `unpricedCreditSpendingNote` and `guardrailPreviewUnpricedCreditRefusal` take the
  plan's removal record, as do `unpricedCreditYearsText`,
  `claimAgeUnpricedCreditReason` and `claimAgeSearchRefusal`; the report model's
  `ReportUnpricedCreditYear` gains the optional `removedBy` (report model version 3
  unchanged). `ParseV2BackupResult` carries the restored plans' repairs.

- **Follow-ups.** RetireGolden-Pro's meeting view (seed 20,260,725, 250 paths, plain
  lognormal) and RetireGolden-MCP (seed 42, 200 paths, plain lognormal) should adopt
  `DEFAULT_MONTE_CARLO_SEED` and `headlineMonteCarloOptions` so every host shows one rate
  for one plan, and MCP's `run_monte_carlo` description and protocol baseline move with
  them; both need the new engine (and Pro the new planner-ui). MCP's documentation of
  premium-credit contracts should explain `premiumBasis` and the stated-figures rule.
  The engine's copy of the output census carries an edited note for the solved
  thresholds, which the Docs census should take on its next import.

- **Changed (build): six reductions take 251.0 KiB out of the app's JavaScript and 278.1 KiB
  out of its PWA precache, with no budget cap moved and no computed figure changed.** Measured
  in raw KiB against 4d2d9d67 (with the 2023 life table): all JS 5,096.6 → 4,845.6 of 5,100,
  precache 5,244.3 → 4,966.2 of 5,250 (203 → 195 entries), app entry 413.1 → 403.8, landing
  critical path 729.2 → 719.9. Each reduction was built and measured in turn on 04e71e59,
  before the life table (all JS / precache; R6 saves about 1.4 KiB more since the catalog
  gained the two life-table rows):
  - **R1, −132.9 / −132.9.** The seven in-process fallbacks in planner-ui's worker runners
    (`mc/pool.ts` ×4, `optimize/runner.ts`, `optimize/spendingRunner.ts`,
    `relocation/runner.ts`) are guarded by `typeof Worker === 'undefined' &&
    import.meta.env.DEV`, so a production build no longer ships a main-thread copy of the
    solvers the worker already carries. Worker is tested first, so a bundler without
    `import.meta.env` never reads it where Worker exists. The `planner.worker` chunk is
    byte-identical (same hash).
  - **R2, −58.8 / −58.8.** "How RetireGolden is tested" gets its suite names and counts from
    `app/vite.config.ts` at build time (`fs.globSync` over one shared pattern list,
    `planner/howTestedSuites.ts`, injected with `define`) instead of shipping ~960 test-file
    paths; development builds keep the `import.meta.glob` branch. The page prints the same
    eight suite names and counts.
  - **R3, 0 / −27.0.** Six PWA icons were listed twice in the precache manifest
    (`includeAssets` and `includeManifestIcons` on top of `globPatterns`); each is now listed
    once, and the service worker caches the same (URL, revision) set.
  - **R4, −39.9 / −40.0.** The RMD Joint and Last Survivor table (`rmd/jointLifeTable.ts`)
    ships delta-packed and is decoded once at module load; `rmd/jointLifeTable.test.ts` proves
    the encoding lossless against the literal extract, cell for cell and on 67,081 age pairs.
  - **R5, −9.2 / −9.2.** The Learning Center index no longer carries `audience`,
    `reviewCadence` and `currentYearSensitive`, which no page renders; they live in a
    test-only sidecar keyed by slug (`testSupport/articleEditorial.ts`).
  - **R6, −8.9 / −8.8.** The QCD post-pass reads the `rmd-qcd` provenance entry directly
    (`RMD_QCD_PARAMETER_SOURCE`, still listed in `PARAMETER_PROVENANCE` in the same place), so
    the worker no longer carries the whole catalog; its evidence IDs are unchanged.

  **Behaviour change (R1):** a production build running where `Worker` does not exist no
  longer computes Monte Carlo, the optimizer, the spending solver or relocation compare on the
  main thread. It fails through the worker error path with a plain-words reason ("This
  browser can't run calculations in the background, which this page needs…"). Every browser
  that can run the app, and the RetireGolden-Pro renderer, has `Worker`; Vitest, the dev
  server and the dev-mode scripts keep the in-process path. The bundle budget now also fails
  when any chunk names a test file or the precache manifest lists a URL twice (a measurement
  fix; no cap moved). Figures: the 29 examples and their 10 scenarios give byte-identical
  engine output in the default, cash-flow and optimizer-probe modes, and the full equivalence
  corpus (150 members, four modes) is byte-identical, against both 04e71e59 and 4d2d9d67.

- **Changed: the life table is SSA's 2023 period table, read as published, and a sex
  that is not stated is the average of the male and female chances (displayed numbers
  change)** (decision D-LIFE-TABLE-2023; derived, independently checked and the
  implementation independently reviewed, RetireGolden-Docs
  `evidence/life-table-2023-{derivation,check,review}.md` at commit `75e1cf87`). The engine
  carried the life expectancy column of SSA's 2022 period table (2025 Trustees Report)
  and rebuilt each year's death probability from it by the half-year identity. It now
  carries SSA's Table 4C6 for 2023, as used in the 2026 Trustees Report: the probability
  of dying within one year and the life expectancy at every age 0 to 119, for men and for
  women, as printed, read from SSA's page on 2026-09-27
  (`longevity/ssaPeriodLifeTable.ts`, with a source record whose SHA-256 of the columns
  the evidence rebuilds from the numbers). Every survival figure reads the published
  column through the engine's one survival curve (`montecarlo/survival.ts#survivalCurve`).
  - **The table end.** The last row is closed: a life at 119 dies during that year,
    although SSA prints 0.926604 there. Reading it would change the chance of reaching 120
    by at most 2.3e-11 for anyone 65, and by 0.0734 for someone already 119.
  - **"Average" sex** (a person whose sex the plan does not state: every new plan's first
    person, a partner added on the Household page, a spouse imported from a tax return)
    is now the 50/50 mixture of the male and female survival curves from the person's
    current age: every survival probability, the life expectancy and every expected value
    is the average of the male and female ones (percentile ages and hazard powers read
    off the curve are not). It was the half-year identity on the averaged life
    expectancies. Two "average" people are independent mixtures, so a couple's values
    average the four sex pairings; reading them as "an opposite-sex couple, order
    unknown" would differ by up to 0.135% of a benefits-only row on the examples. The
    Household and questionnaire options read "Not stated (average of male and female)",
    and the Household help no longer says sex is only the life-expectancy baseline: it
    also sets the percentile planning age, the survival-percentile spending horizon, the
    Social Security expected values, the Monte Carlo lifespans and a joint-and-survivor
    annuity's taxable share. The Monte Carlo "Model longevity" help says a sex not
    stated draws from the average of the male and female chances.
  - **The health adjustment** (`hazardForExpectancyMultiplier`) returns exactly 1 for the
    questionnaire multiplier 1 (it returned 0.9999999999989995), and otherwise aims at the
    multiplier times the curve's own life expectancy rather than SSA's printed one, which
    differs from it by at most 0.005 years at the questionnaire's ages. Compared with the
    old target on the new table, this moves 1, 1, 2 and 3 of 837 health-adjusted
    percentile picks by one year at multipliers 0.8, 0.9, 1.1 and 1.12, and at 1 moves
    none (the old target moved one).
  - **On the 29 examples.** The benefits-only top claim age changes at the default 2% on
    14 of the 23 examples that rank a claim age (the 11 single claimants whose sex is not
    stated, 68 to 69; glidepath-allocation and static-allocation-control, 66 to 68;
    survivor-years, 64/69 to 64/70) and in 57 of their 391 example-and-rate tables over
    the 17 slider rates; bracket-fill-roth and rmd-irmaa, whose claims are all made, rank
    none since B2-P1 slice 5. Every 2% headline rises, by 2.76% (survivor-years, $853k to
    $876k) to 5.02% (no-head-start-grad and trump-account-head-start, $117k to $123k);
    example-couple $841k to $865k. Of the 150 survival-percentile ages the picker offers
    the examples' 36 people, 116 rise by one year and none falls; no example stores a
    pick. With "Model longevity" on (1,000 paths, the page's seed and headline model, each
    example as the app loads it), 22 of the 29 Monte Carlo success rates fall
    (guardrails-flex-goals most, 22.5% to 20.1%), 6 do not move at a tenth of a point and
    1 rises (no-annuity-brokerage, 97.7% to 97.9%). The headline success rate and every
    example golden do not read the curve and do not move, and neither does the
    year-by-year projection of the 29 examples, nor what slice 5 computes from it (the
    claim-age sweep and its month refinement, the Optimize page's claim-age option and the
    survivor page's figures). No example has a joint-and-survivor annuity; the regulation
    fixture's expected return moves from $22,330.89 to $22,683.94, still below Table VI's
    $22,800. On the Social Security page's evidence cases the 40-year career's ratio is
    2.46 (was 2.38) and the projected career's 1.59 (was 1.53); survivor switching's case
    A tops at $423k (was $415k).
  - **Plans whose year-by-year projection moves.** The projection reads the table in two
    cases, and a plan in either gets new year-by-year figures, and new figures wherever
    they are read, the claim-age sweep, the Optimize page and the survivor page included:
    spending set to amortize to the age reached with a 25% or 10% chance (the
    amortization-based spending policy's survival-percentile horizon, worked out again on
    every projection rather than stored), and a joint-and-survivor annuity, whose
    exclusion ratio is priced on the joint life expectancy. Measured on the examples with
    those settings: under-saved-single with its spending amortized to the 25% age (90 on
    the 2022 table, 91 on 2023) ends with an after-tax estate of $212,538 rather than
    $9,840; example-couple on the 10% joint horizon $1,659,513 rather than $1,378,752;
    annuity-purchases-estate with its annuity made 50% joint-and-survivor pays $349,238 of
    lifetime taxes rather than $349,346. The notice is this entry, the spending horizon's
    help (which names the table edition and says the age is worked out again on every
    projection), and the Assumptions card, which now lists the life table among its
    sources and restates a percentile pick with the table edition it was made on.
  - **The questionnaire** prints SSA's 2023 life expectancy (a man of 65: 18.12, was
    17.48; a woman: 20.66, was 20.12), names the edition from the table's source record,
    and says how far the curve's own life expectancy is from the printed one: at most
    0.005 years, the engine's published
    `longevity/ssaPeriodLifeTable#CURVE_EXPECTANCY_GAP` (0.00496 years, a man of 46)
    rounded up to the thousandth, which a test recomputes from the columns so a table
    refresh restates it.
  - **Stored figures keep their edition.** A percentile pick and a saved questionnaire
    result record the table edition they were computed on (`tableEdition`); one saved
    before this change has none, was made on the 2022 table, and is labelled so: the
    Household line reads "(SSA 2022 period life table; the planner now uses the 2023
    table)", the questionnaire result links the 2022 page and says the planner has moved
    on. The editions a stored figure can name are a closed set, the 2022 and 2023 tables,
    each with SSA's own page (`longevity/ssaPeriodLifeTable#KNOWN_LIFE_TABLE_EDITIONS`):
    any other edition, or a saved result's value that is not an edition, reads "table
    edition not recognized" and links SSA's live page, and the saved result is kept; the
    Assumptions card and its exports print "(25% survival percentile, SSA 2022 period life
    table, 2025 Trustees Report)" and cite SSA's page for the 2022 table. There every
    planning age cites the edition it was computed on, never the current table by default:
    a questionnaire age, whose edition the plan does not store, takes the edition of the
    questionnaire result saved in this browser for that person when that result gives the
    plan's age, and otherwise reads "(life-expectancy questionnaire estimate, table
    edition not recorded)" and cites no table; an unrecognized edition cites none either.
    The Social Security form helpers (`socialSecurity/ssFormUtils`) reuse a saved result's
    age as it was saved, with no label; they have no caller in the planner's pages today.
    Plan storage: the plan schema's `longevity.percentile` gains the optional
    `tableEdition` (`{ periodYear, trusteesReportYear }`); saved plans stay valid,
    `CURRENT_PLAN_SCHEMA_VERSION` stays 5, and `schema/plan.v5.json` is regenerated
    (`DOCS/features/plan-file-format.md` lists the field). The questionnaire's
    localStorage result gains the same optional field. A plan that makes a round trip
    through an engine that predates the field (0.3.0, which RetireGolden-Pro and
    RetireGolden-MCP pin) loses `tableEdition`, because that engine drops keys it does not
    know; the pick keeps its age, and back in this planner a 2023 pick then reads as a
    2022 pick. The effect is on the label only, and in the older direction: the pick is
    shown as made on an earlier table than it was, with the note that the planner now uses
    the 2023 table, and no figure changes.
  - **Sources.** `params/provenance.ts#PARAMETER_PROVENANCE` gains `ssa-life-table` (SSA's
    Table 4C6, the 2023 period table of the 2026 Trustees Report) and
    `ssa-life-table-2022` (SSA's page for the 2022 period table of the 2025 Trustees
    Report, which the Assumptions card cites for a planning age made on it), 21 ids in
    all; the Assumptions card and the report's parameter appendix list them, and the
    report goldens take the rows. The table's source record no longer carries a SHA-256 of
    its archive capture, which could not be recomputed (the archive's rendering carries a
    per-fetch footer); the columns' own SHA-256 is the table's hash, and the capture's URL
    and time stay.
  - **Records.** New calculation records `ssa-period-life-table` and
    `mortality-published-death-probability`; `mortality-ex-to-qx-identity` is retired;
    the survival, sampled-death, joint-expectancy, percentile and hazard records are
    restated (statements and formula blocks), with worksheets and mutation receipts. The
    vintage record `ssa-table-4c6-period-life-table-vintage` is settled: the embedded
    table is the one SSA publishes, and its yearly re-verification stays with
    `annuallyIndexed`, the `rules:due` queue and `verify:quotes`.
  RetireGolden-Pro renders these pages through planner-ui and imports none of the changed
  modules, so it picks the numbers up with the next planner-ui and engine bump.
  RetireGolden-MCP defaults every person to "average" and reads no survival figure; its
  tool description of "average" (`src/buildPlan.ts`) should say "the mean of the male and
  female survival probabilities" at its next engine bump.

- **Changed: the claim-age sweep and the survivor figures move into the engine; claims
  already made are no longer searched, no claim age is ranked against a premium credit
  the ledger cannot price, and the survivor lever adds to the plan's conversions
  (displayed numbers change)** (B2-P1 slice 5, owner decisions R12 and R16 of
  D-B2P1-PARITY and the claim-age decisions of 2026-09-25; derived and independently
  checked, RetireGolden-Docs `evidence/b2p1-slice5-*.md`). Five figures on the Social
  Security and survivor pages were computed in planner-ui; each is now an engine function
  the page reads, with a calculation record, a worksheet, evidence and an executed
  mutation receipt:
  - **Claims already made** (`socialSecurity/openClaims.ts#isClaimAlreadyMade`, its own
    record `social-security-claim-already-made`): a claim whose year (birth year + claim
    years) is before the plan's start year is history, not a choice (42 U.S.C. 402(a); 20
    CFR 404.621(a)(3)); the birth-month convention, (a)(2)'s six months, withdrawal within
    12 months (404.640) and suspension from full retirement age (402(z)) are stated
    limits. The sweep, its month refinement, the benefits-only ranking, the bridge panel's
    earliest-claim comparison, the Optimize page's co-optimization and the Scenarios
    page's claim-age lever use this one test, written once. On the 29
    examples: the bracket-fill couple (claimed 2020 and 2022) and rmd-irmaa (2023) now read
    "Every claim here is already made", naming who claimed and when, on the In-your-plan
    tab (10 of 125 ranking pairs; the bracket-fill couple was told "claim at 70 / 70 …
    your current choice" under three rankings) and on the Benefits-only tab (which offered
    "Apply 70 / 70"); the co-optimization's candidates fall from 66 to 46. The
    Benefits-only tab also compares with the plan's claim months: a 67y 6m claim no
    longer marks the whole-year 67 row current or withholds its Apply (no example claims
    with months).
  - **The claim-age sweep** (`decisions/claimAgeSweep.ts#sweepClaimAges`, R12): the
    winner's change is signed and measured from the plan as entered, claim months
    included, in dollars of the plan's last year, which the page names. Four
    bridge-durability changes that printed "+−$16k", "+−$134k", "+−$146k" and "+−$178k" in
    green now print "−$16k" … in red, and four "+$0" print "$0". Every one of the 2,505
    rows the sweep still prices is bit-identical, and every positive change is the old
    figure to the bit. When the plan has a Marketplace year whose premium tax credit the
    ledger cannot price, no claim age is ranked (all Social Security counts in the
    credit's income in the years it is paid, so an unpriced credit could change which
    claim age comes out ahead, in either direction), and the note names each year with
    its own reason instead of "No claim age meets this ranking's constraints": 85 notes
    (17 examples × 5 rankings; 13 for years whose figures are not yet published, four with
    2026 or 2027 years refused for guardrail spending, income below the poverty line or a
    calculation that did not settle), with no robustness check offered on a ranking the
    page refused. A disability benefit from its onset is held as the plan pays it and the
    partner's claim ages are compared; the sweep refuses only when every open claim is
    one. The heatmap's axes are the ages the engine swept, and a missing cell is an error,
    not $0. Rows that bridge durability ranked on the estate instead are named, saying
    whether the claim age or the plan as entered lacked the bridge years (11 displayed
    pairs; survivor liquidity would name 19 more, on plans where it is hidden), survivor
    liquidity is offered only when the plan has survivor years (hidden on 20 of the 25
    examples that offer the tab), and the tab says how its search differs from the
    Optimize page's and that its grid starts at 62, or at the age reached this year if
    later.
  - **The month refinement** (`#refineClaimAgeMonthly`, R12): ranked on the chosen
    objective, taking a month only when it meets the objective's constraints and ranks
    strictly higher; the page says "no month within a year of the whole-year pick ranks
    higher" rather than "optimal to the month", and the refinement and the robustness
    table are dropped when the plan or the ranking changes. 8 refinement lines change
    (bridge durability no longer undoes its own pick: glidepath-allocation's "66y 9m
    (+$55k)" is 65; under-saved-single's lifetime-tax pick moves to 64y 8m, +$2,519 of tax
    saved) and the bracket-fill couple's 3 go.
  - **The survivor lever** (`projection/survivorTransition.ts`, R16): Roth conversions
    filling the 12% bracket are added to the plan's own through the year of the first
    death (`SimulateOptions.additionalBracketFill`: the larger of the two in each window
    year, the fill capped at the convertible balance), not substituted for them. On the 7
    couples' 56 timing rows: the 24 rows of the three plans that convert nothing are
    unchanged bit for bit; on the four converting plans 31 estate figures, 15 colours and
    32 tax figures change (example-couple "+$147k" to "+$277k" becomes $0; annuity-purchases-estate
    "+$463k" to "+$546k" becomes +$135k and +$105k; no-annuity-brokerage's "me dies at
    70" tax "+$37k" becomes "−$20k"). Every lever cell names its year's dollars and says,
    year by year from executed dollars, what the lever did and why: the years it added
    conversions, the years the plan already converts at or past the top of the 12%
    bracket, the years the ledger converted less than the fill asked, the years with no
    pre-tax balance it can convert, no room in the bracket, a fill cut to nothing or a named conversion,
    with every message the ledger raised shown once. example-couple's $0 is partly a
    skipped conversion, not only a plan already past 12%: Sam has no Roth account, so
    Sam's share of every conversion is skipped (when Alex dies at 90: no room in 2026 and
    2027, at or past the fill in 2028 to 2032, short in 2033 to 2041 with the ledger's
    "Sam has no Roth account …", no balance left from 2042). The same message now shows on
    the all-401k-no-bridge and brokerage-bridge-401k rows (Jordan has no Roth account).
  - **The SSA-44 difference and the survivor shortfall count**: the SSA-44 figure stays
    the whole-projection difference, with its relief-year part published beside it and
    ", including $X in later years" when they differ (no example row today); "no
    surcharge to relieve" is decided on the relief years. The shortfall facts read
    required spending at the ledger's funding tolerance, and "covered" reads "required
    spending covered" (33 rows); no count or degenerate row changes.
  - **The Optimize page's claim-age option** (`claim-age-co-optimization`, restated)
    refuses in the Social Security page's words: the five example recommendations (for
    example the aggressive saver's "claim at 62", +$193,083.87, which started benefits
    inside its unpriced years) and twelve "none beat your current claim ages" notes
    become the refusal naming each year and its reason (17 examples; Monte Carlo, the
    report and Apply revert to the plan as entered on the five), the two examples whose
    claims are all made say so, and six plans' "N claim combinations" fall because past
    canonical ages are no longer tried (5 to 3, and 3 to 2). An open claim with no
    canonical age left to try (a claim at 70 in the start year, the earlier ages past)
    has the new outcome `no-age-left`, and the card says no claim age was left to try
    instead of "1 claim combinations were each fully re-optimized". The downloadable
    report prints the card's own refusal, each unpriced year with its reason and each
    held claim by name, instead of "SS claim combinations optimized: 1" and "None
    (current claim ages held)"; its example-couple golden now shows that refusal.
  - A diagnostic evaluation's loss reason names the diagnostic raised ("diagnostic-only
    evaluation: ACA evidence … is non-actionable in the baseline for 2028, …") instead of
    "invalid patch or materially unexecuted schedule", on the Optimize report's tournament
    rows too.
  - **The claim-age scenario lever** (planner-ui `scenarioLevers.ts`, the Scenarios page's
    "Claim age for all eligible streams" and RetireGolden-Pro's meeting view "Claim Social
    Security at 70"): a claim already made is left as it is, with a warning naming who
    claimed and when; a claim age the person has already passed is not applied; when no
    claim is left to change, the lever says who claimed and when instead of rewriting the
    claims (the bracket-fill couple's "at 70" lever no longer re-makes their 2020 and 2022
    claims).
  - **The spending note's reasons** (`planner/acaVetoCopy.ts`, the "How much can I spend?"
    page and the Scenarios capacity section): a year whose credit and income did not
    settle on one value, whose income can land on either side of the credit's cliff, or
    whose credit and amount of HSA withdrawals that count as medical expenses did not
    settle is named as that, where the note said "some facts the credit needs are
    missing"; the claim-age refusals use the same words.
  - **A disability benefit is named, and no longer stops the partner's ranking in the
    plan**: the In-your-plan tab holds the disabled person's benefit as the plan pays it
    and compares the partner's claim ages; the Benefits-only tab, which prices a couple's
    claims as pairs of claim ages and cannot place a disability benefit on that grid,
    names the person and gives that as its reason for ranking neither.
  - The couple primer describes the "lower earlier, higher later" pattern without
    crediting the top-ranked strategy to survivor protection, which the chosen objective
    may not weigh.
  planner-ui's `planner/survivorAnalysis.ts` and the sweep, refinement and verdict code of
  `planner/ssAnalysis.ts` are deleted. RetireGolden-Pro picks all of this up with the
  next planner-ui bump (its meeting lever calls planner-ui's `scenarioLevers.ts`, and it
  imports none of the deleted modules). A plan with a zero-PIA stream among its first two
  is searched differently on the two pages (the co-optimization counts it, the sweep does
  not), a stated limit; no example has one. **Follow-up outside this repository** (after the
  next engine release): RetireGolden-MCP's `batch_evaluate` writes `claim_ages` for every
  person with no already-made check (`src/adapter.ts`) and should refuse or caveat
  through `socialSecurity/openClaims.ts`.

- **Changed: the Social Security analysis models move into the engine; the break-even
  chart shows the plan's dollars, the benefits-only ranking prices couples on the
  ledger's rules, and "what you paid in" is in today's dollars (displayed numbers
  change)** (B2-P1 slice 4, owner decisions R6 to R10 of D-B2P1-PARITY; derived and
  independently checked, RetireGolden-Docs `evidence/b2p1-slice4-*.md`). Nine figures on
  the Social Security analysis page and the Social Security step were computed in
  planner-ui; each is now an engine function the page reads, with a calculation record,
  a worksheet, evidence and an executed mutation receipt:
  - **Break-even** (`socialSecurity/analysis/breakEven.ts`, R6): the cumulative benefits
    are the start-year PIA × the claim factor × 12 × the ledger's own cost-of-living
    factor and benefit cut for each year (`socialSecurity/colaFactor.ts`, which
    `simulatePlan` now calls with its own inflation path, so no Monte Carlo path moves),
    not a cost-of-living adjustment compounded from 62; crossings are found on the
    unrounded totals. On the 29 examples: 252 callouts, none changes; 6,684 of 9,116
    tooltip values change. Each charted person's values move by one factor,
    (1 + the plan's inflation)^(62 − age), (1.025)^(62 − age) at the default 2.5%:
    measured, from 0.9060 for the person aged 66 (survivor-years' Chris) to 2.6851
    for the youngest, aged 22 (Nova in no-head-start-grad and trump-account-head-start);
    the next youngest, aged 25, moves by 2.4933, and the three people aged 62, whose
    factor is 1, keep theirs.
  - **Benefits-only expected value** (`socialSecurity/analysis/expectedValue.ts`, R7):
    each year's benefits follow the ledger's rules (claim months; a couple's lower
    earner paid the own benefit plus the reduced spouse excess from the month the spouse
    benefit starts; after a death, the widow(er) benefit on the deceased's actual or
    never-claimed benefit, reduced at the first month of widow(er) entitlement and then
    held to the widow's limit; a divorced spouse only from the year of the first month the
    ex is 62 throughout, the ledger's gate), the
    COLA drift and haircut of the plan's assumptions, and the engine's one survival curve
    (`montecarlo/survival.ts#survivalCurve`, which `survivalProbabilityTo` is now a view
    of, bit for bit). The 18 single examples and bracket-fill-roth do not change at any
    rate. Six couples change: at the default 2%, example-couple's best stays 70/62 at
    $841k (was $852k), survivor-years' moves from 67/70 ($851k) to 64/69 ($853k),
    annuity-purchases-estate and no-annuity-brokerage stay 70/63 at $784k ($792k), and the
    two 401(k) couples stay 70/62 at $425k ($442k); over the 17 slider rates 980 of 3,519
    displayed rows and 41 top claim ages change. A claimant whose benefit is a disability
    benefit from its onset is no longer ranked or charted by claim age; the page says why.
  - **What you paid in** (`socialSecurity/analysis/oasdiReturn.ts`, R8; the module is
    named for OASDI, the Social Security part of FICA, since it leaves out Medicare): each
    year at its effective OASDI rate (SSA's table, `socialSecurity/oasdiTaxRates.ts`) on
    earnings capped at that year's base, restated in today's dollars by the BLS CPI-U
    annual averages (`socialSecurity/cpiU.ts`); the ratio adds the benefits already
    received for someone collecting, and the tax the projected work the PIA counts will
    pay ("paid in so far" and "what your projected work will pay"), so both sides cover
    the same career. A 40-year $50,000 career paid in $225,418 in 2026 dollars, not
    $119,307 at one rate, and its ratio is 2.38, not 3.80; a 45-year-old with a projection
    to 65 is shown 1.53, not 2.36 over the history alone. A disability benefit from its
    onset gets a sentence, not a ratio. No example has an earnings history.
  - **Survivor switching** (`socialSecurity/analysis/survivorSwitching.ts`): strategies
    that pay the same benefits are shown once (fewer claims, then earlier ages), and each
    year carries the plan's COLA drift and benefit cut, as the ranking beside it does.
    No example has a deceased former spouse.
  - **The Social Security step** (`socialSecurity/piaFromEarnings.ts`,
    `socialSecurity/analysis/credits.ts`): the AIME explainer's counts are the engine's;
    the zero-year gain is recomputed exactly and names the replaced year (R9: $110 a month,
    not $229, for a $300,000 sample), in the dollars of the PIA the step shows, and for
    someone 62 or older, whose $0 years have passed, says what the year would have added
    ($23 a month in 2026 dollars, not $18 in 2020's, for the review's case); the credit estimate uses SSA's quarter-of-coverage
    amount for each year from 1978, $1,890 in 2026 (R10's single-year amount is retired).
  - **One PIA resolver** (`piaFromEarnings.ts#resolveStreamPiaMonthly`) for the ledger, the
    claim-milestone insight and the pages; the couple primer calls PIA × 12 the
    full-retirement-age benefit.
  - **What the benefits-only views leave out, said on the page**: the benefits-only tab, the
    feature doc and the Learning Center name the differences from the plan (no earnings
    test, a couple member's former-spouse records not counted, one claim age per person)
    instead of saying the rules are the same, and a notice names each person whose plan
    wages would have the earnings test hold back part of a benefit at a claim age the tab
    shows (example-couple: Alex at 64 or 65, Sam at 62 or 63). It is found with the
    ledger's own earnings test, now one function (`socialSecurity/earningsTest.ts`) that
    the projection and `socialSecurity/analysis/earningsTestReach.ts` both call; no
    projected number moves. Modeling the earnings test in those views is a separate
    decision (D-SS-ANALYSIS-EARNINGS-TEST).
  - **The family maximum in the couple model** is the ledger's own
    (`familyMaximum.ts#currentSpouseMonthlyUnderFamilyMaximum`, the room above the
    worker's PIA since #756), so a worker who claimed after full retirement age leaves a
    spouse the whole excess in both: $500 a month, not $360, in the review's case.
  - **Sources**: the Assumptions card and the report's source list cite SSA's tax-rate
    table for the 6.2% rate (it was attributed to the COLA fact sheet), and add SSA's
    quarter-of-coverage table and BLS's CPI-U (three new entries in
    `params/provenance.ts#PARAMETER_PROVENANCE`, 19 in all).
  planner-ui's `socialSecurity/{breakEven,expectedPv,ficaReturn,survivorSwitching,explain}.ts`
  are deleted. RetireGolden-Pro renders these pages through planner-ui's routes and
  imports none of the modules, so it picks the changes up with the next planner-ui
  bump; RetireGolden-MCP has no Social Security analysis tool.

- **Fixed: a spouse benefit is capped by the family maximum less the worker's primary
  insurance amount, not less the benefit the worker is paid (displayed numbers change
  only where the old cap bound; none of the 29 examples or their 10 scenarios moves)**
  (found by the slice 4 review, F3). 20 CFR 404.404 reduces the auxiliaries so that the
  month's total, "including an amount equal to the primary insurance amount" of the
  worker, stays within the family maximum, and POMS RS 00615.756 says "Deduct PIA from
  maximum"; the worker's own benefit is not reduced (RS 00615.730). The engine subtracted
  what the worker is paid, so a worker who delayed left too little room: a worker born
  1964-01-15 with a $1,000 PIA claiming at 70 ($1,240) has a family maximum of $1,500,
  which leaves $500 for his spouse, not $260. His spouse (born 1964-06-15, PIA $100,
  claiming at 67) is now paid her whole $400 excess, and the household's 2035 Social
  Security is $20,880 rather than $19,200. An early claim leaves the same room too. The
  spouse's original benefit, half the worker's PIA, now meets that room first, before her
  own benefit is taken from it and before the age reduction (20 CFR 404.410(b); POMS
  RS 00615.010), where the engine capped the reduced excess last; the two orders differ
  only when the room is below half the PIA. Under the retirement and survivor maximum,
  at least 150 percent of the PIA before it is floored to the dime, the room holds a
  single spouse's whole original benefit less that rounding (under 10 cents a month), so
  a single spouse is held back by cents at most; the disability maximum of a worker on
  SSDI can leave no room at all, and the engine does not model it
  (`usc-42-403-a-6-ssdi-family-maximum`). The claim-milestone insight's mirror of the
  current-spouse top-up composes the benefit the same way. New settled record
  `cfr-20-404-404-family-maximum-counts-the-worker-pia` (20 CFR 404.404, 404.403(a)(5)
  Example 1 (twice), 404.410(b), POMS RS 00615.756 B.1, RS 00615.730 and RS 00615.010, all
  seven quotes checked live), with fixtures on the review's case and on an SSDI worker
  whose disability maximum leaves room for less than half the PIA (room 300 on a PIA of
  1,000: 200 paid to a spouse with a PIA of 100, where capping last paid 300), and
  projection tests for a delayed and an early claim; the `family-maximum-bend-points`
  calculation's limit now says the room is above the PIA.

- **Fixed: Social Security disability is paid from the first month after the
  five-month waiting period, placed by the month the disability began (displayed
  numbers change for every SSDI plan whose onset year is the plan's first year or
  later)** (decision D-APPROX-FACTS, revisited 2026-09-27; derivation and independent
  check in RetireGolden-Docs `evidence/approx-facts-*.md`). 42 U.S.C. 423(a)(1) and
  (c)(2) pay nothing until five full calendar months of disability have passed, and a
  month counts only when the disability began on or before its first day (POMS DI
  10105.070). The engine paid a full year from the onset-age year: 5 to 17 months more
  than any onset date allows. New optional plan field `incomes[].disability.onsetMonth`
  (1 to 12; additive, no schema-version bump; `plan.v5.json` regenerated): an onset
  after the 1st of month M is first paid in M+6. For a worker born 1970-06-15 with a
  $2,000 PIA and a 2030 onset, 2030 pays $12,000 for January, $8,000 for March, $2,000
  for June and nothing for July to December, where it paid $24,000; an October onset
  pays $18,000 in 2031 and a December onset $14,000. Disability entitlement ends with
  the month before the month full retirement age is attained and the same PIA continues
  as the old-age benefit (42 U.S.C. 402(a)(3)): `ssdiPaid` now carries only the
  disability months of that year and none after it (it counted the converted benefit
  as SSDI for life), and the stream's published `source` reads `own-retirement` from the
  year that holds the FRA month, now placed by month (a worker born 1959-06-15, whose
  FRA of 66y10m falls in April 2026, now reads `ssdi` for all of 2025). When the first payable month is at or after the FRA month there is
  no disability benefit: the stream is priced as a retirement claim at its claim age
  and the projection warns, naming the person (`ssdiNotPayableBeforeFraWarning`, or
  `ssdiNotPayableBeforeFraNeverClaimedWarning` when the worker died before the claim age and
  the stream is priced as never claimed); the old
  onset-at-or-after-FRA fall-through was silent. An onset age equal to the FRA years
  can now pay disability months where the engine priced a retirement claim. With a
  blank month that takes a birthday after July 1 when FRA is a whole number of years,
  but for the cohorts born 1955 to 1959, whose FRA adds 2 to 10 months, a birthday
  after May 1 (1955) or March 1 (1956) is enough, and from 1957 any birthday but
  January 1 (1957, 1958) or any at all (1959): born 1959-02-15 with an onset age of 66
  (FRA 66y10m, attained December 2025), 2025 now pays June to November as disability
  and December as the converted benefit. A
  worker who dies before his first payable year is treated as never having claimed.
  The claim-milestone insight and the planner's claim-age lever apply the same test.
- **Changed: a blank disability onset month reads as January 1** (same decision). The
  waiting period is then January to May and the first payment is for June: seven
  months in the onset year, the earliest start and so the largest amount the statute
  allows, where the engine paid twelve. Every SSDI plan saved before this change has a
  blank month, so its onset year pays $14,000 rather than $24,000 on a $2,000 PIA; an
  onset year before the plan's first year does not move. A plan saved with a month and
  then opened and saved by an engine that predates this field (0.3.0 in RetireGolden-Pro
  and RetireGolden-MCP) loses the month silently, and then reads as the January 1
  onset. That pays up to 12 months more than the month the user gave when the given
  month also leaves a disability month. When it leaves none, the stripped plan turns
  the retirement claim into a disability benefit from June of the onset year, which
  pays more early and less later: for a worker born 1970-06-15 with a $2,000 PIA, a
  December 2036 onset and a claim at 70, the plan with the month pays nothing until
  2040 and then $29,760 a year (the claim at 70 with delayed credits); stripped, it pays
  $14,000 in 2036 and $24,000 a year from 2037, $86,000 (43 months) more through 2039
  and then $5,760 a year less, with no delayed credits.
- **Changed: the planner's disability block asks for the month and the year the
  disability began** (same decision). The year field stores `onsetAge` (year minus
  birth year) through a new `NumberField` `valueOffset`, so the engine's bounds and
  advice read in years; "Not sure" leaves the month blank. The three sentences that said
  disability pays "from the onset age" now describe the waiting period, the card warns
  when the date leaves no disability month before full retirement age, and the SSDI
  article in the Learning Center says the same. Record
  `usc-42-423-c-2-ssdi-five-month-waiting-period` is restated and reclassified from
  needs-fact to convention (needs-fact 24 to 23, convention 22 to 23), with its stated limits:
  a month is read as an onset after the 1st (one month late for an onset on the 1st,
  which at the FRA edge can remove the only disability month), the application is
  taken as timely (423(b), 423(c)(2)(B)), and re-entitlement within five years and ALS,
  which need no waiting period, are not modeled. New calculation `ssdi-payable-months`.
- **Fixed: a Roth IRA's five-year period starts with the plan's own first contribution
  or conversion when the person's Roth IRAs start empty, and a surviving spouse keeps
  her late spouse's first Roth year (numbers change only for such plans; none of the 29
  examples moves)** (same decision). 26 U.S.C. 408A(d)(2)(B) makes Roth IRA earnings
  qualified only after five tax years from the first year any of the owner's Roth IRAs
  was funded (Treas. Reg. 1.408A-6 A-2). The plan does not collect that year and the
  revisited decision does not add it (rule 6: it moved no example plan in 117 scenario
  runs, and without a field for conversion principal already in a Roth IRA it would
  have taxed that principal as earnings). With no input: when a person's Roth IRAs hold
  nothing at the start, the plan's first contribution or conversion starts the period,
  and earnings withdrawn at 60 or older inside it are ordinary income with no 10% tax
  (a Roth IRA opened by a 2026 conversion and spent down in 2028 at 64 is taxed on the
  earnings; in 2031 they are tax-free); and a spouse who treats a late spouse's Roth IRA
  as her own takes the earlier of the two first years (A-7(b)), which the handoff
  dropped. Both presumptions can be wrong, in opposite directions. A Roth IRA that
  holds money at the start is still presumed past its period, which under-taxes one
  first funded less than five years before the start. And someone who funded a Roth
  IRA before the plan starts and emptied it is presumed never to have had one, so the
  plan's first contribution or conversion starts a new period and earnings the statute
  treats as qualified are taxed, which over-taxes.
  `RothBasisState` gains the optional `fiveYearPeriodStartYear`; new
  `startRothFiveYearPeriod` and `rothFiveYearPeriodAfterTreatAsOwn`. Record
  `irc-408A-d-2-roth-qualified-distribution` stays needs-fact, restated in both
  directions, with two false sentences deleted; `irc-408A-d-4-B-roth-distribution-ordering`
  is scoped to Roth IRAs.
- **Changed: the Roth contribution-basis help asks for conversions already in the
  account as well as direct contributions** (same decision). The old text asked for
  direct contributions only, so conversion principal already in a Roth IRA when the
  plan starts was treated as earnings (taxed, and before 59½ penalized) for anyone who
  followed it. Conversions made before the plan starts have no layer of their own, so
  the 10% recapture on one less than five years old is not charged: a stated limit on
  the qualified-distribution record, with the designated Roth account's pro rata rule
  and a designated Roth rollover into a Roth IRA, until each has its own record.
- **Known limit registered: a designated Roth account has no five-year period in the
  engine** (same decision, found in its independent review). The qualified-distribution
  record said designated Roth accounts in employer plans were "held to the same test"
  as a Roth IRA; the engine gives them no five-year period at all, so a distribution at
  60 or older is treated as qualified. 26 U.S.C. 402A(d)(2)(B) gives each plan's
  designated Roth account its own period, from the first designated Roth contribution
  under that plan (Treas. Reg. 1.402A-1 A-4(a)), and a distribution inside it is not
  qualified. The plan does not collect that year, and the engine does not start a
  period when the plan funds an empty designated Roth account either. The error runs
  one way, under-taxing: earnings drawn at 60 or older inside the period are shown tax
  free. New approximated record `irc-402A-d-2-designated-roth-five-year-period`
  (needs-fact 23 to 24; approximation kinds 73 / 24 / 23), with a fixture pinning a
  whole-account distribution at 62 inside the period: the statute includes its 9,000
  of earnings, the engine none. The qualified-distribution record now says what the
  engine does.
- **Follow-ups outside this repository (same decision):** RetireGolden-Pro and
  RetireGolden-MCP pin engine 0.3.0, which strips `incomes[].disability.onsetMonth` on
  parse, so release the MCP and then Pro on the new engine promptly; the MCP's
  `update_plan` can set the month through `add_income`/`replace_income`, its typed
  `build_plan` path has no disability month, its engine-skew caveat says a document
  "was imported as supplied" when fields were stripped, its protocol baseline hashes
  (`resource.sha256`, `resource.readSha256`, `describe_plan_schema_full`,
  `meta.enginePackage`) must be regenerated, and `skills/retiregolden/references/plan-json.md`
  should list the month; Pro's intake grammar refuses the three-level path, so a mapper
  must write the whole `disability` object.

- **Fixed: a PIA computed from an earnings history now receives the cost-of-living
  increases since eligibility (displayed numbers change for an entered earnings history
  of anyone born 1963 or earlier)** (decision D-SS-LAW-2, problem P12, found by the
  independent check of the B2-P1 slice 4 derivation). The bend-point formula gives the
  PIA of the eligibility year, and 42 U.S.C. 415(i)(2)(A)(ii)-(iii) raises it by the
  increase of that year and every later one, floored to the dime each time, whenever the
  person claims. The projection used it unraised: a man born 1960-05-01 with $50,000 a
  year from 1982 to 2021 was paid $34,156.80 in 2027 rather than $40,372.80 (his 2022 PIA
  of $2,846.40 raised by the 2022-2025 increases to $3,364.40). The engine now carries
  SSA's COLA series (1975-2025, `COLA_PCT_BY_YEAR`) and applies it from the eligibility year
  through the year before the projection's first year, before the ledger's own COLA; a
  year SSA has not announced uses the plan's COLA assumption and the projection warns.
  Maintenance: the series ends with the December 2025 increase, so from 2027-01-01 every
  earnings-history PIA past eligibility uses that stand-in for 2026 until SSA's 2026
  increase (announced in October 2026) is added to `COLA_PCT_BY_YEAR`.
  The claim-milestone insight reads the same start-year PIA. An entered PIA is
  unchanged. planner-ui's `resolvePia` (the Social Security analysis page's models and
  the Social Security step's "Computed PIA" line) applies the same
  `piaWithCostOfLivingIncreases`, so the step now shows that man $3,364 a month, as the
  plan pays it from 2026, with a note that his earnings give $2,846 for 2022, and the
  analysis page ranks claim ages on the PIA the ledger pays; `resolvePia` takes the
  projection's first year and COLA assumption (`piaAsOfPlan`) and `claimingPeople` a
  start year. B2-P1 slice 4 still moves the resolver into the engine. New record
  `usc-42-415-i-2-A-pia-cost-of-living-since-eligibility` and calculation
  `pia-cost-of-living-since-eligibility`.

- **Fixed: earnings before 1979 are counted only up to that year's contribution and
  benefit base, and the earnings window starts at 1951 (displayed numbers change for an
  entered earnings history)** (decision D-SS-LAW-2, problem 5 of the B2-P1 slice 4
  derivation, confirmed by its independent check). 42 U.S.C. 415(e)(1) excludes a year's
  earnings above that year's base ($3,600 for 1951-54 up to the section 430 base from
  1975). The engine's base table started in 1979 and capped every earlier year at the
  latest base, $184,500: a worker born in 1956 with $50,000 a year from 1978 had the whole
  1978 wage counted, an AIME of 7,790 and a PIA of $2,605.00, where the statute gives
  7,436 and $2,551.90. The table now carries SSA's bases for every year from 1937, and the
  window starts at 1951, the first computation base year (415(b)(2)(B)(ii)), which also
  settles the five-year dropout record for workers born in 1928 or earlier (computation
  years are the elapsed years less five; approximation fixes 74 to 73). The planner's
  paid-in estimate reads the same table. New record
  `usc-42-415-e-1-earnings-above-the-base-not-counted` and calculation
  `aime-covered-earnings-cap`.

- **Fixed: a spouse or divorced spouse who is also paid an own benefit gets the own
  benefit plus the separately reduced excess, from the month the spouse benefit starts
  (displayed numbers change)** (decision D-SS-LAW-2, problem 3 of the B2-P1 slice 4
  derivation, confirmed by its independent check). 42 U.S.C. 402(q)(3)(B) and
  402(k)(3)(A) pay the reduced own benefit plus the excess of half the worker's PIA over
  the own PIA, reduced for the months before full retirement age from the first month of
  the spouse benefit (402(q)(6)(A)(ii)); with deemed filing (402(r), for people who
  attain 62 after 2015) that month is the later of the claimant's own claim and the
  month the worker's benefit starts, or for a divorced spouse the first month the ex is
  62 throughout (POMS RS 00202.005 B.2.a). The engine priced this only for simultaneous
  early claims; a worker filing later, a claimant with delayed credits, and every
  divorced spouse got the larger of the own benefit and half the worker's PIA reduced at
  the claimant's own claim age. One helper,
  `dualEntitlement.ts#spouseDualEntitlementMonthly` (the POMS RS 00615.694 one-line
  form), now prices every path: the ledger's current spouse, the divorced-spouse menu
  and the claim-milestone insight's prior year. Examples: a wife with an 800 PIA who
  claimed at 62 and a husband with a 2,400 PIA who claims at 70: her $780 a month
  becomes $960; a single claimant with an 800 PIA whose ex (PIA $2,000) is first 62
  throughout a month when she is 63 years 9 months: $650 becomes $707.50. The records
  `current-spouse-excess-poms-order` and `current-spouse-excess-fallback` are replaced
  by `dual-entitlement-composition`, and
  `usc-42-402-q-3-B-k-3-A-current-spouse-dual-entitlement` now covers both spouse paths.
  Earnings-test months are credited back to the spouse reduction only for years a spouse
  benefit was paid (402(q)(7)). A divorced spouse's benefit is paid from the calendar
  year of the first month the ex is 62 throughout, the whole of that year under the
  ledger's annual convention; an ex born in December after the 2nd starts it the next
  January, where the engine had paid it from the year the ex turned 62 (a claimant with
  an 800 PIA who claims at 62 in 2026, whose ex, born 1964-12-05 with a $4,000 PIA,
  turns 62 that year: $6,720 in 2026, her own benefit, rather than $15,600; $16,500 from
  2027).

- **Fixed: a widow(er) benefit is reduced from the month the survivor became a
  widow(er), not from the survivor's own earlier claim (displayed numbers change)**
  (decision D-SS-LAW-2, problem 1 of the B2-P1 slice 4 derivation, confirmed by its
  independent check). 42 U.S.C. 402(q)(6)(A)(iii) starts the widow(er) reduction period
  with the first month of widow(er) entitlement (or age 60, if later), and 402(q)(3)(E)
  keeps an own benefit claimed earlier from lending its months to it. The ledger reduced
  a survivor at her own claim age, as if she had been widowed when she first claimed. It
  now uses the later of that claim and January after the year of death, the first month
  the ledger pays the survivor (the plan states a life age, so December of the last year
  alive is the month of death; 20 CFR 404.621(a)(4)(ii) would also let a widow(er)
  choose the month of death itself, but the ledger pays nothing for it, so that month is
  not counted). Example: a survivor born 1964 who claimed her own benefit at 62, widowed
  in December 2028 by a spouse with a $2,000 PIA who claimed at 62: $15,769.29 a year
  before, $19,800 now (both fixes). At the survivor's full retirement age, only months
  withheld from the widow(er) benefit itself under the earnings test are credited back
  (402(q)(7)), each widow(er) or spouse benefit counting only its own record's months;
  months withheld from her own benefit before the death no longer are. New
  record `usc-42-402-q-6-A-iii-widow-reduction-from-entitlement-month` and calculation
  `survivor-reduction-entitlement-month`.

- **Fixed: the widow's limit (RIB-LIM) is applied after the survivor's age reduction,
  and only when the deceased claimed early (displayed numbers change)** (decision
  D-SS-LAW-2, problem 2 of the B2-P1 slice 4 derivation, confirmed by its independent
  check). 42 U.S.C. 402(e)(2)(D) reduces the widow(er) benefit for age first and then,
  if it is still above both the deceased's actual reduced benefit and 82.5% of the PIA,
  cuts it to the larger of the two; POMS RS 00615.320 A.3 says the same. The engine
  took the limit first and reduced it again for age, so a survivor of an early claimant
  who also claimed early was paid too little. Example: deceased PIA $2,400 claimed at 62
  (paid $1,680), survivor at 62: $1,576.93 a month before, $1,911.43 now; at the
  survivor's full retirement age both give $1,980. It reaches the ledger's survivor
  step-up, the former-spouse survivor benefit and the survivor-switching panel. The
  record `poms-rs-00615-320-rib-lim-after-survivor-reduction` is settled (approximation
  fixes 75 to 74). `SurvivorBenefitInput` gains an optional `deceasedEverReduced`
  (whether the deceased was ever paid a reduced old-age benefit); omitted, it is taken as
  an actual benefit below the PIA, which gives the same result.

- **Changed: six comparisons the planner pages computed are now published by the
  engine** (owner decisions D-UI-SS, R11, R13, R15 and R17, and slice 3's open calls
  recorded 2026-09-26; B2-P1 slice 3). One comparison
  convention is exported, `compareScalars` and `compareNullableScalars`
  (`@retiregolden/engine/scenarios/scalarComparison`: proposal minus baseline, a
  negative zero published as 0, a figure that is not finite refused with a RangeError),
  and every comparison below goes through it. The pages only format and select: the
  Compare page's rows (`@retiregolden/engine/scenarios/planHeadlines`,
  `comparePlanHeadlines`), each relocation row's lifetime tax difference from the first
  row and its ending estate in today's dollars
  (`RelocationCandidateRow.lifetimeTaxesAndPenaltiesDeltaVsBaseline` and
  `.endingAfterTaxEstateTodayDollars`), the claim-age co-optimization's estate gain
  (`ClaimAgeCoOptimization.claimChangeEstateGain`, with `estateYear`, the year whose
  dollars it is in; the Optimize page's claim card and the report both read it, R17),
  the conversion schedule total (`conversionScheduleTotal`, published as
  `OptimizedSchedule.conversionTotal` on the raw and cleaned schedules and as
  `ExactLedgerTournament.winnerConversionTotal`; the engine's own cleaned-schedule gates
  and requested total read it too) and the Insight preview's change in Monte Carlo
  success (`compareMonteCarloSuccessRates`, which refuses two runs on different path
  counts). Unchanged on the example plans: the relocation rows (116 of 116 bit for bit
  at FL, TX and CA), the claim gains (the five winners and the twenty that hold their
  claim ages), every conversion total except the two sentences below, and the Compare
  page's Money lasts, Success and Depletion age cells on all 812 ordered pairs. What
  changes is below; the figures are measured in the slice's addendum.

- **Changed: the Compare page compares money in today's dollars when the two plans end
  in different years** (owner decision R13). Subtracting nominal dollars of two
  different years reported inflation as a difference between the plans. When the plans
  end in different years, each ending figure is now divided by its own plan's published
  inflation factor for its own end year, and lifetime tax plus penalties is re-summed
  year by year in start-year dollars; when they end in the same year nothing changes.
  Every money row names its basis ("(2026 $)", or the shared end year and "(nominal)"),
  and a sentence under the table names both end years. On the 812 ordered pairs of the
  29 example plans, 762 end in different years: their lifetime tax cells and 678 of
  their cells in each ending row change, and the difference changes sign (and colour)
  in 30 estate, 24 net worth, 18 investable and 6 lifetime tax cells; for example
  `example-couple` against `hsa-stealth-retirement` reads −$466k of after-tax estate in
  2026 dollars where it read +$330k. The 50 pairs that end in the same year, every
  designed A/B pair among them, are unchanged. Both plans are now projected from one
  start year read once, and a comparison the engine refuses is stated on the page in
  plain words, with the plan it is about and what to fix, instead of breaking it. When both plans run their full horizons the engine publishes
  no Money lasts difference (neither exhaustion year is known); the page still reads
  "same" or "both full plan", with no colour. `compareScenarioPlans` gains
  `headline.moneyLasts` in the same convention, for RetireGolden-Pro's meeting view.

- **Changed: the Insight preview's Monte Carlo line runs the headline configuration**
  (owner decision R11). The spending-guardrails preview simulated both plans on
  historical returns at 250 paths, a different model and a quarter of the paths of the
  success rate shown everywhere else, so it reported a change from a rate the reader
  had not been shown. It now reuses the headline run for the plan (the rate the KPI bar
  shows, 1,000 paths or a finer published run) and runs the previewed plan on the same
  model, seed, path count and start year (a published run that outlived a New Year keeps
  its own start year, and the engine refuses two runs from different years): `bracket-fill-roth` reads +25.1 points where it read
  +30.8, `rmd-irmaa` +17.5 where +20.0, `annuity-purchases-estate` "no change" where
  +0.8, and `no-annuity-brokerage` +0.1 where +2.4. The engine's shared-path helper
  (`attachStochasticMetrics`) prices each plan with its own tax stack when the decision
  context builds one per plan (latent: its one caller does not). The spending-guardrails
  card no longer publishes a constant 12 as its "change in success rate"
  (`InsightImpact.successRateDeltaPct`, which RetireGolden-Pro's review queue printed as
  "Change in success rate: +12 percentage points" for every plan); whether a preview
  runs the Monte Carlo pair is now `Detector.previewsMonteCarlo`, and the card keeps its
  place in the Insights order through a named editorial weight
  (`EDITORIAL_RANKING_WEIGHT_DOLLARS`), so no card moves. When the guardrail preview is
  refused because a Marketplace year's premium tax credit is unpriced (20 of the 26
  example plans that offer the card), the card now names those years and the reason in
  plain words and says why a preview without the credit is not shown, instead of
  printing the engine's sentence.

- **Fixed: Optimize page sentences that said something that had not happened.** The
  execution sentence printed "Cleaned executable schedule: $0" beside the executed
  cleaned total on `bridge-early-retirement` and `trump-account-head-start`; it now
  prints the cleaned schedule's own total ($1,135,975 and $4,053,361). On those two and
  five other example plans the hero said "only $X could actually be converted" of the
  same $X, blaming a traditional balance that was there; a schedule with no material
  shortfall, in any one year or in total (which the engine now publishes as
  `ExactLedgerValidation.executedWithoutMaterialShortfall`, so the page re-derives no
  margin), is now headed "shown as a diagnostic" and names the cause the result
  carries (here the unpriced premium tax credit years; otherwise incomplete tax years;
  both when both apply), while one short in total keeps the shortfall sentence. A solve that stopped at its time limit (`rmd-irmaa` on slower machines) no
  longer reads "No beneficial conversions found … little pre-tax balance to convert":
  the page says the solver ran out of time and only the simple strategies were compared
  (the card for a current plan that still ranks highest no longer says a solver
  schedule was compared when the solve found none), and a timed-out schedule that is
  shown is said to be the best the solver found by then. The claim
  card and the report row name the year whose dollars the claim gain is in, and the
  relocation table names its first row as the baseline ("Deltas are against the first
  row (Your plan (FL → KY))", column "Δ vs your plan") instead of "staying in KY".
  The asset-location Insight's evaluated line named its estate gain in today's dollars;
  the figure is nominal, and the line now names the plan's last year ("in YYYY
  dollars"), and the `insight-impact-estate-and-lifetime-tax-deltas` record, which also
  said today's dollars, is corrected (unreviewed until the review lane checks it).
  The Insights card's preview, the Roth & Tax Optimizer's failure well and the
  relocation compare's error line printed an engine refusal in the engine's own words
  (for a worker page, its class was lost on the way back); each now names what could
  not be computed or compared and what to do next, and keeps an unrecognised error's
  text only as a labelled detail.

  Follow-ups outside this repository. RetireGolden-Pro: its review queue
  (`reviewEvaluate.worker.ts`) reads `InsightImpact.successRateDeltaPct`, which is
  removed; that is Pro's only compile break, and the guardrails finding shows no success
  change until Pro runs the Monte Carlo pair itself (its card parser needs no change,
  since the flag is not on the card); its meeting view should read
  `headline.moneyLasts` (money lasts "through" a year, and the bounded difference) and
  print both end years when a scenario changes the horizon; wherever its review queue
  or meeting view prints `InsightImpact.endingAfterTaxEstateDelta` or
  `lifetimeTaxDelta`, it should not call them today's dollars (they are nominal: the
  estate delta in dollars of the plan's last year, the lifetime delta each year's own
  dollars summed), which needs checking in Pro's own rendering; the next planner-ui bump
  brings every page change above.
  RetireGolden-MCP: `compare_scenarios` should read `comparePlanHeadlines` (its basis and
  both end years) rather than subtract nominal estates across horizons, which changes
  its protocol-baseline payload; `run_optimizer` returns `schedule` whole, so it gains
  `conversionTotal` and the protocol baseline's `run_optimizer_default` hash changes
  (`winnerConversionTotal` can be picked into the tournament block); reinstall its engine
  before measuring, since the installed copy is older than its pin.

- **Changed: the embedded TIPS real-yield curve is Treasury's published 2026-06-30 row**
  (decision D-TREASURY). Every TIPS-ladder quote, funded ratio, Social Security bridge
  sizing and pension lump-sum rate reads this curve. It stored 1.85/2.05/2.25/2.55/2.70%
  at 5/7/10/20/30 years, which is neither the official row nor its nearest 5 basis
  points; it now stores 1.93/2.06/2.20/2.54/2.73%, digit for digit as the Daily Treasury
  Par Real Yield Curve Rates page and its CSV print the 06/30/2026 row, with no rounding.
  What moves: the Insights "TIPS bridge ladder" card on 16 example plans (for example
  `example-couple` $140,471 → $140,217, `aggressive-saver` $118,481 → $118,673; the gap
  years and the annual income do not change), the same bridge figures on the Social
  Security page and in the optimizer's bridge candidate, and `guardrails-flex-goals`'s
  essential-spending floor card (still 44% funded; present values $901,214 → $901,466
  and $392,982 → $393,278, and "~2.7% real" → "~2.73% real"). A three-rung ladder
  paying $12,000 a year in years 5 to 7 costs $34,602.31 (was $34,628.45); a 20-year
  owned ladder paying $30,000 from 2027 yields 6.31% of its cost (was 6.32%); the
  pension lump-sum analysis's six-year curve rate at 2% inflation is 3.995% (was
  3.95%). No example plan holds a ladder, so no projected example figure moves; the
  report's parameter-source appendix prints the new row. The treasury, pension-election
  and ladder worksheets are recomputed outside the engine and their records are
  unreviewed until another reviewer recomputes them.

- **Changed: the bracket-fill Roth example gives Riley a Roth IRA, so it fills the
  bracket it is named for** (decision D-BRACKET-FILL-ROTH-EXAMPLE). A conversion lands
  only in its owner's own Roth IRA, and the household amount is split between the
  owners by their IRA balances, so without one Riley's share was dropped every year and
  taxable income ended $76,551.76 under the top of the 22% bracket in 2026. With her
  (empty) Roth IRA both shares convert: 2026 converts $183,448.24 (was $115,098.46) and
  ends a cent under the top. Both IRAs are converted by 2030, so the RMDs and the
  charitable gifts from them stop there. On Results: lifetime conversions $472,533.42 →
  $808,047.79, lifetime tax $163,853.34 → $218,889.90, ending investable $623,753.79 →
  $587,705.63, lifetime QCDs $165,189.53 → $52,563.29; the conversion years' incomes put
  Medicare's income surcharge at tier 1 in 2028 and tier 2 in 2029 to 2031 (premiums
  in 2029 $5,718.09 → $12,492.99). The warning that Riley has no Roth account is gone;
  the overshoot warning ("Spending withdrawals ... pushed income above the
  Roth-conversion target") now appears and is true, and a reduced-conversion warning
  appears for 2030. "How much can I spend?" answers $100,800 (was $101,600; exact
  $100,899, was $101,602), slack $10,800, initial withdrawal rate 8.20% (was 8.26%);
  the spending shapes read flat $91,000, smile $105,100, smirk $107,200 (were $91,700,
  $105,800, $107,900; the differences are unchanged). The spending-headroom card reads
  $14,480/yr on a $333,051 estate (was $15,369/yr on $353,480), and the headline Monte
  Carlo success rate at the page's defaults (the example as the library opens it, whose
  plan id seeds the paths) is 66.8% (was 67.7%). The walkthrough's
  2026 and 2029 tables are derived again by hand for the new household and held to the
  engine. The `roth-conversion-annual` record gains the owner-split limit, and the
  `YearResult.rothConversion` comment says that with two owners the executed total is
  the sized amount rounded half up to the cent.

- **Changed: the early-retiree ACA example and the 401(k) bridge pair say what they
  show** (decision D-ACA-EXAMPLE-COPY). The early-retiree example's copy now says the
  credit is priced for 2026 and 2027, the coverage years whose figures are published,
  and that 2028 budgets the full premium; that the benchmark premium is assumed equal to
  the $1,000 a month Casey pays, so editing the premium turns the credit off; and that
  the conversions are sized to the 10% bracket, not to the cliff (raising them to 12%
  erases both credits). The "401(k) plus brokerage bridge" and "All-in 401(k)" copy
  claimed the bridge lasts to the planning horizon, outlives the control by years,
  keeps more ACA credits and lowers net premiums, and that its conversion scenario
  backfires. On the projection the bridge runs out in 2068 and the control in 2067,
  both before 2078; no premium tax credit is priced in either plan in any year (in 2026
  and 2027, the coverage years whose figures are published, the couple's wages put
  them above the cliff, at 783% and 792% of the poverty line in the bridge plan and
  638% and 647% in the control; the bridge years, from 2038, come after the last
  published coverage year), so the premiums are the same; the control pays $87,045 of early-withdrawal penalties; and the conversion
  scenario, which converts only Sam's share because Jordan holds no Roth IRA, lowers
  lifetime tax from $876,459 to $566,785 and lasts to 2070. The copy, the builder
  comments and the golden-test narration now say so.

- **Docs: three calculation worksheets say what a projected year does** (decision
  D-WALKTHROUGH-WORKSHEET-WORDING). `roth-conversion-annual` states the contract's
  tolerance (the bisection's one-sided $0.01, and the half-up cent of a two-owner split)
  instead of its worked case's $0.005; `spending-healthcare-annual` no longer lists the
  gross premium in a year whose credit is not priced as a wrong reading;
  `year-result-ltcg-zero-headroom` names the year's threshold, indexed in a projected
  year (49,450 in 2026, 50,686.25 in 2027 at 2.5% inflation). No worked value moves;
  the three records are unreviewed until the review lane checks the rewording. The four
  `YearAcaResult` doc comments the decision asked for landed with the second
  walkthrough year; two of them described the stand-in income-tax year as unpriced,
  which the 2027 ACA figures made false, and now name the ACA coverage-year figures as
  the gate. `YearResult.ltcgZeroHeadroom` and `YearExpenses.healthcare` gain the same
  clarifications.

- **Changed: nine more figures the planner pages computed are now published by the
  engine** (owner decision D-UI-SS; B2-P1 slice 2). The pages only format and select
  them: the spending solver's answer, its slack and its initial withdrawal rate
  (`SustainableSpendingResult`), the spending-shape comparison
  (`@retiregolden/engine/decisions/spendingShapes`), the risk-based guardrail
  thresholds in dollars (`guardrailThresholdDollars`, and the persisted percent
  `balancePct`), the TIPS ladder's income yield and buy-list years (`quotePlanLadder`,
  on the ledger's own window, `planLadderWindow`, which `simulatePlan` now calls), the
  bucket view (`@retiregolden/engine/projection/bucketLens`), the cash-flow chart's
  Household cash and Unfunded nodes (the reconciliation totals), the Monte Carlo fan
  chart's bands (the fan percentiles themselves) and the histogram's bin centres
  (`Histogram.binCenters`). Each withdrawal rule's ending estate on the spending page
  arrives in today's dollars converted by the rule's own run
  (`SwrRuleResult.endingAfterTaxEstateTodayDollars`). Unchanged on every example plan:
  the withdrawal rates, the guardrail dollars (29 of 29 bit for bit when switched to
  risk-based guardrails), the ladder yield (no example has a ladder), the buckets
  (2,420 rows bit for bit) and the cash-flow amounts (the hub differs from the old
  line sum in the last binary digit in 32 of 1,210 years, and no printed dollar
  moves). What changes is below.

- **Changed: every surface now shows the sustainable spending the solver page showed**
  (owner decision R4). The solver's answer is published rounded down to the nearest
  $100 (`maxBaseAnnual`), with the level that passed kept as `feasibleBaseAnnual` and
  the slack measured from the published amount, so the insight card, the Scenarios
  capacity table, the tax-strategy tradeoffs, RetireGolden-Pro and the MCP show the
  amount the spending page shows and applies. Under fixed-target spending the rounded
  amount is taken to pass without a run of its own: a lower amount has not been found
  to fail where a higher one passed on any example plan or variant tried, though a
  lower spend that drops income below the poverty line and loses the premium tax
  credit is not ruled out. Under withdrawal-rate or risk-based guardrails, where a
  lower amount can fail although a higher one passed, the rounded amount is published
  only when a run at it passes (the search's own probe at that amount, or one more
  run); otherwise the solver publishes the exact amount that passed, says so
  (`maxBaseAnnualRounding: 'none'`) and adds a sentence saying why, which the
  spending page prints. A rounded amount below the plan's required spending is never
  published. Whether today's spending is sustained is published as
  `sustainsCurrentBase` (the verdict on the level that passed, as the page judged it
  before), and the Scenarios capacity comparison carries it per side with each side's
  passing level and rounding, because the slack alone can read −$30 for a $72,030
  base that passes; the Scenarios capacity table prints it per side, in a "Current
  base spending" column (Sustained, Not sustained, or Not judged). On the example plans the spending page changes nothing; on the
  25 answering examples whose answer is not a whole hundred the other surfaces now
  show $2 to $91 less (for example `rmd-irmaa` $131,485 → $131,400, and its slack
  $21,485 → $21,400); 17 of the 19 spending insight cards the examples offer show the
  lower amount, and none disappears. No example with an answer spends under
  guardrails, so no probe count changes.

  On guardrail plans the spending page itself changes. Where it applied and added as
  a scenario the exact amount the solver tested, it now applies the rounded amount
  once a run at it has passed. Where it showed the rounded amount although that
  amount fails, it now shows the exact amount and says why: the `lean-fat-fire`
  example under withdrawal-rate guardrails (upper guardrail 150, a $40,500 required
  floor) showed $76,600, which runs out of money in 2085, and now shows $76,641.
  Follow-ups outside this repository: RetireGolden-Pro's meeting view suggests
  revisiting base spending whenever the proposal's slack is negative
  (`meetingViewModel`), which now misfires on a sustained base with a slack between
  −$100 and 0 and should read `proposalSustainsCurrentBase`; the MCP's
  `solve_max_spending` passes through only the published amount and slack, and should
  also publish `feasibleBaseAnnual`, `maxBaseAnnualRounding` and `sustainsCurrentBase`.

- **Fixed: the spending-shape table's "vs constant-real" column subtracted amounts it
  did not show** (owner decision R5). The table printed each shape's amount rounded
  down to $100 beside a difference of the unrounded amounts, so a $100 gap could read
  "+$99" and no gap "+$99". The difference is now taken between the two amounts shown:
  48 of the 54 shape differences on the example plans change, by −$84 to +$88 (for
  example `under-saved-single`'s smile +$5,063 → +$5,100); no amount changes.

- **Fixed: the Monte Carlo "Range of outcomes" tooltip printed band widths as dollar
  levels** (owner decision R14). The chart stacked the 90th-minus-10th and
  75th-minus-25th percentile widths on transparent bases and the tooltip listed them
  beside the bases, so "10–90% $900,000" read as a level. The bands are now drawn as
  ranges between the two levels and the tooltip prints "10th to 90th percentile
  $400,000 to $1,300,000".

- **Fixed: a histogram of paths that all end at the same amount was labelled $1 to
  $30.** With every ending equal the histogram's bin width is a placeholder of 1, which
  the page read as a real width. The engine now publishes each bin's centre, the one
  value itself in that case, and the page then draws one bar at that value holding
  every path: one bar, $0, on the five example plans whose every path runs out at the
  page's defaults (`inherited-ira-beneficiary`, `survivor-years`, `ltc-shock`,
  `brokerage-no-hsa`, `fixed-target-spending`).

- **Changed: the risk-based guardrail thresholds say when they have no dollar figure**
  (owner decision R3). The pages printed $0 for both thresholds when the plan's
  investable balances were zero, although the ledger then anchors on the first year
  the portfolio has a balance; they now print the percents and say where they apply:
  Results, the projection's first year with a balance; Monte Carlo, each simulated
  path's; the Spending card, both. A pair whose
  cut threshold is not below its raise threshold says the rule holds spending every
  year. On every plan with a balance the printed dollars are unchanged.

- **Mutation receipts are checked against the current code and tests** (decision
  D-RECEIPT-DRIFT). A receipt is the evidence that an evidence test kills a mutant of
  production code, and a reader can rerun it only while its diff and captured output
  still describe that code. A new check, `rules/mutationReceipts.conformance.test.ts`,
  reads every receipt without re-executing anything (its tests take about a quarter of a
  second) and fails when one has drifted: a hunk whose context and removed lines no
  longer occur exactly once in the production file, as whole lines, at the line its `@@`
  header names, or whose header names no line or miscounts its lines; a stack line into
  a test file that no longer lies in the test the failure names (or in the helper the
  frame names); a quoted code-frame line that no longer reads as the test file does; a
  named test the file no longer registers; or a stated test count that no longer matches
  the file, where its source fixes the count. Stack lines into production files and the
  diff's blob hashes are not checked, and the test file says why. On main the check
  found 133 of the 226 receipts drifted (some in more than one way): 74 hunk headers
  named a line the code has since moved from, 13 miscounted their lines, 37 diffs were
  text substitutions that named no line, 27 captures quoted test lines that had moved
  and 16 stated test counts the files no longer have. Every one was re-executed
  (baseline green, mutant red, production restored byte for byte and green); the 37
  substitutions are now the git diff of the same substitution, which reproduces the
  mutated file byte for byte, and no mutation changed. No calculation or displayed
  number changes.

- **Fixed: the Medicare income surcharge (IRMAA) threshold threw for a 2027 parameter
  pack** (decision D-ACA-2027-TABLE). 42 U.S.C. 1395r(i)(5)(C)(ii) resumes indexing the
  $500,000 top threshold for premium years after 2027, measured from August 2026.
  `irmaaTierThreshold` could measure from that base only while the pack year was 2026,
  and refused any other, so adding the fall's 2027 pack would have stopped every
  projection with a Medicare month in 2028 or later, and the Insights IRMAA detector for
  every plan starting in 2027 or later. `IrmaaThresholdYear` gains an optional
  `inflationFactorBetween(fromYear, toYear)`; with it the resumed row is measured from
  2026 whatever the pack year, and every engine caller passes it. Anchoring at a 2027
  pack instead would agree with the statute only at a constant inflation rate: on a path
  of 3%, 2% and 5%, a 2029 premium year's top single threshold is $525,000 from the
  2026 base and would be $536,000 from 2027. A caller that omits it still gets the
  refusal for a pack year other than 2026. No example figure moves: the only published
  pack is 2026's, where the two readings are the same.

- **Fixed: the ACA premium tax credit now follows the IRS rounding** (decision
  D-ACA-2027-TABLE). 26 CFR 1.36B-3(g)(1) rounds the applicable percentage "to the
  nearest one-hundredth of one percent", and Form 8962 reads the table at the
  poverty-line percentage with its fraction dropped (Worksheet 2, line 4). The engine
  interpolated on the exact percentage and rounded nothing; it now reads the table at
  the whole number and rounds the rate half up to 0.01%, in 2026 and 2027 alike. The
  100% and 400% tests stay on the exact percentage, as the form's cliff test compares
  dollars, and the published `fplPct` stays exact. The form's whole-dollar rounding of
  the annual and monthly contribution (lines 8a and 8b) is a stated limit, worth at
  most about $0.50 of credit a year on the annual path and about $6 on the monthly
  one. early-retiree-aca's 2026 credit goes $10,364.77 → $10,366.95 (182.11% is read at
  182: 5.73%), and the 2027 credit the next entry adds is read the same way (183: 5.94%);
  the figures that entry gives already include this rounding.
  glidepath-allocation's 2026 credit goes $8,121.13 → $8,126.97 (ending investable
  $1,272,656.33 → $1,272,697.21). No other example moves. New export `acaWholeFplPct`
  (`@retiregolden/engine/tax/aca`); `acaApplicablePct` now returns the rounded rate
  (listed under Breaking).

- **Changed: the 2027 ACA premium tax credit is priced on its published figures**
  (decision D-ACA-2027-TABLE). Every figure the 2027 credit reads is published:
  Rev. Proc. 2026-26 gives the 2027 applicable-percentage table (2.15% below 133% of
  the poverty line, up to 10.22% from 300% to 400%), and the poverty line for 2027
  coverage is the HHS 2026 guideline, $15,960 for one person plus $5,680 for each
  added person (Alaska $19,950 + $7,100, Hawaii $18,360 + $6,530), because the
  statute uses the guidelines in effect when that year's open enrollment begins,
  which is in 2026 (26 U.S.C. 36B(d)(3)(B); 26 CFR 1.36B-1(h)). The engine now keeps
  these per coverage year (`acaParametersForCoverageYear` and `ACA_COVERAGE_YEARS` in
  `@retiregolden/engine/params`; the 2026 pack references the 2026 block) and prices
  a Marketplace year on its own figures while the 2027 income-tax figures are still
  projected from the 2026 pack. Such a year says so with the informational support
  code `income-tax-parameters-projected`: the credit formula reads no income-tax
  figure, but the household income does, through bracket-sized conversions and the
  tax fixed point (a 1% change in those figures moves early-retiree-aca's 2027 credit
  by about $44). The Results ledger's credit marker, the report's ACA status line,
  a note under the downloadable report's ACA ledger (the report model's
  `projectedIncomeTaxNote`) and a new "ACA premium tax credit figures" row in the
  report's assumptions table say it; the parameter source appendix gives each coverage
  year's schedule its own row and link (`aca-ptc` for 2026, Rev. Proc. 2025-25, and the
  new `aca-ptc-2027` for 2027, Rev. Proc. 2026-26). Published guidelines are used as
  published: a 2027 poverty line is 15,960, never 15,960 × 1.025, and the `acaCliff`
  conversion ceiling for 2027 is 4 × 15,960 = $63,840 (it would have been sized to
  $64,165, above the cliff). 2028 and later stay
  unpriced until their figures are published. On the 29 example plans, 18 of the 22
  Marketplace years in 2027 are now priced: early-retiree-aca gets a $10,924.78
  credit (ending investable $539,207.42 → $579,405.87, with the rounding above) and
  hsa-property-depth $3,283.50 (lifetime tax $32,843.21 → $32,299.64); 13 are above the cliff and 3
  below it with a $0 credit; ltc-shock (below 100%), guardrails-flex-goals (adaptive
  spending), fixed-target-spending and brokerage-no-hsa stay unpriced. The last two
  fund 2027 just above 100% of the poverty line by withdrawals the credit would
  shrink to below 100%, so no self-consistent credit exists in the engine's model; a
  stated limit gives the truer reason (the 26 CFR 1.36B-2(b)(6) exception is not
  modeled). From 2027, Pub. L. 119-21 §71301 reaches a lawfully present tax-family
  member who is not an eligible alien; that is a stated limit, and the year
  contract's `coverageEligibility` help text says what 'supported' now asserts. New
  rule records for Rev. Proc. 2026-26, 36B(d)(3)(B), the HHS 2025 and 2026 guidelines
  and the eligible-alien rule, and a new calculation record,
  `aca-coverage-year-parameters`, with its worksheet and receipt; an external-oracle test
  pins the 2027 table and cliffs. `INFORMATIONAL_ACA_SUPPORT_CODES` and
  `isBlockingAcaSupportCode` (`@retiregolden/engine/projection/types`) are the one
  list of support codes that inform without blocking, and
  `premiumTaxCreditOnProjectedIncomeTax` joins the year display figures. The
  "How much can I spend?" solver (next item) reads that list for its disclosure, so
  `income-tax-parameters-projected` is never named as a reason a year went unpriced;
  with 2027 priced, 2027 leaves the solver's unpriced years in the 18 examples that
  had it, early-retiree-aca's answer goes $45,313 → $45,625 (shown $45,300 → $45,600)
  and hsa-property-depth's $28,688 → $29,087 (its unpriced years become 2026, 2028
  and 2029).


- **Plain words in every published record field:** the rule and calculation text the
  methodology site prints (rule titles, rationales and citations, the approximation
  notes, and each calculation's title, purpose, statement, formula, limits and dataset
  text) no longer uses dashes as punctuation or internal test vocabulary ("fixture",
  "exact ledger", "pack", "vintage", "DEFECT ... registry slice", "fails closed",
  "scenario patch", "detector", "no-op"). 347 texts were reworded without changing
  what they say; no calculation changed. A new check, `rules/publicText.ts` with its
  conformance suite, now holds every rendered field to that list, including a spaced
  hyphen used as a dash (subtraction and ranges pass); quoted statutory text is exempt.
  44 citations changed only their punctuation (a dash between document and section
  became a colon), so the quote-fidelity ledger carries their existing verdicts under
  the new citation text without a new fetch.

- **"How much can I spend?" answers plans with an unpriced premium tax credit:** the
  solver gave no answer on 22 of the 29 examples, and on every plan with a Marketplace
  year whose credit the projection could not price, which includes every plan built in
  the editor with the credit box on, since the editor never writes the per-year credit
  details. Such a year (one past the latest parameter year RetireGolden has, or one
  without those details) made every probe a refusal, and the page then said fixed costs
  might exceed what the plan can fund. That refusal is meant for actions whose value
  depends on the credit, such as Roth conversions, and stays there. A spending probe
  now runs on the ledger as it already is: those years pay the full Marketplace
  premium, which the credit can only lower (26 U.S.C. 36B(b)(2)), and the result names
  them and which way a credit there would move the answer (`acaGrossPremiumYears`,
  `acaGrossPremiumReasons`, `acaGrossPremiumDirection`). At fixed-target spending a
  lower premium lowers what that year must withdraw, so a credit would likely leave
  room to spend somewhat more (measured on the examples, not proven); under guardrails
  it could move the answer either way, because cuts and raises respond to healthcare
  costs. The page, its spending shapes, the Scenarios capacity section and the
  spending-headroom Insight say which years, why, and which way. Before → after, from a
  2026 start: Early retiree & the ACA cliff, no answer → $45,300; Aggressive saver to
  early retirement, no answer → $90,300. 20 examples gain an answer and the 7 that had
  one do not move. The two still without one are true: Long-term-care shock depletes
  even at zero spending, and Guardrails and flexible goals at its required floor (next
  item).
- **The solver probes the required spending floor, not zero:** when today's spending
  fails, the solver used to probe $0, which the plan checks refuse for a plan with
  required spending, and then reported that even zero spending "depletes the portfolio
  or breaks the estate floor". It now probes the required floor and names it and the
  constraint that failed ("Even the required spending floor ($34,000/yr) depletes the
  portfolio before the plan ends." for Guardrails and flexible goals; an ending estate
  below the target is named as that), and no probe goes below the floor, the first one
  included: a base spending that rounds below a fractional floor is seeded at the floor
  rounded up instead of failing the plan checks. The same example's smirk spending
  shape now answers $37,000. The page's "fixed costs may
  already exceed what the plan can fund" sentence now appears only when a probe at zero
  base spending ran and ran out of money, never after a floor, a bequest-target miss, a
  budget that stopped before zero was tried, or a solve that could not run.
- **The solver page no longer calls a sustainable baseline unsustainable:** the answer
  is shown rounded down to $100, and the page judged today's baseline against that
  rounded figure, so a $72,030 baseline the plan sustains exactly read as "$30 below …
  cannot sustain today's spending". The hero and the slack tile now judge by the exact
  answer ("less than $100 a year to spare"), and when the bequest target is what limits
  the answer, the page says the plan cannot sustain today's spending and still leave it.
  Under guardrail spending the page no longer says the rounded figure also passes: there
  a lower level can fail where a higher one passed, so Apply to Spending and Add as
  scenario use the exact amount the solver tested, and the page says so; fixed-target
  plans keep the figure rounded down to $100.
- **The Optimize page no longer says the 2027 credit figures are unpublished:** its
  explanation of an unpriced Marketplace year said "sourced ACA tax parameters for those
  years are not yet published", which is false for 2027 (the IRS published that year's
  applicable percentage table in Rev. Proc. 2026-26). It now says RetireGolden doesn't
  have the credit's figures for those years yet, on the Optimize page and the "why this
  recommendation" panel alike.
- **Changed: the eleven ledger figures the planner pages computed are now
  published by the engine** (owner decision D-UI-SS; B2-P1 slice 1). The
  pages only format and select them. Six move as they were and no displayed
  number changes: tax plus penalties, spending with tax and penalties, net
  long-term-care cost, upside spending, the upside miss, and the capital-loss
  carryforward used. Five change, below. New engine modules:
  `@retiregolden/engine/projection/dollarBasis`, `/projection/yearFigures`,
  `/projection/moneyLasts` and `/insights/detectorProjection`, and a new
  ledger field, `YearResult.unassignedCash`.

- **Fixed: "Tax-free gains room" showed gains that cost federal tax**
  (owner decision R2). The Results column added the room left in the 0%
  long-term bracket to the remaining capital-loss carryforward. That is not
  the room at no tax: an extra gain can use up a loss deduction the
  household's other income was using, make more Social Security taxable,
  shrink the senior deduction, or reach the 3.8% net investment income tax,
  whose thresholds are not indexed while the 0% bracket is. The column now shows the largest extra long-term gain
  that raises the year's federal income tax (regular tax, AMT and NIIT) by
  $0, found by recomputing the year's federal tax with the gain netted
  through the carryforward first. A single filer in 2026 with $40,000 of
  pension and a $10,000 carryforward saw $35,550 and now sees $7,000
  (realizing $35,550 would have cost $360); one with $10,000 of pension and
  $30,000 of Social Security saw $38,100 and now sees $20,352 (the old figure
  would have cost $1,135). The column rounds down to the whole dollar, so it
  never shows more room than the engine found ($20,352.94 here). On the 29 example plans the figure is lower in
  370 of 1,210 plan-years and higher in none. The largest drop is $216,148
  (`all-401k-no-bridge` and `brokerage-bridge-401k`, 2078: $303,767 became
  $87,619), where realizing the old figure would have cost $11,599.64 of
  federal tax. Most of those years hold no taxable account to realize a gain
  from; in the 51 that end the year with a taxable-account balance, the
  largest drop is $59,276 (`salary-growth-escalation`, 2070) and the largest
  cost at the old figure $2,628.59 (`aggressive-saver`, 2063). In 150 of the
  370 the room is $0. The column's tooltip, the
  table explainer and the Learning Center article on harvesting say what the
  room includes and what it leaves out (state tax, the ACA premium credit,
  Medicare premiums two years later), and a year with an ACA premium credit
  carries a marker: realizing gains can also shrink the credit, and if it
  was paid in advance, the part lost is paid back as federal tax at filing. The room in the 0% bracket stays published
  (`YearResult.ltcgZeroHeadroom`).

- **Fixed: an account held in two plan rows was counted twice in the
  balance charts** (owner decision R1). The Results balance chart, the report
  chart data and the printed report added an account's balance once per plan
  row, although the engine publishes one balance per account: an IRA recorded
  as two $50,000 rows under one id showed $200,000 of traditional money
  instead of $100,000. Each category now counts every account once. No
  example plan holds such an account, so none of their charts change.

- **Added: unassigned cash is drawn on the balance chart** (owner answer to
  Q9). When a surplus has no cash or taxable account to land in, the ledger
  holds it outside every account (and warns); it is in investable assets but
  in no account type, so the stacked chart stopped short of the investable
  total by that amount, silently. The engine now publishes it
  (`YearResult.unassignedCash`); the Results chart and the printed report
  draw it as its own band, and the downloadable report's chart data carries
  it as an extra column, when a plan has any. In the `coast-fire` example it
  starts in 2026 and reaches about 45% of investable assets in 2055.

- **Changed: one "money lasts" convention** (owner decision R15). The Results
  sentence counted the years between the depletion year and the plan's last
  year, so a plan short only in its final year read "depletes 0 years before
  the end of the plan". It now names the last fully funded year and counts
  the years short of the plan's end: "Money lasts through 2045, 7 years
  short of the plan's end in 2052" for the `under-saved-single` example,
  which used to say 6. The count is one higher than before in every plan
  that runs short (10 of the 29 examples). The KPI bar, the printed report,
  the LTC stress table on the Insurance page and the Social Security bridge
  comparison now say "through" the last funded year where they said "until"
  or "to" the first short year: the same fact, one year earlier ("until 2046"
  is now "through 2045"); the downloadable report's "Depletes in 2046" is now
  "Through 2045 (runs short in 2046)". A plan short from its first year says
  "short from 2026" everywhere instead of naming the year before it. The
  engine's `compareLtcStress` publishes each run's money-lasts figures
  (`LtcStressComparison.lasts`), and the Compare page's delta now reads the
  engine's `lastFundedYear` instead of its own copy.

- **Changed: today's dollars divide by the ledger's own inflation factor**
  (owner decision R19). The pages compounded the plan's inflation rate with
  a power from their own start year; they now read the factor the ledger
  grew each year's amounts by. The two differ only in the last binary digit
  (21 of 41 years at 2.5%, one unit each), so a whole-dollar figure can move
  only on an exact half-dollar tie, and the FI target line in today's
  dollars is now exactly the FI number. The relocation page converts from
  its comparison's own start year and the spending page from its solve's,
  not from the clock when the page renders.

- **Removed from the engine API: `lastsThroughYear`**
  (`@retiregolden/engine/decisions`). It counted a plan that never runs short
  as lasting through the year after its end. Use `lastFundedYear` from
  `@retiregolden/engine/projection/moneyLasts`; every difference between two
  results is the same under both (each result moves by one year), so the
  decision and optimizer money-lasts deltas do not change. No package in this
  repository, RetireGolden-MCP or RetireGolden-Pro called it.
  `summarizeProjection` now reads its ending categories through
  `balancesByCategory`, which refuses a plan whose account id is also a
  property, debt or permanent-life policy id (the plan checks already refuse
  those plans and repair stored ones).

- **Removed from `@retiregolden/planner-ui/projection`: `inflationView`**
  (no caller outside the package). `ProjectionView` gains `basis`, the
  engine's dollar basis for the run; `deflate` and `inflate` stay, as
  one-line calls to the engine, and they now refuse a year outside the
  projection instead of extrapolating. RetireGolden-Pro reads `deflate` in its
  review-queue worker and fleet scan to hand to the insight cards; a follow-up
  there should switch those to `detectorProjection`. The row builders in
  `planner/resultsRows` take the page's dollar mode instead of an adjuster.
  Two more RetireGolden-Pro follow-ups: its packet `ReportDocument.tsx`
  (lines 405 to 429) draws the chart from the report's chart-data rows and
  ignores their new optional `unassignedCash` field, so a plan with unassigned
  cash prints a stack short of investable assets there; and the packet
  screen's `chartDataCsv` gains the `unassignedCash` column only for plans
  that have unassigned cash.

- **Student-t market model is now a true Student-t:** it used to draw a normal and
  multiply one year in twenty by 2.5 (3.5 at df 4 or less), so its swings were about 12%
  larger than the volatility set (1.25 times at df 4 or less) and no t variate was
  drawn. It now draws Z · sqrt((df − 2)/V) with V chi-square (Marsaglia and Tsang, on
  uniforms only), whose standard deviation equals the set volatility; the fat tails come
  from the t itself. A df of 2 or less is refused (the floor at 3 is gone). Allocated
  accounts' class shocks share the same V, so they form a multivariate t: large moves in
  magnitude co-occur across classes, their direction follows the correlation, and cash
  gets t tails too. Before → after on one test household (1,000 paths, seed 42,
  $1,000,000 taxable, $45,000 spending, 5% return, 12% volatility): success 45.7% →
  48.4%. Lognormal at 12% on the same household is unchanged at 48.2%.
- **GARCH market model fixed:** the recursion fed back its already-scaled shock (a
  factor 0.36 on the alpha term at the default setting, 25 at 100), and with a fixed
  omega of 1e-5 its long-run swing was about 0.56 points a year when the volatility was
  set to 12%, so its paths were nearly deterministic. At volatility settings of 24.5 or
  more it had no finite long-run variance (the old recursion stays strictly stationary
  to about 26.2; only the planner's top value, 25, is affected). It now runs textbook
  GARCH(1,1) on its own innovation (Bollerslev 1986), with omega set so the long-run
  standard deviation equals the set volatility in every year (variance targeting). Alpha
  + beta of 1 or more, and negative inputs, are refused. Allocated accounts' class
  shocks now cluster with the market: each class keeps its volatility and correlations
  and is scaled each year by the market's conditional volatility over its long-run one.
  Before → after on the same household: success 90.1% → 49.0% at 12%, and 85.7% → 38.3%
  at 20%.
- **Reversed-history window refused instead of clamped:** `windowLengthYears` must be a
  whole number of years from 5 to 96; anything else now raises an error instead of
  running a different window (3 and 4 ran as 5, 97 as 96) or crashing (a fractional
  window). No displayed figure moves: the planner always sends 10, and every valid
  window replays the same paths as before.
- **No silent clamps left in the market models:** an out-of-range value now raises an
  error with a message instead of being changed quietly, for the return-inflation
  correlation (outside −1 to 1, in seven models), a class volatility (missing, negative
  or not finite), the historical block length (not a whole number of at least 1), the
  regime switch and high-inflation probabilities (outside 0 to 1), AR(1) phi (1 or more
  in size, where the process is not stationary), the stationary mean block length (below
  2), the user-shock year (not a whole number of at least 1; a fractional year used to
  give no shock at all), an explicit historical stress window (not a whole number from 1
  to 96), the historical stress suite's worst-window count (not a whole number of at
  least 1), a return, regime or inflation volatility (negative or not finite: every
  model's returnVolPct and inflationVolPct, user shock's baseReturnVolPct and regime
  switching's bull and bear volatilities; only GARCH's returnVolPct was checked before),
  and a custom class correlation matrix that is not positive definite. Every value the
  earlier code ran as given produces the same paths as before, except a
  positive-definite correlation matrix with a Cholesky pivot below 1e-12, which is now
  factored exactly instead of having that pivot raised to 1e-12; a test compares each
  unchanged model against a copy of the previous code over a grid of such values. Values
  the earlier code clamped are now refused, as listed above, or run as set: the regime
  switch and high-inflation probabilities and AR(1) phi accept their whole mathematical
  range instead of the old bounds (0.001 to 0.5, 0.01 to 0.3, and −0.9 to 0.95), so a
  value outside those bounds is no longer moved to the nearest one. The planner never
  sets the two probabilities and passes phi 0.3, so no displayed figure moves. The CAPE
  adjustment cap (a cap on a derived value), the stationary bootstrap's minimum block of
  one year, and the random-number and balance floors stay, and are documented.
- **Guardrail solver success probe:** `solveRiskBasedGuardrails` takes an optional
  `successProbe(balanceFrac, spendingMultiplier)` that replaces its Monte Carlo runs (a
  test seam; the default is unchanged). With it the band-edge thresholds and the
  suggested cut and raise now have a calculation record evidenced against an analytic
  success curve, and the census gains two families for them (the solved thresholds and
  the suggested monthly adjustment). The solver worksheet's lattice range is corrected
  to 1 through 1024.
- **Monte Carlo page shows the slider each model reads:** Return volatility for
  lognormal, Student-t, GARCH, Gaussian, AR(1), CAPE and user shock; Equity weight for
  the three historical modes, the stationary and empirical bootstraps and reversed
  history; neither for regime switching and inflation regimes. Before, only lognormal
  showed the volatility slider and every other model showed the equity slider, so
  Student-t and GARCH silently reused the last lognormal volatility. The historical
  stress windows now have their own stock-share control, shown whatever model is picked,
  since the model's equity weight is offered only for the models that read it.
- **Fixed: a value lost or shown under another row when two rows shared an
  id** (decision D-CASH-PROPERTY-ALIAS): the year's balances, and the
  property, debt and policy values behind them, keep one value per id. The
  plan checks accepted a cash account and a property under one id, so the
  property's value was published in place of the cash balance: cash $10,000
  and a $300,000 home under `home` showed $300,000 of cash in the ending
  balances by category, the balance-by-category chart and the estate
  breakdown's cash row, and so also moved the amount passing to charity and
  the after-tax estate when that cash account named a charity destination.
  They also accepted other pairs under one id, with three kinds of effect.
  Two rows of different kinds (a property and a debt, or an account and a
  permanent-life policy) kept both in the totals, but the year's published
  balances showed one in place of the other. Two rows of the same kind (two
  properties, two debts, two permanent-life policies) kept one value, so one
  of them dropped out of net worth. Two LTC policies counted their benefit
  years together, so a year one of them paid used up a year of the other.
  The checks now refuse every such pair with a message naming it, from the
  same reading of which rows collide that the repair uses (a property or a
  debt sharing an id with an investable account, other than one property
  with one cash account, was refused before only as a duplicate account id).
  A saved
  plan that has one is repaired when it opens: an investable account keeps
  the id, otherwise the first row does, and each other row gets a new id
  (`<id>-property`, `<id>-debt` or `<id>-policy`, numbered when taken). No
  other field in a plan can name a property, a debt or a policy, and every
  account reference could only have meant the investable account, so nothing
  else moves; a stored scenario's copy of a renamed row takes the same new
  id, found by the row's contents (for an edited copy, its name and type and
  then the closest contents) rather than its position, so a scenario that
  dropped, reordered or edited rows still names each one the way the plan
  does, and a pair found only in a scenario's own lists is
  repaired there. A scenario that would add a pair loading cannot repair is
  refused when applied, with a message saying the scenario introduces the
  shared id. The load notice (new repair kind
  `sharedIdSeparated`) tells the household. For such a plan the cash balance
  and cash totals drop to the cash actually held, each renamed row appears
  under its own entry, net worth counts both of two same-kind rows, and two
  LTC policies each pay their own benefit period; investable assets do not
  change. A pension or an annuity publishes no value under its id and may
  still share one with a property, a debt or another pension or annuity (not
  with an investable account, which stays refused as a duplicate account id),
  and an LTC policy may share one with an account or a permanent-life policy,
  since they keep no value in common.

- **Fixed: a false Roth-conversion warning** (decision
  D-ROTH-TARGET-WARNING): "Spending withdrawals from traditional accounts
  pushed income above the Roth-conversion target in some years." was raised
  whenever a fill-to-target conversion and a spending draw from a traditional
  account fell in the same year, without looking at income. It is now raised
  only when the year's final value of the measure the conversion was sized
  against (taxable income for a bracket top, MAGI for an IRMAA tier or a fixed
  MAGI, ACA MAGI for the credit cliff) ends more than a cent above the
  target. No figure changes; the warning disappears from projections that
  never went over, among them the bracket-fill example, whose taxable income
  ends $64,977.21, $43,471.24 and $61,127.60 under the target in 2027, 2028
  and 2029, and the example couple's report, whose two conversion years with
  a spending draw (2034 and 2035) end about $94,753 and $70,301 under it.

- **Changed: engine comments and dead members brought in line with the code**
  (decisions D-PREMIUM-END-AGE, D-GOAL-FLEXIBILITY,
  D-ADJUSTMENT-ROUNDING-REASON, D-DEAD-EXPORT): the `premiumMode` comment now
  says an until-age policy is charged in the years before the insured (or
  the LTC owner) reaches the stop age; the `GoalFlexibility` comment now says
  a movable or skippable goal still unfunded at its latest year is recorded
  as skipped and counted in the unfunded layer totals, as the scheduler
  always did; the never-used `rounding` reason is removed from optimizer
  schedule adjustments; and the uncalled `nonCashWeight` export is deleted.
  No displayed number changes.

- **Fixed: inherited Roth earnings counted twice in the withdrawal categories**
  (decision D-INHERITED-ROTH-SLICE): in a year with a non-qualified inherited
  Roth distribution, its taxable earnings were added to the traditional
  withdrawal category as well as to Roth, so cash + taxable + traditional +
  Roth + HSA exceeded the year's total withdrawals by that amount. The
  traditional category now carries only dollars withdrawn from traditional
  accounts, and the five categories add to the total in every year. Displayed
  numbers that change, and only in such a year: the year's traditional
  withdrawals (and the lifetime traditional-withdrawal sum on scenario
  comparisons) drop by the Roth earnings. Taxes do not change: those earnings
  are still ordinary income under IRC 408A(d), and the inherited
  ordinary-income figure (`inheritedTraditionalDistribution`) keeps them, as
  its comment now says. The optimizer's bracket-fill windows read the year's
  spending draw from traditional accounts net of the dollars that actually
  moved out of inherited traditional accounts (a spousal election year
  included, where an inherited account's published row can show an amount
  that did not move), so the candidates it offers do not change either.
  Those movements come from the year's `retirementRuntimeSource`, which
  `simulatePlan` always publishes. For a baseline year built elsewhere
  without it, the forced amount is read only where the published figures fix
  it: nothing when no inherited distribution moved, otherwise the inherited
  traditional rows' executed amounts when every row's executed amount adds
  up to `inheritedDistribution`; a year they cannot fix counts as having no
  spending draw, rather than being read from the ordinary-income figure.

- **Fixed: 0% capital-gains room when income is below the deduction**
  (decision D-ZERO-RATE-HEADROOM): the search for the room stopped at the 15%
  threshold, so a year whose ordinary income (with gains, qualified dividends
  and the taxable Social Security they bring) was below the deduction showed
  the threshold alone. It now adds the unused deduction, as IRC 1(h)(1)(B) and
  63 give it. The year's `ltcgZeroHeadroom` and the tax-opportunity view's
  gain-harvesting room move up in those years only: single, 2026, no Social
  Security, $10,000 of ordinary income shows $55,550 instead of $49,450, and
  $0 shows $65,550 instead of $49,450. Years whose income already covers the
  deduction are unchanged to the last bit, except the boundary where income
  (with the benefit it makes taxable) exactly equals the deduction: that year
  now shows the threshold itself ($49,450 single) rather than about $49,449.99.
- **Social Security survivor benefits follow the statute when a worker dies before
  claiming (displayed numbers change).** The survivor of a worker who died without
  having claimed was paid nothing from the worker's record until the year the worker
  would have reached the claim age entered in the plan, and was then priced at that age
  (credits the worker never earned, or an early reduction for a claim never made). The
  survivor is now paid from the year after the death (or from the survivor's own
  entered claim age, if later), on the PIA plus the delayed credits earned up to the
  month before death, with no early reduction and no widow's limit (42 U.S.C. 402(e)(1),
  (e)(2)(A) to (D), 402(w)(2)(A); 20 CFR 404.313(e)(1)). Example: worker PIA $2,000,
  planned claim at 70, dies at 64; survivor past her survivor FRA with her own $600.
  Before: $600 a month for five years, then $2,480. Now: $2,000 a month from the year
  after the death. A death before 62 still uses the PIA as entered, stated as a limit.
- **Delayed retirement credits use the rate for the date of birth.** Every credit was
  2/3 of 1 percent a month; 20 CFR 404.313(b)(2) gives less for births on or before
  January 1, 1943 (5/8 of 1 percent for 1941 and 1942, down to 1/12 of 1 percent).
  Only someone born before 1943 whose benefit is priced from a delay past full
  retirement age sees a change: a 1941 birth claiming at 70 gets 132.5 percent of PIA,
  not 134.7 percent.
- **Survivor full retirement age follows 416(l) for every cohort (displayed numbers
  change for early survivor claims).** The survivor table now is the retirement
  schedule two birth years later: 65y2m to 65y10m for 1940 to 1944, 66 for 1945 to
  1956, 66y2m to 66y10m for 1957 to 1961, and 67 from 1962. It had run six birth years
  late for 1940 to 1950 and stopped at 66y8m from 1960, so an early survivor claim in
  those cohorts was reduced slightly less than the law requires.
- **Claim-age optimizer: the "FRA" candidate is the person's own full retirement age.**
  The middle of the three canonical claim ages was 67 for everyone and labelled FRA.
  It now follows the effective birth year (a January 1 birth counts in the prior year),
  as 416(l) gives it: 66 and 2 to 10 months for 1955 to 1959 (so a January 1, 1960
  birth gets 66 and 10 months), 66 for 1943 to 1954, and 65 and 2 to 10 months for 1938
  to 1942. From an effective birth year of 1960 nothing changes.

- **Bundle budget aggregate rows:** raised `all JS` 4400 → 4800 KiB and
  PWA precache 4550 → 4900 KiB. Azure `build` on head `03bb93cc` measured
  4431.7 and 4579.6 KiB; the previous ~30–46 KiB of slack was tripping every
  unrelated PR. Same `bundleBudget.mjs` gate; no new mechanism.

- **PIA earnings helper unused `missing_awi` error code:** removed the never-emitted
  `missing_awi` member from `PiaFromEarningsErrorCode`. Unpublished AWI and bend-point
  years still use the latest published SSA tables and set `usesStandInForFutureTables`;
  that stand-in is a planning convention, not a filing-grade refusal. No PIA dollar
  change.

- **Production build: funding tolerance read as `undefined` (Results page, main thread):**
  the app graph's explicit-only chunk for `annualFundingApplicationAndClosePhase.ts` sat in
  a static import cycle with the `useProjection` core chunk, so its module-level alias of
  `ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS` evaluated before the core had run and read
  `undefined` (Rolldown emits top-level `const` as `var`). Every comparison against it was
  false in the deployed app only: one "Tax and withdrawal funding could not reconcile within
  half a cent … differs by $0.00" note per plan year, ACA years funded at gross premium, the
  coordinated HECM draw always 0, and `depletionYear` never set — a depleting plan still read
  "Your money lasts the full plan" while Monte Carlo (worker graph) reported 0%. Unit tests
  and the dev-server e2e never load the production chunk graph and stayed green. Fixed by
  giving both graphs the same `codeSplitting` group list (no explicit-only coordinator chunks;
  `useProjection` row 640 → 700 KiB for the folded 31 KiB), reading the tolerance at call time
  in the funding phase, failing the bundle budget on any static import cycle among
  `dist/assets` chunks (`staticImportCycles`), and adding `app/e2e-dist` — Playwright against
  `vite preview` of the built `dist` (`pnpm test:e2e:dist`, in the `build` CI job) that
  requires neither spurious note on the example couple and a reported depletion year once its
  spending exceeds what the plan can fund. Present in production since #587 (2026-09-02).

- **Louisiana TY2026 standard deduction:** corrected `states.LA.standardDeduction` to
  $12,875 single and $25,750 MFJ per La. R.S. 47:294 CPI-U indexing and LDR 2026 Form
  IT-540ESi (`la-ldr-it540es-2026-standard-deduction`). Retirement cap CPI indexing,
  unsupported filing statuses, exemptions, credits, and whole-return accuracy remain
  outside this correction. Before → after on representative fixtures: single base
  $12,875 tax $11.25 → $0; MFJ base $25,750 tax $22.50 → $0; single $100,000 tax
  $2,625 → $2,613.75; MFJ $100,000 tax $2,250 → $2,227.50.

- **Oregon TY2026 rate schedule and standard deduction:** corrected `states.OR`
  standard deduction to $2,910/$5,820 and indexed bracket lowerBounds to single
  $4,550/$11,400 and joint $9,100/$22,800 per LRO Report #1-26
  (`or-lro-2026-rate-schedule-and-standard-deduction`). The engine composes continuous
  marginal rates and does not replicate LRO printed whole-dollar base taxes; HOH,
  age/blind additions, exemption credits, and whole-return accuracy remain outside this
  correction. Before → after on representative fixtures: single $100,000 tax
  $8,216.9375 → $8,176.375; MFJ $100,000 tax $7,683.875 → $7,602.75.
  In the bundled Oregon Barista FIRE example, the observed long-horizon comparison
  increases ending investable assets/net worth by $46,584 and after-tax estate by
  $41,124. Nominal lifetime taxes and penalties increase by $2,765 alongside the
  larger ending balances; that aggregate includes federal tax and is not a
  fixed-income Oregon tax comparison.

- **Surviving-divorced Social Security duration:** added additive
  `FormerSpouse.relationship: surviving-divorced` with a ten-year
  marriage-before-divorce gate on the non-disabled age-60 survivor path
  (`cfr-20-404-336-surviving-divorced-spouse-eligibility`). Legacy saved plans
  that still use `relationship: deceased` keep the ordinary-widow nine-month
  duration unchanged. The planner UI now labels deceased spouse and deceased
  divorced ex separately and exposes the new relationship option.

- **Maine TY2026 pension cap:** corrected `states.ME.retirement.capPerPerson` from
  $48,216 to $49,824 per MRS July 2026 Form 1040ES-ME instructions
  (`me-mrs-36-5122-2-m2-m3-2026-pension-deduction`). Gross Social Security and
  Railroad Retirement offset, military separation, plan qualification, and M-3
  federal-AGI phaseout remain outside this correction.

- **Owned-IRA post-candidate contribution deadline:** the post-candidate
  classification builder now refuses evidenced ordinary deadlines that are
  canonical but not the exact `ordinaryFederalFilingDeadline` date for the tax
  year (for example, 2031-04-18 for tax year 2030). The exact 2031-04-15 case
  still builds. Filing-evidence and persistence paths already enforced exact
  equality; this aligns the post-candidate enforcer.

- **Ohio TY2026 nonbusiness tax base:** corrected gross nonbusiness tax above
  $26,050 by restoring the enacted §5747.02(A)(3)(c) $332 cumulative base before
  credits on the same individual schedule for supported single and MFJ filing
  statuses (`oh-rev-code-5747-02-a-3-c-2026-nonbusiness-rate-schedule`).
  Exemptions, retirement and senior credits, business income, municipal tax, and
  whole-return accuracy remain outside this correction. The conflicting official
  2026 IT 1040 ES worksheet table is disclosed but not followed.

- **MFJ IRA spousal compensation ceiling:** corrected the living MFJ IRA pass so equal and higher
  earners cannot exceed their own wages under IRC 219(b)(1) while the strictly lesser spouse may
  still use section 219(c) combined-compensation room; the shared household pool still conserves total
  compensation. Confirmed before/after on representative fixtures: equal $5,000 wages each moves from
  $7,500/$2,500 to $5,000/$5,000; $6,000/$4,000 with the higher earner processed first moves from
  $7,500/$2,500 to $6,000/$4,000; $10,000/$0 earner-first and the reversed lower-first
  $2,500/$7,500 case are unchanged.

- **Planner-worker TDZ (#672):** the planner Web Worker no longer isolates
  the funding/year-close and owned-IRA settlement coordinators as their own
  chunks. Those isolated chunks imported the worker entry (a circular ES module
  graph); production then crashed on first spawn with
  `Cannot access 'oe' before initialization`. The same worker serves Monte Carlo
  and both Optimize-rail tools, so the crash showed as "Simulation error" on
  Monte Carlo, "Solver error" on How much can I spend?, and "Optimizer error"
  on Roth & Tax Optimizer, where Download recommendation report stayed disabled
  after retry (no held result). Kernels and publications stay split. The
  bundle-budget gate now fails if any other chunk statically imports the
  worker entry, matching that entry by basename so `/assets/`, `../`,
  nested, and query-string specifiers cannot fail open.
- **California and Minnesota 2026 parameter corrections:**
  aligned the 2026 state pack with primary sources for California's Form 540-ES
  estimated-tax worksheet standard deduction ($5,706 / $11,412;
  `ca-ftb-2026-540-es-standard-deduction`) and Minnesota DOR TY2026 single/MFJ
  deduction ($15,300 / $30,600) and whole-dollar rate bands
  (`mn-dor-2026-rate-schedule-and-standard-deduction`). California retains 2025
  Schedule X/Y bracket arrays unchanged; FTB directs the tax table through
  $100,000 while the engine uses continuous schedules at lower incomes — that
  behavior is disclosed but is not an FTB table oracle. Minnesota §290.0132
  subd. 26 Social Security subtraction evidence was corrected
  (`mn-stat-290-0132-subd-26-social-security-inclusion`); indexed simplified
  thresholds versus unindexed alternate maxima are source-discriminated, but
  runtime subtraction remains unimplemented and approximated. Before → after on
  representative fixtures: CA single/MFJ $20,000 / $40,000 ordinary taxable
  income $14,460 / $28,920 → $14,294 / $28,588; CA Schedule X/Y bracket arrays
  unchanged but fixed-income output at taxable $100,001 moves with the deduction:
  single $105,707 ordinary tax $5,754.169 → $5,738.731; MFJ $111,413 ordinary
  tax $3,089.76 → $3,069.84; MN single $50,000 ordinary tax $1,949.395 →
  $1,876.605; MN MFJ $80,600 ordinary tax $2,826.815 → $2,693.85; MN SS FAGI
  $84,000 / $90,000 produced tax $4,261.395 / $4,669.395 → $4,188.605 /
  $4,596.605 (taxable $68,700 / $74,700) while accepted post-subtraction
  counterfactuals remain $1,876.605 / $2,515.805. Observed case impact: 22
  metrics across 5 California example plans show lower lifetime taxes ($104–$790)
  and higher terminal wealth; no default Minnesota case is represented
  ([`DOCS/operations/ca-mn-parameter-correction-2026-09-08.md`](DOCS/operations/ca-mn-parameter-correction-2026-09-08.md)).
  Calendar-year records expire after 2026;
  later plan years may reuse the 2026 pack as a planning stand-in. No whole-return,
  credit, itemization, or MN SS runtime closure claim.
- **QLAC purchase candidate owner age:** `annuityPurchaseGenerator` now gates and sizes the QLAC candidate from the selected traditional account owner's age for its product-policy younger-than-83 gate and preferred start ages 80–83, not the primary household member. Treas. Reg. 1.408-8(a)(3) governs IRA-owner substitution for the legal QLAC commencement deadline; it does not supply the <83 gate. A primary age 84 / spouse-owner age 82 household now emits the candidate at start age 83 (restored under the younger-owner rule); a primary age 82 / older-owner household loses the candidate when the owner's age crosses the gate. When the selected traditional account's owner does not resolve in the household, the generator suppresses the QLAC candidate rather than substituting the primary — a fail-closed boundary on raw generator input, not a new stored-plan regression.
- Corrected one guarded ordinary simultaneous early current-spouse Social Security shape to combine the claimant's reduced own benefit with the separately reduced positive excess of half the worker PIA over the claimant PIA. The admitted 1964-01-02 pair claiming at 62 changes from $15,600 to $16,080 in the full 2027 row. A claimant's original claim age, strict unclamped DOB-plus-claim-age dates, one non-disabled stream per person, the MFJ/two-person proxy, and worker-start-no-later ordering bound the correction. Delayed-own, later-worker staggered, disability, multiple-stream, and unavailable historical-entitlement cases retain the disclosed legacy behavior.
- Repaired first-distribution-calendar-year §4974 timing in
  `annualOwnerRmdPlan`: the default path still attempts payment in the
  attainment year, but any unpaid remainder is carried with a bounded
  `distributedBeforeDueYear` credit and priced in the calendar year containing
  April 1, not in the attainment year. A fully funded default first year keeps
  the same dollars but no longer publishes an attainment-year `noShortfall`
  excise-detail row. Generic §4974 rate/relief fixtures retarget to a 1952 owner
  (age 74, divisor 25.5) so December 31 deadline years stay separate from the
  first-year rule vector. Default first-year misses now publish
  `rmdShortfallObligationId(ownedIras, 2026, 2027)` — the two-argument
  `…(ownedIras, 2026)` form keys `:tax-2026` and no longer matches; callers
  should use the published obligation id or pass the explicit deadline tax year.

- **Direct NIIT and senior foreign-addback split:** `computeFederalTax` now accepts an optional narrow `niitSection911A1NetAddback` for the §1411(d) threshold leg while retaining `foreignExclusionAddback` for §86 provisional income and §151 senior-deduction MAGI; the result exposes `niitMagi` separately. Omitting the narrow value preserves the prior broad-value compatibility fallback; an explicit zero is retained. Direct Roth-conversion tax sizing carries both values into calculator calls. Annual projection resolution and receipts, recommendation/action readiness, the IRMAA foreign-addback omission, and statutory eligibility/allocation determinations remain unchanged.
- **SSDI freeze evidence correction:** replaced a retirement-index proxy that had been labeled as the statutory disability-freeze oracle with a conditional 2019 disability AIME worksheet, separated the unchanged 2026 engine result into characterization coverage, and clarified that `disability.onsetAge` does not establish DIB eligibility facts. Calculator output is unchanged; disability-aware AIME remains unimplemented.
- **Ground-truth dashboard follow-up:** corrected the annual re-verification cadence for Maine's indexed standard deduction and phase-out, registered Delaware's still-unfixed 2026 QSS standard-deduction mapping as an approximation, and scoped the settled NIIT lesser-of record to supplied NII and MAGI inputs. Calculator output is unchanged.
- Reclassified `irc-1411-d-modified-agi-foreign-exclusion-addback` from
  `settled` to `approximated` / `overstatesTax` for the disclosed extra-housing
  NIIT MAGI case: IRC 1411(d) and 151(d)(5)(C)(iii)(II) define different
  foreign addbacks, but `computeFederalTax` still reuses one
  `foreignExclusionAddback`. Runtime algorithm, schema, and public API are
  unchanged; separate MAGI modeling remains open. Fixture and nearby docs /
  comments updated to match. Corrected `projection/internal/types/tax.ts`
  attestation from `rule-free` to `partial`: `taxParameterFilingStatus` enforces
  QSS-to-MFJ parameter selection without a direct rule pin or discriminating
  registered fixture (the prior `rule-free` status was incorrect).
- **Delaware standard deduction (2026 pack):** corrected the DE row from erroneous
  unenacted HB 89 figures ($5,700 / $11,400) to operative § 1108 basic amounts
  ($3,250 / $6,500) with a fixed $2,500 per-person age-65 addition. Observed
  direction on the repaired enforcer: below-65 single and MFJ households can see
  higher Delaware tax from a smaller deduction; age-65 single moves from a
  $5,700 to a $5,750 deduction and MFJ with two age-65 filers from $11,400 to
  $11,500, which can lower tax. No whole-return accuracy claim; QSS mapping,
  blindness, and other Delaware limbs outside the deduction repair remain
  approximated or unmodeled.
- **Four-state 2026 parameter corrections (DE, HI, RI, UT):** aligned the 2026
  state pack with primary sources for Delaware's §1102(a)(14) 5.55% band
  ($25,000–$60,000), Hawaii's §235-2.4(a)(2)(F) standard deduction ($8,000 /
  $16,000 for tax years beginning after 2025 through 2027), Rhode Island ADV
  2025-22 TY2026 deduction ($11,200 / $22,400) and uniform schedule thresholds
  ($82,050 / $186,450), and Utah enrolled S.B. 60 / §59-10-104 flat rate
  (4.45%). Changes modeled subtotals only; no whole-return, credit, pension, or
  QSS closure claim. Primary worksheets and engine output agree on representative
  fixtures: DE $33,250/$36,500 ordinary income → tax 1,276 → 1,278.50; HI
  $10,000/$20,000 income → tax 78.40/156.80 → 28/56; RI $220,000 income
  single/MFJ → tax 9,473.63/8,820.72 → 9,374.64/8,703.76; UT $20,000 income →
  tax 900 → 890. Residual scope unchanged: HI employer-pension distinction,
  RI income-tested SS/retirement modifications, Utah §59-10-1042 Social Security
  credit and other credits, and unsupported filing statuses remain unmodeled or
  approximated.
- **Maine 2026 standard deduction — age-65 addition and §5124-C(2) phase-out.** Reason: for tax
  years beginning 2026, 36 M.R.S. §5124-C(1-B) keeps Maine’s published basic
  ($15,700 / $31,400) and adopts the IRC §63(c)(3)/§63(f)(1) age additional
  amount; the pack had omitted the age addition unless whole-federal basic
  conformity was also tagged, and the combined basic-plus-age total was not
  subject to the §5124-C(2) proportional phase-out. Result: Maine keeps the
  published basic, attaches the federal age-65 addition without whole-federal
  basic tagging, and phases out the combined total above the published starts
  using a modeled Maine-AGI proxy. Legally settled components: basic plus age
  (`mrs-36-5124-c-1-b-decoupled-standard-deduction`) and the narrow phase-out
  formula (`mrs-36-5124-c-2-standard-deduction-phaseout`) for single and
  married statuses the engine models — age-only, not blindness or HOH. Residual:
  personal exemption, blindness, incomplete §5122 AGI, and part-year month
  approximation remain unmodeled; no net Form 1040ME tax direction is asserted.
  Independent modeled example (single age 65, $139,750 wages): allowed standard
  deduction $8,875, modeled state tax $8,837.8625 (pack taxable-income component
  only). Evidence: discriminating fixtures and goldens updated; example-case
  impact counts deferred to maintainer verification.
- **Corrected West Virginia 2026 personal income tax rates** to W. Va. Code
  §11-21-4j(a)/(e) (SB 392; signed 2026-03-31, effective 2026-06-12, retroactive
  to 2026-01-01): **2.11% / 2.81% / 3.16% / 4.22% / 4.58%** at shared
  **$0 / $10,000 / $25,000 / $40,000 / $60,000** bounds for single and MFJ.
  Prior pack still carried §11-21-4i rates (2.22%–4.82%). Modeled taxable-base
  examples: $10,000 → $211 (−$11 vs $222); $100,000 → $3,782.50 (−$199 vs
  $3,981.50). No deduction, exemption, or retirement-bucket changes. Full IT-140
  not certified (personal exemptions and senior any-income/disability/pension
  subtypes remain unmodeled). The sole state pack also stands in outside 2026
  under the existing fallback; statutory authority is 2026+.
- **Corrected Michigan 2026 ordinary retirement deduction cap** from the stale
  2025 phase-in amount **$49,423** to the current ordinary combined qualifying
  ceiling **$67,610** single/MFS (**$135,220** MFJ) under MCL 206.30(10)(d),
  Treasury RAB 2026-1, and 2026 Withholding Guide 446. Pack remains one shared
  capped rule with no age gate and no public/private split. Observed modeled
  single $60,000 qualifying private-pension case: state tax **$449.5225 → $0**
  (−$449.5225 = 4.25% × (60,000 − 49,423)). No other state’s intended pack
  cells change. Because the sole pack also stands in for historical and future
  projected years, those modeled stand-in years move with the correction; coarse
  qualification / election / pre-1946-public / return-ceiling residuals remain.
  An all-state regression comparison found **2,448** observations compared and
  **36** tax deltas, all in **MI**. Long-horizon example cases *Starting from
  zero (no head start)* and *Trump account IRA head start* each show modeled
  lifetime taxes and penalties **−$13,913** and ending investable / net worth /
  after-tax estate **+$18,641** (rounded); no other cases change. These are
  observed modeled long-horizon deltas, not independent statutory oracles.
- Prepared **`@retiregolden/engine` 0.3.1** — a **patch** bump exporting the
  shared `passesModeledOrdinaryWidowRecordGates` helper so modeled ordinary
  widow record gates are not duplicated across callers. **Never published**: it is folded
  into 0.4.0 (the entry at the top of this section).
- **The planner-ui range moves to `^0.3.1`**, same coordinated-floor pattern as
  the 0.3.0 entry in **2026-09-04** — `@retiregolden/planner-ui` now declares
  `^0.3.1`. Its own version is not bumped here. The new floor stops packaged
  UI from resolving engine 0.3.0, which never exported that helper. Pack
  smoke's `auto` mode still detects the minimum is not on npm, asserts the
  local engine version equals the declared minimum, and packs the exact local
  unpublished minimum.
- **Downstream to coordinate:** publish engine 0.3.1 to npm before any
  planner-ui release that depends on it. Neither package is published by this
  change.

**`@retiregolden/engine` boundary notes, relocated from the package README**

These describe the shape of five `actions/` and `projection/` boundaries as
they were built out. They had accumulated under "Runtime contract" on
[packages/engine/README.md](packages/engine/README.md) — the npm landing page —
where roughly sixty lines of implementation narrative sat above Usage and
buried the actual contract (ESM/Node, purity and the injection seams,
determinism, the optional cash-flow capture, versioned parameter packs).
Recorded verbatim so nothing is lost.

Moving them changes what the README emphasizes, not what the package
publishes: every function named below is exported from `actions/index.ts` and
so is reachable on the `@retiregolden/engine/actions` subpath, and several are
also reachable on their own `actions/<module>` subpath, which
`packages/engine/scripts/pack-smoke.mjs` asserts on every pack. What these
notes are is build-out narrative — how each boundary came to have the shape it
has — rather than the runtime contract a consumer needs on the landing page.

- The owned-IRA penalty prerequisite can accept raw annual SEPP schedule routes,
  rebuild each route's complete inventory from canonical annual character, and
  issue final `iraSeppQualified` zero-penalty decisions only after complete
  reconciliation and exact payment rejoin. Non-success routes remain pending
  and supply no negative-SEPP authority. The pure annual finalizer and
  movement-candidate coordinator now forward these raw routes, accept the
  final qualified outcome, preserve detailed route diagnostics when blocked,
  and bind compact canonical route results into annual evidence. Their public
  staged-date ID builder reproduces planning evidence only; exact coordinator
  rejoin remains the authority, and neither boundary commits movement or
  establishes actionability.
- `coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate` adds
  Plan-identity-authoritative, runtime-snapshot-bound planning evidence around
  that coordinator. It derives the complete Plan owner/year ordinary-withdrawal
  batch and owned non-Roth IRA pool, then requires complete, consistently dated
  opening, year-end, annual basis/line-7, line-8, and exact alive evidence. It
  remains pure and noncommitting: every result keeps movement uncommitted and
  actionability unestablished.
- `buildAnnualRetirementPhysicalEventInventory` is the pure chronology boundary
  in front of future simulator integration. It derives traditional-account Plan
  action allocations internally and exact-rejoins a complete Plan/year/ledger-run
  runtime inventory covering RMD, automatic SEPP, legacy withdrawal/conversion,
  in-year IRA/employer-plan account-balance contribution inflows and employer
  match. Aggregate legacy QCD reclassification, annuity funding, rollover
  inflows, and other traditional transfers stay unresolved until their producer
  and physical endpoints have a typed binding contract. Following-year IRA
  contributions designated for the prior tax year
  remain separate annual-basis facts, not events in this calendar-year chronology.
  A resolved contribution record is the upstream ledger's post-owner-wide-limit
  occurrence, not a contribution candidate; fully suppressed contributions are
  intentionally absent under the complete runtime attestation. The inventory
  checks Plan-local source prerequisites without duplicating shared-limit or
  section 415(c) math. A shared movement authority may cover multiple source
  members only when their owner, kind, origin, date, and sequence agree; upstream
  evidence remains unique per member. It never invents a missing owner, source,
  date, or order: incomplete records and cross-authority chronology conflicts
  fail closed. Successful output
  is a globally ordered immutable stream with owned-IRA pool views and provisional
  Form 8606/QCD categories; it still mutates no balance or basis, calculates no tax
  or penalty, and establishes neither movement nor actionability.
- `buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput` is the next
  pure evidence boundary for the standalone-compatible Plan-owned IRA batch. It
  exact-rejoins the canonical candidate, complete December 31 owner pool, basis,
  and contribution-window evidence into a frozen classifier input without
  classifying, executing, or integrating with projection.
- `preparePlanOwnedNonRothIraAnnualCandidateTransaction` is the pure provisional
  producer for that batch. It rebuilds the annual physical-event inventory,
  derives the exact Plan-owned action/source batch, and stages it against
  caller-supplied exact-cent balances. Its frozen applications and source
  transitions apply only to a detached snapshot: movement and actionability
  remain unestablished, and it publishes no December 31, tax, penalty, basis,
  or finalization claim.

### Breaking (published `@retiregolden/engine` API)

- **Freeze additions (B2-P1 under D-UI-SS), engine and planner-ui:** `MonteCarloSummary`
  (`@retiregolden/engine/montecarlo/run`) gains the required fields `lastingPathCount` and
  `medianFirstDepletionYear` (`number | null`), so a host that constructs a summary must set
  both. planner-ui's `HouseholdGraphTotals` is removed: `HouseholdGraph.totals`
  (`@retiregolden/planner-ui/householdMap/householdGraph`) is now the engine's
  `EnteredBalanceSheet` (`@retiregolden/engine/model/enteredBalanceSheet`; the same five
  fields, read-only), `HouseholdGraph` gains the required `accountNodes`, and
  `sumEnteredTotals` is replaced by `enteredTotalsOfNodes(graph, nodeIds)`.
- **Rollover (decision D-2027-ROLLOVER), planner-ui:** `projectPlan`, `useProjection`,
  `headlineMcRunOptions`, `piaAsOfPlan`, `claimingPeople` and `warningFor` require the start
  year; there is no clock default. Pass `projectionStartYear(plan)` (exported from
  `projection.ts`). `headlineMcRunOptions` also requires its path count, which had defaulted to
  `DEFAULT_PATH_COUNT`. `useMcHeadline` takes the start year and reads a run published from
  another year as none. `SurvivalPercentileModal` takes `startYear`.
- **Rollover (decision D-2027-ROLLOVER), engine:** `parsePlan` no longer refuses an elected
  pension lump sum whose election year is before the save stamp's year, nor one on a document
  whose stamp cannot be read, and `migratePlanToCurrent` no longer drops either election (the
  `lumpSumElectionDroppedElectionYearPassed` and `lumpSumElectionDroppedUnreadableSaveDate` repair
  kinds stay in the union and are no longer produced). A host that saves must run
  `asOfIssues(plan, startYear)`, as planner-ui's `checkPlanForSave(plan, now, { asOfYear })` does.
  `PackLookup` gains `components`; `packForYear` returns a cached, frozen lookup.
- **Life table (decision D-LIFE-TABLE-2023):** the subpath
  `@retiregolden/engine/longevity/ssaPeriod2022` is renamed
  `@retiregolden/engine/longevity/ssaPeriodLifeTable`, and its `MALE` and `FEMALE` life
  expectancy arrays are replaced by `SSA_PERIOD_LIFE_TABLE` (`{ source, male: { q, e },
  female: { q, e } }`, SSA's 2023 period table) with `LAST_TABLE_AGE`,
  `CURRENT_LIFE_TABLE_EDITION`, `LIFE_TABLE_EDITION_BEFORE_THE_FIELD`,
  `storedLifeTableEdition`, `isCurrentLifeTableEdition`, `KNOWN_LIFE_TABLE_EDITIONS`,
  `knownLifeTableEdition`, `CURVE_EXPECTANCY_GAP` and the types `KnownLifeTableEdition`,
  `PeriodLifeTable`, `PeriodLifeTableColumns` and `PeriodLifeTableSource`;
  `baselineRemainingYears` keeps its signature and reads the 2023 life expectancies.
  `montecarlo/mortality#annualMortality` no longer accepts 'average': it takes the new
  `TableSex` ('male' | 'female') and throws a `RangeError` for anything else, since
  'average' has no single death probability (read `montecarlo/survival#survivalCurve`).
  `SurvivalCurve` gains `deathProbabilityGivenAlive`. `longevity/types` gains
  `LifeTableEdition` and the optional `LongevityResult.tableEdition`, and the plan
  schema's `longevity.percentile` the optional `tableEdition`. planner-ui (published
  source): `longevity/constants` gains `lifeTableCitation` (over the known editions only),
  `lifeTableName`, `storedLifeTablePhrase`, `curveExpectancyGapText`,
  `UNRECOGNIZED_LIFE_TABLE_EDITION` and `LifeTableCitation`, `longevity/storage` gains
  `questionnairePlanningAge`, `planner/assumptionsExport#buildAssumptionsSnapshot` takes
  an optional third argument, the saved questionnaire results by person slot
  (`SavedQuestionnaireAge`), and `BASELINE_CITATION` is built from the engine's source
  record. RetireGolden-Pro and RetireGolden-MCP import none of the renamed or narrowed
  exports. The one-year death probability lives in the new leaf module
  `montecarlo/deathProbability` (`annualMortality`, `MAX_AGE`, `Sex`, `TableSex`), which
  `montecarlo/mortality` re-exports, so the mortality and survival modules no longer
  import each other. A non-finite age (NaN, +Infinity or -Infinity) now throws a
  `RangeError` in `sampleDeathAge`, `jointLastSurvivorExpectancy` (for either life) and
  `hazardForExpectancyMultiplier` (for every multiplier, 1 included), where each returned
  a number: `sampleDeathAge` 119 for NaN or +Infinity and a draw from age 0 for -Infinity;
  `jointLastSurvivorExpectancy` NaN, the other life's expectancy for +Infinity and 120.5
  for -Infinity; `hazardForExpectancyMultiplier` about 0.2 for NaN, 0.2 or 8 for +Infinity
  and the power at age 0 for -Infinity. No caller passes such an age (ages come from whole
  birth years), so no figure moves. The source record's `archive` loses `sha256`, and
  `PARAMETER_PROVENANCE` gains the ids `ssa-life-table` and `ssa-life-table-2022`.

- **Claim-age searches and the survivor analysis (B2-P1 slice 5):** new modules
  `decisions/claimAgeSweep` (`sweepClaimAges`, `refineClaimAgeMonthly`, `refineClaimMonths`,
  `claimAgeSweepVerdict`, `unpricedAcaYears` and their types, also exported from
  `decisions`), `socialSecurity/openClaims` (`openClaims`, `isClaimAlreadyMade`,
  `claimYearOf`, `claimAgeStreams`, `gridClaimAges`, `earliestOpenClaimAge`) and
  `projection/survivorTransition` (`survivorTransitionAnalysis`, `isDegenerateTiming`,
  `candidateDeathAges`, `conversionLeverPatch`, `leverYears`, `ssa44PremiumDifference`,
  `survivorShortfallYearCount`, `withSurvivorSsa44`, `SURVIVOR_DEATH_AGES`,
  `SURVIVOR_LEVER_BRACKET_PCT`). `socialSecurityClaimGridGenerator` emits candidates only
  for claims not already made and not a disability benefit from onset (none when no such
  claim is left, and no longer 70 alone for someone past every grid age) and patches the
  claims by stream;
  `socialSecurityClaimGenerator` skips a claim already made and any canonical age whose
  claim year is before the start year. `ClaimAgeCoOptimization` gains the required
  `outcome`, `unpricedAca` and `alreadyClaimed`, and `optimizePlanCoOptimizingClaimAge`
  prices no candidate when every claim is made or the plan has an unpriced credit year.
  `BenefitsOnlyRanking` gains the required `alreadyClaimed`, and its `personIds` and each
  row's `claimByPersonId` now name only the open claims. `SimulateOptions` gains
  `additionalBracketFill` (a malformed one throws a `RangeError`), `ProjectionResult` the
  optional `additionalBracketFill` rows (`AdditionalBracketFillYear`).
  `ExactDecisionEvaluation` gains the optional `diagnosticCauses`, and a diagnostic
  evaluation's constraint violation now reads "diagnostic-only evaluation: <the causes>".
  `decisions/objectives` exports `hasSurvivorYears`, `rankedMetricBasis` and
  `RankedMetricBasis` (`'objective' | 'estate-fallback-plan' | 'estate-fallback-row'`).
  `decisions/generators` exports `claimAgeGridClaims`, and the grid holds a disability
  benefit from its onset; a ranked `ClaimAgeSweep` publishes those claims in
  `disabilityPersonIds`. `ClaimAgeCoOptimizationOutcome` gains `'no-age-left'`.
  `AdditionalBracketFillYear` gains the required `fillNotes` and `ledgerNotes`, its
  sizing half is the new `AdditionalBracketFillTarget`, and `SurvivorConversionLever`
  gains the required `years` (`SurvivorLeverYear`, `SurvivorLeverYearReason`). The rule `usc-42-402-worker-claim-window-62-to-70` now pins
  `socialSecurity/openClaims.ts#gridClaimAges` (`decisions/generators.ts#SS_GRID_CLAIM_AGES`
  is gone). planner-ui (published source): `planner/survivorAnalysis` is deleted (its
  `buildSurvivorAnalysis` is the engine's `survivorTransitionAnalysis`, whose rows carry a
  non-null `conversionLever` with `raisedYears` and `coveredYears`, `endYear`,
  `ssa44ReliefYearSavings`, and facts with `requiredShortfall` for `shortfall`);
  `planner/ssAnalysis` loses `sweepClaimingStrategies`, `refineClaimingMonthly`,
  `planWithClaimAgesMonthly`, `objectiveIsFlat`, `sweepVerdict`, `SweepVerdict`,
  `SweepRow`, `SweepResult`, `MonthlyClaim` and `MonthlyRefinement`; `planner/acaVetoCopy` gains
  `unpricedCreditYearsText`, `claimAgeUnpricedCreditReason` and `UnpricedCreditYear`, and
  the new `planner/claimAgeCopy` holds the already-claimed sentences and the Optimize
  card's claim-age refusal (`claimAgeSearchRefusal`, `claimAgeHeldText`). The report
  model's `ReportClaimAgeEvidence` gains the optional `outcome`, `unpricedAca`
  (`ReportUnpricedCreditYear`) and `alreadyClaimed` (`ReportAlreadyClaimed`, with the
  person's name), optional so a version-3 model saved before them still renders as a
  search that ran, and `reportEvidenceFromOptimizeResult` takes the plan's people to name
  the held claims.

- **Social Security analysis (B2-P1 slice 4):** the parameter field
  `socialSecurity.oasdiEmployeeRatePct` is removed from `ParameterPack` and the 2026
  parameters (its one reader, the planner's paid-in panel, reads the rate table
  `@retiregolden/engine/socialSecurity/oasdiTaxRates` now). `PiaFromEarningsResult` gains
  the required `zeroYearsInAime`, and `PiaFromEarningsInput.earnings` and
  `piaInputFromEarnings`'s `earnings` are `readonly YearEarning[]`. New engine modules:
  `socialSecurity/analysis/{breakEven,expectedValue,oasdiReturn,survivorSwitching,credits}`,
  `socialSecurity/colaFactor`, `socialSecurity/oasdiTaxRates`, `socialSecurity/cpiU`;
  new exports `montecarlo/survival#survivalCurve` and `SurvivalCurve`,
  `socialSecurity/piaFromEarnings#resolveStreamPiaMonthly`, `#streamPiaFromEarningsInput`,
  `#zeroYearReplacementGain` (with an optional `asOf` and the result's
  `startYearGainMonthly`), `#zeroYearSampleEarnings`, `#bendTierForAime`, and
  `socialSecurity/ssaWageData#QUARTER_OF_COVERAGE_AMOUNT_BY_YEAR` and
  `#quarterOfCoverageAmountForYearOrLatest`; `socialSecurity/earningsTest#earningsTestWithheldAnnual`
  and `socialSecurity/analysis/earningsTestReach#earningsTestReach`;
  `socialSecurity/analysis/expectedValue#realBenefitScale`; `socialSecurity/analysis/claimants`
  (`socialSecurityStreamFor`, `socialSecurityClaimants`, `benefitsOnlyClaimAges`,
  `disabilityReplacesClaimAge`, which `expectedValue` re-exports, so a page that needs only
  the claimants does not load the models). `socialSecurity/analysis/oasdiReturn`
  exports `oasdiReturnForPerson`, `OasdiReturn` and `OasdiReturnOptions` (named for OASDI;
  the slice's draft called them `ficaReturn*`, never published), and `OasdiPaidIn` carries
  the projected work (`projectedToday`, `projectedEmployerToday`, `projectedYears`);
  `survivorSwitching#SwitchingOptions` requires the plan's `assumptions`.
  `params#PARAMETER_PROVENANCE` gains the ids `social-security-tax-rates`,
  `social-security-credits` and `cpi-u`. planner-ui (published source): the modules
  `socialSecurity/{breakEven,expectedPv,ficaReturn,survivorSwitching,explain}` are deleted,
  and `planner/ssAnalysis` loses `benefitsOnlyRanking`, `BenefitsPvRow` and `CLAIM_AGES`
  (the ranking is `@retiregolden/engine/socialSecurity/analysis/expectedValue#benefitsOnlyRanking`,
  whose rows now carry `disabilityPersonIds` beside them).

- **Family maximum room:** `AuxiliaryFamilyMaximumInput`
  (`@retiregolden/engine/socialSecurity/familyMaximum`) no longer has
  `workerActualMonthly`; `capAuxiliaryForFamilyMaximum` caps at the family maximum less
  `workerPiaMonthly` (20 CFR 404.404). A caller that passed the field must drop it. New
  beside it: an optional `familyMaximumMonthly` input, for a caller with a maximum other
  than the retirement and survivor one, and `currentSpouseMonthlyUnderFamilyMaximum`,
  the current spouse's total benefit with the maximum applied before the age reduction.

- **SSDI window (decision D-APPROX-FACTS):** `inSsdiWindow`
  (`@retiregolden/engine/socialSecurity/disability`) now takes the year's
  `SsdiYearMonths` (from `ssdiMonthsInYear`) instead of `(ageAttained, onsetAge,
  fraYears)`, and is true only in a year that pays disability months and no converted
  month. New exports beside it: `SSDI_WAITING_PERIOD_MONTHS`, `ssdiFirstPayableMonthIndex`,
  `ssdiSchedule`, `ssdiMonthsInYear` and the `SsdiOnset`, `SsdiSchedule` and
  `SsdiYearMonths` types.

- **Social Security spouse benefits (decision D-SS-LAW-2):** the module
  `@retiregolden/engine/socialSecurity/currentSpouseBenefit` and its
  `ordinarySimultaneousEarlyCurrentSpouseComponents` are removed; the new module
  `@retiregolden/engine/socialSecurity/dualEntitlement` exports
  `spouseDualEntitlementMonthly`, `spouseEntitlementAgeMonths`,
  `spouseReductionFactorAtAgeMonths`, `claimStartMonthIndex` and
  `divorcedExFirstMonthIndex`. `MaritalBenefitContext` gains the required
  `claimantOwnPiaMonthly` and `claimantOwnActualMonthly` and the optional
  `claimantSpouseWithheldMonths`, and its `claimantClaimAge` is now the configured claim
  age before any earnings-test credit; a divorced-spouse candidate's `monthly` is now the
  claimant's total (own benefit plus the reduced excess), not the spouse benefit alone.
  `AnnualSocialSecurityInput` (`projection/internal/annualSocialSecurity`) loses
  `currentSpouseContext` (every couple is priced the same way) and gains the required
  `withheldSurvivorMonthsBySource` and `withheldSpouseMonthsBySource`, keyed by
  `auxiliaryBenefitSourceKey` (new: the claimant and the record the benefit is paid on);
  `AnnualSocialSecurityResult` gains `withheldSurvivorMonthWrites` and
  `withheldSpouseMonthWrites` (`{ sourceKey, value }`). `nra.ts` exports `DobParts`, `attainedAgeZeroMonthIndex`
  and `attainedAgeMonthsInMonth`, `claimFactor.ts` exports `creditedAgeMonths`, and
  `survivorBenefit.ts` exports `widowEntitlementAgeMonths`.
- **`WAGE_BASE_BY_YEAR`** (`@retiregolden/engine/socialSecurity/ssaWageData`) now starts
  at 1937, and `wageBaseForYearOrLatest` returns 0 before 1937; `FIRST_WAGE_BASE_YEAR` and
  `piaFromEarnings.ts#FIRST_COMPUTATION_BASE_YEAR` are new. `computePiaFromEarnings` and
  `piaInputFromEarnings` start their window at 1951 for a worker who turned 22 before it,
  so `firstBaseYear` and `computationYearCount` change for births in 1928 or earlier.
  `COLA_PCT_BY_YEAR`, `LATEST_PUBLISHED_COLA_YEAR`, `piaWithCostOfLivingIncreases` and
  `socialSecurityColaAssumptionPct` are new, and `simulatePlan` resolves an earnings PIA in
  the first year's dollars.
- **planner-ui (decision D-SS-LAW-2):** `resolvePia(person, stream, asOf)`
  (`planner/ssAnalysis`) now requires the projection's first year and COLA assumption,
  passed as `piaAsOfPlan(plan)` (new), deliberately without a default so no caller
  silently receives the eligibility-year PIA; `claimingPeople(plan, startYear)` gains an
  optional start year that defaults to the current year.

- **B2-P1 slice 3 (comparisons):**
  - **`InsightImpact.successRateDeltaPct` is removed**, since no detector publishes it
    any more (rule 4). `SUCCESS_RATE_POINT_DOLLAR_EQUIVALENT` is removed with it;
    `computeCardScore` reads `EDITORIAL_RANKING_WEIGHT_DOLLARS` (a new export) in its
    place, so the order is unchanged. `Detector.previewsMonteCarlo` (`true`, optional)
    is new. RetireGolden-Pro's `reviewEvaluate.worker.ts` reads the removed field and
    gets a type error on the engine bump.
  - **`ClaimAgeCoOptimization.claimChangeEstateGain` and `.estateYear`** are new
    required fields; planner-ui's `ReportClaimAgeEvidence` gains both as required
    fields too, so a report model or claim result built by hand needs them.
    planner-ui's `claimEstateGain` (`planner/optimizePageClaim`) is removed.
  - **`OptimizedSchedule.conversionTotal`** and
    **`ExactLedgerTournament.winnerConversionTotal`** (and so
    `ExactLedgerTournamentSummary.winnerConversionTotal`) are new required fields; a
    hand-built schedule or tournament needs them. New export `conversionScheduleTotal`
    (`@retiregolden/engine/strategies/conversionScheduleTotal`, a leaf module,
    re-exported from `strategies/optimizer`), which refuses a non-finite amount with a
    RangeError. planner-ui's `scheduleConversionTotal`
    (`planner/optimizePagePromotion`) is removed.
  - **`ExactLedgerValidation.executedWithoutMaterialShortfall`** and
    **`ConversionExecution.materialTotalShortfall`** (`boolean`) are new required
    fields; a hand-built validation or evaluation needs them. The recommendation states
    are unchanged: the evaluation's diagnostic test now reads
    `materialTotalShortfall` instead of recomputing it.
  - **`RelocationCandidateRow.lifetimeTaxesAndPenaltiesDeltaVsBaseline`** and
    **`.endingAfterTaxEstateTodayDollars`** (`number | null`) are new required fields.
  - **`ScalarComparison` and `NullableScalarComparison`** are declared in
    `@retiregolden/engine/scenarios/scalarComparison` (still re-exported, unchanged,
    from `scenarios/comparison`). A comparison that meets a figure that is not finite
    throws a `NonFiniteComparisonError` (a new export: a `RangeError` whose `role`
    names the operand), where it threw a plain `Error` reading
    "scenario comparison produced a non-finite number" (the lifetime sums of
    `compareScenarioPlans` keep that message). `compareScenarioPlans` sets the new
    optional `headline.moneyLasts`, and so refuses (RangeError, from `moneyLasts`) a
    hand-built result whose depletion year is not one of its own years.
  - **`attachStochasticMetrics`** publishes its deltas through `compareScalars`
    (exported as `stochasticDeltas`): a negative zero reads 0, and a candidate whose
    metrics (or the baseline's) include one that is not finite gets no attachment and
    the new exported diagnostic `STOCHASTIC_METRICS_NOT_FINITE_DIAGNOSTIC`, so the
    max-downside-resilience ranking refuses it with that reason instead of throwing;
    with a decision context that has `taxCalculatorForPlan`, every
    entry is priced with its own plan's stack. New exports
    `compareMonteCarloSuccessRates` and `MonteCarloRateRun`: it compares two runs'
    success rates only when they share a path count and a start year, which each run
    states, and refuses (RangeError) otherwise.
  - **New module `@retiregolden/engine/scenarios/planHeadlines`**
    (`comparePlanHeadlines`), which refuses two projections with different start years
    and a depleting side whose first person has no birth date (`PlanHeadlineRefusal`, a
    `RangeError` carrying the reason and the side), and a
    projection with no dollar basis when the end years differ (from
    `projectionDollarBasis`). `compareMoneyLasts`, `MoneyLastsComparison` and
    `MoneyLastsBound` are new exports of `@retiregolden/engine/projection/moneyLasts`,
    re-exported from `planHeadlines`.
  - **New engine exports `MonteCarloComparisonRefusal`** (the RangeError
    `compareMonteCarloSuccessRates` throws, with its reason) **and
    `InsightPreviewUnavailable`** (`insights/previewUnavailable`, the error the
    asset-location and spending-headroom detectors throw, with a reason written for the
    reader, when they find nothing to preview; it was a plain `Error`).
  - **planner-ui worker errors carry a typed refusal:** the worker's error message gains
    an optional `refusal` (`workers/refusal.ts`: the engine refusal's kind and its
    operand role or reason, as plain data, since an error's class does not survive
    postMessage); `runWorkerRequest` rejects with a `WorkerRefusalError` carrying it;
    `OptimizeResponse` and `RelocationCompareResponse` gain the field. The Optimize
    failure well and the relocation compare's error line no longer start "Optimizer
    error:" or "Compare error:"; they say the failure in plain words
    (`planner/engineRefusalCopy.ts`).
  - **Three calls now refuse a figure that is not finite** with a RangeError, where it
    used to pass through as NaN: `evaluateCandidate` and the exact-ledger validation on
    a requested conversion amount (through `conversionScheduleTotal`),
    `optimizePlanCoOptimizingClaimAge` on an after-tax estate, and
    `compareRelocationCandidates` on a row's lifetime tax sum (both through
    `compareScalars`).
  - **planner-ui:** `planner/compareDeltas` exports only `formatDelta` and `DeltaUnit`
    (`deterministicSuccessPct`, `moneyLastsDelta`, `ageDelta`, `MoneyLastsDelta` and the
    `lastFundedYear` re-export are removed); `formatMcDelta` takes the engine's fraction
    rather than percentage points; `recommendationBody` takes an optional context (the
    tournament's ACA veto); `planner/useMcSuccessRate` exports `headlineMcRun` (which
    returns the run's start year) and `headlineMcRunOptions` (which takes one), and
    `publishMcHeadline` and `registerMcHeadlineRun` take the start year of the run they
    publish or register.

- **`SustainableSpendingResult` (B2-P1 slice 2, owner decision R4):** `maxBaseAnnual`
  now publishes the answer rounded down to $100 (or, under guardrails when that fails,
  the exact amount), not the level that passed, and `spendingSlackDollars` is measured
  from it; `bestEvaluation` is the run at the level that passed. New required fields
  `feasibleBaseAnnual` (the level that passed), `maxBaseAnnualRounding`
  (`'down-to-hundred' | 'none' | null`), `sustainsCurrentBase` and
  `initialWithdrawalRatePct`. Under guardrails `simulationCount` can exceed
  `maxSimulations` by one (the check of the rounded amount).
  `ScenarioSpendingCapacityResult` accepts `feasibleBaseAnnual`,
  `maxBaseAnnualRounding` and `sustainsCurrentBase` as optional fields, and
  `ScenarioSpendingCapacityComparison` gains the optional `feasibleBaseAnnual`,
  `baselineMaxBaseAnnualRounding`, `proposalMaxBaseAnnualRounding`,
  `baselineSustainsCurrentBase` and `proposalSustainsCurrentBase` (null on a side
  whose result did not carry them). New exports `roundSolvedSpending`, `SOLVED_SPENDING_STEP_DOLLARS`,
  `initialWithdrawalRatePct`, `EXACT_ANSWER_DIAGNOSTIC_LEAD` and
  `isExactAnswerDiagnostic`, and the module `decisions/spendingShapes`. A caller that
  builds the result by hand gets a type error until it adds the fields. planner-ui's
  `SpendingSolveResult` carries the four new fields as optional ones, and
  `SpendingSolveEvidence` gains an optional `endingAfterTaxEstateTodayDollars`, so
  typed results built before them still compile.
- **`RiskBasedThreshold.balanceDollars` is removed** (decision R3): nothing read it and
  it never acted. `balancePct` (the percent the planner persists, two decimals) is
  required in its place; the dollars come from `guardrailThresholdDollars(plan)`.
- **`Histogram.binCenters`** is a new required field; a hand-built histogram needs it.
- **`SwrRuleResult.endingAfterTaxEstateTodayDollars`** (`number | null`) is a new
  required field.
- **The bucket lens moved to the engine**: planner-ui's `planner/bucketLens` keeps only
  `BucketPreset` and `BUCKET_PRESETS` (whose `spans` are now `readonly number[]`, the
  engine's `BUCKET_LENS_SPANS`); `bucketLens` and `BucketYearRow` are
  `@retiregolden/engine/projection/bucketLens`, which refuses a span that is not a
  positive whole number and a year without a finite `netPortfolioNeed` instead of
  reading it as 0.

- **ACA inputs of the annual projection phases** (`@retiregolden/engine/projection/internal/*`,
  decision D-ACA-2027-TABLE): `AnnualAcaResultPublicationInput.isStandIn` is renamed
  `acaParametersStandIn` and `parameterPack` is renamed `acaParameters` (typed
  `AcaPricingParameters`, the coverage year's figures), and the input gains the required
  `incomeTaxParametersProjected`; `AnnualFundingCandidateEvaluationContext.parameterPack`
  is renamed `acaParameters`; `AnnualHealthcareExpensesInput.isStandIn` and
  `AnnualExpenseAssemblyPhaseInput.isStandIn` are renamed `acaParametersStandIn`, because
  the ACA gate was their only reader and the flag now means the coverage year has no
  published ACA figures. `AcaSupportCode` gains `income-tax-parameters-projected`, so an
  exhaustive switch over it needs the case. `sizeRothConversion` refuses an `acaCliff`
  target (`aca_nonactionable`) for a coverage year without published figures, and its
  ceiling reads that year's guidelines as published instead of `pack` scaled by
  `inflationScale`. The `tax/aca.ts` functions accept any object with
  `federalPovertyLine` and `aca`, so a `ParameterPack` still works. In planner-ui,
  `ReportProvenance` gains `acaCoverageYears`, optional so that a version-3 report model
  saved before it still renders (without the "ACA premium tax credit figures" row).

- **`acaApplicablePct` returns the rounded rate** (`@retiregolden/engine/tax/aca`,
  decision D-ACA-2027-TABLE): it rounds the interpolated applicable percentage half up to
  the nearest 0.01%, as 26 CFR 1.36B-3(g)(1) requires, so a caller that read the
  unrounded rate gets a different number (5.7324 at 182% in 2026 is now 5.73). The credit
  now reads it at the whole-number poverty-line percentage, `acaWholeFplPct(fplPct)`; a
  caller that wants the credit's rate should do the same.

- **Sustainable-spending result fields (required):** `SustainableSpendingResult` gains
  `acaGrossPremiumYears`, `acaGrossPremiumReasons`, `acaGrossPremiumDirection` and
  `zeroSpendingDepletes` (true only when a probe at zero base spending ran and depleted);
  `ScenarioSpendingCapacityResult` (a `Pick` of it) gains the same three, and
  `ScenarioSpendingCapacityComparison` gains `baselineAcaGrossPremiumYears`,
  `proposalAcaGrossPremiumYears`, `baselineAcaGrossPremiumReasons`,
  `proposalAcaGrossPremiumReasons`, `baselineAcaGrossPremiumDirection` and
  `proposalAcaGrossPremiumDirection`. A caller that builds any of these objects by hand
  gets a type error until it adds them; `compareScenarioSpendingCapacityResults` still
  reads an untyped result without them as having no unpriced years rather than
  throwing. planner-ui's `SpendingSolveResult` (the `spendingSolve` export) carries the
  same four fields. New exports `ACA_GROSS_PREMIUM_DIAGNOSTIC_LEAD` and
  `isAcaGrossPremiumDiagnostic` recognize the solver's unpriced-credit diagnostic by its
  text, not its position.
- **`EvaluateCandidateOptions.nonActionableAca`** (`'refuse' | 'disclose'`, default
  `'refuse'`, which is today's behavior). `evaluateInsightAction` now defaults it to
  `'disclose'` for the `spending-headroom` card only; every other card, tournaments and
  coordinate-descent search keep the refusal: their `evaluation` option types omit the
  field, and `runDecisionTournament` and `refineConversionSchedule` throw a TypeError when
  an untyped caller passes `'disclose'`. `SustainableSpendingOptions.evaluation` omits it
  too: the solver always discloses.
- **`GarchModelConfig`:** `omega` is deleted (it is now set from the volatility, so an
  explicit value would either be ignored or contradict it), and `returnVolScalePct` is
  renamed `returnVolPct`, which now means the long-run standard deviation of the return
  shock in percentage points, as for every sibling model. A typed caller passing either
  old key gets a type error, and `createGarchModel` refuses either key from an untyped
  caller with a RangeError that names the replacement (pass `returnVolPct`; `omega` is
  now derived), so no old config silently runs the default volatility. The
  RetireGolden-MCP and RetireGolden-Pro hosts build only the lognormal model and need no
  change.
- **New RangeErrors from `createMarketModel` and the model factories**, where values
  used to be clamped or rounded without a word: Student-t df of 2 or less; GARCH
  negative inputs and alpha + beta of 1 or more; a reversed-history window that is not a
  whole number from 5 to 96; a return-inflation correlation outside −1 to 1; a missing,
  negative or non-finite class volatility; a class correlation matrix that is not
  positive definite (also from `choleskyDecompose`); a historical block length that is
  not a whole number of at least 1; a regime switch or high-inflation probability
  outside 0 to 1; AR(1) phi of 1 or more in size; a stationary mean block length below
  2; a user-shock year that is not a whole number of at least 1; a negative or
  non-finite `returnVolPct` in any model that reads one (Student-t, lognormal, Gaussian,
  AR(1), CAPE, inflation regime, GARCH), `baseReturnVolPct` (user shock),
  `inflationVolPct` (every model that has one) or regime switching's `bullVolPct` and
  `bearVolPct`. `runHistoricalStressSuites` refuses an explicit window that is not a
  whole number from 1 to 96 and a `worstWindowCount` that is not a whole number of at
  least 1, and `solveRiskBasedGuardrails` refuses a `successProbe` value outside 0 to 1.

## 2026-09

**2026-09-04**
- Prepared **`@retiregolden/planner-ui` 0.10.0** — a **minor** bump, and like
  the engine entry below it is minor because the published surface got
  smaller. **Not yet published.**
- **The `"./*": "./src/*.ts"` wildcard export is gone.** This is the breaking
  change. The wildcard resolved *any* deep path under the package, which meant
  it also resolved the paths `files` deliberately excludes from the tarball:
  `@retiregolden/planner-ui/testSupport/samplePlan`,
  `/import/documentBenchmark`, `/import/documentCorpus`, `/import/pdfFixtures`
  and `/report/goldens/*` all resolved cleanly and then failed inside the
  host's own build as a module-not-found on the host's own line. The exports
  map could not say "that is not published", because a wildcard cannot tell
  the difference between a path that exists and a path that merely matches.
  `scripts/pack-smoke.mjs` had called it a hazard in a comment since 0.5.0.
- **The 23 deep subpaths are now named one at a time.** They are the twelve
  RetireGolden-Pro imports — including `data/planStoreContract`, which the
  0.4.4 entry below documents as reaching Pro's desktop library store through
  the wildcard — the one RetireGolden-MCP import, and the ten `app/` imports
  in this repository:

  ```
  ./data/localStore                        ./planner/examples/buildContext
  ./data/planStoreContract                 ./planner/examples/buildExampleCouple
  ./data/v2Backup                          ./planner/examples/buildUnderSavedSingle
  ./householdMap/householdGraph            ./planner/examples/registry
  ./householdMap/mapViewModel              ./planner/format
  ./import/brokerCsv                       ./planner/planContextCore
  ./import/genericCsv                      ./planner/refreshProtectionContext
  ./import/projectionLab                   ./planner/useProjection
  ./import/reviewChecklist                 ./report/reportHtml
  ./import/tenForty                        ./routes/LearnRoutes
  ./learn/learningRegistry                 ./routes/groups
  ./optimize/runOptimize
  ```

  They carry **no stability promise** and may move in any release, patch
  included — the same terms the README gave the wildcard paths. What changes is
  that the set is now finite and written down. `./routes/LearnRoutes` and
  `./routes/groups` are `.tsx` modules published **without** the extension,
  like every other key; a consumer reading the first one's source text asks for
  `@retiregolden/planner-ui/routes/LearnRoutes?raw` and the bundler applies the
  exports map to the specifier and `?raw` to what it finds (this repo's
  `app/scripts/sitemapRoutes.test.mjs` is that consumer, and its import
  dropped the `.tsx`).
- **Null guards for the excluded paths.** `./testSupport/*`,
  `./report/goldens/*`, `./import/documentBenchmark`,
  `./import/documentCorpus` and `./import/pdfFixtures` map to `null`, behind a
  closing `./*: null`, mirroring `@retiregolden/engine`'s map. With no wildcard
  left these are strictly redundant — an unlisted path is already refused — and
  that is the point: they are what keeps those paths refused if a wildcard is
  ever reintroduced, and they name the excluded directories in the one file a
  packaging change is made in.
- **The pack smoke proves the map instead of trusting it.** A sweep now runs
  before the scratch consumer's Vite build, reading the **packed** manifest
  rather than a list kept in the script, so a new key cannot escape it: every
  non-null key must resolve *and* land on a file the tarball actually contains
  (the wildcard's failure, moved from the consumer's build to here), eight
  formerly-wildcard paths must fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`, and
  the null blockers must still be declared. It uses `import.meta.resolve`,
  which applies the map without loading the module — necessary, because this
  package ships TypeScript that node cannot parse. Output:
  `pack smoke: exports map -> 37 subpaths resolve from the tarball, 8
  formerly-wildcard paths refused`.
- **The engine range is `^0.3.0`**, moved by the engine entry below rather than
  by this one. planner-ui gains no new engine export here; its own suite
  follows `decisionFixtures` to `@retiregolden/engine/testing/decisionFixtures`
  in four test files, which is a test-only import and reaches no consumer.
- **Downstream to coordinate:** a host importing a deep path that is not in the
  list above now gets `ERR_PACKAGE_PATH_NOT_EXPORTED` at resolve time instead
  of a module-not-found later in its build. If the path is a real module the
  tarball ships, open an upstream issue and it can be added; if it is under
  `testSupport/`, `report/goldens/` or one of the three import fixtures, it was
  never in the tarball and the old error was a lie about that.
- Prepared **`@retiregolden/engine` 0.3.0** — a **minor** bump, because the
  published module surface got smaller. **Not yet published**; the owner tags
  `engine-v0.3.0` and approves the `npm-publish` environment, and npm serves
  what it serves until they do.
- **Two new published fields on `YearResult`.**
  - `netPortfolioNeed`: the nominal dollars the portfolio must supply that
    year — total expenses plus tax plus penalties, less total incomes, floored
    at zero. planner-ui's bucket lens was computing exactly that per year in
    the UI, which is money math outside the engine; it now reads the published
    field and its own helper is gone. Assembled in `annualYearResultAssembly`,
    where all four inputs are final, and published last in the literal so no
    existing key moves position.
  - `InheritedAccountYearEvidence.refusalCode`: the discriminated cause behind
    `refusalReason`. The prose is reader-facing text that names the specific
    fact or rule, and the Results page was classifying it with seven
    `includes()` checks — so rewording an engine message silently rewrote the
    user's explanation. The union is `successor-beneficiary`,
    `entity-beneficiary`, `multiple-beneficiaries`, `employer-plan`,
    `needs-review`, `successor-clock-out-of-scope`; there is deliberately no
    member for the labeled legacy planning approximation, which publishes no
    refusal at all. `refusalReason` is unchanged, word for word, and the
    substring reading survives as the fallback for results serialized before
    codes existed.
- **Twenty-nine `./actions/<name>` subpaths removed.** This is the breaking
  part, and the reason for the minor rather than a patch. The export map
  listed 39 of them behind the `"./actions/*": null` blocker; 29 had no
  importer anywhere — not in RetireGolden-Pro, not in RetireGolden-MCP, not in
  `app/` or `planner-ui` — and every listed name is public API a semver bump
  then has to honour. Removed: `annualHsaOpeningAuthority`,
  `annualHsaPenaltyEvaluation`, `annualHsaPhysicalMovementCandidate`,
  `annualHsaReimbursementLedger`, `annualHsaTreatmentBindingCoordinator`,
  `annualHsaWithdrawalCharacter`, `annualIraBasisAllocation`,
  `annualOwnedNonRothIraPoolCapacity`, `annualQcdPhysicalExecution`,
  `annualQcdResidualForm8606`, `annualQcdTaxCharacterPostPass`,
  `annualRetirementActionMovementCoordinator`,
  `annualRetirementActionPublication`,
  `annualRetirementPhysicalEventInventory`,
  `ownedNonRothIraAnnualCandidateCoordinator`,
  `ownedNonRothIraAnnualCandidateTransaction`,
  `ownedNonRothIraAnnualFilingEvidence`,
  `ownedNonRothIraAnnualFilingSourceResolver`,
  `ownedNonRothIraAnnualFinalization`,
  `ownedNonRothIraAnnualPlanCoordinator`,
  `ownedNonRothIraAnnualPostCandidateEvidence`,
  `ownedNonRothIraMovementCandidate`, `ownedNonRothIraPenaltyPrerequisite`,
  `ownedNonRothIraSeppAnnualReconciliation`,
  `ownedNonRothIraSeppCurrentPaymentCandidate`,
  `ownedNonRothIraWithdrawalCharacter`, `rothConversionExecution`,
  `taxableWithdrawalCharacter`, `traditionalEmployerPlanPenaltyPrerequisite`.
- **The ten kept subpaths are unchanged**, and they are the ten this monorepo
  imports one at a time: `actions/annualQcdExecutionPrerequisite`,
  `actions/civilDate`, `actions/contract`, `actions/execution`,
  `actions/identity`, `actions/money`, `actions/planBalanceAdapter`,
  `actions/reasons`, `actions/retirementActionCandidateIdentityAllocator`,
  `actions/retirementActionManualReview`. **No module became unreachable**:
  all 29 pruned names are still exported from the `./actions` barrel, which
  `publishedSurface.test.ts` proves for every one of them by comparing the
  source modules against the package's export map and the barrel's re-export
  list. Pack smoke adds a runtime check in the packed artifact — `typeof`
  assertions through the barrel for a representative subset of the 29, plus a
  new loop asserting every pruned subpath fails with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- **One subpath added: `./testing/decisionFixtures`.** `decisionFixtures.ts`
  moved from `src/decisions/` to `src/testing/`, beside `planFixtures.ts` and
  `flatTax.ts`. Its own header called it "test-only — not exported from the
  module index, so it never reaches the app bundle", which was true of the
  barrel and false of the tarball: the build excludes only `*.test.ts` and
  `*.test-support.ts`, so it always shipped — as
  `dist/decisions/decisionFixtures.js` — pulling `parsePlan`,
  `createFederalTaxCalculator` and `simulate` into its graph. Publishing it
  is the right answer rather than hiding it — planner-ui's suite already
  imports these fixture plans across the package boundary, and a consumer
  writing decision-engine tests needs the same ones — so the directory now
  says what the packaging did. The old
  `./decisions/decisionFixtures` path is gone; there is no shim, because the
  only importers are test suites in this monorepo and neither RetireGolden-Pro
  nor RetireGolden-MCP imports it. Its coverage attestation moved with it, from
  `attestations/decisions.ts` to `attestations/testing.ts`, unchanged in
  substance.
- **`testIds` became `makeTestIds(scope)` in the same file.** A single
  module-level `let counter = 0` behind a shared `testIds()` meant a fixture's
  account and income ids depended on how many other fixtures had been built in
  that module instance first — so the same builder produced different ids on
  its second call, and adding a fixture call above another silently renumbered
  the one below it. Nothing pinned an id, so nothing was wrong; it was a trap
  waiting for the first test that did. Each builder now opens its own sequence,
  scoped by name (`dec-tradHeavy-1`), which also keeps `mixedTraditionalPlan`
  — which composes `inheritedOnlyPlan` and adds an account — from minting an id
  the composed plan already used. `decisions/assetLocationInvariance.test.ts`
  was the one importer of the shared counter and now opens its own with
  `makeTestIds('assetLocationInvariance')`; the two accounts it actually pins
  were already file-local literals. Ledger output is unaffected: the
  differential equivalence dump over the `full` corpus (150 members, 600
  entries) is byte-identical to the branch base.
- **The planner-ui range moves in the same commit, and it has to** — the same
  `linkWorkspacePackages` reasoning as the 0.2.0 entry below:
  `@retiregolden/planner-ui` now declares `^0.3.0`. Its own version is not
  bumped here. The pack smoke's `auto` mode detects that 0.3.0 is not on npm,
  asserts the local engine's version equals the declared minimum, and packs
  the local engine: `packing the exact local engine minimum 0.3.0 ... pack
  smoke OK ... against local minimum 0.3.0`.
- **Downstream to coordinate:** a consumer importing any of the 29 pruned
  subpaths changes the import to `@retiregolden/engine/actions`; the exported
  names are identical. A consumer that constructs a `YearResult` literal now
  has to supply `netPortfolioNeed`, which is required rather than optional
  because the ledger always publishes it.

## 2026-08

**2026-08-31**
- Import & migrate (`/import`) landing source cards share the same 2×2 grid as
  Getting started on `/`. The step back control sits with the source heading as
  a readable secondary button, and returning from a step restores keyboard
  focus to the card that was opened.
- Prepared **`@retiregolden/engine` 0.2.0** — the first **minor** bump in the
  0.1.x line, and deliberately not a patch. **Not yet published** — the owner
  tags `engine-v0.2.0` and approves the `npm-publish` environment, and npm
  serves 0.1.12 until they do. Plan schema v5 (PR #382) added a
  **required** `inflationAdjusted` boolean to a one-time income stream, which
  breaks a `^0.1.x` consumer in two ways: a TypeScript caller constructing a
  `oneTime` income literal stops compiling, and a caller handing `parsePlan` a
  v4-shaped plan object gets a validation failure unless it routes through
  `migratePlanToCurrent` first. Stored documents are unaffected — migrating them
  is exactly what the v4 → v5 step is for. The repository's usual discipline of
  shipping engine changes as patches exists to keep additive exports inside the
  `^0.1.0` range consumers declare (see the 0.1.3 and 0.1.5 entries); that
  reasoning does not apply here, because shipping a breaking change as 0.1.13
  would silently break every caret consumer on its next resolve, which is the
  one thing the caret is supposed to promise against.
- **The planner-ui range moves in the same commit, and it has to.**
  `linkWorkspacePackages: true` still honours the declared range, so leaving
  `@retiregolden/planner-ui` on `^0.1.12` while the workspace engine reads
  0.2.0 stops pnpm linking the checkout and silently resolves the *published*
  v4 engine instead — measured: the lockfile flips from `link:../engine` to
  `version: 0.1.12`. planner-ui source requires v5, so that state is broken, and
  `workspace:` protocol is not an option here (see `pnpm-workspace.yaml`: these
  packages ship via `npm publish`, which does not rewrite it). The two version
  edits are therefore one atomic change, not the usual split.
- **No release window to manage, because the pack-smoke already anticipated
  this.** planner-ui's smoke test normally resolves its declared engine minimum
  from the registry, which would fail here — 0.2.0 does not exist on npm yet.
  Its `auto` mode detects exactly that and packs the LOCAL engine instead,
  asserting the local package version equals the declared minimum before it
  does. Verified by running it: `packing the exact local engine minimum 0.2.0
  ... pack smoke OK ... against local minimum 0.2.0`. So `main` stays green
  between this merge and the publish, and the check flips back to resolving
  from the registry once 0.2.0 is live, with nothing to change. The currently
  published planner-ui 0.9.0 is unaffected and internally consistent — it was
  built against the v4 engine and resolves one.
- **Hardened the fallback this release leans on.** The registry probe caught
  every error and answered "not published", so a network blip, a rate limit or
  an auth failure was indistinguishable from an absent version: `auto` would
  quietly pack the local engine and CI would stay green while the
  registry-resolution path went unexercised. It now reads npm's structured
  `error.code` (available because the probe already passes `--json`) and treats
  only **E404** as absence, throwing otherwise with a message pointing at
  `PLANNER_PACK_SMOKE_ENGINE_SOURCE=local` for a deliberate local pack. Both
  branches measured: an unpublished version reports `E404` and still falls back;
  an unreachable registry reports `ECONNREFUSED` and now fails loudly instead of
  silently downgrading the check.
- **planner-ui is not re-released here.** Its `^0.2.0` range ships whenever it
  next publishes; nothing about the currently published 0.9.0 changes.
- **Downstream to coordinate:** the RetireGolden MCP reads the shipped Plan JSON
  Schema, so `describe_plan_schema` reports **v5** once it picks this up, and
  `build_plan` must author `inflationAdjusted` on a one-time income. The
  historical `schema/plan.v1.json` … `plan.v4.json` artifacts remain shipped at
  their versioned subpaths, so a consumer pinned to an older document shape can
  still read the schema it was written against.

**2026-08-30**
- Moved the flat-rate tax stub out of the projection engine and into the
  testing-support surface, without breaking anyone. The body moved from
  `packages/engine/src/projection/flatTax.ts` to
  `packages/engine/src/testing/flatTax.ts`; the old path now re-declares it as
  a deprecated alias, so `@retiregolden/engine/projection/flatTax` still
  resolves and still exports the same `createFlatTaxCalculator` — the identical
  function object, not a copy. No consumer breaks. All 89 in-repo importers (85
  engine test files, 4 planner-UI test files) moved to
  `@retiregolden/engine/testing/flatTax`, leaving the old subpath with no
  in-repo product or test consumers — the only in-repo code that still names it
  is the pack-smoke guard that keeps it honest; it exists for external code
  pinned to it. The arithmetic is untouched and no fixture's expected dollar
  changed. The alias shape is deliberate: TypeScript does not report a
  `@deprecated` tag attached to a bare `export { x } from` re-export, so that
  shape would have shipped a marker no consumer ever sees; the alias reports at
  both the import and the call site. Pack-smoke now proves both subpaths
  resolve, yield the same function object, stay nameable from a compiled
  consumer, and that the deprecation is actually reported to that consumer by
  the TypeScript language service — so the alias shape above is enforced rather
  than merely explained, and the compatibility promise with it. Removal is
  deferred to a future major and is **not** scheduled; when it happens it must
  be done by adding an exact `"./projection/flatTax": null` exports key, which
  wins over the `./projection/*` pattern — never by deleting that wildcard,
  which would take down every other projection subpath including
  `projection/simulate` — and the pack-smoke guard above has to come out in the
  same change, since it consumes the subpath it protects.
- Corrected stale roadmap framing that outlived the work it described. The stub
  called itself a "V1 placeholder" awaiting replacement "in roadmap phase V2",
  and the `TaxCalculator` interface said the same. The real federal engine
  shipped long ago, and nothing is queued to replace this file — it is the
  permanent, deliberate test double for those 89 suites. Both comments now say
  so. The interface's comment mattered most: it is re-exported through the
  public `projection/types.js` façade and emitted into the shipped `.d.ts`, so
  consumers were reading the outdated claim in editor tooltips.
- Reversed the planner-UI / MCP dependency direction so all arrows point one
  way. `@retiregolden/planner-ui` no longer dev-depends on the published
  `@retiregolden/mcp`; the MCP depends on planner-UI, never the reverse. The
  "Copy plan for your AI" round-trip guard moved with it, from
  `packages/planner-ui/src/data/planForAi.roundtrip.test.ts` to
  `tests/planForAiRoundtrip.test.ts` in RetireGolden-MCP (its PR #59), where it
  runs against that repo's local adapter instead of a published tarball — so a
  `build_plan` regression now fails in the pull request that causes it rather
  than waiting for an npm release to carry it across. Dropping the dev
  dependency also removed the eight sourcemap-resolution warnings
  `@retiregolden/mcp`'s `dist` emitted on every planner-UI test run, and the
  `server.deps.inline` block that existed only to serve that one test. The
  **producer** side of the contract is still enforced here by the
  `serializeSinglePlan` block in `packages/planner-ui/src/data/planFormat.test.ts`;
  what left is the **consumer** round trip through a real `build_plan`, which
  now reaches the guard only after planner-UI publishes and the MCP repo picks
  up the new version. Recorded because that is a real detection delay, not a
  free move: treat `serializeSinglePlan` as a published contract.

**2026-08-29**
- Replaced automatic standalone Grok PR review with the independent OpenRouter
  review workflow and stable `review / openrouter-first-pass-gate` context.
  The legacy Grok workflow is manual-only; it is not an OpenRouter fallback.

**2026-08-25**
- Re-enabled the production web import capability after the WS6 incident-switch
  rehearsal proved the deployed one-key switch removed every browser file-input
  surface while preserving manual entry, existing-plan access, exports, and
  RetireGolden backup recovery.
- Disabled the production web import capability for the WS6 incident-switch
  rehearsal. Browser file inputs remain unmounted while disabled; manual plan
  entry, existing plans, exports, and RetireGolden backup recovery remain
  available. A separate reviewed PR restores the capability after live
  verification.
- Added a fail-closed, no-store web incident switch for file-backed import.
  Missing, malformed, oversized, redirected, non-200, extra-key, or disabled
  config removes the new-plan wizard, broker CSV refresh, mySSA XML import,
  and FedInvest CSV fallback before their file inputs render. Manual entry,
  existing-plan access, exports, and RetireGolden backup restore remain
  available; the switch is explicitly excluded from PWA precaching.

**2026-08-21**
- Closed reverse-gap registry record `irc-4974-rmd-shortfall-excise-tax`.
  The annual ledger now charges 25% of each computed RMD shortfall on
  `YearResult.penalties`, with partial payments reducing the base dollar for
  dollar. Explicit same-applicable-plan correction plus Form 5329 evidence can
  select 10% only inside the earliest statutory correction-window endpoint;
  requested or denied reasonable-error waivers retain tax, while an explicit
  grant and the final regulation's two automatic fact patterns reach zero. An
  opt-in first-year deferral carries the first amount to April 1 and places a
  miss in the RBD year alongside that year's separate RMD. Explicit 403(b)s
  aggregate per owner; inherited accounts aggregate only with an explicit
  same-decedent identity. Living-owner Roth IRAs stay outside lifetime RMDs;
  inherited Roth shortfalls are covered. The chapter 43 tax is isolated from
  income tax, AGI, MAGI, IRMAA, §86, and ACA calculations.
- Planner-home first-run chrome (#297): empty-library tab title is `RetireGolden`
  (not `Your plans`), Getting started is a 2×2 of equal cards, the header uses a
  readable wordmark instead of the lockup PNG's 5–6px baked-in tagline, skip-to-content
  sits in flow above the header when focused, the Theme control has a visible
  group label and no longer shares the primary-CTA gold fill, Start here is a
  column of links, and disabled **Download plan backup** names why
  (`No plan to export yet`).

**2026-08-20**
- Closed the reverse gap on **IRC §401(k)(2)(B)(i) employer-plan conversion
  source / distributability** for the aggregate Roth-IRA path. `isConvertibleToRoth`
  now refuses an owned employer traditional account unless the projection year
  can prove severance (attained age at or past `retirementAge`) or age 59½
  (attained-age-60 proxy). The weight and drain loops both read that predicate,
  so a still-working participant under 59½ converts $0 and the year names the
  refusal. The same locked-employer warning fires when an IRA only partly fills
  the request and a gated 401(k) sits unused. The public one-argument
  `isConvertibleToRoth(account)` call is kept: IRAs stay convertible; employer
  accounts fail closed when year-level context is absent. In-plan Roth of
  otherwise nondistributable amounts under §402A(c)(4)(E) remains a different
  enacted act and is not modelled.
  Registry record `irc-401-k-2-B-i-employer-plan-conversion-source-not-gated-by-distributability`
  reclassified `approximated` → `settled`.
- 1040 guided seed form handling: money fields replace (instead of appending into
  a formatted value / Chromium `insertReplacementText`), the date-of-birth year
  segment is capped at 4 digits, and Backspace in Line 7 no longer submits the
  form. A Single-filing estimated brokerage is owned by the primary, not Joint.

**2026-08-19**
- Prepared **`@retiregolden/engine` 0.1.12** (patch — the engine half of the
  §414(v)(7) high-earner designated Roth catch-up below, including its
  §415(c) exclusion, the compensation-minus-other-electives cap, the Plan v4
  schema regeneration carrying `priorCalendarYearFicaWages`, and the
  §408(d)(8)(A) post-70½ QCD offset corrections on the aggregate `qcdAnnual`
  arm). Released as a pair with planner-ui 0.9.0, whose engine floor moves to
  `^0.1.12` because the UI reads and writes the new Box 3 field — the pins
  move together.
- Prepared **`@retiregolden/planner-ui` 0.9.0** (minor — additive public
  subpaths and import hardening, plus the §414(v)(7) calculation addition
  below; requires `@retiregolden/engine ^0.1.12`). The new public, browser-free **`./complete-export`** subpath
  publishes the read/verify half of the `retiregolden.complete-export` v1
  planning-record contract: the typed manifest shape, `parseCompleteExportManifest`
  (liberal on producer labels, strict on integrity — safe-integer totals
  equations, Win32-folded path-collision refusal, declared-limit
  self-consistency, the pinned Free bridge path), the `manifest.sha256`
  sidecar grammar, and fail-loud Web Crypto verifiers. There is deliberately
  no writer — RetireGolden Pro remains the sole producer. Custodian file
  refresh (Schwab/Fidelity) hardened end-to-end: statement as-of extraction
  with local-calendar staleness flags, whole-word account matching with
  broker-scoped remembered assignments, exact-cent reconciliation, and
  durable pre-mutation refresh snapshots with protection-honoring
  restore-and-undo. Also carries KPI-bar and planning-age layout fixes and
  the workspace's npm→pnpm switch (packaging and publish pipeline
  unchanged in behavior).
- Implemented **IRC §414(v)(7) high-earner designated Roth catch-up** (SECURE 2.0
  §603) for contribution years 2026+. Employer-plan catch-up above the §402(g)
  base is recharacterized as designated Roth when prior-year FICA wages from the
  sponsoring employer **exceed** $150,000 (Notice 2025-67). Exactly $150,000
  stays pre-tax-eligible. No Roth employer account for that owner ⇒ the high-earner catch-up
  is $0. Super catch-up ages 60–63 is the same §414(v) slice. IRA / HSA / SEP /
  SIMPLE IRA are untouched. The wage test is a user-entered Box 3 proxy on the
  employer account (`priorCalendarYearFicaWages`); omitted defaults to 0 and is
  not subject. T.D. 10033 does not delay the 2026 statutory mandate to 2027.
  Redirected catch-up is not reported as an IRS-limit cut, is excluded from
  §415(c) by §414(v)(3)(A), is limited by §414(v)(2)(A)(ii) to compensation
  minus other electives, and remains elective deferral of the source plan
  for match.

**2026-08-13**
- Prepared **`@retiregolden/planner-ui` 0.8.0** (minor — additive supported
  governance record-capture seams; no calculation changes). The new public,
  browser-free **`./projection`** subpath promotes the planner's deterministic
  `projectPlan(plan, startYear)` projection, its view type, and the clock
  helper without pulling in React. Evidence hosts pass and record an explicit
  start year, then retain the exact projection result and summary instead of
  re-running a plan later.

  The existing **`./report-model`** subpath now adds backward-compatible
  `parseReportModel`: it validates the envelope (kind, supported version
  1..current, field types, block structure) and returns a `ParsedReportModel`
  whose `provenance` and `blocks` are structurally validated but untyped
  (`Record<string, unknown>`). It rejects malformed, oversized, or newer
  envelopes with a caller-visible upgrade message. Hosts that wrote the bytes
  with `serializeReportModel` at the current version may assert to `ReportModel`
  after checking `model.version === REPORT_MODEL_VERSION`; all other consumers
  must narrow field-by-field. Hosts re-rendering persisted models must handle
  absent or unknown blocks and warn rather than drop silently. Serialization
  remains deterministic; no retirement, tax, or money calculation changed.

## 2026-07 (July 2026 Depth Wave)

**2026-07-30**
- Prepared **`@retiregolden/engine` 0.1.9** (patch — additive Plan v3 retirement-action
  eligibility-fact persistence and schema support). Planner UI source that reads those facts now
  requires `@retiregolden/engine ^0.1.9`; its packed-consumer smoke installs and compiles against
  the exact supported minimum, using the local 0.1.9 tarball only until that version is available
  from the registry.

**2026-07-26**
- Prepared **`@retiregolden/engine` 0.1.8** and **`@retiregolden/planner-ui` 0.6.2**
  (patches — additive Advisor meeting WS8 performance seams, with no calculation changes).
  Engine scenario comparisons can now report genuine completed shared-path work across baseline
  and proposal while keeping callbacks out of result provenance. Planner UI's public
  `./spending-solve` facade now accepts an optional `AbortSignal`; aborting terminates active
  worker work, removes listeners, settles once with `AbortError`, and ignores late events.
  Regression coverage pins monotonic `1..2N` comparison progress, already-aborted behavior,
  active-worker termination, and late-message safety. Calculation cases remain unchanged.
- Prepared **`@retiregolden/planner-ui` 0.6.1** (patch — additive, browser-free intake refresh contract; no public planner UI behavior change). The new supported **`./intake-refresh`** subpath lets a professional host classify, preview, and apply narrowly allowlisted updates from a later intake to the same saved plan. It recognizes only annual wages, recurring annual income, one-time income amounts, and recent annual MAGI, and it requires provenance-backed semantic identity before a candidate can update anything. Stable current-plan IDs and semantic bindings flow through classification, delta construction, and application; Unicode-aware matching prevents visually deceptive names from becoming accidental identities.

  Refreshes are fail-closed. Duplicate matches, stale or malformed deltas, changed target values, missing targets, and protected paths cannot be applied. Accepted candidates write only their single supported money leaf; rejected or merely unmatched candidates leave the plan unchanged. The contract never adds or removes records and does not refresh Social Security, accounts, household or filing status, historical MAGI, timing, growth, tax treatment, or strategy fields. A Pro host remains responsible for sealing the base snapshot, authorizing the saved-plan target, collecting explicit review decisions, and committing the exact preview atomically.

**2026-07-25**
- Prepared **`@retiregolden/planner-ui` 0.6.0** (MINOR — a new supported subpath, plus an additive field on an existing one). Ships the **migration-source identifier** (advisor-intake WS6) on `@retiregolden/planner-ui/migration-source`: it says WHICH incumbent planning tool a user-provided file came from, publishes what can and cannot be brought over from it, and emits the mandatory unmapped report. It maps no fields itself, and the shape of the surface is deliberately lopsided — one mapper, three identifications. ProjectionLab is recognised by the export's **structure** (the same `currentFinances.accounts` shape `projectionLab.ts` already gates on) and mapped by that existing mapper, unchanged and not duplicated. RightCapital, eMoney and MoneyGuide are **identified only**: RetireGolden holds no documented machine-readable export from any of them, the plan forbids bundling proprietary samples, and inventing column names for a format nobody here has seen is the failure that actually costs a user something — it lands wrong numbers in a plan while looking like a successful import. So those three get identification, published limitations, and the manual path, and a field selector for one of them does not belong in the file. What would change that is a real export from a trial account, checked in as a substantiated format with its own fixtures.

  **Identification is conservative because the WS5 benchmark says it has to be** — field *selection* on extracted document text measured 17–75% precision, and deciding "this is an eMoney report" from the same text carries the same hazard. A product name matches only with no letter, digit, mark or invisible joiner on either side, and the guard is spelled with Unicode-aware lookarounds rather than `\b`: `\b` is defined over ASCII word characters alone, so a soft hyphen (PDF text layers carry one wherever a word was hyphenated) or a zero-width joiner manufactures a boundary and defeats it, and `projectionlab`+ZWJ+`oratory` renders on screen exactly like the rejected decoy `projectionlaboratory`. Every match carries its surrounding text **verbatim**, bounded, with control and format characters and lone surrogates rendered as visible `<U+XXXX>` — evidence that shows a character the file never held is not evidence. Evidence is graded so a mere name mention reads weaker than a structural format match, a file naming two tools is reported *ambiguous* with no vendor claimed, and a file past the size cap answers `too-large` rather than being scanned or silently dropped. A `meta.app` naming a different product is published as evidence **against** the identification rather than quietly among the support. Extracted pages are reported by state — text, clipped, an unreadable image, nothing the reader could read, and the pages that never opened at all — and no sentence claims more than the extractor's signals can carry: `imageOnly` is set by any raster paint operation and measures no coverage, so a page is never asserted to *be* a scan, and a textless page is never asserted to be empty (a report whose text was converted to outlines looks identical from where the reader stands). The report **names** the pages worth reading and never carries their text; a caller keeps the extracted `DocumentPage[]` itself. Every item is `status: 'unmapped'` with no `target`, proven by round-tripping through `reviewToProvenance` and `serializeImportProvenance` rather than by inspecting fields.

  **`./import-provenance` gains one additive field**: the `none` locator variant takes an optional `sourceIndex`. `none` means "no precise coordinate in this vocabulary", not "no source" — a page citation, or a checklist entry about a file as a whole, has a perfectly definite file behind it — and without the field a multi-source envelope silently filed every such entry against `sources[0]`, which for a report built mostly of `none` locators means most of it was attributed to the wrong file. The default differs from a coordinate leaf on purpose: omitted on `csvRow`/`jsonPath`/`form1040` still means `sources[0]`, while omitted on `none` means no source is named at all, which is what preserves the existing property that a `none` locator may sit in an envelope with an empty `sources[]`. `describeSourceLocator` renders it. Reading code that ignores the field behaves exactly as before, which is why this is a minor rather than a major — but it is not a patch, because a new supported subpath is new API.

  The free wizard is untouched: `ImportPage` offers no PDF upload and no migration surface, so this module's consumer is the Pro intake workbench, the same posture `./document-text` has. The engine range stays `^0.1.7` (published), so **no engine release is needed**.
- Prepared **`@retiregolden/planner-ui` 0.5.1** (patch — additive shared-service exports, no UI behavior change). Adds two supported edition-neutral subpaths for professional hosts composing the public planner: **`./plan-tax-calculator`** exposes the existing `taxCalculatorFor(plan)` adapter so engine comparisons use the planner's federal/state/local tax stack, and **`./spending-solve`** exposes the existing worker-backed `runSpendingSolve` contract plus its request/result/evidence/response types. The spending executor now calls the same tax adapter directly, removing a duplicate assembly path without changing calculations. Tarball smoke coverage imports both supported subpaths from the packed package and continues to require the spending-solver worker chunk; focused tests pin direct-engine tax-stack parity and the Promise-based synchronous fallback when `Worker` is unavailable.

**2026-07-24**
- Released **`@retiregolden/planner-ui` 0.5.0** (MINOR, not a patch — the Node floor moved). Two additive feature sets shipped together, plus one change that is breaking for anyone on an older runtime, which is what decides the version. **`engines.node` moves from `>=20` to `>=24`** across the repo and CI: Node 20 reached end of life in April 2026, `pdfjs-dist@6` requires `>=22.13`, and RetireGolden-Pro — the package's principal consumer — already declared `>=24`, so the producer was looser than its own consumer. A consumer on Node 20–23 can no longer install this release, and calling that a patch would be a false compatibility claim. **The `@retiregolden/planner-ui/scenario-levers` subpath** (advisor-meeting workspace) adds the canonical fast-lever contract — every definition declares the RFC 6901 paths it may patch and each result reports the operations actually emitted. **The `@retiregolden/planner-ui/document-text` subpath** (advisor-intake WS5) adds local PDF text extraction: per-page text with a 1-based page number as the citation, image-only detection for the scanned page an OCR pass would be needed for, and a result union whose reasons distinguish a problem with the document from a problem with the host's pdfjs — so an integration fault is never shown to a user as a problem with their file. Nothing throws for a bad document. `pdfjs-dist` is an **optional peer**: a browser host injects its own module (`options.pdfjs`), Node and SSR fall back to a dynamic import, and a host that never imports the subpath installs nothing and ships no pdfjs bytes. The published `SourceLocator` union is deliberately unchanged — adding a page-citation kind would make every new provenance export unreadable by an older consumer, and the accuracy benchmark that would justify it has not answered yet. `RefreshProtectionValue` gains an **optional** `pending` flag (source-compatible; the no-provider default stays `false`) so a host resolving protection asynchronously can say "not known yet" instead of accidentally saying "nothing", and `UpdateBalancesPanel` refuses both apply and file selection while it is set. Free-app behaviour is unchanged throughout: the import wizard still offers no PDF upload, and it mounts no refresh-protection provider.
- Released **`@retiregolden/planner-ui` 0.4.9** (patch — additive scenario comparison workspace). The Scenarios page now consumes the shared `@retiregolden/engine` 0.1.7 comparison service for baseline-versus-proposal headline, spending, income-source, withdrawal, IRMAA, estate, annual-ledger, and shared-market risk deltas, with explicit nominal/today's-dollar bases and proposal-minus-baseline direction. Sustainable spending capacity runs as two worker-backed exact-ledger solves and reports converged maxima, feasible lower bounds, unavailable results, limiting constraints, and plan-prefixed diagnostics. Every result is bound to plan/scenario fingerprints, projection year, selected scenario, and stochastic settings so rapid changes, equivalent-scenario switches, stale successes, and stale failures never become current output or leave calculation controls stuck. Invalid in-progress drafts and fingerprint failures remain in the workspace as clear unavailable states instead of crossing the route error boundary. Accessible tables, a single assertive status path, explicit Current/Recalculating/Error/Unavailable labels, New Year rollover handling, and `never` depletion semantics complete the presentation contract. Requires the published **`@retiregolden/engine ^0.1.7`**; no existing public API was removed.
- Prepared **`@retiregolden/engine` 0.1.7** (patch — additive scenario-comparison API). Adds the canonical baseline-versus-proposal comparison contract for headline outcomes, tax and penalties, spending, income and withdrawal sources, estate, annual-ledger rows, and same-seed shared-path risk; every numeric change uses proposal-minus-baseline semantics and identical plans normalize to exact positive-zero deltas. The projection ledger now records IRMAA-only surcharge dollars directly alongside total Medicare premiums and tier, so consumers never re-price the surcharge. Optional sustainable-spending-capacity comparisons preserve convergence and diagnostic metadata, while per-plan tax calculators are required so geography changes cannot silently reuse the baseline tax stack. Planner-ui adopts this API in a follow-up release and must require `@retiregolden/engine ^0.1.7` after this engine version is published.
- Released **`@retiregolden/planner-ui` 0.4.8** (patch — purely additive). Ships the **`RefreshProtectionProvider` seam** (advisor-intake WS4, the panel-side injection point the Pro repo consumes): a React context provider plus `useRefreshProtection()` through which a host app declares which accounts carry advisor-controlled values, as **structured id-based entries** `{ accountId, field?: 'costBasis' }` — account *ids*, not positional paths, so a host's protection set stays correct when the user reorders or deletes accounts between advisor sessions; ids never need parsing, so ids containing dots are safe by construction. The Accounts screen's `UpdateBalancesPanel` resolves entries to the engine's positional `protectedTargets` fresh each render and blocks matching rows: protected rows default OFF, stay individually selectable, render a "Protected — advisor override" note, and carry a per-row **"Allow this refresh"** release that is deliberately **transient** — row-scoped (releasing one row never unlocks another row targeting the same account), cleared on new file, reset, or plan switch, and never persisted, so an advisor's override survives every future refresh unless the user re-releases it each time. A field-scoped entry (`costBasis`) conservatively blocks the whole account row, because the engine's write primitive updates balance and cost basis as a unit — documented on the type so a host can't assume finer granularity than the write path honors. A partial apply (some rows written, others protection-blocked) names the held-back count in the status message, since the preview table and its audit are gone by then. The panel also gained commit-safe concurrency guards hardened through the review loop: a synchronous read-epoch invalidates in-flight file reads superseded by a newer pick, and the committed-plan-id ref advances in a layout effect so a discarded concurrent render can never mis-arm the plan-switch reset. The default context value is an empty protection set, so the public planner is byte-for-byte behavior-identical without a provider; the seam is inert until a host mounts one. No existing API changed; no engine or provenance surface moved.
- Released **`@retiregolden/planner-ui` 0.4.7** (patch — purely additive, source-only). Ships the **broker-refresh/reconciliation engine** (advisor-intake WS4, public half) on the second stability-promised subpath, `@retiregolden/planner-ui/import-refresh` — like the sibling `./import-provenance`, a supported API whose exported names and signatures only move on a semver-major, and deliberately browser-free (no DOM, no `crypto.subtle`) so the Pro/Advisor repo or a Node process can classify and apply a refresh headless. It is the returning-user "update my balances from a fresh broker download" path factored out of the Accounts panel into three functions. **`classifyRefresh`** matches each parsed broker row to a plan account and returns a `RefreshClassification`: per-row **`RefreshMatchKind`** verdicts (`exact` / `likely` / `ambiguous` / `unmatched` — deliberately **not** `ImportConfidence`: that scale grades how faithfully a *value* survived the trip, this one grades how sure we are *which account* a row refers to, and one enum for both would let a UI equate "we're sure this is your Roth" with "we copied this number exactly") plus a faithful `protectedPaths` snapshot of any caller-supplied protected set. False positives are engineered out rather than hoped away: a lone hit on a shared account-type *category* word ("IRA") grades `ambiguous` and defaults OFF — so a plan holding only a Rollover IRA never silently pre-selects "overwrite it with the file's Roth IRA number" — with the runners-up kept on `alternativeAccountIds` as the audit trail; and label normalization strips only digit-*heavy* parentheticals, so "(Z12345678)" is an account-number mask but "(Joint)" is name content, and short digit runs survive as words ("401k", "529"). **`buildRefreshDelta`** previews the exact before→after field writes by running the selection on a clone through the **same single write primitive `applyRefresh` uses**, so the preview structurally cannot diverge from the apply; it also surfaces the updatable accounts no row touches (their balances are going stale) and duplicate collisions (two rows assigned to one plan account), which are never auto-merged — a single collision empties the preview's changes list and makes **`applyRefresh`** a full no-op (writes nothing, returns 0), matching the panel's disabled apply button, so a headless caller reaches the same verdict. The delta carries a `reviewToProvenance`-compatible honesty checklist (a multi-position total grades `derived`, a lone position `exact` — unless clamping floored a negative value to $0, which is a transformation, not a copy, so it grades `derived` too). The WS4 **structural acceptance**: apply only ever writes `balance`/`costBasis` of selected, non-protected, non-duplicate accounts, in place, and never assigns a whole account shape — so a balance refresh *cannot* overwrite unrelated strategy assumptions (allocation, yields, contribution schedule, beneficiary, …) as a property of the code path rather than a review-time promise. **`protectedTargets`** is the Advisor seam: a caller-supplied path set enforced as one effective union across all three stages — classify snapshots it onto the classification, build unions that snapshot with its own argument and every `isProtected` candidate's target, apply unions the delta's record with its own argument — so protection supplied at *any* stage reaches enforcement even when apply is handed nothing, including for a target the user manually reassigned onto a protected account. A set supplied only at apply time is still honored, with a one-directional divergence: apply may skip writes the preview showed, never write more. The public planner panel passes no set; the Pro repo feeds it the WS2 intake decisions in a later dispatch. The Accounts screen's `UpdateBalancesPanel` now runs entirely on the engine — classification-driven default selections (`exact`/`likely` ON, `ambiguous`/`unmatched`/protected OFF), rendered before→after deltas per row, stale and duplicate callouts, apply routed through `applyRefresh` inside the plan `update` seam so `parsePlan` still gates saves — and its copy states the guarantee plainly. No existing API changed and the engine range stays `^0.1.6` (published), so no engine release is needed.
- Released **`@retiregolden/planner-ui` 0.4.6** (patch — scenario compatibility fix). Requires `@retiregolden/engine ^0.1.6` and uses its canonical scenario-patch rebind API whenever a plan receives a new identity: duplication, conversion from an example, and collision-rekeyed backup import. Canonical scenarios now keep their baseline preconditions aligned with the cloned plan id and remain applicable after those flows; unchanged-id imports and legacy loose patches retain their prior behavior. Tests cover duplicate, example-conversion, and import round-trips with real canonical scenarios.
- Prepared **`@retiregolden/engine` 0.1.6** (patch — additive scenario API). Adds the versioned `retiregolden.scenario-patch` contract: canonical typed operations with baseline preconditions and metadata, stable diff and composition, conflict-aware atomic apply/revert, legacy loose-patch compatibility and migration, safe plan-identity rebinding, and fail-closed path validation. Planner-ui adopts the new rebind API in the same wave and must declare `^0.1.6` after this engine release is published.

**2026-07-23**
- Released **`@retiregolden/planner-ui` 0.4.5** (patch — purely additive, source-only). Ships the **import-provenance contract** (advisor-intake WS1) on a new stability-promised subpath, `@retiregolden/planner-ui/import-provenance` — supported API, unlike the wildcard deep paths, so its envelope `kind`/`version` pair, exported names, and signatures only move on a semver-major. It answers, for every value an import mapper lands in a draft plan, where it came from and how faithfully it survived the trip: a **`SourceLocator`** union (`csvRow` / `jsonPath` / `form1040` / `derived` / `none`, with `sourceIndex` naming the file a leaf addresses in a multi-source import), an **`ImportConfidence`** grade (`exact` / `derived` / `estimated` / `assumed` / `unmapped`), a **`ReviewerDecision`** state (`pending` / `accepted` / `overridden` / `rejected`, a discriminated union so `overrideValue` exists exactly when the state is `overridden`), and a **`target`** engine plan path (`accounts[3]`, `household.state`) saying where the value landed. `ImportConfidence` is deliberately **not** the insights high/medium/low vocabulary: insights grades how strong a *finding* is, this grades how faithfully a *source value* was copied, and one enum for both would let a UI equate "we're confident this is a problem" with "we copied this number exactly". The versioned `retiregolden.import-provenance` envelope pairs `serializeImportProvenance` with `parseImportProvenance` (named failure reasons — `too_large` / `not_json` / `wrong_kind` / `unsupported_version` / `malformed`; unknown top-level fields tolerated so a host may extend it; a 10M-char cap that mostly guards against parsing the wrong huge file). It **never embeds a raw source document** — a source contributes only its file name, lowercase-hex SHA-256 of its **raw bytes**, byte count, and the mapper that read it, and the guarantee is structural rather than advisory because serialization rebuilds every object field-by-field, dropping anything a caller left attached. Hashing the raw `ArrayBuffer` (not decoded text) is what makes the digest match the file on disk, since decoding would normalize BOMs and invalid UTF-8 out of it; it lives alone in `import/sourceHash.ts` because `crypto.subtle` is the one piece that needs Web Crypto and is therefore async, letting `provenance.ts` stay browser-free and the four mappers stay synchronous and pure. All four mappers (`projectionLab`, `brokerCsv`, `genericCsv`, `tenForty`) now emit a locator, confidence, and target on every review item — additively; the human `source`/`detail` strings are unchanged — and `reviewToProvenance` folds a checklist into the envelope's `mappings`/`unresolved` buckets, deriving confidence from item status for producers predating the optional fields so a landed value is never graded `unmapped`. ImportPage gains a **"Download import report"** action; decisions stay `pending` in the free planner and are set later by the Pro/Advisor workbench. One privacy decision worth naming: the **guided 1040 path publishes no fingerprint at all** — there is no file, and a deterministic hash of low-entropy typed personal inputs (a DOB has ~36,500 plausible values) in a report meant for handoff would be dictionary-attackable, so `sha256` is the empty string, the contract's honest "nothing to verify against", never a wrong hash. No existing API changed and the engine range stays `^0.1.5`, so no engine release is needed.

**2026-07-22**
- Released **`@retiregolden/planner-ui` 0.4.4** (patch — additive, source-only). Added a shared **`PlanStore` contract suite** on the test-only subpath `@retiregolden/planner-ui/data/planStoreContract` (`describePlanStoreContract(label, factory)`). It pins the semantics every `PlanStore` implementation must share — anchored in the interface doc comments in `data/planStoreContext.ts`: `listPlans` returns `{ id, name, updatedAtIso }` summaries with order not significant; `loadPlan` returns the stored document verbatim (any `schemaVersion`) or `null`/`undefined` when absent; `savePlan` upserts keyed by the document's own `id` (saving twice leaves one entry with the later content and `updatedAtIso`); `deletePlan` removes, and deleting an absent id does not reject. Each consumer supplies a factory (fresh store per test + a valid plan-document builder + optional cleanup), so both the public browser store (`indexedDbPlanStore`, exercised by `data/planStoreContract.test.ts` over `fake-indexeddb`) and Pro's desktop library store run the identical behavioral contract. The module depends on `vitest` + local seam types only — no engine or adapter imports — and is deliberately **not** re-exported from `src/index.ts` (it reaches the wire only via the package's `"./*"` → `"./src/*.ts"` map). Purely additive: no runtime code or public API changed, so the engine range is untouched.

**2026-07-21**
- Shipped **"Copy plan for your AI"** in the free web app — Goal 2, and the last open item, of enhancement `mcp-agent-surface.md`. A button in the results toolbar copies the current plan to the clipboard as `{ plan, startYear, schemaVersion, engineVersion }`: the real engine plan document (not a summary), in the subset of the RetireGolden MCP's `export_plan` envelope the browser can honestly fill, so a pasted payload spreads straight into `build_plan`. With the MCP installed an assistant's tools ingest it directly; without it, a model still receives structured *inputs* it can reason about instead of the results ledger the CSV export gives it. Clipboard, not a download (a plan is a few KB; pasting is one action). No prose line above the JSON — that would break `JSON.parse`, so the instruction lives in the UI hint, next to a privacy note stating plainly that whatever the user pastes into sees the whole plan under their own account and that provider's terms. `startYear` is emitted deliberately: `build_plan` defaults to the literal 2026 while the planner projects from the current year, so an unstamped payload would agree with the app throughout 2026 and diverge silently on 2027-01-01 (the same bug class already fixed in Pro's connector). `conventions` is deliberately **absent** — not `null`, not `{}` — because the MCP's convention knobs are benchmark session overrides with no engine or browser meaning, and an empty object would assert a posture the user never chose. Format documented in `DOCS/features/plan-file-format.md`; the `CopyButton` lifted out of the assumptions card now reveals the text in a selectable field when the Clipboard API is unavailable, so a failure hands the data over instead of dropping it. A round-trip test in this repo (with `@retiregolden/mcp` as a **dev** dependency — the first dependency edge of any kind to that package, and nothing reaches the browser bundle) feeds a real copied payload to the real `build_plan` and asserts the plan, start year, and projection come back unchanged. Building it surfaced a cross-product bug and got it fixed the same day: MCP 0.4.2's `run_projection` ran a federal-only tax stack where the browser combines federal with the engine's modeled state pack, so an assistant reported different numbers than the screen for a resident of a modeled state (~13% of ending net worth on the sample KY couple — and note `stateEffectiveTaxPct: 0` means "use the modeled pack", not "no state tax"). Fixed in `@retiregolden/mcp` **0.5.0** ([MCP PR #18](https://github.com/RetireGolden/RetireGolden-MCP/pull/18)), which also adds a browser-parity test on the consumer side; the dev dependency here pins 0.5.0 and the round-trip test now asserts the MCP's own `run_projection` summary equals the browser's, so the parity is guarded from both ends. The engine-provenance assertion is written against the MCP's *installed* engine rather than blanket-asserting no skew: the MCP exact-pins an engine version, so between an engine release and the MCP re-pinning, a correctly-stamped payload legitimately raises the caveat — asserting it away would couple this suite to another repo's release cadence.
- Added an **`ENGINE_VERSION` export** to `@retiregolden/engine` — available as `@retiregolden/engine/version` and re-exported from the root. The engine already exposed `PLAN_SCHEMA_VERSION` for the *plan format* but nothing for its own release, so a document the engine produced could not say which build produced it. The immediate consumer is the free web app's forthcoming "Copy plan for your AI" export (enhancement `mcp-agent-surface.md`, Goal 2), whose payload stamps `engineVersion` so the RetireGolden MCP's `build_plan` can raise its provenance caveat — *defaults and modeling semantics can move between engine versions* — instead of letting a divergent projection look authoritative. It is **generated** from `package.json` into a checked-in constant (`npm run generate:version`, following the existing `generate:schema` precedent) rather than read at runtime: the engine ships into browser bundles, where the `createRequire` pattern the MCP uses has no resolver, no filesystem, and no `package.json` to read. A unit test re-reads `package.json` independently and fails if the constant is stale — load-bearing rather than ceremony, since no CI job runs the generators and these artifacts are otherwise kept current by discipline alone (the same gap already applies to the generated Plan JSON Schema). **Version:** engine bumped `0.1.4 → 0.1.5` (patch; additive export, within the `^0.1.x` range consumers declare). Unlike 0.1.3's additive export, this one has a consumer that *depends* on it in the same wave: `@retiregolden/planner-ui` adopts `ENGINE_VERSION` in a follow-up PR and tightens its range to `^0.1.5`, so **0.1.5 must be published before that planner-ui release** — its registry-based pack-smoke cannot resolve the range until then. Releasing the engine on its own first is exactly the independence the additive-patch discipline is meant to preserve. **Not yet published** — the owner tags/publishes releases.
- Released **`@retiregolden/planner-ui` 0.4.3** for the export above (patch — additive `serializeSinglePlan` on the stability-promised `plan-format` subpath, plus the shared `CopyButton`). Its engine range tightened `^0.1.0 → ^0.1.5`: planner-ui now *depends* on `ENGINE_VERSION` rather than merely tolerating it, and the caret was not expressive enough to say so. **Engine 0.1.5 must therefore be published before planner-ui 0.4.3** — the registry-based pack-smoke cannot resolve the range until it is. That is why the engine export shipped as its own release first; see its entry above.

**2026-07-20**
- Added exact pre-projection MAGI history for IRMAA's two-year lookback. Plans may now provide optional year-keyed `historicalAnnualMagiByYear` values; a matching year takes precedence over `recentAnnualMagi`, which remains the backward-compatible fallback for older saved plans. This removes the prior first-two-projection-year ambiguity when consecutive historical tax returns have different MAGIs. The generated Plan JSON Schema and boundary tests cover the new input. **Version:** engine bumped `0.1.3 → 0.1.4` (patch; additive plan input). **Not yet published** — the owner tags/publishes releases.
- Added a **versioned Plan JSON Schema export** to `@retiregolden/engine` (enhancement `plan-ingestion-and-round-trip.md`, step 2; additive, no change to `planSchema`/`parsePlan`/any existing behavior). The engine now *derives* a JSON Schema (draft 2020-12) from `planSchema` with zod 4's `z.toJSONSchema({ io: 'input' })` — describing what `parsePlan` accepts, so a downstream AI client (the forthcoming MCP `describe_plan_schema` tool, built separately in RetireGolden-MCP) can learn the plan format and author a plan from a user's account statements. New surface: a `./schema` subpath exporting `planJsonSchema`, `PLAN_SCHEMA_VERSION`, `PLAN_SCHEMA_ID`, `PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS`, and `generatePlanJsonSchema()`. The schema is kept off the minimal root entrypoint so importing `simulatePlan`/`planSchema` never eagerly evaluates the ~130 KB schema constant. It ships two ways: a compiled constant and a checked-in static `schema/plan.v1.json` (in the npm `files`) for offline, no-import reads. Build-time generation via `npm run generate:schema` writes both from one generator (with a version-path guard that fails a future schema-version bump until the versioned artifact paths are updated); a sync test fails CI if the artifact drifts from `planSchema`. Discriminated unions (accounts/incomes) map to `oneOf` and the `schemaVersion` literal is preserved; cross-field refinements JSON Schema can't express (id references, funding rules, allocation weights summing to 100%, year-window ordering, …) are dropped by `z.toJSONSchema` and are therefore enumerated in `PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS` and summarized in the schema `description` — the structural schema is necessary but not sufficient, and `parsePlan` remains the full validator. Tests cover fixture parity (every parsePlan-accepted fixture, plus a kitchen-sink plan, validates via ajv), a pointed-path failure on a wrong-typed/missing field, the version, and schema↔planSchema sync. **Version:** engine bumped `0.1.2 → 0.1.3` (patch). The change is additive and stays within the `^0.1.0` range `@retiregolden/planner-ui` and the web app already declare, so the engine **releases independently** (as 0.1.1/0.1.2 did) and consumers pick it up on their next resolve — no coordinated planner-ui release and no workspace/registry version skew. (A strict-semver reading would treat a new export as a minor; a minor would force `^0.2.0` range bumps across planner-ui and the app and would fail their registry-based pack-smoke checks until engine 0.2.0 is actually published, so the additive change ships as a patch instead.) **Not yet published** — the owner tags/publishes releases.
- Migrated npm publishing to **Trusted Publishing (OIDC)** with a manual-approval gate (PR #32): both package workflows now authenticate via GitHub's OIDC token instead of the long-lived `NPM_TOKEN`, pin npm to `^11.5.1` for OIDC support, and run the publish job in the `npm-publish` environment (required reviewer plus an `engine-v*` / `planner-ui-v*` tag deployment policy). Provenance is still generated automatically; a `guard` job keeps manual dispatches dry-run-only.
- Released **`@retiregolden/engine` 0.1.2** to npm (patch — bug fixes, no API changes): graceful handling of tax-solver discontinuities, a fix to the tax-withdrawal fixed-point convergence, and the SC H.4216 / ME 2026 state-tax corrections (ORACLE-016/017 kept outside the SCIAD and ME deduction phase-outs) backed by external oracle fixtures. 0.1.2 is eligible under the `^0.1.0` range — a fresh resolve selects it; consumers with a pinned lockfile pick it up on their next update.
- Released **`@retiregolden/planner-ui` 0.4.2** to npm (patch — no API changes): rebaselined the projection characterization goldens to track the engine 0.1.2 tax fixes, and cleared a Semgrep XSS false positive in the pack-smoke script.

**2026-07-17**
- Released **`@retiregolden/engine` 0.1.1** to npm (patch — corrected data, no API changes): the GA 2026 rate/deduction fix (4.99% / $15,000–$30,000, DOR vintage), the full 2026 state-pack staleness sweep (legislated rate changes in IN, MS, MT, NE, NC, OH, OK, NY; Missouri's HB 594 individual capital-gains exemption; ME/SC 2026 rewrites from PR #23 review — ME decoupled deduction + 2% surcharge, SC H.4216 SCIAD + 1.99%/5.21%; federal-conformed standard deductions aligned to the 2026 federal figure), and the re-anchored SPIA payout-rate planning table. Patch semantics chosen deliberately: `^0.1.0` consumers pick up the corrected 2026 math automatically.

**2026-07-09**
- Shipped survivor & widowhood transitions + IRMAA relief (market-research Tier 2.1; all four steps of `DOCS/enhancements/survivor-widowhood-and-irmaa-relief.md`; feature-off proven byte-identical — `cases:diff` vs main shows no case deltas):
  - **SSA-44 IRMAA redetermination (opt-in)**: `expenses.healthcare.ssa44` models Form SSA-44 relief after a qualifying life-changing event — a couple's first death, and optionally each person's retirement (work-stoppage) year. In the two premium years after an event (the years whose two-year lookback still references pre-event income), IRMAA MAGI = min(lookback, prior-year) — the prior year is the documented planning-grade stand-in for the current-year estimate (same convention as the ACA credit), and the min encodes that a redetermination is only filed when it helps. The Roth optimizer prices it in-solve: flagged premium years shift their IRMAA-binary source from year (t−2) to (t−1) (probe → `OptimizerYear.ssa44Redetermination`), a conservative single-source stand-in the exact-ledger tournament refines. New Spending → Healthcare toggles; new per-year `medicarePremiums` + `irmaaTier` reporting fields on `YearResult`; fixtures cover survivor and retirement windows, never-raises-a-premium, the optimizer LP source shift, an economic solve case, and feature-off byte-identity. Domain rules §7 documents the treatment.
  - **Survivor transition view** (`/plan/:id/survivor`, Explore rail, couples-only): sweeps earlier first-death timings (ages 70–90, either spouse first) by re-running the user's own plan with `deathAgeByPersonId` overrides on the same deterministic ledger as Results — filing-status timeline, survivor Social Security step, tax on similar MAGI across the transition, IRMAA with/without SSA-44 (tier and premium delta per window year), survivor spending coverage (shortfall years + investable low point), and the convert-while-joint lever (the detector's fill-the-12%-bracket patch priced as an ordinary scenario). A one-click callout can turn SSA-44 modeling on when timings show unmodeled relief. `planner/survivorAnalysis.ts` is pure and test-guarded to agree exactly with hand-run scenarios; educational framing throughout (timings are chosen scenarios, never predictions).
  - **Detector upgrade**: `widows-penalty-roth` keeps its original screens and now quantifies the survivor bracket jump on the plan's own first survivor year (same MAGI priced single vs joint, today's dollars) and points at SSA-44 when survivor-window premiums land in a surcharge tier the plan isn't relieving; the conversion-acceleration preview scenario is unchanged and still priced on the exact ledger.
  - **Learning Center**: new `appealing-irmaa-ssa-44` article (Healthcare, sourced to SSA/Medicare.gov) wired to the new field, the survivor view, and the widow's-penalty detector; the existing `widows-penalty-and-survivor-brackets` article extended with the Medicare/IRMAA row, SSA-44 cross-links, and the new view's route.
  - **QSS/IRMAA correctness fix (from PR review)**: qualifying-surviving-spouse years now price Medicare premiums on SSA's **individual** threshold table (POMS HI 01101.020 groups QSS with single/HOH) instead of the joint table the income-tax mapping uses — previously QSS survivor years could understate IRMAA. Results-moving only for plans with `hasQualifyingDependent` whose survivor-year lookback MAGI lands between the single and joint thresholds (`cases:diff` clean — no example plan does).
- Shipped the state-relocation compare ("where should I retire?" on your real plan; market-research Tier 2.6, steps 1–3 of `DOCS/enhancements/state-relocation-compare.md` — read-only sweep over shipped machinery, no schema change):
  - **Relocation Compare page** (`/plan/:id/relocation`, Explore rail): pick up to 5 candidate states (optional split-year move year, optional flat local rate, optional flat cost-of-living spending delta) and run the user's actual plan once per candidate in a Web Worker (`engine/projection/relocation.ts` + `src/relocation/`). Rows rank by lifetime state+local tax, lifetime taxes & penalties, ending after-tax estate (today's dollars), and a Monte Carlo success rate on **shared market paths** (same seed/model per row, so path N is the same market history in every state). Each candidate is expressed as a scenario patch over the existing `household.state`/`stateMoves`/assumptions fields — proven **byte-identical to manually editing the plan's state**, and "Add as scenario" round-trips to exactly the row the sweep ran. Candidates clear a flat state-rate override (it would mask the modeled packs); the UI calls this out, states the income-tax-only scope prominently (property/sales/COL/healthcare named as out of model), and never recommends a "best state".
  - **Per-state driver drill-down**: the sweep records the ledger's final per-year state-tax lines through the production calculator, then re-prices each year with one state rule neutralized at a time through the identical code path (new exported `computeStateTaxYearTotal` with a params hook) — attributing lifetime state tax to SS treatment, retirement-income exclusions (shared-rule vs separate public-pension bucket surfaced distinctly), and capital-gain treatment, with a runtime reconciliation guard proving the unmodified recomputation matches the ledger's lines exactly.
  - **`state-relocation` detector upgraded** (screen conditions preserved): `evaluate()` now runs the same deterministic sweep over a zero-income-tax shortlist (FL/TX/WA), quantifies the lifetime state-tax drag in today's dollars, and previews the top candidate as a scenario — copy reframed neutrally ("worth a look", income tax is one factor). The Learning Center article ("what actually changes when you move states") is dispatched separately (Codex).
  - CA→FL vs CA→PA public-pension fixture proves the pension-exclusion driver surfaces (PA's shared full exclusion vs NY's separate public-pension law), move-year candidates match manual split-year edits, deterministic metrics are seed-stable, and `sharedPaths` gained per-entry tax calculators for per-candidate local rates. Full suite green (1,603 tests, +11 new).

**2026-07-08**
- Shipped annuity depth v2, pension lump-sum, and home-equity (HECM) decisions (market-research Tier 2.3 + 2.4 + 2.5; all five steps of `DOCS/enhancements/annuity-pension-and-home-equity-decisions.md`, additive/no-op-default throughout — plans that use none of it are byte-identical):
  - **Annuity payout forms + ladders**: `payoutForm` on annuity accounts — life-only (default), life with N-year period certain (guaranteed payments continue to the household if the owner dies inside the window), and joint & survivor (a chosen share continues to the other household member for life). Non-qualified exclusion-ratio taxation extends per form (IRS Pub 939 General Rule): period certain floors the expected-return multiple at the guarantee; joint & survivor decomposes by expectation over the SSA-derived joint last-survivor expectancy (documented planning-grade approximations of Pub 939 Tables III/VI/VIA, hand-worked method fixtures). Annuity ladders (multiple dated purchases) are first-class, and the purchase candidate generator gained a laddered SPIA candidate (three tranches at now/+3y/+6y).
  - **Annuitization sweep ("how much to annuitize?")**: `buildAnnuitizationSweep` runs a bounded 0–30% allocation grid through the shared-path Monte Carlo primitive — each point trades that share of investable assets for a life SPIA priced from a new sourced payout-rate planning table (`engine/decisions/spiaQuotes.ts`; user quotes override) — and reports the success-vs-legacy frontier on the Monte Carlo page's Frontier views. Kitces glidepath attribution: allocation-matched controls (the premium shifted bonds→stocks *without* buying the annuity) isolate the implicit rising-equity-glidepath share of the benefit from what annuitization adds beyond it.
  - **Pension lump-sum vs annuity decision**: pensions can record a `lumpSumOffer` (amount + election year) and an optional `lumpSumElection`; electing commutes the pension — a tax-free direct rollover into a chosen traditional account in the election year, priced by the ledger. The Accounts section gains a decision view: the annuity's PV at a curve-anchored discount rate (TIPS real yield + inflation), the survivor option's PV value, and a discount-rate × longevity sensitivity table (hand-worked PV goldens) — framed as tradeoffs, never advice. `pensionLumpSumGenerator` supplies the keep-vs-take scenario pair to the decision engine.
  - **HECM line of credit (buffer asset, Pfau)**: opt-in on a primary residence — line sized by the lender quote or the pack's published HUD principal-limit factors (5.875% expected rate, 2026; provenance id `hecm-plf`), the unused line and the loan balance both compounding at the entered growth rate (default 7.5% = rate + MIP), financed upfront costs, and two draw policies: coordinated (draw tax-free for spending in the year after a negative market return, letting depressed assets recover) and last-resort (draw only when the portfolio is exhausted); any open line backstops a true shortfall. Non-recourse honored end to end: sale payoff never exceeds the proceeds, and net worth/estate cap each loan at its home's value. New `hecmDraw`/`hecmLoanBalance` year fields; a deterministic crash-then-recover fixture reproduces Pfau's coordinated > last-resort > no-HECM direction.
  - **Insights detectors**: `annuitization-headroom` (planning to 95+ with liquid savings and no lifetime income beyond SS), `pension-election-pending` (undecided offer, quotes the PV comparison), and `hecm-buffer-candidate` (house-rich/portfolio-thin at 62+) — each previewing a ledger-priceable scenario. Learning Center articles are dispatched separately (Codex).
  - Substance folded into domain rules §19; SPIA payout table and HECM PLF refresh cadence added to the maintenance schedule. Full suite green (1,550 tests at ship, +46 new).
- Shipped spending paths, SWR lenses & longevity-as-a-distribution (market-research Tier 2.2/2.7/2.8/2.10/2.11; steps 1–5 of `DOCS/enhancements/spending-paths-and-swr-lenses.md` — the Learning Center cluster, step 6, remains open for Codex). All opt-in; feature-off plans proven byte-identical (`cases:diff` vs main shows no case deltas):
  - **Spending-shape presets** (`engine/spending/shapePresets.ts`, Spending screen): constant-real, retirement smile (shipped calibration unchanged), new retirement **smirk** — Blanchett's *median* retiree, a steady −1%/yr real decline with no late uptick, compiled as compounded 5-year phase steps to age 100 — front-loaded travel, and a **custom annual real delta**, all writing ordinary editable `expenses.phases` rows at creation time (no schema bump, anti-drift). The "How much can I spend?" page gained a **solve-per-shape** view quantifying the shape-aware initial-spending uplift on the user's own plan; a solver fixture proves the smirk uplift direction.
  - **Amortized spending (ABW)** — the Bogleheads-formalized amortization-based-withdrawal family (VPW/TPAW/CAPE rules are members) as a new opt-in spending policy (`expenses.spendingPolicy.mode = 'abw'`; pure math in `engine/spending/abw.ts`): each year the recurring lifestyle target is the actual start-of-year portfolio re-amortized over the remaining horizon (annuity-due, matching the ledger's spend-then-grow timing; the payment ratio is inflation-invariant). Parameters: expected-return source (fixed real %/yr with a one-click **VPW preset** at 3.8% — the VPW wiki's global stock/bond IRRs weighted 60/40 — or a CAPE earnings-yield blend, or a TIPS real yield) × horizon (planning age or the 25%/10% survival-percentile age, joint for couples) × spending tilt. Healthcare, debt, property, insurance, and one-time goals stay separately modeled on top; the payment funds through the normal tax cascade. Fixtures prove the amortization identity (exact depletion at the horizon under realized = expected returns) and the tax cascade; per-path re-amortization works unchanged under Monte Carlo. The Monte Carlo "Adjustment outlook" card is now correctly scoped to the two guardrail modes (ABW re-amortizes instead of cutting), and the HTML report summarizes the ABW policy.
  - **"Whose 4% rule?" SWR comparator** (`engine/decisions/swrComparator.ts`, on the "How much can I spend?" page): Bengen 2025 (4.7%, *A Richer Retirement*), Morningstar 2026 (3.9%, *State of Retirement Income*), and the ERN CAPE rule (1.75% + 0.5 × 100/CAPE) each priced on the user's own plan with one deterministic exact-ledger run (same-path deltas by construction), with citations, next to the plan's own solved answer expressed as a rate — published rules of thumb vs. the plan-specific number, none endorsed.
  - **Survival-percentile planning ages** (`engine/montecarlo/survival.ts` + a Household-screen "Percentile" picker): planning age as "the age I/we have a 25% (10%) chance of reaching" — single and joint ("either of us", independent lifetimes) — from the same SSA 2022 q(x) derivation the stochastic-longevity engine uses, with an optional proportional-hazards health adjustment converted from the saved longevity questionnaire's multiplier (the Actuaries Longevity Illustrator pattern, no second factor set). The picked age writes once with provenance (`longevity.source = 'percentile'` + the pick spec, shown on the assumptions card); never silently recomputed; fixed-age plans unchanged.
  - **Bucket reporting lens** (`planner/bucketLens.ts` + an opt-in Results card, off by default): the projected balances re-read as time-segmented buckets — "the next N years of net spending" (spending + taxes − income, floored at 0; classic 2yr/8yr/growth and 3yr/growth presets) — reconciling to the ledger's investable total every year by construction, with the honest Estrada/Kitces evidence note: buckets are reported, never managed; the plan stays invested (and simulated) total-return.
  - Model additions are all optional-with-defaults (no schema version bump): `spendingPolicy.mode: 'abw'` + `spendingPolicy.abw`, `longevity.source: 'percentile'` + `longevity.percentile`, and an exported `ExpensePhase` type. Ground truth folded into domain rules §14 ("Spending paths & SWR lenses") and features/README §1/§4.
- Shipped the Social Security bridge & TIPS-ladder income floor (market-research Tier 1.4 + 1.5 + funded-ratio hook 2.9; all six steps of `DOCS/enhancements/social-security-bridge-and-tips-ladder.md`):
  - New pure `engine/ladder/` module: back-to-front rung solve for a level real income (the tipsladder.com construction), curve-interpolated par-TIPS pricing, `realPresentValue` on the TIPS curve, SS bridge sizing (`bridge.ts`), and the funded ratio (`fundedRatio.ts`). Golden-tested against the level-annuity identity and the mid-2026 regime claim (30-year ladder at ~2.7% real supports ~4.8–4.9% real SWR).
  - TIPS ladders as plan artifacts (`plan.incomeFloor.ladders`, additive/optional — no migration): purchase funding transfers the quoted cost out of cash/taxable (realizing gains pro-rata, scaling down with a warning when short), and cash flows run inside the ledger with real TIPS taxation — coupons + annual inflation accretion (phantom OID) are federal ordinary income including NIIT, **exempt from state tax** via a new universal `TaxYearInput.usGovernmentInterest` field (31 U.S.C. §3124; honored by modeled packs, split-year proration, and the flat-override path); maturing principal is a tax-free return; unmatured face rides in `YearResult.ladderValue` → net worth. New `incomes.tipsLadder` category flows through Results charts and the ledger CSV.
  - SS bridge as a one-click artifact: a bridge panel on the Social Security Optimizer sizes each claimant's bridge (forgone age-62 benefit × retirement→claim gap years, the BPC framing), quotes the TIPS ladder, adds it to the plan, and prices "claim at 62" vs "delay" vs "delay + bridge" on the same deterministic ledger and the same 500 seeded Monte Carlo paths. `bridgeLadderGenerator` proposes bridge/no-ladder candidates to the decision engine (category `guaranteed-income`).
  - Funded-ratio card (Pfau's household pension-accounting lens) on Results and the new **Income floor** planner page: required-floor spending vs guaranteed income (SS, pensions, annuities, ladders), both read from the same projection years, deflated, and discounted on the embedded TIPS curve — plus the unfunded-gap PV.
  - New Insights detectors: `ss-bridge-gap` ("your gap years are unfunded — preview a sized bridge as a scenario") and `income-floor-funded` ("your floor is X% funded", advisory).
  - Embedded Treasury real-yield curve snapshot (`params/data/realYieldCurve2026.ts`, provenance id `real-yield-curve`, annual refresh cadence in the maintenance schedule, "curve as of" label on every quote). Opt-in FedInvest CUSIP price fetch (`engine/ladder/fedInvest.ts`) — the app's only outbound network request, explicit-click only, day-cached in localStorage, CSP `connect-src` opened to treasurydirect.gov only; because FedInvest sends no CORS headers the UI degrades gracefully and offers a zero-network `securityprice.csv` import fallback (CSV format verified against the live endpoint).
  - Three Learning Center articles (`tips-ladders`, `social-security-bridge`, `funded-ratio`) wired to detector cards and field help.
  - Feature-off proven byte-identical: full suite green (1,433+ tests incl. new ladder/ledger/state-tax/detector/generator fixtures covering both inflation regimes) and `cases:diff` vs main shows **no case deltas** across the example library.
- Shipped onboarding imports & cross-tool migration (all six steps of the enhancement plan; UI + pure client-side mappers, no engine change):
  - Export-format hardening: the plan backup JSON is now a documented contract (`DOCS/features/plan-file-format.md` — envelope, schema versioning, migration guarantees, round-trip exactness, unknown-field handling) enforced by tests: every example-library plan round-trips serialize→parse exactly, a pinned full-featured v1 export must stay importable forever (CI fails if a schema change would strand old backups), and the docs-consistency suite pins the documented versions to the code.
  - New `/import` wizard ("Import from a file" on the planner home) with four guided paths, each producing a draft plan through the same validated route as backup import, behind a shared review checklist (Imported / Assumed — review / Not imported / Skipped) so nothing imports silently: broker positions CSV (Schwab section format, Fidelity account-column format, Vanguard holdings download; balances + cost basis where present, account types guessed from labels with visible review items), ProjectionLab JSON export (accounts/income/spending/milestone mapping, version-sniffed, format drift refused with a helpful message), generic spreadsheet/RPM CSV (header detection + per-column role guesses with a manual column-mapping step), and a 1040 guided seed (~12 typed line values → filing/state/household, wages, an explicitly-estimated taxable account from interest/dividends at an assumed yield, pension, SS benefit basis, and the IRMAA-lookback MAGI; no PDF/OCR — deferred by design).
  - Accounts screen: "Update balances from a broker CSV" panel for returning users — assign each account found in the file to a plan account and refresh balances (and taxable cost basis) without retyping.
  - Security: all imported files treated as hostile input (hardened RFC-4180 CSV core with size/row/column caps, every number through a strict money parser, JSON caps, formula/markup strings kept inert) with adversarial test suites per mapper, à la the SSA XML importer.
  - Learning Center: "Moving to RetireGolden" and "Seed your plan from your tax return" (Using RetireGolden), wired to the new route; sustainability statement now points at the format contract.
- Shipped the trust & transparency layer ("show your work"; additive UI over existing evidence payloads, no engine change):
  - Per-plan assumptions card at `/plan/:id/assumptions-card` (linked from Results and Assumptions): every live assumption — economy, per-account returns/allocations, longevity, law toggles, strategy settings, and the parameter pack — tagged user-set / app default / published source, with "Copy as text" and "Copy as JSON" exports (the JSON round-trips the assumption values shown on the card exactly; the remaining plan inputs travel in a plan backup).
  - "Why this number?" explainer panels: Monte Carlo success % (what it counts, model/seed/precision, depletion-year trace, first-decade p10-vs-median sequence sensitivity), the optimizer recommendation (objective, winner, margin over runner-up and over the solver's schedule, plus a table of every beaten alternative with dollar margins from the exact-ledger tournament), and the spending-solver answer (bisection method, binding constraint, simulation count).
  - Cite-the-authority tooltips: field ⓘ bubbles can now carry a `source` link to the parameter's provenance entry (IRS/CMS/SSA etc.), wired to the conversion fill-target, QCD, recent-MAGI, state-override, and trust-fund-cut fields.
  - Asset-location invariance, proven: new fixture suite `engine/decisions/assetLocationInvariance.test.ts` (green — no defect found) shows a zero-tax conversion between identically-allocated accounts leaves every year's totals identical, the estate benefit is exactly the heir-tax term, and conversion candidates can never smuggle in an allocation change; public claim added to the methodology posture note.
  - In-app "How RetireGolden is tested" page at `/how-tested` (linked from Results and the Disclaimer): one-auditable-ledger story, external-oracle suites with build-time (glob-derived, never-stale) counts, the optimizer parity-harness summary, golden/regression gates, and the deliberate simplifications stated as prominently as the strengths.
- Shipped risk-based guardrails & probability-of-adjustment reporting (market-research Tier 1.2 + 1.3):
  - New `riskBasedGuardrails` spending-policy mode: spending adjusts when the real portfolio balance crosses dollar thresholds solved from the user's target probability-of-success band (default 70–95%), instead of the withdrawal-rate ratio. Same discretionary rationing machinery as G-K; the required floor is never cut; unsolved thresholds leave the mode inert.
  - Shared-path threshold solver (`engine/montecarlo/riskBasedGuardrails.ts`): bisection over the starting-balance scale on identical seeded Monte Carlo paths finds the balances matching the band edges and sizes the $/mo cut/raise that restores the band midpoint; runs on demand in a worker from Spending and persists the thresholds on the policy.
  - Adjustment-outlook reporting for any guardrail plan (`MonteCarloSummary.adjustments` + Monte Carlo card): P(any cut), median/p90 deepest cut, average/p90 cut years, longest cut spell, P(raise), P(ending surplus), and P(estate clears the bequest target) — the Kitces "probability and magnitude of adjustment" framing alongside the classic success %.
  - Surfaces: Spending mode picker + band fields + solve button with dollar readout, Results risk-based guardrail callout + `guardrailFactor` CSV column, report spending-policy summary line, insights detector/safe-spend generator treat risk-based plans as already guardrailed, `risk-based-guardrails` Learning Center article, domain rules §14 entries.
  - Fixtures: solver band-reproduction/determinism tests, ledger integration tests, and a 2007-retiree historical-sequence fixture demonstrating the G-K vs risk-based cut-depth delta. Plans without guardrails are byte-identical (regression-tested).
- Shipped the ground-truth 2026 law & oracle sync (Tier 0 of the July market research; three verifications, one real gap found and fixed):
  - **Correction — OBBBA senior deduction now priced in-solve by the Roth optimizer.** The $6k/person (65+) deduction and its 6%-of-MAGI phase-out ($75k/$150k thresholds, 2025–2028) were in the tax ledger but invisible to the MILP: the optimizer left ~$6k/person of cheap-bracket conversion headroom unused in those years and undercharged conversions inside the phase-out band (true marginal rate = bracket × 1.06). Now modeled as a deduction constant plus a convex phase-out floor (same pattern as the taxable-SS phase-in PWL), always on in production, byte-identical LP when absent. A new optimizer fixture proves the phase-out flips a marginal conversion; the trad-heavy characterization fixture's exact after-tax estate improved ~$1.2k, and the example-plan library shows no case deltas (`cases:diff`).
  - **Correction — Social Security trust-fund default updated to the 2026 Trustees Report.** The 2026 report (June 2026) projects combined OASDI depletion in Q3 2034 with **83% of benefits payable**, so the haircut toggle default `TRUSTEES_DEFAULT_SS_HAIRCUT` moved from 19% to **17% from 2034** (single definition site; `ScenariosPage` literal defaults now import it). Learn articles and DOCS citations updated; the OASI-only figures (2032, 78% payable) are documented alongside.
  - Owl parity harness re-pinned from `f0c3942d` to `f09b4022` (tag `v2026.07.04`, Owl's current release) in both the TS manifest and the Python runner; `npm run owl-parity -- --install-owl --strict-owl` regenerated and the gate **passes on every fixture** — margins +$98 (high-tax state, narrowed from +$3.0k by Owl's newer release) to +$141.4k (balanced low-basis couple). Competitive analysis, optimizer feature doc, and external-oracle-comparisons updated.
  - (The fourth Tier-0 item, the 2026 ACA applicable-percentage verification, had already been completed by the hardening plan.)
- Shipped the UI/UX critique remediation (site-wide product-quality pass; UI/copy/CSS only, zero engine deltas):
  - Insights surface rebuilt on the design-system tokens/classes (no more inline-style island, undefined CSS variables fixed and guarded by a static test, SVG icons, theme-aware badge tints).
  - All native `window.prompt`/`confirm`/`alert` call sites replaced with in-app dialogs on the shared Modal; "Clear all data" now requires typing `delete` and offers a one-click backup first.
  - Monte Carlo model picker: 3 plain-language presets (Smooth randomness / Replay real history / Stress test) + an "Advanced models" disclosure holding the full 15-model catalog; byte-identical configs per seed (wiring-tested); competitive tooltip copy removed.
  - Copy clarity: "exact-ledger", "patch", and machine labels removed from user-visible strings; bad Monte Carlo verdicts now carry a handrail linking to Insights and "How much can I spend?".
  - Accessibility: WCAG AA contrast in light/dark/toggled-dark (accent `#0C8F66` → `#0B7A56`; token-computed contrast test), valid plan-card ARIA (no nested-interactive), aria-live save indicator, authored `:focus-visible`, chart text alternatives.
  - Mobile: ≥44px effective touch targets on coarse pointers, single-row scrollable KPI bar at 375px, scrollable rail chip strip, and a compact no-hamburger header.
  - KPI plan-completeness state: half-entered plans show "Getting started" instead of a red depletion verdict; red KPI values and the Results depletion notice link to Insights.
  - Polish: shared stat-tile classes replace inline styles, Learn reading measure tightened, reduced-motion coverage extended, transform-based progress fill, disclaimer de-duplication (app footer is authoritative).
- Completed the surpass-Owl program (Track 1 Steps 2-6 + convergence loop): in-LP taxable-gain realization, bracketed state tax and the taxable-SS phase-in PWL, IRMAA two-year lookback in-solve, co-optimized SS claim age, windowed bracket-fill candidates, and top-two search refinement. `npm run owl-parity` now passes on every fixture (RetireGolden beats pinned Owl by +$3.0k to +$141.4k of exact after-tax estate).
- Exposed the opt-in "Also optimize Social Security claim age" toggle on the Optimize tab; a winning claim change and its conversion schedule apply atomically.
- Added the UI/UX critique remediation enhancement plan (shipped the same day; see above).
- Restored docs clobbered to one-line placeholders by 2026-07-07 docs commits (4413fc1/b56b2a3): `DOCS/features/social-security.md`, `DOCS/enhancements/gap-analysis-closeout.md`, `DOCS/enhancements/assumptions-deep-dive-and-learning-center.md`, and `DOCS/enhancements/early-investing-and-fire.md` (re-applying their intended retired-`gap-analysis.md` reference edits); synced feature-doc ground truth (MC model library, example-library count, optimizer index summary).
- Shipped codebase hardening & drift repair (all five phases of the desloppify remediation plan):
  - Verified the 2026 ACA applicable-percentage table against IRS Rev. Proc. 2025-25 (values were already correct; provenance now cites the Rev. Proc. and the maintenance schedule tracks the annual check).
  - Autosave now flushes on `pagehide`/`visibilitychange` (closes the tab-close/PWA-kill data-loss window); Monte Carlo and SS-analysis worker failures surface error banners instead of stuck spinners; the spending chart's duplicate category color fixed with a new `--chart-8`.
  - Delivery/offline: Examples and Compare are lazy routes (entry chunk 1,005KB → 822KB), the 3MB HiGHS WASM and Learn images are runtime-cached (optimizer + read articles work offline), header logos shrunk 385KB → 12KB each, and `npm run build` now generates `sitemap.xml` (129 URLs) referenced from robots.txt.
  - Enforcement: CI test job runs coverage thresholds; new Playwright smoke suite (persistence roundtrip, Results/Monte Carlo render, backup export→clear→import, lazy routes).
  - Structure: 2,850-line `sections.tsx` split into `planner/sections/` behind a barrel; `engine/socialsecurity` merged into `src/socialSecurity`; `TRUSTEES_DEFAULT_SS_HAIRCUT` centralized in `engine/params`; money formatter, chart tooltip style, worker promise wrapper (`workers/run.ts`, with sibling-termination on pool failure), and guarded localStorage access (`data/localStore.ts` + `STORAGE_KEYS`) each deduplicated to one home.
  - Docs/dead code: code-map/README/index.html-meta drift repaired (with a new docs-consistency test), dead v1 CSS selectors removed, `samplePlan` moved to `testSupport/`, planStore list pipelines folded.
  - Engine output verified byte-identical to `main` via `npm run cases:diff` (no case deltas).

**2026-07-07**
- Closed remaining July gap items (G1-G2, G4-G7; G3 asset-location surfacing intentionally limited to Insights detector).
- Docs sync: ground-truth DOCS updated to match all shipped July enhancements.
- Merged local case runner + self-contained HTML report export (`npm run cases`, report downloads with assumptions/provenance/ledger/optimizer evidence).
- Shipped stochastic frontier & risk metrics (after-tax estate percentiles, depletion prob, expected shortfall, spending shortfalls; frontiers + historical stress).
- Shipped guaranteed-income & estate depth (annuity purchases SPIA/QLAC, per-account beneficiaries with heir tax class + charity, survivor reserve, `annuityPurchaseGenerator`).
- Shipped account/HSA/fixed-asset depth (accountEligibility service, HSA medical sub-ledger + reimburse, nondeductible IRA basis/pro-rata, fixed asset §121 + tax fields, safety-net floor).
- Shipped asset allocation & return model v2 (4-class opt-in allocation + glidepaths + rebalancing + taxable realization; class yields for drag; MC class-correlated shocks; `assetLocationGenerator`; editable Assumptions table).
- Shipped social-security survivor precision (family-max cap on auxiliaries, ARF credit to spousal/survivor, claim-month proration, SS optimizer using shared exact-ledger + objective ranking).
- Various review fixes, guardrail patch hardening, and CI/docs chores.
- Added 8 new A/B example plans (4 feature demonstrations + 4 matched controls) to the Example Library, plus Learning Center articles, to make it easy to test the July depth wave features (guardrails, annuities+estate, allocation+glidepaths, HSA+fixed-asset depth) via Compare Plans and the case runner.

**2026-07-06**
- Shipped spending guardrails + flexible goals (required/target/ideal/excess layers, movable/skippable/fixed one-time goals with windows/priority/partials, Guyton-Klinger guardrails protecting required, MC metrics, Insights preview actions; additive schema).
- Shipped sustainable spending & objective modes (survivorSpendingPct, bequestTargetDollars feeding estate floors, spending profile presets, SpendingSolverPage + solver worker, objective policy selector + ranked tournament, headroom detector).
- Shipped tax & income-coverage depth (AMT planning-grade, localIncomeTaxPct, death-year MFJ + QSS, state CG conformity metadata for select states, income-coverage fixture/checklist for recommendation trust).
- Asset allocation, tax depth, guardrails, and sustainable PRs landed with reviews.
- Added difficulty/risk scores to enhancements index.

**2026-07-05 to 07-02**
- Shipped ledger-native decision engine core (shared CandidateGenerator / evaluate / tournament / objective policies / generators seam used by Optimize, SS analysis, Insights, spending solver).
- Shipped Roth/tax optimizer exact-ledger post-processor + validation (MILP trim + exact-ledger tournament arbitration for recommendations; beneficial/neutral/rejected states).
- Shipped tax/brokerage/healthcare depth gaps (ACA proration, pension buckets, split-year moves, taxable drag with yields).
- Planning-depth clean-room roadmap closed out and dispatched.
- Strategy/Spending/Insurance Learning Center audit + links shipped.
- Home page redesign (adaptive welcome + paths + examples).
- Example plan library at /examples.
- Early investing & FIRE support (time-phased contributions + salary growth + match, FI metrics, new examples + LC category).

## 2026-06

- Groundwork for decision engine, insights detectors, and objective policies.
- Assumptions deep-dive + Learning Center category.
- Multiple optimizer fixture + exact-ledger convergence work.
- Gap-analysis closeout plan executed (SSDI, survivor precision foundations, FICA/SE education view, FRA credit validation, proprietary LICENSE + THIRD-PARTY-NOTICES, spike deletion).
- Enhancements program formalized with scores; many depth plans moved to shipped.

## 2026-05 to early June (v2 Foundations)

**2026-06-11 onward (v2 planner)**
- Added v2 planning docs.
- Core v2 engine: deterministic projection, federal tax + RMDs, healthcare (Medicare/IRMAA/ACA), penalties, QCDs.
- Full Social Security integration (PIA from earnings, survivor, earnings test).
- Roth conversions + withdrawal strategies.
- Monte Carlo engine + worker pool + scenarios/compare.
- Rebuilt planner UI/shell around full household plan model (replaced earlier single-purpose SS/longevity workbench).
- Persistence: IndexedDB + JSON backup/restore.
- Original routes (`/social-security`, `/longevity`) retired in favor of integrated `/plan/*`.

**2026-05-13 (Initial)**
- Project initialized as RetireCalc (React + Vite + TS + Azure SWA CI).
- Life expectancy / longevity calculator (M2).
- Social Security calculator (M3): claiming ages, breakeven, PIA from earnings (M4), PDF export (M5), couple/spousal/survivor (M6).
- mySSA XML import, wizard UX, storage, tests, error boundaries.
- Early roadmap / backlog docs.
- JSON data portability.

## Notes

- The app evolved from a focused Social Security + longevity tool (RetireCalc) into a full privacy-first, browser-only retirement planner with taxes, optimization, Monte Carlo, Learning Center, and deep modeling.
- July 2026 saw a concentrated "depth wave" delivering most of the advanced planning features (allocation, guardrails, objectives, estate/annuity, SS precision, etc.) while keeping additive/no-schema-bump discipline.
- Historical detailed build plans (even shipped ones) live in `DOCS/enhancements/`. Ground-truth descriptions of current behavior live in `DOCS/features/`, `DOCS/domain/`, architecture, etc.
- No formal semantic versions; development is commit- and date-driven with frequent exact-ledger + test guardrails.

For the live app and full source, see the repository and https://retiregolden.app/.
