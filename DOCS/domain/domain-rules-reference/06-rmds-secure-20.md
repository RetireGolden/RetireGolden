## 6. RMDs (SECURE 2.0)

- Start age: **73** for born 1951–1959; **75** for born 1960+ (i.e., from 2033).
- Annual RMD = prior Dec 31 balance ÷ Uniform Lifetime Table divisor (Joint Life Table II when a sole-beneficiary spouse is >10 yrs younger).
- Joint Life Table II is 26 CFR 1.401(a)(9)-9(d), Table 3. It includes spouse-beneficiary ages below 20; do not regenerate it from Pub 590-B displays that only show the age 20+ slice (`treas-reg-1-401-a-9-9-d-joint-life-table-divisor-literals`).
- Applies to traditional IRA/401(k)/403(b); **Roth 401(k) exempt since 2024** (IRC §402A(d)(5); `irc-402A-d-5-designated-roth-account-no-lifetime-rmd`); Roth IRA exempt (`irc-408A-c-4-roth-ira-no-lifetime-rmd`).
- **IRC §4974 excise.** The default tax is **25% of the actual shortfall** —
  `max(0, required − distributed by the statutory deadline)` — and is charged to the payee on the year row's
  `penalties` channel, outside AGI/MAGI. It is not 25% of the whole required amount when part was paid. The rate
  becomes **10%** only when the whole shortfall is distributed from the same applicable plan (or a legally
  aggregable IRA/403(b) group) **and** a return reflecting the reduced tax is filed inside the correction window.
  The window ends at the earliest of a notice-of-deficiency mailing, assessment, or December 31 of the second
  taxable year beginning after the tax year; the first two dates can shorten the calendar-year endpoint. A
  reasonable-error waiver request does not erase the tax: only an explicit modeled grant does. The two automatic
  waiver fact patterns, for tax years beginning in 2025 or later, are the final regulation's EDB
  pre-RBD-death/life-expectancy-default-to-10-year election and the
  beneficiary's timely correction of a decedent's year-of-death miss
  (`treas-reg-54-4974-1-g-2-edb-ten-year-election-automatic-waiver`,
  `treas-reg-54-4974-1-g-3-year-of-death-automatic-waiver`). Corrective distributions do not rewrite
  the prior shortfall and, fail-closed while proposed §1.401(a)(9)-5(g)(2)(iv) remains unfinalized, do not also
  satisfy the current-year RMD. The excise is a chapter 43 tax barred from deduction by §275(a)(6); it never enters
  AGI, §86 income, IRMAA MAGI, or ACA MAGI. A corrective distribution has its own ordinary-income treatment in the
  year received except for basis, qualified Roth, or QCD character. After a 5-year or 10-year emptying deadline,
  any balance left is the entire required amount in the deadline year and every subsequent year, so a residue can
  create a fresh §4974 shortfall each year. Sources: [26 U.S.C. §4974](https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleD-chap43-sec4974.htm),
  [Treas. Reg. §54.4974-1 / T.D. 10001](https://www.govinfo.gov/content/pkg/FR-2024-07-19/pdf/2024-14542.pdf), and
  [2025 Form 5329 instructions](https://www.irs.gov/pub/irs-pdf/i5329.pdf).
- **First-year April 1 split.** A first distribution-calendar-year amount elected for April 1 of the following
  year has no §4974 tax in the attainment year because its deadline has not passed. If April 1 is missed, the
  excise is imposed in the RBD year on that deferred amount; that year's separate December 31 RMD can create a
  second shortfall. The tax year is therefore the year containing the due date, not always the year whose balance
  and divisor produced the amount (`treas-reg-54-4974-1-f-first-year-rbd-excise-tax`).
- **Aggregation and the unmet-amount sweep.** An IRA's RMD is calculated separately per account, but the sum may
  be taken from any one or more of the owner's IRAs — so an IRA too small to cover its own calculated amount
  leaves a shortfall the owner's other IRAs must still distribute rather than extinguishing it. The ledger sweeps
  an unmet amount across that owner's remaining aggregated IRAs in plan account order, one of the orderings the
  regulation permits, chosen for determinism. Only IRAs held **as owner** aggregate: an inherited IRA, a spouse's
  IRA, and an employer plan each stand outside the sum and must distribute their own amount
  (`treas-reg-1-408-8-e-1-i-aggregate-ira-rmd-sum`).
- **Duplicate account IDs are a Plan-data convention, not an RMD rule.** An unreferenced duplicate ID remains
  loadable for backward compatibility. Before any annual phase runs, the simulator selects the last account row
  carrying that ID as the account of record, while retaining the ID's first position in plan order. That one
  canonical row supplies every balance and fact channel, including RMDs, April 1 capacity, inherited schedules,
  SEPP, QCD/Form 8606 aggregation, conversions, withdrawals, and published balances. A retirement action,
  pension rollover, or annuity purchase that references a duplicated account ID is ambiguous and is rejected by
  Plan validation instead of relying on this selection convention. The regression suite is
  [`simulate.duplicateAccountId.test.ts`](../../../packages/engine/src/projection/simulate.duplicateAccountId.test.ts).
- **QCD:** direct IRA-to-charity from age 70½, excluded from income, counting toward an RMD when one is due; 2026
  limit $111,000, and that figure is one donor's. A QCD is **not** conditional on an RMD — 408(d)(8) turns on the donor's age and nothing in it
  references section 401(a)(9) — and the ledger now models that. The pre-RMD window from 70½ to the applicable age
  is open, and dollars requested beyond the owner's IRA RMD are debited straight from donor-owned aggregated IRAs,
  shrinking every later RMD base. Age 70½ is resolved from the birth month at annual granularity (attained 71, or
  attained 70 with a birth month of January–June); within-year timing is not modeled, so a gift dated before the
  half-birthday counts. That proxy is registered `approximated` / `understatesTax`
  (`irc-408-d-8-B-ii-projection-annual-age-proxy`) and errs permissively by up to twelve months for every birth
  month. The threshold date it is layered on is a separate question: the six-calendar-months sentence survives only
  in a defined-benefit provision, and nothing resolves a month-end or leap-day birth, so that convention is
  recorded `unsettled` in `irc-408-d-8-B-ii-age-70-half`. **The gift is deemed pre-tax.** Under 408(d)(8)(D) the
  distribution is treated as includible up to the aggregate amount that would be includible if all of the donor's
  individual retirement plans were distributed in the year and treated as one contract, so the qualified gift
  leaves the section 72 computation entirely: it returns no basis, it is absent from the Form 8606 line-7
  numerator and from the line-9 denominator, the whole qualified routed amount leaves income, and the year's other
  distributions pro-rate over the reduced pool. A gift past that aggregate includible amount is not a qualified
  charitable distribution in the excess; the excess stays on line 7, recovers basis, and is published per
  occurrence so the basis replay reports it rather than inferring it
  (`irc-408-d-8-D-projection-qcd-after-pro-rata`, now `settled` and carrying the corrected statutory figures it
  was rewritten with). **The household scalar is charged to donors before it is measured.** Eligibility turns on
  each individual's own age, the ask is capped at the sum of the living donors' own indexed limits, the routed
  half is charged in proportion to each owner's own required distribution and never past it, the beyond-RMD half
  is charged at the account it drains, and required distributions are not pooled across spouses
  (`irc-408-d-8-A-projection-household-qcd-aggregation`, now `settled`). A married couple with two eligible donors
  may therefore exclude up to two indexed limits, and a household with one eligible donor is held to one however
  large an ineligible spouse's IRA is. Conventions the statute does not supply survive that correction. Each
  donor's limit is applied after attribution rather than to the ask. What one donor's limit refuses is offered to
  the other donors in sorted owner id order, because the scalar carries no donor intent to honour and plan account
  ordering would make which donor gives depend on how the accounts happen to be listed. And dollars no donor can
  route or drain are dropped rather than given, because giving them would exclude dollars past a taxpayer's limit.
  The carve itself runs in plan account order and each entry's line-7 gross rounds on its own, so the published
  line-9 denominator can differ by one cent across account permutations; the record states that bound and why
  paying it is cheaper than a year that stops settling at all. A gift year also settles at the statutory
  close-of-year denominator now, so it no longer reaches the legacy fallback measure, which stays `approximated`
  (`irc-408-d-2-C-projection-pro-rata-measurement-instant`) for the two shapes that still reach it: an
  owned-IRA-funded annuity purchase and a Plan-declared exact owned-IRA withdrawal. **The post-70½
  deductible-contribution offset is applied on this arm.** The second sentence of 408(d)(8)(A) reduces the
  exclusion, but not below zero, by the excess of deductible §219 contributions for all years ending on or after
  age 70½ over reductions already taken. The aggregate arm uses the same lifetime running total as the named arm
  (`irc-408-d-8-A-projection-post-70-half-contribution-offset`, now `settled`): projected deductible traditional
  IRA contributions in the run for tax years ending on or after the donor's 70½ threshold year, plus Plan-declared
  `deductibleIraContributions` for pre-start years that are themselves on or after that threshold. Roth
  contributions, employer deferrals, and nondeductible basis do not count. When a named QCD the Plan declares
  before the projection starts makes the already-taken reductions in limb (ii) unprovable and §219 is positive,
  the arm does not claim the exclusion (the gift still moves). `YearResult.qcd` is the gross gift; the exclusion
  is the MAGI / `qcdIncomeOffset` channel. Leftover after the reduction is ordinary income and does not lower
  MAGI. The user still enters one household number, no charity or direct transfer is identified, and the
  per-owner attribution is a modeling convention rather than a source the household chose.
- **Named QCD actions.** A `qcd` retirement action names the donor, one owned source IRA, an exact-cent
  allocation, and a charity, and the annual projection **commits** it — `simulate.ts` calls the execution
  prerequisite, the physical staging, and the executor, and only the executor can report a committed gift.
  Age 70½ is the exact
  civil date 846 calendar months from the birth date with a month-end clamp, published on the record as
  `calculation: 'addCalendarMonths846WithMonthEndClamp'` so a reader can see the arithmetic was chosen
  (`irc-408-d-8-B-ii-age-70-half`, `unsettled`: the six-calendar-months sentence survives only in a
  defined-benefit provision, and nothing at any level resolves a month-end or leap-day birth). The gift's
  scheduled date must fall in the action year and on or after that threshold. The source must be an owned,
  non-inherited IRA carrying a recorded classification fact; employer plans are excluded
  (`irc-408-d-8-B-employer-plan-source-exclusion`), an ongoing SEP or SIMPLE IRA is refused
  (`irc-408-d-8-B-ongoing-sep-simple-source-exclusion`), and inherited and Roth IRAs are excluded
  structurally (`irc-408-d-8-beneficiary-ira-source`, `irc-408-d-8-roth-ira-source`). The charity must be
  designated an eligible public charity with the direct-transfer, eligible-organization, and
  not-a-DAF-or-supporting-organization attestations all true (`irc-408-d-8-B-i-qualified-recipient`); a
  split-interest designation is refused on its own reason (`irc-408-d-8-F-split-interest-sublimit`,
  `irc-408-d-8-F-i-split-interest-direct-payment`). The post-70½ deductible-contribution offset **is** applied on
  this arm, from persisted per-donor contribution evidence plus a lifetime running total the annual pass carries,
  and a donor whose history cannot be proved is failed closed rather than offset by an assumed zero. The annual
  exclusion limit must be a sourced figure for the action's own year: a gift past the parameter pack is refused
  and stands the aggregate arm down for that year too (`irc-408-d-8-A-named-qcd-limit-after-the-pack-year`,
  `outOfScope` — the aggregate arm extrapolates its limit by plan inflation, and the named arm does not inherit
  that because only it claims an action executed). Two boundaries remain. The annual pass distributes the whole
  required amount in cash before any gift is sized, so every named gift is modeled as beyond the requirement and
  the record's `rmdSatisfiedAmount` is structurally zero — stated on the record through a typed `coordination`
  field rather than left to be inferred, and registered `approximated` / `overstatesTax` with a `produced` fixture
  (`treas-reg-1-408-8-g-projection-named-qcd-beyond-rmd`); the aggregate arm does model the coordination, so the
  two arms answer the same household differently. And the executor refuses the whole batch whenever any gift
  leaves a positive section 170 amount to deduct, so no named QCD produces a charitable deduction — a wholly
  excluded gift leaves no §170 amount either (`irc-408-d-8-E-excluded-qcd-no-section-170-double-benefit`). An
  accepted QCD is already age-70½-eligible, so it is never an under-59½ distribution and carries no freestanding
  §72(t) exception (`irc-72-t-1-qcd-not-early-distribution-exception`). The ordering
  rule that makes an earlier cash distribution irrevocable is `treas-reg-1-408-8-b-3-rmd-first-dollars-out`.
- **Inherited accounts.** When beneficiary facts classify a schedule, `projection/simulate.ts` executes
  `classifyInheritedRegime` / `inheritedRequirementForYear` (`strategies/inheritedIra.ts`) in the annual
  ledger with per-account `InheritedAccountYearEvidence` (regime key, matrix row, requirement kind, executed and
  voluntary amounts, limitations, disclosures, refusals, citations). Supported regime keys (matrix §3,
  condensed): `ten-year-with-annual-rmds` (post-RBD designated individual; 2021–2024 notice relief ended before
  2025: `irs-notice-2022-53-2023-54-2024-35-inherited-rmd-transition-relief`), `ten-year-no-annual` (pre-RBD),
  `edb-life-expectancy`, `edb-ten-year-elected` (unsettled — IRA-agreement election), `spouse-remain-beneficiary`,
  `spouse-treat-as-own-transition` (the death-year election retains the decedent RMD:
  `treas-reg-1-408-8-c-3-spouse-as-own-death-year-rmd`), `spouse-ten-year-elected` (unsettled), `roth-ten-year-no-annual`,
  `roth-edb-life-expectancy`, plus `roth-taxability-evidence` attached to every Roth row. Divisor mechanics use
  the Single Life Table (Treas. Reg. 1.401(a)(9)-5(d)(3)(iii);
  `treas-reg-1-401-a-9-5-d-3-beneficiary-single-life-denominator`, settled for classified facts); post-RBD deaths
  apply the greater-of-owner test when facts support it
  (`treas-reg-1-401-a-9-5-d-1-ii-greater-of-employee-life-expectancy`, settled for classified facts); EDB
  life-expectancy uses the beneficiary's expectancy (`irc-401-a-9-E-ii-eligible-designated-beneficiary`, settled
  for classified facts). **Fail closed:** death before 2020, successor beneficiary; pre-RBD
  non-designated beneficiaries under the five-year rule
  (`irc-401-a-9-B-ii-non-designated-beneficiary-five-year-rule`,
  `treas-reg-54-4974-1-c-five-year-deadline-rmd`); post-RBD estates, trusts, and other entity
  classes under the same X3 refusal (including a see-through trust that would qualify under
  Treas. Reg. 1.401(a)(9)-4(f)) without that five-year citation; multiple beneficiaries without separate-account
  facts (`treas-reg-1-401-a-9-8-a-1-ii-separate-account-deadline`), missing or contradictory facts, and a post-RBD ten-year
  election → typed refusal; classifier refusals other than X1 project on the labeled
  `legacy-planning-approximation` path with the refusal on the evidence row. Legacy two-field accounts (no
  beneficiary block) stay on that labeled path. No schema fact can assert SECURE 2.0 §327 spouse-as-employee
  treatment; that posture is disclosed on spouse life-expectancy rows rather than refused as an assertion the plan
  cannot make. Named residuals: §1.402(c)-2(j)(4) catch-up (`treat-as-own-timing-gate-unverified`), non-qualified
  inherited-Roth earnings tax (K3 disclosure only), post-S2 contribution/conversion/QCD enablement for validators
  without year context, and Roth S2-flip basis migration into the owned Roth pool. WS5: **Accounts** is the input
  surface (beneficiary-details panel); **Results** is the full per-account schedule (regime, deadline, disclosures,
  refusals, professional-confirmation marker); **Report** is compact; CSV export carries amounts, kinds, and the
  confirmation flag; the Learning Center article explains the schedules. Planning-grade only — not filing-grade.
- Sources: [IRS Pub 590-B](https://www.irs.gov/publications/p590b), [IRS RMD FAQs](https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs), [eCFR 26 CFR 1.401(a)(9)-9, Table 1 (Single Life) and Table 3 (Joint Life)](https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-9).
