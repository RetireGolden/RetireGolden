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

The external-oracle fixtures currently in the tree, each with its primary source frozen into the test:

| ID | Domain | Fixture | Primary source |
|---|---|---|---|
| ORACLE-001 | Federal tax | [`packages/engine/src/tax/federalTax.external.golden.test.ts`](../packages/engine/src/tax/federalTax.external.golden.test.ts) | IRS Rev. Proc. 2025-32 — brackets, standard deduction, age-65 add, LTCG breakpoints. |
| ORACLE-002 | Federal tax + Social Security | [`packages/engine/src/tax/federalTaxSocialSecurity.external.golden.test.ts`](../packages/engine/src/tax/federalTaxSocialSecurity.external.golden.test.ts) | IRS Pub 915 Worksheet 1 + Rev. Proc. 2025-32 — retired MFJ pension+SS across all SS tiers (0%/50%/85%/85%-cap). |
| ORACLE-003 | ACA | [`packages/engine/src/tax/aca.external.golden.test.ts`](../packages/engine/src/tax/aca.external.golden.test.ts) | IRS Rev. Proc. 2025-25 + HHS 2025 FPL — applicable-percentage schedule and the 400%-FPL cliff. |
| ORACLE-004 | Medicare / IRMAA | [`packages/engine/src/tax/medicare.external.golden.test.ts`](../packages/engine/src/tax/medicare.external.golden.test.ts) | CMS CY2026 — thresholds, Part B premiums, all Part D surcharge tiers. |
| ORACLE-005 | RMD | [`packages/engine/src/rmd/rmd.external.golden.test.ts`](../packages/engine/src/rmd/rmd.external.golden.test.ts) | IRS Pub 590-B — full Uniform Lifetime table and worked examples, including the Joint Life Table II spouse example. |
| ORACLE-006 | Social Security PIA | [`packages/engine/src/socialSecurity/piaFromEarnings.external.golden.test.ts`](../packages/engine/src/socialSecurity/piaFromEarnings.external.golden.test.ts) | SSA bend points + Annual Statistical Supplement 2025 Appendix C worked example. |
| ORACLE-007/008 | Social Security claiming | [`packages/planner-ui/src/planner/ssAnalysis.external.golden.test.ts`](../packages/planner-ui/src/planner/ssAnalysis.external.golden.test.ts) | Open Social Security (pinned commit `6e177de`) — single high-discount worker ranks 62 first; low-discount couple delays the higher-PIA spouse to 70. |
| ORACLE-009/010 | State tax | [`packages/engine/src/tax/stateTax.external.golden.test.ts`](../packages/engine/src/tax/stateTax.external.golden.test.ts) | NJ Division of Taxation graduated brackets; KY DOR flat rate + $31,110 retirement exclusion below/at/above cap. |
| ORACLE-011/012 | Optimizer / full plan | [`packages/engine/src/projection/oracle011012.external.characterization.test.ts`](../packages/engine/src/projection/oracle011012.external.characterization.test.ts) | Owl (frozen at commit `266c87b`, independent of the parity-harness pin) as a directional Roth-conversion benchmark with exact-ledger non-regression; hand worksheet for a five-year RMD-start bridge (Pub 590-B divisors + 2026 Medicare premium). |
| ORACLE-013 | State tax | [`packages/engine/src/tax/stateTax.external.golden.test.ts`](../packages/engine/src/tax/stateTax.external.golden.test.ts) | CA FTB 2025 Schedule X — graduated brackets across six layers; SS exempt while pensions are fully taxed. |
| ORACLE-014 | State tax | [`packages/engine/src/tax/stateTax.external.golden.test.ts`](../packages/engine/src/tax/stateTax.external.golden.test.ts) | GA DOR — flat 5.39% and the 65+ retirement-income exclusion below/at/above the $65,000 per-person cap (the 62–64 tier is a documented model simplification). |
| ORACLE-015 | State tax | [`packages/engine/src/tax/stateTax.external.golden.test.ts`](../packages/engine/src/tax/stateTax.external.golden.test.ts) | IL DOR — flat 4.95% with the full retirement-income subtraction; cases chosen so the unmodeled personal exemption cannot change the answer. |
| — | TIPS ladder | [`packages/engine/src/ladder/ladderMath.worksheet.golden.test.ts`](../packages/engine/src/ladder/ladderMath.worksheet.golden.test.ts) | Hand worksheet on the dated U.S. Treasury par real yield curve snapshot (2026-06-30): back-to-front faces, par-as-spot rung prices, and deferral coupons derived by decimal arithmetic outside the engine. |

Known gaps, kept visible on purpose: state-tax external fixtures now cover NJ, KY, CA, GA, and IL — but
states that tax Social Security (CO, MN, MT, …) still have none, because the big-levers model documents an
intentional overstatement there (income-based SS subtractions are unmodeled), leaving no cleanly comparable
worksheet subset; TIPS-ladder pricing has a hand-priced dated-curve worksheet but still no independent-tool
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
7. Update [testing.md](testing.md)'s companion docs as needed
   ([domain/domain-rules-reference.md](domain/domain-rules-reference.md), the relevant `features/*` doc).

## Review cadence

Run and refresh external-oracle records:

- During the annual parameter-pack update ([maintenance-schedule.md](maintenance-schedule.md)).
- Before a major release.
- Any time code changes AGI, MAGI, taxable income, RMDs, Social Security, ACA, Medicare/IRMAA, state tax,
  Roth conversions, or withdrawal ordering.
- Any time an external oracle updates in a way that affects a pinned fixture.

For annual refreshes, keep old fixtures when they protect old tax-year behavior and add new fixtures for
the new tax year. Do not mutate expected values without recording the reason.
