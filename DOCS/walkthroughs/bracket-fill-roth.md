# Walkthrough reference: "Bracket-fill Roth conversions", year 2026 by hand

Independent hand derivation of the first projection year of the curated example `bracket-fill-roth`
(`packages/planner-ui/src/planner/examples/buildBracketFillRoth.ts`), for the public walkthrough page and the test
that will hold the engine to it.

**Provenance.** Derived 2026-09-22 by Claude (Opus 5.5 subagent) against the repository checkout the repository checkout at
`0907b126` (branch `claude/b1-p5-walkthroughs`). `git status --short` listed 36 modified files (37 after the rebase noted
below), every one of them under
`DOCS/operations/` (coverage JSON and Markdown); no source file, parameter pack, worksheet, domain-rules page or
walkthrough file is modified, so every file cited below is the committed version. While I worked, the branch was
rebased by another session: HEAD is now `6169e390` (onto #731 `2019cbf8`, then `fbd3b1ec` and "Walkthrough rows carry an
explicit unit for the site"), and `0907b126` is no longer an ancestor. `git diff --stat 0907b126 HEAD` touches nine
files: two doc-comment or catalog-string edits (`socialSecurity/currentSpouseBenefit.ts`,
`rules/calculations/socialSecurity.ts`), an optional `unit` field on `WalkthroughRow` (`walkthroughs/walkthrough.ts`),
the two sibling row files, and four coverage or evidence JSON files. None changes behavior this plan reaches. Line
numbers below are those of `0907b126`; the one that shifts at the new HEAD is `currentSpouseBenefit.ts` line 98, now
line 100. The rows author should give the age, count and year rows the new `unit`. I did not run the engine, run any
test, or execute any TypeScript or JavaScript, and I modified no repository file. I did the arithmetic by hand and
checked it with exact rational arithmetic (Python `fractions`). I replayed one bisection (the conversion sizer) and
one exact-cent split (the owner allocation) in Python IEEE-754 doubles and integers, written from the loop text; that
replay is my own arithmetic, not engine code. The rules come from the calculation worksheets (`DOCS/calculations/**`),
the engine's doc comments, the parameter pack, the rule-registry records (`packages/engine/src/rules/records/*.ts`),
the calculation records (`packages/engine/src/rules/calculations/*.ts`) and `DOCS/domain/domain-rules-reference/*`.
Where no contract says enough I read the function body, and the source column says "(body)": the conversion
bisection, the owner split of the household conversion, the QCD owner routing, the current-spouse guard, and the
fixed-point coordinator.

Disclosures. (1) The walkthrough test projects through `runWalkthrough` (`examples/walkthroughs/walkthrough.ts`), which
calls `projectPlan` (`planner-ui/src/projection.ts`), which calls `taxCalculatorFor` (`planner-ui/src/planTaxCalculator.ts`);
I read all three. (2) From `examples.golden.test.ts` I read the harness lines (1–18 and 273) and, only after section 2
was complete, the one `EXPECTED` line for this example (line 147), which holds whole-run aggregates. Section 4 uses its
`lifetimeRoth` as a loose cross-check; no figure in section 2 comes from it. (3) I did not open
`DOCS/operations/ca-mn-parameter-correction-2026-09-08/ca-mn-cases-{before,after}.json`, which mention this example, or
anything else that could carry engine output for it. (4) I read the two sibling derivations
(`DOCS/walkthroughs/rmd-irmaa.md`, `early-retiree-aca.md`) and their checks (`REVIEW-2026-09-22.md`) and reuse their
settled findings, each re-verified against the files and cited again below.

**Rounding convention.** None of the contracts used here states a rounding step for Social Security, the RMD, taxable
Social Security, the senior deduction, tax, the withdrawals or the growth; the ledger carries unrounded
binary-floating-point dollars. Of the 42 worksheets cited here, 22 set an absolute $0.005 fixture tolerance (every
dollar composition, for example `portfolio-need-annual`, `tax-total-annual`, `roth-conversion-annual` and
`accounts-investable-total-annual`), which is `ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS` (`projection/moneyTolerance.ts`
line 11); 16 state exact equality because their chosen inputs are whole dollars, whole years, enumerations or exact
integer cents; 2, `delayed-retirement-credit-factor` and `social-security-cola-factor`, state 1e-12 for exact ratio
arithmetic; 2, the two current-spouse worksheets, state 1e-9 dollars (one of them adding "exact to cents" for its
integer-dollar combined result). The full list is at the end of this paragraph. This plan's figures are not whole
dollars (the RMD is a multiple of 1/53), so each figure is given as its exact value (a fraction, or a terminating
decimal) and then rounded half-up to the cent for display. **A test should compare against the exact value with
tolerance 0.005, not against the cent-rounded display value summed downstream.** Two things differ from the siblings:

- **The executed conversion is cent-quantized by the engine itself.** Because two owners hold convertible balances,
  the household amount is split between them in exact integer cents (row 53), so `rothConversion` is exactly
  115,098.46. That figure is also robust to the bisection: every landing the "$0.01" contract allows gives the same
  115,098.46 (row 57), so it can be compared at 0.005.
- **The household amount before the split is bisection-sized** and published as
  `aggregateRothConversionAllocationDesired`. It lands at 183,448.244678974151611328125, 0.003838546 below the closed-form
  root 183,448.248517520215633…; a 0.005 comparison against the closed form passes today, but the contract promises only
  a one-sided $0.01 (section 3, A4). Pin the traced value or assert root − 0.01 < value ≤ root.

Worksheets cited, by stated tolerance. **$0.005 (22):** `social-security-benefit-annual`, `rmd-joint-life-divisor`,
`roth-conversion-annual`, `federal-ltcg-stacking`, `tax-total-annual`, `tax-realized-gains-annual`,
`medicare-irmaa-first-tier-boundary`, `medicare-base-part-b-premium`, `spending-healthcare-annual`,
`spending-base-annual`, `spending-total-annual`, `portfolio-need-annual`, `withdrawals-by-category-annual`,
`withdrawals-total-annual`, `spending-shortfall-annual`, `surplus-invested-annual`, `year-result-ltcg-zero-headroom`,
`income-total-annual`, `income-taxable-yield-annual`, `accounts-balance-per-account-annual`,
`accounts-investable-total-annual`, `accounts-net-worth-annual`. **Exact (16):** `social-security-payable-months`,
`normal-retirement-age`, `rmd-uniform-lifetime-divisor`, `rmd-applicable-age-attain-year`, `qcd-limit-and-age-proxy`,
`qcd-income-offset-qualified-slice`, `exact-cent-pro-rata-half-up`, `exact-cent-largest-remainder-slices`,
`federal-taxable-social-security-tiers`, `federal-standard-deduction-age-65`, `federal-ordinary-bracket-tax`,
`federal-amt-screen`, `tax-penalties-annual`, `medicare-irmaa-two-year-lookback`, `irmaa-lookback-selection`,
`medicare-magi-composition`. **1e-12 (2):** `delayed-retirement-credit-factor`, `social-security-cola-factor`.
**1e-9 (2):** `current-spouse-excess-poms-order`, `current-spouse-excess-fallback`.

---

## 1. Inputs, as built

The plan comes from `createExamplePlan` (in `buildContext.ts`), which calls `createEmptyPlan` with a fixed clock and
deterministic ids, then replaces `assumptions` and `strategies` with the example baselines merged with this builder's
overrides. `buildBracketFillRoth` then replaces `household`, `accounts`, `incomes` and `expenses`, and calls
`parseExamplePlan`. That helper writes `acaYears` only when `applyAcaCredit` is true and the pre-65 premium is
positive (`buildContext.ts` lines 81–86); here `applyAcaCredit` is false and the premium is 0, so it only validates.

### 1a. Projection call (how the year is run)

| Item | Value | Source |
|---|---|---|
| `SimulateOptions.startYear` | 2026 (`EXAMPLE_FIXED_YEAR`) | `examples/walkthroughs/walkthrough.ts#runWalkthrough` (`projectPlan(plan, { startYear: EXAMPLE_FIXED_YEAR })`); `planner-ui/src/projection.ts#projectPlan` (lines 68–79) |
| Tax calculator | `combineTaxCalculators(createFederalTaxCalculator(), createStateTaxCalculator({ overridePct: 0, localPct: 0 }))` | `planner-ui/src/planTaxCalculator.ts#taxCalculatorFor`; the same stack as the golden harness (`examples.golden.test.ts` lines 10–18); `tax/federalTax.ts#combineTaxCalculators` doc ("Penalties are never a member of the sum") |
| Market series | none (deterministic) | `SimulateOptions.market` doc |
| Fixed "now" | `2026-06-29T12:00:00.000Z`; stamps `createdAtIso`/`updatedAtIso` only | `buildContext.ts#EXAMPLE_FIXED_NOW_ISO`; `SimulateOptions` carries no date |
| End year | **2049** = max(1953 + 92, 1955 + 94) = max(2045, 2049) | `simulate.ts` line 489 (`endYear = … Math.max(...people.map((p) => dobYear(p) + lifeAgeOf(p)))`) |
| First-year RMD deferral elections | none; `projectPlan` passes no `rmdFirstYearDeferrals` | `SimulateOptions.rmdFirstYearDeferrals` doc ("default projections attempt it in the attainment year") |
| `captureAnnualCashFlow` | off | `projectPlan` (only when asked) |

### 1b. Plan facts

| Field | Value | Set by | Note |
|---|---|---|---|
| `name` | Bracket-fill Roth conversions | builder | |
| plan `id` / person ids | `bracket-fill-roth--seq-1` / `bracket-fill-roth--p1` (Morgan), `--p2` (Riley) | `exampleIdFactory` / builder | `createEmptyPlan` draws the person id (`seq-0`) before the plan id (`seq-1`); the default person is replaced |
| `household.filingStatus` / `hasQualifyingDependent` | `marriedFilingJointly` / false | builder | |
| `household.state` / `stateMoves` / `capitalLossCarryforward` | `FL` / [] / 0 | builder | |
| Person 1 (primary, `people[0]`) | **Morgan**, dob `1953-01-01`, `male`, retirementAge 65, longevity `{ planningAge: 92, source: 'manual' }` | builder | primary person: `simulate.ts` line 410 (`const primary = people[0]!`) |
| Person 2 | **Riley**, dob `1955-01-01`, `female`, retirementAge 65, `{ planningAge: 94 }` | builder | both born on January 1 (matters for Riley's FRA, row 13) |
| Cash `--cash` | 80,000; `annualReturnPct` 2; owner null; contribution 0 | builder | |
| Traditional `--ira-m` | kind `ira`; 700,000; `annualReturnPct` null (so 5); owner Morgan; no `nondeductibleBasis`; no `spouseSoleBeneficiary` | builder | |
| Traditional `--ira-r` | kind `ira`; 400,000; null (so 5); owner Riley; no basis; no `spouseSoleBeneficiary` | builder | |
| Roth `--roth` | kind `ira`; 50,000; null (so 5); owner **Morgan** | builder | the household's only Roth account; **Riley holds no Roth** |
| Taxable account | none | builder | so no yield, no basis-ratio sale |
| Social Security `--ss-m` | Morgan; `piaMonthly` 2,500; `earnings` null; `claimAge` 67y0m; no disability; no former spouses | builder | |
| Social Security `--ss-r` | Riley; `piaMonthly` 1,800; `earnings` null; `claimAge` 67y0m; no disability; no former spouses | builder | |
| `expenses.baseAnnual` | 90,000 (today's dollars; excludes healthcare) | builder | |
| `expenses.phases` | `[{ fromAge: 80, multiplier: 0.85 }]` | builder | "Phase applies from this age of the primary (first) person" (`expensePhaseSchema.fromAge` doc, `model/plan.ts` line 1972) |
| `expenses.requiredAnnual` / `idealAnnual` / `excessAnnual` / `oneTimeGoals` / `spendingPolicy` / `survivorSpendingPct` | absent / absent / absent / [] / absent / absent | (absent) | required layer = `baseAnnual` (`expensePlanSchema.requiredAnnual` doc, "Absent ⇒ equals baseAnnual") |
| `expenses.healthcare` | `pre65MonthlyPremiumPerPerson` 0; `applyAcaCredit` false; `medicareExtrasMonthlyPerPerson` 250; no `ssa44`; no `acaYears` | builder | |
| `insurance`, `careEvents`, `scenarios`, etc. | [] | `createEmptyPlan` | |

### 1c. Assumptions (baseline `EXAMPLE_BASELINE_ASSUMPTIONS` merged with this builder's overrides)

| Assumption | Value | Origin |
|---|---|---|
| `inflationPct` | 2.5 | baseline |
| `healthcareExtraInflationPct` | **3** | override (baseline 2); health factor is additive, 1 + 0.025 + 0.03 per year (`simulate.ts` line 520) |
| `defaultReturnPct` | **5** | override (baseline 6); "Applied to any account with annualReturnPct = null" (`assumptionsSchema` doc) |
| `ssCola` / `ssHaircut` | `{ mode: 'matchInflation' }` / null | baseline |
| `stateEffectiveTaxPct` / `localIncomeTaxPct` | 0 / 0 | baseline |
| `recentAnnualMagi` / `historicalAnnualMagiByYear` | 0 / absent | baseline / (absent) |
| `heirTaxRatePct` / `safeWithdrawalRatePct` | 25 / 4 | baseline; estate and FI metrics only |

### 1d. Strategies (baseline `EXAMPLE_BASELINE_STRATEGIES` merged with this builder's overrides)

| Strategy | Value | Origin |
|---|---|---|
| `withdrawalOrder` | `{ mode: 'sequential' }`: cash, taxable, vested equity comp, traditional, Roth, HSA | baseline; `withdrawalStrategySchema` doc; `annualWithdrawalPlanning.ts#SEQUENTIAL_ORDER` (line 67) |
| `rothConversion` | `{ mode: 'fillToTarget', target: 'topOfBracket', targetValue: 22, startYear: 2026, endYear: 2034 }` | override. `targetValue` is the bracket **rate** ("Bracket rate (e.g. 24) when target=topOfBracket", `rothConversionStrategySchema` doc) |
| `qcdAnnual` | **10,000** (today's dollars) | override; "Qualified charitable distributions per year (today's dollars), routed from RMDs when age-eligible" (`strategiesSchema.qcdAnnual` doc) |
| `retirementActions` | [] (so no named conversion or named QCD suppresses the aggregate arms) | baseline |
| `itemizedDeductions` / `taxableSafetyNetFloor` / `survivorReserveTarget` | absent (standard deduction; safety-net floor 0, `simulate.ts` line 854) | |

---

## 2. Year 2026 by hand

Order of the year (`projection/simulate.ts` header): ages, income, expenses, contributions, then the forced
distributions and the QCD (`annualForcedDistributionQcdAndRetirementActionsPhase`, called at line 2398), then the
aggregate Roth conversion (`annualAggregateRothConversionPhase`, line 2494; the header's bullet "Roth conversions run
after RMDs"), then the fixed-point tax and withdrawal iteration (`annualFundingApplicationAndClosePhase`, line 2582),
then flows, property events, growth and the snapshot. The header's own arrow list omits the conversion step and names it
only in a later bullet; the ACA sibling's check recorded the same (its C16).

Every factor is 1 in 2026: general `inflFactorFrom(2026, 2026) = 1`; health `healthInflFactorFrom(2026, 2026) = 1`;
the pack-year scale and the conversion-sizing scale `inflFactorFrom(pack.year 2026, 2026) = 1`; `limitGrowth = 1`.
2026 has its own published pack (`params/data/year2026.ts`), so nothing is indexed and nothing is a stand-in.

### 2a. Timeline and people

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 1 | Morgan's `ageAttained` | **73** | 2026 − 1953 | `yearLedger.ts#PersonYearState.ageAttained`; `simulate.ts` line 1553 (`year - dobYear(p)`, calendar birth year) |
| 2 | Riley's `ageAttained` | **71** | 2026 − 1955 | same |
| 3 | `alive` / `lifeAge` | true / 92 (Morgan); true / 94 (Riley) | 73 ≤ 92; 71 ≤ 94 | `PersonYearState.alive` doc; `simulate.ts` line 1555 |
| 4 | Full or partial year | **Full calendar year**: 12 months of spending, Social Security and Medicare for both | `SimulateOptions` carries only `startYear`; no year-row contract has a start-year proration term; the 2026-06-29 "now" does not reach the ledger | `simulate.ts#SimulateOptions`; section 3, A1 |
| 5 | Filing status | `marriedFilingJointly` | household status with two people alive | `simulate.ts` lines 443–449 (`filingStatusFor`); `YearResult.filingStatus` doc |
| 6 | People counted 65+ (age-65 additions, senior deduction) | **2** | both alive and ≥ 65 | `annualAggregateRothConversionPhase.ts` line 302 (`peopleStates.filter((s) => s.alive && s.ageAttained >= 65).length`); worksheet `federal-standard-deduction-age-65` |
| 7 | Primary person (the spending-phase age) | Morgan | `people[0]` | `simulate.ts` line 410; `expensePhaseSchema.fromAge` doc |

### 2b. Social Security

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 8 | Morgan: effective birth year for FRA | 1952 | born January 1, so the prior calendar year | `socialSecurity/nra.ts` header line 3 ("Jan 1 DOB uses prior calendar year"), `#effectiveBirthYear` lines 8–15 |
| 9 | Morgan: FRA | 66y0m (792 months) | the 1943–1954 cohort; the calendar year 1953 gives the same | `nra.ts` line 35 (body, "`if (y >= 1943 && y <= 1954) return { years: 66, extraMonths: 0 }`"). The `normal-retirement-age` worksheet derives only the 1960-and-later endpoint and does not support this cohort |
| 10 | Morgan: months claimed after FRA / DRC cap | 12 / 48 | 67 × 12 − 792 = 804 − 792 = 12; cap 70 × 12 − 792 = 48 | `socialSecurity/claimFactor.ts#claimFactor` (line 22ff, body) |
| 11 | Morgan: claim-age factor | **1.08** (27/25) | 1 + 12 × (2/3)/100 = 1 + 8/100 | worksheet `delayed-retirement-credit-factor`; `benefitFactor.ts` line 22 ("DRC: 2/3% of PIA per month after FRA, up to age 70") |
| 12 | Riley: effective birth year for FRA | **1954** | born January 1, 1955, so 1954 | `nra.ts` header line 3, `#effectiveBirthYear` |
| 13 | Riley: FRA | **66y0m (792 months)** | 1954 is in the 1943–1954 cohort. **The calendar year 1955 would give 66y2m** (`nra.ts` line 36), so here the January 1 rule changes a published figure | `nra.ts` lines 35–36 (body); section 3, A8 |
| 14 | Riley: months after FRA / factor | 12 / **1.08** (27/25) | 804 − 792 = 12, cap 48; 1 + 12 × (2/3)/100 | same as rows 10–11 |
| 15 | Payable months in 2026 | **12** each | The claim year is the year `ageAttained` equals 67: 2020 for Morgan, 2022 for Riley. 2026 is after both, so 12 | worksheet `social-security-payable-months`; `annualSocialSecurity.ts#annualSocialSecurityPayableMonths` (lines 59–66) |
| 16 | COLA factor / haircut factor | 1 / 1 | `matchInflation` compounds from the projection start, so 1 in 2026 whatever the claim year; `ssHaircut` null | `YearIncomes.socialSecurity` doc ("COLA factor: the inflation factor from the start year under matchInflation"); worksheet `social-security-cola-factor` ("factor 1 in the first year"); `simulate.ts` lines 1653–1660 |
| 17 | Morgan's own benefit | 2,700.00 a month; **32,400.00** a year | 2,500 × 1.08; × 12 × 1 × 1 | worksheet `social-security-benefit-annual`; `YearIncomes.socialSecurity` doc |
| 18 | Riley's own benefit | 1,944.00 a month; **23,328.00** a year | 1,800 × 1.08; × 12 × 1 × 1 | same |
| 19 | Spousal candidate for Riley (the lower PIA) | **no top-up**; Riley stays on her own 23,328 | The guarded POMS-order helper returns null because Riley's configured claim (804 months) is not before her FRA (792): `if (claimantDate.claimAgeMonths >= claimantFraMonths) return null`. The fallback then gives excess = max(0, 0.5 × 2,500 × spousal factor 1 − 1,944) = max(0, 1,250 − 1,944) = 0 (the spousal factor is 1 at or after FRA and earns no delayed credits); the family-maximum cap of a zero excess is 0; the candidate 1,944 × 12 = 23,328 is not larger than her own 23,328, so it does not replace it. Morgan, the higher PIA, gets no spousal candidate | `YearIncomes.socialSecurity` doc ("current-spouse spousal (the lower earner's own monthly + max(0, 0.5 × the higher PIA × the spousal factor − own monthly), the excess capped by the family maximum) … replaces the running amount only when larger"); `currentSpouseBenefit.ts` line 98 (body); `claimFactor.ts` line 58 ("no delayed credits on spousal benefits"); `annualSocialSecurity.ts` lines 233–317 (body); worksheets `current-spouse-excess-fallback`, `current-spouse-excess-poms-order`; section 3, A7 |
| 20 | **`incomes.socialSecurity`** | **55,728.00** | 32,400 + 23,328 | worksheet `social-security-benefit-annual`; `YearIncomes.socialSecurity` doc |
| 21 | `socialSecurityStreams` | `--ss-m`: source `own-retirement`, `annualAmount` 32,400, `claimInForce` true; `--ss-r`: `own-retirement`, 23,328, true | one stream per person, each its person's gate stream | `YearResult.socialSecurityStreams` doc; `annualSocialSecurity.ts` lines 438–477 (body) |
| 22 | `ssEarningsTestWithheld` / `ssdiPaid` | 0 / 0 | no wages; both past FRA; no disability | `YearResult` docs |

**The Social Security rule, stated plainly.** Each person's own benefit is `piaMonthly` × claim-age factor (from the
*effective* birth year's FRA, with 2/3% a month of delayed credit capped at 70) × payable months × COLA factor ×
haircut factor. For a couple, the lower PIA's holder is also offered a spousal amount, own benefit + max(0, half the
higher PIA × the spousal factor − own benefit), and takes it only if larger. Here half of Morgan's PIA (1,250) is
below Riley's own 1,944, so no reading of the spousal rule changes 2026. Both claims were made before the projection
(2020 and 2022), and the COLA factor is still exactly 1 in 2026: the entered PIAs are read as 2026-dollar PIAs with the
full delayed credit applied (section 3, A2).

### 2c. RMD and QCD

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 23 | Morgan: RMD applicable age / first RMD year | 73 / **2026** | 1953 is in 1951–1959, so 73; 1953 + 73 = 2026 | `params/index.ts#rmdStartAgeForBirthYear` line 139 ("`if (birthYear <= 1959) return 73`"); domain rules §6 ("Owner living RMD start age … 1951–1959 → **73**") |
| 24 | Riley: RMD in 2026 | **none** (first RMD year **2028**) | 1955 gives applicable age 73, attained in 2028. At 71, `requiredMinimumDistribution` returns 0 ("`if (ageAttained < rmdStartAgeForBirthYear(birthYear)) return 0`"); the Uniform Lifetime Table starts at 72 in any case | `params/index.ts` line 139; `rmd/rmd.ts` line 43; worksheet `rmd-applicable-age-attain-year` (it derives exactly this cohort: born 1955, age 73, attained 2028, RBD 2029-04-01, but through the inherited-IRA function `applicableAgeAttainYears`, not the owner path; both give 73) |
| 25 | Table | **Uniform Lifetime** | The Joint Life table needs the spouse to be the sole beneficiary *and* more than ten years younger. `spouseSoleBeneficiary` is absent (so no spouse is passed), and the gap is 2 years anyway | `rmd/rmd.ts` header lines 4–6 and line 47 (`ageAttained - opts.spouse.ageAttained > 10`); `annualOwnerRmdPlan.ts` line 165; `traditionalAccountSchema.spouseSoleBeneficiary` doc (`model/plan.ts` lines 1075–1079); worksheet `rmd-joint-life-divisor` (the "more than ten" condition) |
| 26 | Divisor | **26.5** | `year2026.rmd.uniformLifetimeTable[73]` | `params/data/year2026.ts` line 103; worksheet `rmd-uniform-lifetime-divisor` |
| 27 | Balance used | **700,000**, the entered balance read as the 2025-12-31 balance | captured before any 2026 flow | `simulate.ts` line 1354 ("Prior Dec 31 balances (RMD base) — captured before this year's flows"); `annualOwnerRmdPlan.ts#AnnualOwnerRmdPlanInput.startOfYearBalance` ("Aggregate prior-Dec-31 balance"); section 3, A1 |
| 28 | First-year deferral | none; the whole first-year amount is taken in 2026 | no election is passed, and the full take leaves no April-1 remainder | `SimulateOptions.rmdFirstYearDeferrals` doc; domain rules §6 ("First-year April 1 split"); `annualOwnerRmdPlan.ts` lines 277–297 (body) |
| 29 | **`rmd`** (gross, forced) | **26,415.09** (exact 1,400,000/53 = 26,415.094339622641509…) | 700,000 ÷ 26.5 | worksheet `rmd-uniform-lifetime-divisor`; `YearResult.rmd` doc |
| 30 | QCD donors | **Morgan and Riley** | Both have attained 71 (Riley exactly 71; at 71 the birth month does not matter) | worksheet `qcd-limit-and-age-proxy`; `YearResult.qcd` doc ("age attained 71, or 70 with a birth month of June or earlier"); `annualLegacyQcdGiftPlan.ts` line 92 (body) |
| 31 | QCD requested / caps | 10,000 / 111,000 per donor / 222,000 for the household | min(10,000 × `inflFactor` 1, 111,000 × `limitGrowth` 1 × 2 donors). `qcdAnnual` is one household figure, capped at the sum of the donors' limits | `strategiesSchema.qcdAnnual` doc; `year2026.ts` line 137; `annualLegacyQcdGiftPlan.ts` lines 104–107 (body); section 3, A6 |
| 32 | How the 10,000 is routed and whose IRA gives it | **10,000 from Morgan's RMD; Riley gives nothing** | `qcdFromRmd` = min(10,000, owned-IRA RMD total 26,415.09) = 10,000. The from-RMD gift is attributed to owners in proportion to their share of the owned-IRA RMD; only Morgan has one, so he takes all of it (his routable amount is min(26,415.09, 111,000)). Beyond-RMD remainder 10,000 − 10,000 = 0, so no IRA is debited for a gift, and Riley's 111,000 capacity goes unused | `annualLegacyQcdGiftPlan.ts` lines 108–160 (body); the call-site comment in `annualForcedDistributionQcdAndRetirementActionsPhase.ts` lines 1231–1239 ("The from-RMD half is attributed in proportion to each owner's share of the owned-IRA required distribution the gift is capped against"); domain rules §6 (the QCD paragraph) |
| 33 | **`qcd`** (gross gift) | **10,000.00** | | `YearResult.qcd` doc |
| 34 | QCD income offset | **10,000.00** | qualified = min(10,000, Morgan's aggregate includible amount 700,000 − basis 0) = 10,000; non-qualified 0, so qualified-from-RMD = 10,000; §408(d)(8)(A) second-sentence offset 0 (no post-70½ deductible contributions); offset = min(10,000, 10,000 − 0) | worksheet `qcd-income-offset-qualified-slice`; `YearResult.qcd` doc; `annualLegacyQcdOwnerCharacterPlan.ts` (body) |
| 35 | `rmd` stays gross | 26,415.09 | the gift reduces only the year's cash inflow | `YearResult.qcd` doc ("`rmd` stays gross; only the year's cash inflow is reduced by the from-RMD gift") |
| 36 | Cash reaching the household from the RMD | **16,415.09** (exact 870,000/53 = 16,415.094339622641509…) | 26,415.094340 − 10,000 | same |
| 37 | Taxable part of the RMD | **16,415.09** | 26,415.094340 − 10,000 offset; no basis | worksheet `qcd-income-offset-qualified-slice` |

### 2d. The Roth conversion: sized for the household, executed for Morgan only

This is the year's headline, and it is not what the example's copy promises. The strategy sizes one household amount
that would bring federal taxable income to the top of the 22% bracket. The engine then splits that amount between the
two owners in proportion to their convertible balances and converts each share only into that owner's own Roth IRA.
**Riley holds no Roth account, so her share is dropped with a warning, and only Morgan's share converts.** Taxable
income ends the year well inside the 22% bracket, not at its top.

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 38 | Strategy active in 2026 | yes | `fillToTarget`, 2026 ∈ [2026, 2034], no named conversion action | `annualAggregateRothConversionTargetPlan.ts` lines 226–227, 252–254 (body) |
| 39 | Runs after the RMD and the QCD | yes | The conversion phase reads balances after the forced distribution; Morgan's RMD is fully taken, so nothing is reserved | `annualAggregateRothConversionPhase.ts` line 301 ("Roth conversions (after RMDs — RMDs must be satisfied first)"); registry record `treas-reg-1-408A-4-a-6-rmd-precedes-conversion` (`rules/records/requiredMinimumDistributions.ts` line 579); `annualAggregateRothConversionPlan.ts` lines 174–200 (body; `iraRmdUnsatisfiedByOwner` is empty) |
| 40 | **What counts toward the bracket top: ordinary income before the conversion** | **16,415.09** | `incomeBeforeConversion` = ordinary income 0 − pre-tax contributions 0 + RMD 26,415.09 − RMD basis 0 − annuity basis 0 − QCD offset 10,000 − named-QCD offset 0 + non-qualified QCD 0 + SEPP 0 − SEPP basis 0 + inherited ordinary 0 + action ordinary 0. It is Morgan's RMD net of the QCD, nothing else | `ConversionSizingInput.ordinaryIncomeBase` doc ("Ordinary income before any conversion (wages − pre-tax contributions + RMD − QCD + pensions etc.)"); `annualAggregateRothConversionPhase.ts` lines 310–325 (body) |
| 41 | The other sizing inputs | capital gains 0, qualified dividends 0, tax-exempt interest 0, Social Security 55,728, people 65+ 2, scale 1, no itemized deductions | Social Security enters as gross benefits; its taxable share is recomputed by the federal engine at every candidate conversion, so the §86 phase-in and the 85% cap are inside the sizing. **Need-based withdrawals and the year's tax are not inputs**: sizing runs before the funding solve | `strategies/rothConversion.ts` header ("Sizing is solved by bisection against the federal tax engine … taxable Social Security phases in at up to 1.85× per converted dollar"); the `sizing` block passed to `annualAggregateRothConversionTargetPlan` (`annualAggregateRothConversionPhase.ts` lines 484–504, body) |
| 42 | Metric the conversion fills | **federal taxable income after the deduction** | `topOfBracket` returns `detail.taxableIncome` | `YearResult.rothConversion` doc ("topOfBracket holds federal taxable income at the chosen bracket's upper bound"); `rothConversion.ts#metricFor` line 98 |
| 43 | Deduction the sizing uses | **35,500 + the senior deduction at the candidate's own MAGI** | Joint standard deduction 32,200 + 2 × 1,650 age-65 additions = 35,500; plus the OBBBA senior deduction, **2 × max(0, 6,000 − 6% × (MAGI − 150,000))**: the phase-out is taken once per qualifying person, so the pair runs out at 250,000, not 350,000. No itemized deductions; scale 1 | `year2026.ts` lines 40–41, 49–54; `params/index.ts#standardDeduction` (lines 391–399); `federalTax.ts#seniorDeductionAmount` (line 363; its in-body comment: "A joint return with two spouses 65+ consequently runs out at $250,000 of modified AGI"); header step 3; registry record `irc-151-d-5-C-iii-I-senior-deduction-per-individual-phase-out` (`rules/records/individualIncomeTax.ts` line 321); domain rules §1 ("a couple with two people 65+ reaches zero at $250,000 of MAGI, the same point one person does, not $350,000"); section 3, A11 |
| 44 | Bracket bound (the ceiling) | **211,400** | Rate 22 is the MFJ ladder's third entry (lower bound 100,800); the ceiling is the next entry's lower bound, 211,400 (the 24% bracket), × indexing scale 1 | `rothConversion.ts#ceilingFor` lines 114–124 ("`return brackets[i + 1]!.lowerBound`"); `year2026.federalTax.brackets.marriedFilingJointly` (lines 30–38; 211,400 on line 34) |
| 45 | Taxable income at zero conversion | **0** | ordinary 16,415.09; provisional 16,415.09 + 27,864 = 44,279.09, so taxable SS = min(47,368.80, 0.85 × 279.09 + 6,000) = 6,237.23; AGI 22,652.32; deduction 35,500 + 12,000 = 47,500; TI = max(0, −24,847.68) = 0 | `federalTax.ts#computeFederalTax`; worksheet `federal-taxable-social-security-tiers` |
| 46 | Closed-form root | **S\* = 340,296,501/1,855 = 183,448.248517520215633…** | At the root, taxable SS is capped (47,368.80) and MAGI is inside the senior phase-out, so senior = 12,000 − 0.12 × (AGI − 150,000) and TI = 1.12 × AGI − 65,500. Setting TI = 211,400 gives AGI\* = 276,900/1.12 = 1,730,625/7 = 247,232.142857… (senior 332.142857…); ordinary income = AGI\* − 47,368.80 = 6,995,217/35; S\* = 6,995,217/35 − 870,000/53 | derivation from rows 40–44 |
| 47 | Bisection trace (the contract says "to $0.01") | **lo = 384,718,853,225/2,097,152 = 183,448.244678974151611328125** | `hi` starts at max(211,400 − 0, 1,000) = 211,400; its metric is 239,683.89 > 211,400, so it never doubles. The loop halves while hi − lo > 0.01: 25 halvings, ending width 211,400/2²⁵ = 26,425/2²² = 0.0063002109527587890625. Midpoints 22 and 23 (183,448.28248023987, 183,448.25727939606) lower `hi`; midpoint 24 (183,448.24467897415, TI 211,399.995700828…) becomes `lo`; midpoint 25 (183,448.2509791851043701171875, TI 211,400.002757065…) becomes `hi`. It returns `lo`, **0.003838546 below S\***. No midpoint came within 0.0024 of the root, so floating-point noise cannot have flipped a comparison | `rothConversion.ts#sizeRothConversion` lines 173–186 (body); `YearResult.rothConversion` doc ("by bisection (to $0.01)"); section 3, A4 |
| 48 | Gross amount and safety-net trim | desired = lo | Morgan's and Riley's IRAs carry no basis, so each source's taxable fraction is 1 and gross = taxable; the first convertible source (Morgan's IRA, 673,584.91) covers it. The safety-net floor is 0, so there is no trim | `annualAggregateRothConversionTargetPlan.ts#grossAmountForTaxable` lines 161–184 and lines 297–304 (body) |
| 49 | **`aggregateRothConversionAllocationDesired`** | **183,448.244678974151611328125** (display 183,448.24) | row 47 | `YearResult.aggregateRothConversionAllocationDesired` doc ("the amount AFTER the sizing pass and after the safety-net floor trim … and BEFORE the identity trim") |
| 50 | **`aggregateRothConversionAllocationBalances`** (the owner weights) | `--ira-m` **673,584.91** (exact 35,700,000/53 = 673,584.905660377358491…); `--ira-r` **400,000**; `--roth` **50,000** | Gross convertible balances after the RMD and before any drain; cash is not in the reading set | `actions/aggregateRothConversionOwnerAllocation.ts` lines 343–351 (body) and `participatesInAggregateRothConversionAllocation`; `YearResult.aggregateRothConversionAllocationBalances` doc; registry record `irc-408-d-3-A-i-conversion-benefits-the-distributee` (`rules/records/iraBasisAndRollovers.ts` line 400: "splits the sized household amount between owners pro rata by exact-cent largest remainder") |
| 51 | The split in integer cents | household A = **18,344,824**; Morgan's weight **67,358,491**; Riley's **40,000,000**; total **107,358,491** | Each figure is its float's decimal spelling rounded half-up to the cent: "183448.24467897415" → 18,344,824; "673584.9056603773" → 67,358,491; 400,000 → 40,000,000 | `actions/planBalanceAdapter.ts#planDollarsToLedgerCents` (lines 25–54, body); allocation module lines 380–387 (body) |
| 52 | Morgan's slice | **11,509,846 cents = 115,098.46** | exact share 18,344,824 × 67,358,491 / 107,358,491 = 1,235,679,662,300,584/107,358,491 = 11,509,845.665589543 cents; its remainder 71,456,689 is at least half of 107,358,491, so it rounds up | worksheet `exact-cent-pro-rata-half-up`; `actions/exactCentProRata.ts#exactCentLargestRemainderSlices` |
| 53 | Riley's slice | **6,834,978 cents = 68,349.78** | exact share 6,834,978.334410457 cents; remainder 35,901,802 < half, so it rounds down. 11,509,846 + 6,834,978 = 18,344,824, so there is no drift to settle | worksheet `exact-cent-largest-remainder-slices` |
| 54 | Destinations | Morgan's slice → **Morgan's Roth IRA** (`--roth`, his first Roth IRA in Plan order). Riley's slice → **none: trimmed** (reason `ownerHoldsNoRothAccount`) | A conversion must land in the same person's own Roth IRA; Riley holds no Roth account of any kind. The year adds the warning "Riley has no Roth account, so Riley’s share of the Roth conversion was skipped — a conversion has to land in the same person’s own Roth. Opening a Roth IRA for Riley would let that share convert." | registry records `irc-408-d-3-A-i-conversion-benefits-the-distributee` ("trims the slice of an owner who holds no Roth of their own -- naming that person in a warning") and `irc-408A-d-3-B-conversion-destination-must-be-a-roth-ira` (`rules/records/rothAccounts.ts` line 318); allocation module lines 353–408 (body); `annualAggregateRothConversionPhase.ts` lines 680–690 (body) |
| 55 | The movement | **115,098.46 out of Morgan's IRA (`--ira-m`) into Morgan's Roth IRA**; Riley's IRA is not touched | draw = min(673,584.91, 115,098.46); Riley has no remaining slice | allocation module lines 414–439 (body); `annualAggregateRothConversionPhase.ts` lines 704–830 (body) |
| 56 | **`rothConversion`** | **115,098.46** (exact 5,754,923/50) | the sum of the executed credits | `YearResult.rothConversion` doc; `YearResult.aggregateRothConversionAllocationDesired` doc ("`rothConversion` is what the ledger moved, which for a household with an owner who holds no Roth IRA is strictly less than the figure the policy was handed: that owner's slice is dropped, and the difference never converts"); section 3, A3 |
| 57 | Is 115,098.46 sensitive to the bisection? | **No** | The contract allows any `lo` in (S\* − 0.01, S\*] = (183,448.2385…, 183,448.2485…]. Every value there rounds to 18,344,824 or 18,344,825 cents, and those give Morgan 11,509,845.6656 or 11,509,846.2930 cents, both 11,509,846. So `rothConversion` can be held at 0.005 even though it comes from a bisection | rows 51–52 |
| 58 | Shortfall warning | none | A trimmed owner is excluded from `convertibleTargetPlanDollars` (115,098.46), and 115,098.46 is not below it | allocation module line 410 (body); `annualAggregateRothConversionPhase.ts` lines 853–880 (body) |
| 59 | Conversion character | fully taxable, never penalized | no basis, so no Form 8606 nontaxable share; a conversion carries no 10% additional tax | `simulate.ts` header ("conversion taxes … are never penalized"); domain rules §10 |
| 60 | 22% bracket room the year leaves unused | **76,551.76** (76,551.763139622…) | 211,400 − taxable income 134,848.236860 (row 70). It is 1.12 × (S\* − 115,098.46): the dropped share, grossed by the senior phase-out | rows 46, 70 |

### 2e. Income, AGI, deductions, federal tax

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 61 | `taxableYield`, interest, dividends / `taxExemptInterest` | 0 / 0 | no taxable account; a cash account produces no yield row | worksheet `income-taxable-yield-annual`; `distributedTaxableYieldRows.ts` header; section 3, A9 |
| 62 | **`incomes.total`** | **55,728.00** | Social Security only | worksheet `income-total-annual`; `YearIncomes.total` doc |
| 63 | `realizedGains` | 0 | no sale, no rebalancing, no actions | worksheet `tax-realized-gains-annual` |
| 64 | **Ordinary income** (the tax input) | **131,513.55** (exact 348,510,919/2,650 = 131,513.554339622641509…) | ordinary base = income before the conversion 16,415.094340 + the taxable conversion 115,098.46; need-based traditional withdrawals 0 | `annualFundingApplicationAndClosePhase.ts` line 682 (body, `ordinaryBase = incomeBeforeConversion + totalRothConversionTaxable`) |
| 65 | Provisional income | 159,377.55 (159,377.554339622641509…) | 131,513.554340 + tax-exempt 0 + foreign addback 0 + ½ × 55,728 (27,864) | `federalTax.ts#taxableSocialSecurity`; worksheet `federal-taxable-social-security-tiers` (single-filer column; section 3, A5); domain rules §3 |
| 66 | Taxable SS: 85% formula before the cap | 104,070.92 (104,070.921188679245283…) | tier 1 = min(27,864, ½ × (44,000 − 32,000)) = 6,000; 0.85 × (159,377.554340 − 44,000) + 6,000 = 98,070.921189 + 6,000 | same; `year2026.ssBenefitTaxation.tier50Start.marriedFilingJointly` 32,000 and `.tier85Start` 44,000 (lines 76–77), unindexed |
| 67 | **Taxable Social Security** | **47,368.80** | min(0.85 × 55,728 = 47,368.80, 104,070.92). **The 85% cap binds.** It binds once ordinary income exceeds 64,805.176470588… (44,000 + 41,368.80/0.85 − 27,864); the couple is 66,708.38 past that point | same |
| 68 | **AGI** / **`magi`** (published) | **178,882.35** (exact 474,038,239/2,650 = 178,882.354339622641509…) | 131,513.554340 + 47,368.80. MAGI = max(0, ordinary 131,513.554340 + gains 0 + qualified dividends 0 + taxable SS 47,368.80 + tax-exempt 0), the same number | `federalTax.ts` header step 2; worksheet `medicare-magi-composition`; `YearResult.magi` doc; `annualFundingApplicationAndClosePhase.ts` lines 1321–1330 (body) |
| 69 | Standard deduction (joint, two people 65+) | **35,500** | 32,200 + 2 × 1,650 | worksheet `federal-standard-deduction-age-65` (single-filer case; section 3, A5); `year2026.federalTax.standardDeduction.marriedFilingJointly` and `.age65Addition.marriedFilingJointly` (lines 40–41) |
| 70 | Senior deduction | **8,534.12** (exact 565,385,283/66,250 = 8,534.117479245283019…) | senior MAGI = AGI + broad foreign addback 0 = 178,882.354340; per-person phase-out 6% × (178,882.354340 − 150,000) = 6% × 28,882.354340 = 1,732.941260; per person 6,000 − 1,732.941260 = 4,267.058740; × 2 people. 2026 ≤ `lastApplicableYear` 2028 | `federalTax.ts#seniorDeductionAmount` (line 363) and header step 3 ("rides on top of whichever base wins"); `year2026.federalTax.seniorDeduction` (lines 49–54); registry record `irc-151-d-5-C-iii-I-senior-deduction-per-individual-phase-out`; domain rules §1 |
| 71 | Total deduction | 44,034.12 (44,034.117479245283019…) | max(35,500, itemized 0) + 8,534.117479 | `federalTax.ts` header step 3 |
| 72 | **Taxable income** | **134,848.24** (exact 4,466,847,846/33,125 = 134,848.236860377358491…) | 178,882.354340 − 44,034.117479; equivalently 1.12 × AGI − 65,500 | `federalTax.ts#computeFederalTax` |
| 73 | Ordinary tax by bracket (joint 2026) | 10%: **2,480.00**; 12%: **9,120.00**; 22%: **7,490.61** (7,490.612109283018868…) | 24,800 × 10%; (100,800 − 24,800) × 12%; (134,848.236860 − 100,800) × 22% = 34,048.236860 × 0.22 | worksheet `federal-ordinary-bracket-tax` (single-filer ladder; section 3, A5); `year2026.federalTax.brackets.marriedFilingJointly` (lines 30–38) |
| 74 | **Federal regular income tax** | **19,090.61** (exact 15,809,413,153/828,125 = 19,090.612109283018868…) | 2,480 + 9,120 + 7,490.612109. Marginal bracket 22%; each further ordinary dollar costs 22% × 1.12 = **24.64%** (taxable SS is capped; the two senior deductions shrink by 12 cents) | same |
| 75 | LTCG tax / NIIT | 0 / 0 | no preferential income; no net investment income (conversions and IRA distributions are not NII), and MAGI is under the 250,000 joint threshold anyway | worksheet `federal-ltcg-stacking`; `year2026.niit` (lines 70–73) |
| 76 | AMT screen, **`amt`** | **0** | AMTI = TI 134,848.236860 + standard 35,500 + senior 8,534.117479 = 178,882.354340; exemption 140,200 (phase-out starts at 1,000,000); excess 38,682.354340; TMT = 26% × 38,682.354340 = 10,057.412128; AMT = max(0, 10,057.41 − 19,090.61) = 0 | worksheet `federal-amt-screen` (single-filer case); `federalTax.ts` header step 7; `year2026.federalTax.amt` (lines 55–62) |
| 77 | Florida state and local tax | **0** | FL `hasIncomeTax: false`; the override 0 does not apply ("takes precedence when set above zero"); local tax is gated on `hasIncomeTax` | `params/state/data/year2026.ts` FL entry (lines 337–343); `tax/stateTax.ts` header |
| 78 | **`tax`** (composed) | **19,090.61** (exact 15,809,413,153/828,125) | federal 19,090.612109 + state 0 + local 0. `YearResult` has no state field | worksheet `tax-total-annual`; `YearResult.tax` doc; section 3, A10 |
| 79 | `ltcgZeroHeadroom` | 0 | TI with no extra gains (134,848.24) already exceeds `year2026.capitalGains.rate15StartsAbove.marriedFilingJointly` 98,900 | worksheet `year-result-ltcg-zero-headroom`; `year2026.ts` line 66 |

### 2f. IRMAA and healthcare

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 80 | IRMAA lookback year | **2024** | premium year 2026 − 2; no SSA-44 | worksheets `medicare-irmaa-two-year-lookback`, `irmaa-lookback-selection`; `annualHealthcareExpenses.ts` line 93 |
| 81 | **`irmaaLookbackMagi`** / **`irmaaLookbackMagiSource`** / **`irmaaLookbackMagiYear`** | **0 / `planFallback` / 2024** | 2024 is before the ledger and `historicalAnnualMagiByYear` is absent, so the baseline `recentAnnualMagi` 0 is used | `YearResult.magi` doc (first two projection years fall back); `YearResult.irmaaLookbackMagiSource` doc; `simulate.ts` lines 867–878 (`resolveMagiFor`); `assumptionsSchema.recentAnnualMagi` doc |
| 82 | Tier-1 floor (joint, 2026) / **`irmaaTier`** | 218,000 / **0** | `year2026.medicare.irmaaTiers[0].magiOver.marriedFilingJointly` × 1; 0 is not > 218,000 | `year2026.ts` line 193; `params/index.ts#irmaaTierForMagi` (strict "greater than" below the top tier); worksheet `medicare-irmaa-first-tier-boundary` (single-filer case) |
| 83 | Medicare months / marketplace months | 12 / 0 for each person | 73 and 71 are past 65 | `YearExpenses.healthcare` doc; `annualHealthcareExpenses.ts` lines 116–128 (body) |
| 84 | Part B per person / Part D surcharge | **2,434.80** / 0 | 202.90 × (25/25) × premium scale 1 × 12; tier 0 | worksheet `medicare-base-part-b-premium`; `tax/medicare.ts#medicareAnnualPremiumPerPerson`; `year2026.medicare.partBStandardMonthly` (line 187) |
| 85 | **`medicarePremiums`** / **`irmaaSurcharge`** | **4,869.60** / **0** | 2 × 2,434.80 × 12/12 | `YearResult.medicarePremiums` doc ("all covered people; excludes the user's 'extras'") |
| 86 | `irmaaNextTierThreshold` | 218,000 | Medicare active, tier 0, so the next is tier 1 at the joint floor × 1 | `YearResult.irmaaNextTierThreshold` doc |
| 87 | Medicare extras | **6,000.00** | 250 × 12 Medicare months × health factor 1, per person, × 2 | worksheet `spending-healthcare-annual`; `YearExpenses.healthcare` doc; `annualHealthcareExpenses.ts` line 185 |
| 88 | **`expenses.healthcare`** | **10,869.60** | 4,869.60 + 6,000.00 | same |
| 89 | The year's own MAGI against the premium it will set (context) | 178,882.35 vs 2028's tier-1 floor 229,036.25 | 218,000 × 1.025² = 229,036.25; 50,153.90 of headroom. Not what 2026 reads; it is what 2028 reads (source `projected`) | `YearResult.magi` doc ("the IRMAA base two years later"); `irmaaTierThreshold` (lower tiers index at general inflation) |

### 2g. Spending and cash flow

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 90 | **`expenses.baseSpending`** | **90,000.00** | `baseAnnual` 90,000 × inflation 1 × phase multiplier 1 × survivor factor 1. **The age-80 phase does not apply yet**: it keys on the primary person's age, Morgan's 73 < 80 (it first applies in 2033). Riley's age plays no part | worksheet `spending-base-annual`; `YearExpenses.baseSpending` doc; `annualLifestyleLayers.ts` lines 62–72 (body; `primaryAge >= phase.fromAge`); `annualExpenseAssemblyPhase.ts` line 256 (`primaryAge: stateOf(primaryPersonId).ageAttained`); `expensePhaseSchema.fromAge` doc |
| 91 | `oneTimeGoals`, `debtService`, `propertyCosts`, `insurancePremiums`, `careCost`, `ltcBenefit` | 0 each | none in the plan | `YearExpenses` docs |
| 92 | **`expenses.total`** | **100,869.60** | 90,000 + 10,869.60 | worksheet `spending-total-annual`; `YearExpenses.total` doc |
| 93 | `requiredSpending` / `targetSpending` / `intendedSpending` / `idealSpending` / `excessSpending` / `guardrailFactor` | 100,869.60 / 100,869.60 / 100,869.60 / 0 / 0 / 1 | healthcare counts as required; required lifestyle = base; no policy | `YearExpenses` layer docs |
| 94 | **`netPortfolioNeed`** | **64,232.21** (exact 64,232.212109283018868…) | max(0, 100,869.60 + tax 19,090.612109 + penalties 0 − incomes 55,728) | worksheet `portfolio-need-annual`; `YearResult.netPortfolioNeed` doc |
| 95 | Net RMD cash applied first | 16,415.09 | row 36 | domain rules §11 ("RMDs always first"); `annualFundingApplicationAndClosePhase.ts` lines 709–718 (body, `baseCashInflows` adds `rmdTotal − qcdFromRmd`) |
| 96 | The conversion's cash and its tax | the conversion brings **no** cash in; its tax is paid **from cash**, inside the need | Without the conversion the year's tax would be 0 (row 118), so all 19,090.61 is the conversion's. It rides the need; nothing is withheld from the IRA | `simulate.ts` header ("conversion taxes ride the normal withdrawal flow, so they come from cash/taxable first"); domain rules §10; `baseCashInflows` has no conversion term |
| 97 | **Gap after Social Security and the net RMD cash** (need-based withdrawal) | **47,817.12** (exact 39,598,550,653/828,125 = 47,817.117769660377358…) | 64,232.212109 − 16,415.094340. Equivalently the pre-tax gap 100,869.60 − 72,143.094340 = 28,726.505660 plus the tax 19,090.612109 | `YearWithdrawals` doc |
| 98 | Which account funds it | **Cash**: 47,817.12 of its 80,000 | sequential order, cash first; cash covers it all, so neither IRA (beyond the RMD) nor the Roth is touched. No liquid-reserve floor | `SEQUENTIAL_ORDER`; `annualWithdrawalPlanning.ts` (body, `drainCategory` in Plan order); `annualFundingApplicationAndClosePhase.ts` line 911 (reserve 0 when the floor is 0) |
| 99 | Fixed point | converges on the **second** evaluation | seeded with the pre-tax need 100,869.60 − 72,143.094340 = 28,726.505660 (`spendingUsesBeforeTax − baseCashInflows`); the first evaluation returns 47,817.117770, which the second reproduces (a cash draw adds no income, so the tax does not move). The count is published only in ACA-active years; a test must not assert it | `annualFundingFixedPoint.ts` header ("WHAT IT TAKES: the pre-tax cash need …", line 5), `spendingUsesBeforeTax` doc (line 48), convergence at `ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS` (`annualFundingApplicationAndClosePhase.ts` line 1065) |
| 100 | Cash inflows = outflows | 119,960.21 = 119,960.21 | inflows: SS 55,728 + net RMD cash 16,415.094340 + cash draw 47,817.117770 = 119,960.212109; outflows: expenses 100,869.60 + tax 19,090.612109 | identity |
| 101 | `surplusInvested` | **0** | max(0, 72,143.094340 − 100,869.60 − 0 − 19,090.612109 − 0) = max(0, −47,817.117770). The accepted cash inflows are incomes plus the net RMD cash; the need-based draw is not an inflow, so the surplus is 0 by a 47,817.12 margin | worksheet `surplus-invested-annual`; `YearResult.surplusInvested` doc; `annualFundingApplicationAndClosePhase.ts` lines 1068, 1190 (body); section 3, B2 |
| 102 | `shortfall` / `requiredShortfall` / `targetShortfall` | 0 / 0 / 0 | fully funded | worksheet `spending-shortfall-annual` |

### 2h. Withdrawals (published)

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 103 | `withdrawals.cash` | **47,817.12** (47,817.117769660377358…) | row 97 | worksheet `withdrawals-by-category-annual` |
| 104 | `withdrawals.taxable` / `.roth` / `.hsa` | 0 / 0 / 0 | **The conversion is not a withdrawal**: `YearWithdrawals.total` composes need-based draws, RMDs, SEPP, inherited forced distributions and action proceeds, and no conversion | `YearWithdrawals.total` doc |
| 105 | `withdrawals.traditional` | **26,415.09** | need-based traditional 0 + the RMD (gross, the QCD included) | `YearResult.rmd` doc ("included in withdrawals.traditional"); `YearWithdrawals.total` doc |
| 106 | **`withdrawals.total`** | **74,232.21** (exact 74,232.212109283018868…) | 47,817.117770 + 26,415.094340. Check: need 64,232.212109 + QCD 10,000 | worksheet `withdrawals-total-annual` |

### 2i. Year-end balances

**Growth timing.** Growth is applied at year end, on the post-flow balance: the RMD, the conversion (Morgan's IRA out,
Morgan's Roth in) and the cash draw all happen first, then each account grows by its full annual rate. Sources: the
`simulate.ts` header ("apply flows → property events → growth → snapshot"); the `annualPostSolveAccountGrowth.ts`
header ("the closing pre-growth balance states"); `YearResult.balances` doc ("after flows and growth"). Rates: cash 2%
(its own `annualReturnPct`, no shock); both IRAs and the Roth 5% (`annualReturnPct` null, so `defaultReturnPct` 5;
`annualPostSolveAccountGrowth.ts` line 128).

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 107 | Cash, pre-growth / growth | 32,182.88 (32,182.882230339622642…) / 643.66 (643.657644606792453…) | 80,000 − 47,817.117770; × 2% | worksheet `accounts-balance-per-account-annual` |
| 108 | **`balances['bracket-fill-roth--cash']`** | **32,826.54** (exact 1,359,223,916,697/41,406,250 = 32,826.539874946415094…) | × 1.02 | `YearResult.balances` doc |
| 109 | Morgan's IRA, pre-growth / growth | 558,486.45 (exact 1,479,989,081/2,650 = 558,486.445660377358491…) / 27,924.32 (27,924.322283018867925…) | 700,000 − RMD 26,415.094340 − conversion 115,098.46; × 5%. **The conversion leaves Morgan's IRA** | same |
| 110 | **`balances['bracket-fill-roth--ira-m']`** | **586,410.77** (exact 31,079,770,701/53,000 = 586,410.767943396226415…) | × 1.05. Also the prior-Dec-31 base for Morgan's 2027 RMD | same |
| 111 | Riley's IRA, pre-growth / growth | 400,000 / 20,000 | no RMD, no gift, no conversion (her share was trimmed) | same |
| 112 | **`balances['bracket-fill-roth--ira-r']`** | **420,000.00** | 400,000 × 1.05. The prior-Dec-31 base for 2027 (and her 2028 first RMD is on the 2027 close) | same |
| 113 | Morgan's Roth IRA, pre-growth / growth | 165,098.46 / 8,254.923 | 50,000 + 115,098.46; × 5% | same |
| 114 | **`balances['bracket-fill-roth--roth']`** | **173,353.38** (exactly 173,353.383) | 165,098.46 × 1.05 | same |
| 115 | Unassigned cash | 0 | a cash account exists and the surplus is 0 | `YearResult.investableTotal` doc |
| 116 | **`investableTotal`** | **1,212,590.69** (exact 50,208,833,291,697/41,406,250 = 1,212,590.690818342641509…) | 32,826.539875 + 586,410.767943 + 420,000 + 173,353.383. The rounded parts also sum to it: 32,826.54 + 586,410.77 + 420,000.00 + 173,353.38 = 1,212,590.69 | worksheet `accounts-investable-total-annual` |
| 117 | `netWorth` | 1,212,590.69 | no property, debt, insurance, ladder or HECM | worksheet `accounts-net-worth-annual` |

### 2j. What the conversion cost (a counterfactual; no published field)

The example teaches "lifetime tax vs ending Roth balance". These rows show what the 2026 conversion cost in 2026 on the
same contracts, and why the first dollars were cheap and the last ones dear.

| # | Figure | Value | Derivation |
|---|---|---|---|
| 118 | Without any conversion | ordinary 16,415.09; taxable SS 6,237.23; AGI 22,652.32; senior 12,000; TI **0**; tax **0**; cash draw 28,726.51 | row 45; deductions 47,500 exceed AGI |
| 119 | The conversion's tax | **19,090.61**, all of the year's tax: **16.59%** of the 115,098.46 converted, against a 22% bracket and a 24.64% last-dollar rate | 19,090.612109 / 115,098.46 = 0.16586331 |
| 120 | Layer 1: 0 to 13,431.18 | 0% | fills the deductions: AGI rises 1.85 per converted dollar (taxable SS phasing in) until AGI reaches 47,500 |
| 121 | Layer 2: 13,431.18 to 26,836.58 | 18.5% (10% × 1.85): **2,480.00** | TI 0 → 24,800 |
| 122 | Layer 3: 26,836.58 to 48,390.08 | 22.2% (12% × 1.85): **4,784.88** | until taxable SS reaches the 85% cap (ordinary 64,805.18) |
| 123 | Layer 4: 48,390.08 to 84,516.11 | 12%: **4,335.12** | SS capped; TI 64,673.98 → 100,800 |
| 124 | Layer 5: 84,516.11 to 86,216.11 | 22%: **374.00** | TI 100,800 → 102,500, AGI 148,300 → 150,000 |
| 125 | Layer 6: 86,216.11 to 115,098.46 | 24.64% (22% × 1.12): **7,116.61** | senior phase-out; TI 102,500 → 134,848.24 |
| 126 | Sum of layers | **19,090.61** (19,090.612109283…) | 0 + 2,480 + 4,784.877176 + 4,335.122824 + 374 + 7,116.612109; equals row 74 |

### 2k. Penalties and other published zeros

| # | Figure | Value | Rule | Contract source |
|---|---|---|---|---|
| 127 | **`penalties`** (incl. `rmdShortfallExciseTax`) | **0** | Morgan's RMD is fully distributed; no need-based traditional, Roth or HSA withdrawal; both are past 59½; a conversion is never penalized | worksheet `tax-penalties-annual`; `YearResult.penalties` doc; `simulate.ts` header |
| 128 | Other published zeros | `contributions`, `employerMatch`, `sepp`, `inheritedDistribution`, `hecmDraw`, `ladderValue`, `insuranceCashValue`, `deathBenefit`, `capitalLoss*` all 0; `guardrailAction` `hold`; no `aca` | none in the plan | `YearResult` docs |

### 2l. Wrong readings a test should reject (all exact, computed from the same inputs)

Where a wrong reading moves the sizing root, the value shown uses that reading's closed-form root rounded to the cent
(the engine's bisection would land within $0.01 below it); every other input is the engine's.

| Wrong reading | What it produces | Correct |
|---|---|---|
| **The bracket is filled** (Riley's share converts too, as if she held a Roth IRA) | conversions 183,448.24 (Morgan 115,098.46 + Riley 68,349.78); TI 211,399.99; tax **35,931.997901**; MAGI 247,232.13, which is **above 2028's tier-1 floor 229,036.25** (a 2028 IRMAA surcharge); cash draw 64,658.503562; cash year-end 15,648.33; Riley's IRA 348,232.73 | `rothConversion` 115,098.46; tax 19,090.612109; MAGI 178,882.35 (tier 0 in 2028) |
| The whole household amount converts out of Morgan's IRA (the "fill the bracket" reading with the owner split ignored) | `rothConversion` 183,448.244679; tax 35,931.999054; Morgan's IRA year-end 514,643.49; Roth 245,120.66 | same; and a cross-owner conversion is unlawful (registry record `irc-408-d-3-A-i-conversion-benefits-the-distributee`) |
| Weight the owner split by the opening balances (700,000 / 400,000) | Morgan's slice 116,739.79; tax 19,495.035821 | weights after the RMD: 115,098.46 |
| Split the household amount equally | Morgan's slice 91,724.12; tax 13,331.174733 | 115,098.46 |
| Phase the senior deduction out once against the couple's combined 12,000 (zero at 350,000) | sizing root 188,951.95; Morgan's slice 118,551.58; senior 10,059.87; TI 136,775.60; tax 19,514.632616 | per person, zero at 250,000: senior 8,534.117479; tax 19,090.612109 |
| Omit the senior deduction | sizing root 183,116.11; slice 114,890.07; TI 143,173.96; tax 20,922.272155 | TI 134,848.236860 |
| Riley's FRA from her calendar birth year 1955 (66y2m) | Riley's factor 16/15, benefit 23,040; SS 55,440; taxable SS 47,124; slice 115,252.05; tax 19,068.137965 | factor 1.08; 23,328; SS 55,728 |
| Apply the pack's 2.8% COLA in the start year | SS 57,288.384; taxable SS 48,695.1264; slice 114,266.30; tax 19,212.374710 | SS 55,728 |
| Split the QCD 5,000 / 5,000, Riley's half from her IRA beyond her (zero) RMD | ordinary before conversion 21,415.09; slice 112,485.26; tax 19,678.719629; Riley's IRA 414,750 | all 10,000 from Morgan's RMD; ordinary 16,415.09; Riley's IRA 420,000 |
| Read `qcdAnnual` as 10,000 per donor | `qcd` 20,000, Riley's 10,000 debited from her IRA, so her weight falls to 39,000,000 cents; slice 116,180.63; Riley's IRA 409,500 | `qcd` 10,000 |
| Do not exclude the QCD from income | ordinary before conversion 26,415.09; slice 108,824.30; tax 20,008.659085 | 16,415.09; 19,090.612109 |
| Aggregate both spouses' IRAs for one RMD | 1,100,000 / 26.5 = 41,509.43 | Morgan only: 26,415.094340 (each owner's RMD is on that owner's own IRAs) |
| Give Riley an RMD at 71 (for example the table's first row, 27.4) | 14,598.54 | none until 2028 |
| Use the age-74 divisor 25.5 (or 27.4 for 72) for Morgan | 27,450.98 (or 25,547.45) | 26,415.094340 |
| Count the conversion as a withdrawal, or as spendable cash | `withdrawals.traditional` 141,513.55 and total 189,330.67; or a cash draw of −67,281.34 (a surplus) | traditional 26,415.09; total 74,232.21; cash draw 47,817.12 |
| Withhold the conversion's tax from Morgan's IRA | cash draw 28,726.51; cash year-end 52,298.96; Morgan's IRA 566,365.63 (withholding would itself be a distribution) | tax from cash: 32,826.54 and 586,410.77 |
| Price 2026 IRMAA on 2026's own MAGI | tier still 0 (178,882.35 ≤ 218,000). **Premiums cannot tell these apart**; only `irmaaLookbackMagi` 0, `…Source` `planFallback`, `…Year` 2024 can | lookback 2024 |
| Apply the age-80 phase already in 2026 | base spending 76,500 | 90,000 (Morgan, the primary person, is 73; the phase first applies in 2033) |
| Grow before withdrawing (beginning-of-year growth) | cash 33,782.88; Morgan's IRA 593,486.45; Roth 167,598.46 | 32,826.54; 586,410.77; 173,353.38 |
| Pro-rate 2026 to the half year after the fixed "now" | roughly half the spending, Social Security and Medicare | full year |

---

## 3. Contracts I could not find or found ambiguous

Each item says what the engine's contracts support, what the alternatives are, and which reading this document uses.
None of them changes a 2026 figure *under the engine's own contracts*; A3 changes what the example appears to teach.

**A1. The start year is a full year, and the entered balances are the prior Dec 31 balances.** The same finding as both
siblings, re-verified: `SimulateOptions` carries no date (`simulate.ts` lines 183–247), no year-row contract has a
start-year proration term, and the in-function comment at `simulate.ts` line 1354 reads "Prior Dec 31 balances (RMD
base) — captured before this year's flows". Candidate readings: (a) full-year 2026 on the entered balances, with
700,000 as Morgan's 2025-12-31 balance (**used**); (b) the half year after the 2026-06-29 "now". The page should say (a)
out loud.

**A2. What dollars `piaMonthly` is in, for benefits already being paid.** Morgan's claim year is 2020 and Riley's 2022,
both before the projection. The COLA factor is 1 in 2026 and the full claim-age factor applies to the entered PIA, so
the engine reads 2,500 and 1,800 as 2026-dollar PIAs. The own-stream schema says only "Quick mode: PIA entered
directly". Candidates: (a) 2026-dollar PIAs, 2,700 and 1,944 a month (**the engine's rule, used**); (b) PIAs as of the
claim, with the 2021–2026 COLAs still to compound. The page should tell users to enter the PIA restated in current
dollars (or the current payment ÷ 1.08).

**A3. The conversion is sized for the household and executed for Morgan only; the 22% bracket is not filled.** This is
the finding that matters for the page.
- *What is documented.* The registry record `irc-408-d-3-A-i-conversion-benefits-the-distributee` (settled) states the
  whole rule: snapshot each owner's gross convertible balance after the RMD, split the sized household amount pro rata
  by exact-cent largest remainder, drain only that owner's accounts, credit only that owner's Roth, and trim the slice
  of an owner with no Roth, naming them in a warning. `YearResult.aggregateRothConversionAllocationDesired` says the
  published `rothConversion` is "strictly less than the figure the policy was handed" for such a household.
- *What is silent or misleading.* The `YearResult.rothConversion` doc says only that the amount "is drawn from
  traditional balances after any unsatisfied RMD is reserved from them", and the calculation record
  `roth-conversion-annual` (`rules/calculations/roth.ts` line 47) says the row publishes "the gross movement actually
  executed, capped by the traditional balance left after the RMD reserve". Neither mentions the owner split or the
  trim, and the `roth-conversion-annual` worksheet has one owner. Read alone, both suggest the published figure is the
  sized amount.
- *What the example says.* The learn body (`learn/content/examplePlanBodies.ts` line 86) says the couple has "a
  strategy to fill the 22% bracket with Roth conversions"; the registry card (`examples/registry.ts` line 91) teaches
  "Converting up to a bracket top". In 2026 the engine converts 115,098.46, taxable income ends at 134,848.24, and
  76,551.76 of the 22% band stays empty. In my forward estimate (section 4) Morgan's IRA is empty by the end of 2031,
  and 2032–2034 convert nothing although the window runs to 2034.
- *Candidate readings.* (a) Size for the household, then trim the owner with no Roth (**the engine's rule, used**:
  115,098.46). (b) Size against the owners who can lawfully convert, which here would put the whole 183,448.24 through
  Morgan's IRA (his 673,584.91 covers it); lawful, and what "fill the bracket" suggests, but not what the engine does.
  (c) Convert Riley's share into Morgan's Roth: unlawful, excluded by the record.
- *Recommendation.* Not an engine defect under its registered contracts. It is a product choice for Nathan: either give
  Riley a Roth IRA in the example (the golden aggregates would move), or keep the example and have the page teach the
  trim, quoting the warning. Separately, the `rothConversion` doc and the `roth-conversion-annual` record would each
  benefit from one clause naming the owner split and trim. The warning is projection-level (`ProjectionResult.warnings`),
  so a walkthrough row, whose selector reads only the year row and the plan, cannot assert it (B6).

**A4. Bisection-sized versus cent-quantized.** `aggregateRothConversionAllocationDesired` is the raw bisection result
and carries the contract's one-sided $0.01 error bar; the `roth-conversion-annual` worksheet asserts $0.005, while its
calculation record's limits say "The bisection's $0.01 stopping width is a real error bar on the published dollar"
(the ACA sibling's check, its C3, found the same split). Here it lands 0.003838546 below the closed form, inside 0.005
by the luck of the grid (step 0.0063). `rothConversion`, by contrast, passes through the exact-cent owner split and is
the same 115,098.46 for every landing the contract allows (row 57). Recommendation: assert `rothConversion` at 0.005;
pin `aggregateRothConversionAllocationDesired` at the traced 183,448.244678974151611328125 or assert
S\* − 0.01 < value ≤ S\*.

**A5. No joint-filer worksheet.** The worksheets for the bracket tax, the standard deduction with age-65 additions,
taxable Social Security, the AMT screen and the IRMAA tier boundary all derive the single-filer column only; a grep of
`DOCS/calculations` finds no married-filing-jointly case outside an insight and a Monte Carlo worksheet. The joint
figures here (brackets 24,800 / 100,800 / 211,400, the 32,200 + 2 × 1,650 deduction, the 32,000 / 44,000 SS tiers, the
140,200 AMT exemption, the 218,000 IRMAA floor, the 150,000 senior threshold) rest on the pack's `marriedFilingJointly`
column read through the same functions. Unambiguous, but the citations for rows 66–76 and 82 are method citations,
not reviewed joint derivations.

**A6. How the household QCD is divided between two donors.** `strategiesSchema.qcdAnnual` says only "per year … routed
from RMDs when age-eligible". That it is one household figure capped at the sum of the donors' limits, and that the
from-RMD gift is attributed in proportion to each owner's share of the owned-IRA RMD, is stated in the
`annualLegacyQcdGiftPlan` header and body and in a call-site comment, not in a `YearResult` contract (the `qcd` doc
names the per-donor limit only). Candidates: (a) household 10,000, routed from the RMD pro rata by RMD share, so all
from Morgan in 2026 (**used**); (b) 10,000 per donor (20,000); (c) an even split with Riley's half debited from her IRA.
(b) and (c) change ordinary income, the owner weights and Riley's balance (table 2l). From 2028, when Riley has an RMD
too, reading (a) splits the gift between them by RMD share.

**A7. Which spousal formula applies.** The guarded POMS-order helper applies only when the claimant claims before FRA;
Riley claims after, so the fallback ("reduce-then-subtract") runs. Both formulas give a zero excess here (half of
Morgan's PIA, 1,250, is below Riley's own 1,944 whatever factor is applied), so nothing in 2026 can discriminate them.
The spousal amount also earns no delayed credits (`claimFactor.ts` line 58).

**A8. Two birth-year conventions, and here one of them moves a figure.** FRA uses the January-1 effective birth year
(`nra.ts`); `ageAttained`, the RMD start, the QCD age proxy, the Medicare months and the spending phase use the calendar
birth year. No contract states the pair. For Morgan it changes nothing (1952 and 1953 both give 66y0m). **For Riley it
does**: 1954 gives 66y0m and 12 delayed months (23,328), while 1955 would give 66y2m and 10 (23,040). The engine's
reading matches SSA's rule that a person born on January 1 belongs to the prior year's cohort; the page should state it
because a reader who looks up "born 1955" in SSA's table will expect 66 and 2 months.

**A9. Cash-account growth is untaxed.** The siblings' finding, re-verified: `distributedTaxableYieldRows.ts` returns no
yield for a non-taxable account and the cash schema has no yield fields. The 643.66 of cash growth never enters income.
Under the 1099-INT reading, ordinary income would rise by about 643.66 and tax by about 24.64% of it (158.60), circular
with the cash draw.

**A10. Florida's zero is recorded only inside `tax`.** The siblings' finding: `YearResult` has no state field. Prefer
asserting `tax` = 19,090.612109 and, separately, that a direct state-calculator call on `acceptedTaxInput` returns 0.

**A11. The senior deduction still has no worksheet, and here its reading is load-bearing.** Since the siblings, the
per-person reading has a settled registry record (`irc-151-d-5-C-iii-I-senior-deduction-per-individual-phase-out`) and
explicit domain-rules text (§1), and the `seniorDeductionAmount` comment argues it from Schedule 1-A. No
`DOCS/calculations` worksheet derives it (`federal-standard-deduction-age-65` only warns not to confuse the two). It
matters twice in 2026: inside the sizing (the combined reading moves the root by 5,503.71) and in the year's tax
(combined: senior 10,059.87 at a different conversion; per person: 8,534.12).

**B1. The fixed-point seed and evaluation count.** Stated only in `annualFundingFixedPoint.ts` (header and the
`spendingUsesBeforeTax` doc); not observable from the row without ACA. Row 99 records the mechanism; no test should pin it.

**B2. What "cash inflows" means in `surplusInvested`.** As the siblings found: the doc and worksheet do not say whether
need-based withdrawals are inflows; the code excludes them (`annualFundingApplicationAndClosePhase.ts` lines 1068,
1190). Row 101 uses the code's reading: 0 by a 47,817.12 margin, not by cancellation.

**B3. Medicare start for a first-of-the-month birthday.** Both are born on January 1; the prior-month eligibility rule
is not modeled (`annualHealthcareExpenses.ts` in-body comment at lines 120–121). No effect at 73 and 71.

**B4. The claim factor is a float.** 1 + 12 × (2/3)/100 is computed in binary floating point: 12 × fl(2/3) is exactly
halfway between two doubles and rounds to 8, so the factor is fl(1.08), Morgan's monthly benefit is exactly 2,700, and
Riley's is 1,944.0000000000002 (her annual 23,328.000000000004). The household sum still rounds to exactly 55,728. The
0.005 tolerance covers every such residue.

**B5. Twelve Medicare months at 66 or older is stated only in code.** As the siblings found (`annualHealthcareExpenses`
body). Unambiguous.

**B6. The trim warning cannot be a walkthrough row.** `WalkthroughRow.select` reads `(year, plan)`; the warning lives on
`ProjectionResult.warnings`. If the page quotes the warning, the test should check `result.warnings` separately.

**B7. Section 4 is an estimate, not a derivation.** Its figures come from my own simplified forward loop and are not to
be pinned.

---

## 4. Suggested later year: **2029** (instructive, not a knife-edge), with **2033** as the third

**What happens after 2026, in outline.** 2027 is a stand-in year (brackets, standard deduction and age-65 additions
indexed by 1.025; the §86 tiers and the senior-deduction threshold unindexed). Cash has only 32,826.54 left, so 2027 is
the year **cash runs out and the first need-based traditional withdrawal appears**, from Morgan's IRA first (Plan order
within the traditional category), and the fixed point iterates because that draw is taxable. 2028 is the **first year
the IRMAA lookback reads a projected MAGI**, 2026's 178,882.35 from row 68 (source `projected`), against a tier-1 floor
of 229,036.25: tier 0. It is also Riley's first RMD year, so the QCD is split between the two owners by RMD share, and
the last year of the senior deduction. The brief's description of 2029 ("the lookback reads a projected MAGI that
includes a conversion") is therefore first true in 2028; 2029 adds the senior deduction's expiry.

**2029: instructive, and not a knife-edge.**
- The senior deduction is gone (2029 > `lastApplicableYear` 2028), so the sizing root moves to where taxable income =
  AGI − the indexed standard deduction alone.
- The lookback reads 2027's projected MAGI, which includes a conversion and the first traditional draw: about 194,728
  against a floor of 218,000 × 1.025³ = 234,762.16, so tier 0 with about 40,034 of headroom. That margin is wide, so it
  is not a knife-edge, but it also means the premiums cannot show the lookback; only the three lookback fields can.
- Both spouses take RMDs (Morgan at 76, divisor 23.7; Riley at 74, divisor 25.5), and the QCD, 10,000 × 1.025³ =
  10,768.91, is split between them by RMD share (about 4,543 from Morgan's, 6,226 from Riley's).
- The owner weights have moved: Morgan's post-RMD balance is about 289,448 against Riley's 428,103, so Morgan's share
  of the household amount falls to about 40%, and the conversion to about 78,828.
- Nothing sits near a threshold in my estimate: taxable income about 166,527 against an indexed 22% top of about
  227,654.68; taxable SS capped with a wide margin; Morgan's IRA covers both the conversion and the draw.
- Cost of deriving it by hand: 2027 and 2028 must be derived first, each with a traditional-draw fixed point.

**2033: instructive, not a knife-edge, but a longer chain.** Morgan turns 80, so the 0.85 phase applies (base about
90,000 × 1.025⁷ × 0.85 = 90,934.46). Morgan's IRA is empty from the end of 2031 in my estimate, so Riley is the only
convertible owner: the household amount (about 232,335) is still sized and published as
`aggregateRothConversionAllocationDesired`, and all of it is trimmed, so `rothConversion` is 0 inside the window, the
end state of A3 and exactly the case the `aggregateRothConversionAllocationBalances` doc describes ("the year then
publishes this snapshot beside a `rothConversion` of zero"). The QCD comes entirely from Riley's RMD; taxable Social
Security returns to the phase-in formula (about 34,403, below its cap of about 56,307); taxable income is in the 12%
band. None of it is near a threshold, but it needs the whole 2027–2032 chain.

**Rough figures** (my own forward loop on the same contracts; an estimate to orient the next derivation, not a
derivation; a test must not pin them):

| Year | Conversion (sized → executed) | Need-based traditional draw | AGI / MAGI | Senior | Taxable income | Tax | Lookback MAGI (year) vs tier-1 floor |
|---|---|---|---|---|---|---|---|
| 2027 | 191,772.98 → 109,869.90 | 23,558.50 (cash exhausted at 32,826.54) | 194,727.92 | 6,632.65 | 151,707.77 | 22,535.31 | 0 (2025, `planFallback`) vs 223,450 |
| 2028 | 185,144.15 → 93,519.25 | 51,804.23 | 219,578.64 | 3,650.56 | 178,630.89 | 28,187.38 | 178,882.35 (2026) vs 229,036.25 |
| 2029 | 195,417.58 → 78,828.19 | 55,461.80 | 204,756.70 | 0 | 166,527.08 | 25,246.76 | 194,727.92 (2027) vs 234,762.16 |
| 2030 | 205,896.32 → 54,645.62 | 55,555.98 | 176,836.68 | 0 | 137,651.32 | 18,609.37 | 219,578.64 (2028) vs 240,631.21 |
| 2031 | 215,783.58 → 20,572.00 | 54,237.61 (Morgan's IRA empties) | 138,370.71 | 0 | 98,205.72 | 11,223.51 | 204,756.70 (2029) vs 246,646.99 |
| 2033 | 232,335.28 → 0 | 39,448.67 (from Riley's IRA) | 78,695.87 | 0 | 36,497.53 | 3,790.11 | 138,370.71 (2031) vs 259,133.49 |

No year in the window reaches an IRMAA surcharge. Under the "bracket is filled" wrong reading, 2026's MAGI (247,232)
would put 2028 in tier 1.

**Loose whole-run cross-check (not evidence for any 2026 figure other than the conversion).** My loop's six executed
conversions, 115,098.46 + 109,869.90 + 93,519.25 + 78,828.19 + 54,645.62 + 20,572.00, sum to **472,533.42**, and the
example's published whole-run `lifetimeRoth` (`examples.golden.test.ts` line 147) is **472,533.42**. Under the
"bracket is filled" reading the 2026 conversion alone would be 183,448.24, and the sum would be far larger. The agreement
supports the readings used here together: the owner split with Riley's share trimmed, the per-person senior phase-out,
the QCD routed from Morgan's RMD, cash first, then Morgan's IRA before Riley's for need-based draws. Agreement to the
cent is partly luck: the loop rounds each Morgan share from a float product rather than through the engine's integer
cent weights. I did not check `lifetimeTax` or `endingInvestable`, which need the survivor years 2046–2049.
