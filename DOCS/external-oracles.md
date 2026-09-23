# External oracle comparisons

How RetireGolden compares calculation outputs against independent sources: official worksheets,
government calculators, and third-party open-source models. The goal is confidence in high-impact
calculations without turning external tools into runtime dependencies.

The short version:

1. Use external oracles **offline**.
2. Freeze their inputs and outputs into small RetireGolden tests (`*.external.golden.test.ts` — see
   [testing.md](testing.md)).
3. Document assumption differences directly beside the expected values.
4. Treat mismatches seriously only when the compared rule is inside RetireGolden's intended model scope.

## What counts as an oracle

An oracle is an independent source for an expected result:

| Oracle type | Examples | Best use |
|---|---|---|
| Official worksheet or table | IRS Publication 590-B, Form 8962 instructions, CMS Medicare premium tables, HHS poverty guidelines | Boundary rules, annual parameters, simple hand-checkable cases |
| Official calculator | SSA AnyPIA / Detailed Calculator | Social Security PIA and retirement benefit amounts |
| Independent open-source model | Tax-Calculator, PolicyEngine US, Open Social Security, Owl | Cross-checking larger rule interactions |
| Hand worksheet from official parameters | Small tax/RMD/ACA fixtures | Narrow unit tests where the math can be audited in a comment |

The RetireGolden app itself is **not** an oracle. A test can snapshot RetireGolden output as a
characterization test, but that does not prove correctness.

## Source registry

Re-check these links during the annual maintenance pass and whenever a fixture changes.

| Domain | Preferred oracle | Source link | Use with caution |
|---|---|---|---|
| Federal income tax | Tax-Calculator | <https://taxcalc.pslmodels.org/> | It is a policy microsimulation model, so map RetireGolden's simplified inputs carefully. |
| Federal and state tax | PolicyEngine US | <https://policyengine.github.io/policyengine-us/> | AGPL project: use as a black-box oracle only. Do not copy code. |
| Federal tax worksheets | IRS forms, publications, and instructions | <https://www.irs.gov/forms-instructions> | Prefer official worksheets for atomic fixtures. |
| Premium tax credit / ACA | IRS Form 8962 instructions; HHS poverty guidelines | <https://www.irs.gov/instructions/i8962>, <https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines> | ACA policy can change by year; pin the tax year and FPL table. |
| Medicare and IRMAA | CMS Medicare premium releases | <https://www.cms.gov/newsroom/fact-sheets> | IRMAA uses a two-year lookback in real life; RetireGolden may simplify timing in some contexts. |
| RMDs | IRS Publication 590-B and RMD worksheets | <https://www.irs.gov/publications/p590b>, <https://www.irs.gov/retirement-plans/plan-participant-employee/required-minimum-distribution-worksheets> | RetireGolden intentionally does not model every first-year deferral nuance. |
| Social Security PIA | SSA AnyPIA / Detailed Calculator | <https://www.ssa.gov/oact/anypia/> | Best for benefit amount, not whole-plan claiming strategy. |
| Social Security claiming | Open Social Security | <https://opensocialsecurity.com/about/>, <https://github.com/MikePiper/open-social-security> | Compare benefits-only ranking/PV, not RetireGolden's whole-plan estate result. |
| Roth/withdrawal optimization | Owl | <https://github.com/mdlacasse/Owl> | GPL project: use as a black-box benchmark only. Do not copy code. Compare broad schedule direction and exact rerun outcomes. |

## Fixture principles

Every external-oracle fixture should be small enough that a reviewer can understand the story without
reverse-engineering a 30-year plan.

| Principle | Rule |
|---|---|
| Pin the year | Record the tax/benefit year, parameter vintage, and oracle version or access date. |
| Minimize inputs | Remove unrelated income, accounts, returns, inflation, state tax, and healthcare unless they are part of the tested interaction. |
| Compare comparable outputs | If the oracle models more rules than RetireGolden, assert only the overlapping subset. |
| Prefer structured expected values | Store expected AGI, tax, MAGI, RMD, premium, benefit, or claim age as numbers, not screenshots. |
| Keep tolerances explicit | Use dollar tolerances only for rounding or annualizing monthly figures. |
| Preserve assumptions | Put assumption notes in the fixture or in a nearby markdown record. |
| Avoid code contamination | Do not vendor GPL/AGPL code. Do not translate external source code into RetireGolden. |

## Recommended fixture record

