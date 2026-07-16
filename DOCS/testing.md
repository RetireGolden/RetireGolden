# Testing and calculation validation

How RetireGolden's test suite is organized, and the discipline behind it. The goal is not coverage
percent — it is an **auditable calculation engine**: every important output is protected by tests whose
expected values come from an independent source whenever practical, so a skeptical reviewer can recompute
any expected value without reverse-engineering the app.

Commands (repo root):

```bash
npm test              # Vitest across engine, planner-ui, and app
npm run test:coverage # same, with per-package coverage thresholds
```

Coverage thresholds live with each package (`packages/engine/vitest.config.ts`,
`packages/planner-ui/vite.config.ts`) and guard the calculation-heavy folders — they deliberately do not
chase UI coverage. Conventions for *when* to add tests are in [standards.md](standards.md#testing); this
doc covers *what kind* of test to write and how to keep it honest.

## Two kinds of tests

The suite distinguishes two things that are easy to conflate:

| Test kind | Expected value comes from | What it proves | What it does not prove |
|---|---|---|---|
| Oracle / golden test | Hand calculation, official worksheet, or independent tool | The app matches an independently derived answer | That every nearby rule is covered |
| Characterization test | Current app output, after human review | Future changes did not alter known behavior | That the current behavior is correct |

For calculation confidence, oracle tests come first. Characterization tests are still valuable, but they
are regression tests, not correctness tests, and their names and comments must say so.

## The expected-value rule

For any test intended to prove correctness:

1. **Do not generate the expected value by running RetireGolden.** The app is never its own oracle.
2. Put the independent calculation in the test as a short worksheet comment, fixture note, or linked
   fixture file.
3. Keep the input as small as possible.
4. Freeze unrelated assumptions: one year, zero inflation, zero growth, no state tax, no Social Security —
   unless the test is specifically about that interaction.
5. Assert the smallest meaningful output set. For a tax formula, assert the tax detail fields. For a full
   plan, assert the yearly ledger rows that matter.
6. Use explicit tolerances for rounding-sensitive outputs. Avoid broad tolerances that could hide bugs.

## Test taxonomy

File naming marks the intent, co-located beside the code under test:

| Suffix | Kind | Example |
|---|---|---|
| `*.test.ts(x)` | Unit and edge-case tests | [`packages/engine/src/tax/federalTax.test.ts`](../packages/engine/src/tax/federalTax.test.ts) |
| `*.golden.test.ts` | Hand-worksheet oracle tests | [`packages/engine/src/rmd/rmd.golden.test.ts`](../packages/engine/src/rmd/rmd.golden.test.ts) |
| `*.external.golden.test.ts` | Frozen fixtures from an external oracle | [`packages/engine/src/tax/federalTax.external.golden.test.ts`](../packages/engine/src/tax/federalTax.external.golden.test.ts) |
| `*.characterization.test.ts` | Reviewed regression snapshots | [`packages/engine/src/projection/fullPlan.characterization.test.ts`](../packages/engine/src/projection/fullPlan.characterization.test.ts) |
| `*.adversarial.test.ts` | Hostile-input tests for parsers/imports | [`packages/planner-ui/src/socialSecurity/ssaStatementXml.adversarial.test.ts`](../packages/planner-ui/src/socialSecurity/ssaStatementXml.adversarial.test.ts) |

External-oracle fixtures follow the sourcing, tolerance, and record-keeping rules in
[external-oracles.md](external-oracles.md).

Shared helpers are intentionally thin: [`packages/engine/src/testing/money.ts`](../packages/engine/src/testing/money.ts)
(money/percent assertions with explicit tolerances) and
[`packages/engine/src/testing/planFixtures.ts`](../packages/engine/src/testing/planFixtures.ts) (minimal
plan builders). Fixture builders reduce schema boilerplate only — they must not hide business logic or
assumptions.

## The layers of protection

**Atomic oracle tests** validate one formula or one narrow rule at a time — the highest trust-per-line
tests. Examples: federal brackets, Social Security provisional-income tiers, LTCG stacking, ACA
applicable-percentage breakpoints and the 400%-FPL cliff, IRMAA tier cliffs, RMD divisors and SECURE 2.0
start cohorts, SSA bend-point PIA math with dime flooring.

**Full-plan oracle tests** ([`packages/engine/src/projection/fullPlan.golden.test.ts`](../packages/engine/src/projection/fullPlan.golden.test.ts))
are small end-to-end plans whose expected ledger rows are independently calculated: cash depletion,
traditional gross-up, taxable basis gains, Social Security taxation, the pre-65 ACA bridge, RMD/QCD, the
survivor year, and state relocation. They stay tiny — zero growth and zero inflation unless the test is
about growth or inflation — because when a 20-year plan fails, it is hard to know why.

**Ledger invariants** ([`packages/engine/src/projection/ledgerInvariants.test.ts`](../packages/engine/src/projection/ledgerInvariants.test.ts))
assert things that must always be true, with no independent dollar amounts needed: deterministic repeated
runs are identical, balances never go negative beyond a rounding epsilon, category totals equal component
sums, more spending cannot improve ending assets, a no-op feature default leaves output byte-identical.
These catch sign errors, accidental money creation, and ordering mistakes.

**Characterization snapshots** cover larger, realistic plans after a human review. Rules:

1. Explicit fixture names, e.g. `marriedCoupleRmdRothCharacterization`.
2. A one-paragraph human review note in the test.
3. A limited, high-signal set of asserted rows — not the whole ledger.
4. When output changes, the diff needs a human note explaining whether the change is expected.

**Adversarial import tests** cover the messy-data boundary: malformed/hostile SSA XML, corrupt or
oversized JSON backups, unknown schema versions, and CSV/JSON import mappers
([`packages/planner-ui/src/import/`](../packages/planner-ui/src/import/)). Only the SSA XML suite carries
the `*.adversarial.test.ts` suffix today; the backup, schema, and import-mapper hostile-input coverage
lives in ordinary co-located `*.test.ts` files. Bad imports can silently poison calculations if
validation misses them — this is correctness work, not just security.

## Writing one good oracle test

```ts
it('computes a small MFJ wages-only federal tax fixture', () => {
  // Independent worksheet:
  // gross income = ...
  // standard deduction = ...
  // taxable income = ...
  // tax = ...
  const result = computeFederalTax(input)
  expectMoney(result.taxableIncome, expectedTaxableIncome)
  expectMoney(result.totalTax, expectedTax)
})
```

The comment is not decorative. It is the audit trail: if the expected value ever changes, the reviewer can
recompute the worksheet without reverse-engineering the app.

## What not to do

- Do not generate golden expected values by running RetireGolden and pasting the output into an oracle test.
- Do not test only rounded UI strings when the engine exposes structured values.
- Do not write huge full-plan oracle tests first — small plans localize failures.
- Do not hide assumptions in fixture builders.
- Do not compare against external tools without documenting assumption differences
  (see [external-oracles.md](external-oracles.md)).
- Do not chase 100% global coverage before the high-impact calculation tests are in place.

## When a calculation changes

Every change to a calculated rule carries this checklist:

1. Add or update the **smallest atomic oracle test** for the changed rule.
2. Add an **integration test through `simulatePlan`** if the rule affects cash flow, tax, MAGI, balances,
   or warnings.
3. Update [domain/domain-rules-reference.md](domain/domain-rules-reference.md) (rule + source URL) and the
   relevant `features/*` doc.
4. If a current-year parameter changed, update provenance
   (`packages/engine/src/params/provenance.ts`) and [maintenance-schedule.md](maintenance-schedule.md).
5. If a characterization snapshot changed, include a review note explaining why.