Each external comparison carries a short record — a test comment for tiny fixtures, or a markdown file
when the setup is more involved.

```md
## ORACLE-YYYY-NNN: Short name

Status: proposed | implemented | deferred | mismatch accepted | mismatch unresolved
Domain:
Priority:
RetireGolden test file:
RetireGolden source files under test:

Oracle:
Oracle URL:
Oracle version, commit, or access date:
Tax/benefit year:

Input summary:
- Filing status:
- Ages / dates of birth:
- Income:
- Benefits:
- Accounts:
- State:
- Other assumptions:

Oracle output:
- Output A:
- Output B:

RetireGolden comparable output:
- Output A:
- Output B:

Tolerance:

Assumption differences:
- Difference:
- Why comparable:

Decision:
- Pass:
- Intentional model difference:
- Bug to fix:
```

## Test naming

| Scope | Suggested filename |
|---|---|
| Atomic formula fixture | `*.external.golden.test.ts` |
| Official worksheet fixture | `*.worksheet.golden.test.ts` |
| Whole-plan comparison | `*.external.characterization.test.ts` |
| External expected-value metadata | `DOCS/oracle-fixtures/*.md` if the comments become too large |

Do not run Python/Ruby/CLI oracle tools inside Vitest. Vitest consumes **frozen** expected values so the
test suite stays fast, deterministic, and dependency-light. (The one out-of-process comparison, the Owl
parity harness, runs as its own dev/CI-only command — see
[operations/owl-parity.md](operations/owl-parity.md).)

## Acceptance rules

Classify each comparison into one of these outcomes:

| Outcome | Meaning | Action |
|---|---|---|
| Pass | RetireGolden matches the comparable oracle output within tolerance. | Add or keep the test. |
| Expected difference | The oracle includes a rule RetireGolden intentionally omits or simplifies. | Document the difference in the test and feature docs. |
| RetireGolden bug | The difference is inside RetireGolden's modeled scope. | Fix code or parameters, then keep the fixture. |
| Oracle mismatch / unclear | The oracle setup cannot be aligned or the source is ambiguous. | Keep the record in a fixture note, but do not assert it as correctness. |

A comparison should not silently disappear. If a fixture is deferred, record why and what would unblock it.

## Tolerance guide

| Output | Default tolerance | Notes |
|---|---:|---|
| Federal/state tax | $1 | Allows rounding differences; use cents for hand worksheets when possible. |
| AGI / MAGI / taxable income | $1 | Larger differences usually indicate a real assumption mismatch. |
| RMD | $1 | Publication tables are divisor-based and should match closely. |
| ACA credit / net premium | $1 | Watch monthly-to-annual rounding. |
| Medicare premium / IRMAA surcharge | $1 annual | Monthly premiums may produce annual penny differences. |
| Social Security monthly benefit | $1 per month | AnyPIA and RetireGolden may round at different stages. |
| Social Security expected PV | 0.5% or $500 | Use only for benefits-only comparisons and document mortality/discount assumptions. |
| Optimizer conversion schedule | Directional unless exact inputs align | Exact per-year conversions can differ when objective details differ; the exact ledger result is the RetireGolden authority. |

If a tolerance has to be wider than this, the test should explain the reason.

## Implemented fixtures

The external-oracle fixtures currently in the tree, each with its primary source frozen into the test. The
calculation census (`DOCS/operations/calculation-coverage.json`, `oracleExamples`) publishes this table per
`*.external.golden.test.ts` file under `packages/<package>/src/`, beside the file's case count and the "Tolerance:"
statements in its comments, for the public methodology site's published-examples table. Adding a fixture means three
things, and the census refuses to build until all three agree:

- a row here for each oracle the fixture carries (one row may name several, `ORACLE-007/008`), in this one table:
  header and delimiter first, no blank line inside it, a pipe inside a cell written `\|`, and no id listed twice;
- a declaration in the fixture's comments for each of those ids, written `ORACLE-nnn (DOCS/external-oracles.md)`
  (a bare `ORACLE-nnn` is a cross-reference and declares nothing, so cite another file's oracle in the bare form;
  code and strings are never read); the declared ids and this table's ids for the file must match exactly;
- a `Tolerance:` statement in the fixture's comments, ending its sentence with a period (it may wrap onto the next
  comment line, but not into a blank line or a new `Label:` line). The period after a citation abbreviation (Rev.,
  Proc., Pub., No., Sec., a month, e.g., i.e., U.S., an initial) does not end it; spell out any other abbreviation.

A fixture outside `packages/<package>/src/` is refused, not skipped.

| ID | Domain | Fixture | Primary source |
|---|---|---|---|
| ORACLE-001 | Federal tax | [`packages/engine/src/tax/federalTax.external.golden.test.ts`](../packages/engine/src/tax/federalTax.external.golden.test.ts) | IRS Rev. Proc. 2025-32: the 2026 brackets, standard deduction, age-65 addition and long-term capital-gain breakpoints. |
| ORACLE-002 | Federal tax and Social Security | [`packages/engine/src/tax/federalTaxSocialSecurity.external.golden.test.ts`](../packages/engine/src/tax/federalTaxSocialSecurity.external.golden.test.ts) | IRS Publication 915, Worksheet 1, with Rev. Proc. 2025-32: a retired married couple with a pension and Social Security, across every taxable-benefit tier (0%, 50%, 85% and the 85% cap). |
| ORACLE-003 | ACA | [`packages/engine/src/tax/aca.external.golden.test.ts`](../packages/engine/src/tax/aca.external.golden.test.ts) | IRS Rev. Proc. 2025-25 and the HHS 2025 poverty guidelines: the applicable-percentage schedule and the 400% cliff. |
| ORACLE-004 | Medicare and IRMAA | [`packages/engine/src/tax/medicare.external.golden.test.ts`](../packages/engine/src/tax/medicare.external.golden.test.ts) | CMS 2026 Medicare premiums: the income thresholds, Part B premiums and every Part D surcharge tier. |
| ORACLE-005 | RMD | [`packages/engine/src/rmd/rmd.external.golden.test.ts`](../packages/engine/src/rmd/rmd.external.golden.test.ts) | IRS Publication 590-B: the full Uniform Lifetime Table and its worked examples, including the Joint Life Table II spouse example. |
| ORACLE-006 | Social Security PIA | [`packages/engine/src/socialSecurity/piaFromEarnings.external.golden.test.ts`](../packages/engine/src/socialSecurity/piaFromEarnings.external.golden.test.ts) | SSA bend points and the 2025 Annual Statistical Supplement, Appendix C worked example. |
| ORACLE-007/008 | Social Security claiming | [`packages/planner-ui/src/planner/ssAnalysis.external.golden.test.ts`](../packages/planner-ui/src/planner/ssAnalysis.external.golden.test.ts) | An open-source Social Security claiming calculator (version `6e177de`): a single high-discount worker ranks 62 first; a low-discount couple delays the spouse with the larger benefit to 70. The ranking of claiming ages is compared, not present-value dollar amounts. |
| ORACLE-009/010 | State tax | [`packages/engine/src/tax/stateTax.external.golden.test.ts`](../packages/engine/src/tax/stateTax.external.golden.test.ts) | New Jersey Division of Taxation graduated brackets; Kentucky Department of Revenue flat rate and the $31,110 retirement exclusion, below, at and above the cap. |
| ORACLE-011/012 | Optimizer / full plan | [`packages/engine/src/projection/oracle011012.external.characterization.test.ts`](../packages/engine/src/projection/oracle011012.external.characterization.test.ts) | Owl (frozen at commit `266c87b`, independent of the parity-harness pin) as a directional Roth-conversion benchmark with exact-ledger non-regression; hand worksheet for a five-year RMD-start bridge (Pub 590-B divisors + 2026 Medicare premium). |
| ORACLE-013 | State tax | [`packages/engine/src/tax/stateTax.external.golden.test.ts`](../packages/engine/src/tax/stateTax.external.golden.test.ts) | California FTB 2026 Form 540-ES deduction ($5,706 / $11,412) and the 2025 Schedule X/Y above $100,000, carried into 2026 until the 2026 schedules are published; Social Security exempt while pensions stay in ordinary income. Not a whole-return comparison: personal exemption credits are left out, and incomes under $100,000, where the FTB publishes a tax table instead of the schedule, are not compared. |
| ORACLE-014 | State tax | [`packages/engine/src/tax/stateTax.external.golden.test.ts`](../packages/engine/src/tax/stateTax.external.golden.test.ts) | Georgia Department of Revenue 2026: the flat 4.99% rate, the $15,000 / $30,000 deductions, and the 65+ retirement-income exclusion below, at and above the $65,000 per-person cap. The exclusion's separate tier for ages 62 to 64 is simplified in the model. |
| ORACLE-015 | State tax | [`packages/engine/src/tax/stateTax.external.golden.test.ts`](../packages/engine/src/tax/stateTax.external.golden.test.ts) | Illinois Department of Revenue: the flat 4.95% rate with the full retirement-income subtraction. The personal exemption is left out of the model, and the cases are chosen so it cannot change the answer. |
| ORACLE-016 | State tax | [`packages/engine/src/tax/stateTax.external.golden.test.ts`](../packages/engine/src/tax/stateTax.external.golden.test.ts) | South Carolina Department of Revenue, H.4216 notice and ratified bill text: the 2026 two-tier schedule (1.99% under $30,000; 5.21% minus $966 at and above), with cases below, at and above the $30,000 breakpoint, and the $15,000 / $30,000 SCIAD deduction. The deduction's phase-out is left out of the model, so every case keeps federal AGI at or below where it starts. |
| ORACLE-017 | State tax | [`packages/engine/src/tax/stateTax.external.golden.test.ts`](../packages/engine/src/tax/stateTax.external.golden.test.ts) | Maine Revenue Services 2026 rate schedule: the basic $15,700 / $31,400 standard deduction and the 5.8%, 6.75% and 7.15% brackets with the 2% high-income surcharge (a 9.15% top bracket), for households under 65. The personal exemption and the age-65 additional amount are outside the compared cases. |
| — | TIPS ladder | [`packages/engine/src/ladder/ladderMath.worksheet.golden.test.ts`](../packages/engine/src/ladder/ladderMath.worksheet.golden.test.ts) | Hand worksheet on the dated U.S. Treasury par real yield curve snapshot (2026-06-30): back-to-front faces, par-as-spot rung prices, and deferral coupons derived by decimal arithmetic outside the engine. |

The published rows' source cells are quoted on the public methodology site, so they name the source, what it
covers and what it leaves out, in plain words; the testing details behind each state row's limits live here:

- ORACLE-013 (California): personal exemption credits and whole-return accuracy are outside scope, and
  lower-income continuous-schedule behavior is not an FTB table oracle.
- ORACLE-014 (Georgia): the 62-64 tier of the retirement-income exclusion is a documented model simplification.
  This row's review caught the state parameters carrying Georgia's stale 2025 figures, which is the oracle process
  working as intended.
- ORACLE-015 (Illinois): cases are chosen so the unmodeled personal exemption cannot change the answer.
- ORACLE-016 (South Carolina): the $966 continuity identity is asserted in the worksheet. Every case pins federal AGI
  at or below the SCIAD phase-out floor ($40,000 single / $80,000 MFJ), so the full deduction is the DOR answer; the
  unmodeled phase-out is a documented simplification.
- ORACLE-017 (Maine): the standard deduction is asserted as parameters, and each worksheet is an explicit
  taxable-income evaluation of the published schedule (cases at $1.2M single / $1.6M MFJ taxable). Under-65 scope
  only (`peopleAged65Plus: 0`): Maine's federal age-65 additional amount ($2,050 unmarried / $1,650 per eligible
  person married) is outside this subset, and a future 65+ case must resolve the addition through the production
  path before back-constructing wages. High-income surcharge cases use wages equal to the asserted taxable income
  because the modeled phase-out yields zero deduction there; the $5,300 personal exemption remains outside the
  asserted subset.

Known gaps, kept visible on purpose: state-tax external fixtures now cover NJ, KY, CA, GA, IL, SC, and
ME — including both states whose 2026 structures were rewritten mid-year (SC's H.4216 two-tier schedule
+ SCIAD, ME's decoupled deduction + 2%-surcharge-as-9.15%-bracket) — but states that tax Social Security
(CO, MN, MT, …) still have none, because the big-levers model documents an intentional overstatement there
(income-based SS subtractions are unmodeled), leaving no cleanly comparable worksheet subset; TIPS-ladder pricing has a hand-priced dated-curve worksheet but still no independent-tool
run (e.g., tipsladder.com on the same curve); the SPIA payout-rate table is a sourced planning proxy
(last re-anchored 2026-07-15 against published April-2026 life-only sheets; the age-85 anchor is
extrapolated and the QLAC rate awaits a direct quote).

## Per-domain notes

### Federal tax

Start with official or hand worksheets when the fixture is narrow. Use Tax-Calculator when the case
combines ordinary income, Social Security taxation, itemized/standard deduction choice, LTCG stacking,
NIIT, or other interactions.

Record: tax year and filing status; gross income by type; deduction choice and age-65 additions; capital
gains and losses; taxable Social Security worksheet assumptions; and which RetireGolden simplifications
are intentionally excluded from the assertion.

Do not compare payroll tax, refundable credits, AMT, or detailed credits unless RetireGolden has
explicitly added those model areas.

### State tax

Use state department worksheets when practical. Use PolicyEngine US for structured cross-checks, but
document when PolicyEngine models credits, local taxes, itemized state differences, part-year residency,
or benefit programs that RetireGolden does not model.

Good state coverage: a no-income-tax state as a zero control, a flat-tax state, a graduated-tax state, a
state that taxes Social Security, and a state with a retirement-income exclusion or cap.

### ACA

Pin: tax year, household size, FPL table used, MAGI, annual benchmark premium, annual actual premium, and
whether enhanced credits or the 400%-FPL cliff apply for that year. Assert FPL percent, applicable
percentage, expected contribution, credit, net premium, and any warning/cliff flag.

### Medicare and IRMAA

CMS tables are the primary source. Pin: premium year, MAGI year if testing the true two-year lookback,
filing status, people enrolled in Medicare, and whether the Part D surcharge is included. When
RetireGolden uses same-year income as a planning approximation, mark that assumption clearly and compare
only the tier/premium formula for the selected MAGI.

### RMD

Use IRS Publication 590-B and RMD worksheets. Compare: start age by birth cohort, Uniform Lifetime
divisor, joint-life divisor when the spouse is sole beneficiary and more than 10 years younger, prior-year
balance divided by divisor, and QCD reducing the taxable distribution without reducing the required
distribution. Document exclusions such as the first-year April 1 deferral if they are not part of the
fixture.

### Social Security PIA

Use SSA AnyPIA / Detailed Calculator for benefit amount comparisons. Pin: DOB, earnings record by year,
eligibility year, claim age, future earnings assumption, and COLA / wage-indexing vintage. Compare AIME,
PIA where exposed, monthly benefit, and claim factor when the source provides enough detail.

### Social Security claiming

Use Open Social Security for benefits-only claiming strategy comparisons. The comparison must not include
RetireGolden's tax, portfolio, RMD, healthcare, or estate outcome.

Acceptable assertions: best claiming age for a simple single-person case; best claiming-age pair for a
simple married couple; PV ranking within tolerance for a small set of strategies. Document the mortality
table, discount rate, inflation/COLA assumption, and survivor assumptions. If RetireGolden's whole-plan
objective intentionally chooses a different claiming age because taxes or portfolio outcomes matter, that
is not an Open Social Security failure.

### Optimizer / withdrawal strategy

Use Owl only as a black-box benchmark. The purpose is not to force identical LP variables — it is to spot
large directional mistakes.

Good assertions: the exact ledger after accepting a schedule is not worse than a no-conversion baseline in
a case where both tools see Roth conversions as valuable; both tools convert more in low-income bridge
years than in high-income years; RMD pressure is reduced after early conversions.

Avoid: copying Owl code or formulas; asserting identical per-year conversion amounts unless all tax,
healthcare, IRMAA, state, investment, mortality, and objective assumptions are proven aligned.

The systematic version of this comparison is the Owl parity harness —
[operations/owl-parity.md](operations/owl-parity.md).

## Implementation workflow

1. Pick a comparison worth freezing.
2. Create the smallest RetireGolden plan or direct function input that matches the oracle.
3. Run the external oracle offline and save the input, output, version, and date in a fixture note.
4. Decide which outputs are genuinely comparable.
5. Add a RetireGolden test with frozen expected values and assumption comments.
6. If RetireGolden fails, classify the difference before changing code: bad RetireGolden math or
   parameter, intentional simplification, bad fixture mapping, or external oracle limitation.
7. Update [testing.md](testing.md)'s companion docs as needed (the rule's section under
   [domain/domain-rules-reference/](domain/domain-rules-reference/), the relevant `features/*` doc).

## Review cadence

Run and refresh external-oracle records:

- During the annual parameter-pack update ([maintenance-schedule.md](maintenance-schedule.md)).
- Before a major release.
- Any time code changes AGI, MAGI, taxable income, RMDs, Social Security, ACA, Medicare/IRMAA, state tax,
  Roth conversions, or withdrawal ordering.
- Any time an external oracle updates in a way that affects a pinned fixture.

For annual refreshes, keep old fixtures when they protect old tax-year behavior and add new fixtures for
the new tax year. Do not mutate expected values without recording the reason.
