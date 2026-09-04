# Testing and calculation validation

How RetireGolden's test suite is organized, and the discipline behind it. The goal is not coverage
percent — it is an **auditable calculation engine**: every important output is protected by tests whose
expected values come from an independent source whenever practical, so a skeptical reviewer can recompute
any expected value without reverse-engineering the app.

Commands (repo root):

```bash
pnpm test              # Vitest across engine, planner-ui, and app
pnpm test:coverage     # same, with per-package coverage thresholds
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
| `*.approximation.test.ts` | A fixture that pins an `approximated` registry record's stated delta against the code, grouped by rule rather than by module | [`packages/engine/src/rules/approximations/rmdAndInherited.approximation.test.ts`](../packages/engine/src/rules/approximations/rmdAndInherited.approximation.test.ts) |

External-oracle fixtures follow the sourcing, tolerance, and record-keeping rules in
[external-oracles.md](external-oracles.md).

**One documented exception to co-location.** The single-plan export's round trip through the MCP's
`build_plan` lives in the [RetireGolden-MCP](https://github.com/RetireGolden/RetireGolden-MCP) repo,
not beside the serializer here — as a **point-in-time pointer**, it moved there on 2026-08-30 as
`tests/planForAiRoundtrip.test.ts`, a starting point for a search rather than a path this repo can
verify. The MCP is the *consumer* of that payload, and a guard hosted here could only ever test a
published MCP — one release behind the change that broke it, and requiring a dependency arrow back
from producer to consumer. The producer side of the contract is still co-located, in
[`packages/planner-ui/src/data/planFormat.test.ts`](../packages/planner-ui/src/data/planFormat.test.ts).
See [plan-file-format.md](features/plan-file-format.md) for the full split. Do not recreate the
removed dev dependency on `@retiregolden/mcp` to bring that test back.

**A second documented exception to co-location: the approximation suite.** Every
`*.approximation.test.ts` file lives under
[`packages/engine/src/rules/approximations/`](../packages/engine/src/rules/approximations/), grouped
by the `approximated` registry record (or cluster of related records) it pins, not beside the module(s)
whose behavior it asserts against. A single approximated gap routinely spans more than one file — the
account-eligibility proxy fixtures assert through both `strategies/accountEligibility.ts` and the
calendar-date arithmetic in `actions/civilDate.ts`, and the SEPP/HSA cluster spans six records across
eight distinct modules — so co-locating by module would either duplicate the fixture per file it touches or
force an arbitrary pick of one. Grouping by rule instead keeps every fixture pinning the same authority
next to its siblings, which is what lets a reviewer sweep one file to see everything a given statutory
gap covers. Each fixture still asserts against the real exported engine entry point, never a
reimplementation, and still fails the moment the gap it names is closed — see `describeRule.ts` for the
`produced`/`accepted` contract these fixtures fulfill.

### Covering a rule the engine refuses to answer

`describeRule` refuses an `outOfScope` rule id outright, because that classification is a claim that the
engine produces no figure at all, so there is no computed value for candidate readings to disagree about.
That left 73 of the registry's 416 records with no coverage obligation of any kind: the half that says
"we will not answer this", unwatched. An `outOfScope` record asserts the engine fails closed with a typed
refusal, and nothing checked that the refusal existed, still existed, or still had the shape the record
describes. It is the same rot the `produced` field was invented to stop on the `approximated` records,
running in the flattering direction, because "we refuse this" keeps reading as careful long after the
refusal was quietly replaced by a number.

[`packages/engine/src/rules/describeRefusal.ts`](../packages/engine/src/rules/describeRefusal.ts) is the
sibling helper for those records. It accepts only an `outOfScope` id, and its spec asks for the three
things such a record asserts:

| Field | What it names |
|---|---|
| `entryPoint` | The refusal site, as one of the record's own `implementedByFunctions` entries. A symbol the record does not claim is rejected, so the fixture and the published record cannot drift apart. |
| `outOfScopeInput` | What the caller asked for that is out of scope, in one clause. |
| `refusal` | What comes back instead: the reason code, the issue kind, or the typed refusal record. |

The suite body carries the assertion, and it must drive a real exported engine entry point rather than
restate the refusal string. `entryPoint` may name a module-private symbol, because that is what the
registry records; the suite reaches it through whatever public function calls it. Refusal fixtures are
co-located like every other suite, beside the module whose refusal they assert.

`taxRuleRegistry.conformance.test.ts` then requires a refusal fixture for every `outOfScope` rule, gated
by `REFUSAL_FIXTURE_BACKLOG`. That allowlist is asserted by equality, not containment, so it ratchets in
both directions: authoring a fixture without deleting its id fails, and deleting an id without authoring
a fixture fails. Working it off will mean reclassifying some entries rather than fixturing them, because
`outOfScope` covers two shapes and only one of them has a refusal to drive. Where the triggering fact
cannot be expressed in the input model at all, no accepted input reaches the rule and there is nothing to
call; `wa-rcw-82-87-capital-gains-excise` says exactly that in its own statement.

The two scans are kept separate on purpose. A `describeRefusal` call never counts toward the settled,
unsettled, or approximated coverage tests, and a `describeRule` call never counts toward this one.

Shared helpers are intentionally thin: [`packages/engine/src/testing/money.ts`](../packages/engine/src/testing/money.ts)
(money/percent assertions with explicit tolerances) and
[`packages/engine/src/testing/planFixtures.ts`](../packages/engine/src/testing/planFixtures.ts) (minimal
plan builders). Fixture builders reduce schema boilerplate only — they must not hide business logic or
assumptions. The flat-rate tax double
[`packages/engine/src/testing/flatTax.ts`](../packages/engine/src/testing/flatTax.ts) differs in kind
rather than being an exception to that rule: it is a test double rather than a fixture builder, and it
hides nothing — its arithmetic is openly not statute. It must never stand in as an oracle for tax
correctness; federal tax expectations come from the sources named above.

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

## Refactors that must not move a number

A refactor with no intended behavior change is the opposite problem from a calculation change: there is no
new expected value to derive, and a passing suite is not evidence.
[`packages/engine/src/projection/simulate.ts`](../packages/engine/src/projection/simulate.ts) is being broken
up one annual phase at a time, and a helper that silently under-produced rows once passed all 5,495 tests in
the suite. The instrument for that job is
[`packages/engine/scripts/equivalence.mjs`](../packages/engine/scripts/equivalence.mjs) — the engine compared
against **itself** across two source trees.

It is deliberately **not** an oracle. Per [the expected-value rule](#the-expected-value-rule) the app is never
its own oracle; this tool can say "nothing moved" and can never say "this is right". Keep that wording in
commit messages and PR bodies.

The workflow is four commands, run from the repository root:

```
node packages/engine/scripts/equivalence.mjs corpus  --name full --out <dir>/corpus.json
node packages/engine/scripts/equivalence.mjs capture --corpus <dir>/corpus.json --out <dir>/base.json --engine-src <baseline tree>/packages/engine/src
node packages/engine/scripts/equivalence.mjs capture --corpus <dir>/corpus.json --out <dir>/head.json --engine-src <changed tree>/packages/engine/src
node packages/engine/scripts/equivalence.mjs compare --base <dir>/base.json --head <dir>/head.json
node packages/engine/scripts/equivalence.mjs reach   --corpus <dir>/corpus.json --spec <spec>.json
```

`--out` is mandatory for `corpus` and `capture` and never defaults inside the repository: the `full` dump is
71 MB. Point `--engine-src` at a `git archive <sha>` directory rather than at a live worktree — a capture
reads `git status` once, at the start, so another session writing to that tree mid-run yields a manifest that
looks clean while some of the numbers came from different bytes.

**Two things a PASS does not prove**, and each needs its own guard:

- **Object identity.** A caller that publishes a field-for-field rebuild of a helper's payload dumps
  identically to one that publishes the helper's own object — and a byte-identical dump passes a helper that
  is never called at all. That is a delegation test's `toBe`, not this tool's job.
- **Branches the corpus never runs.** `reach` is what closes that, using V8 precise coverage over named line
  ranges. It fails on an unreached entry and on a cold line inside a reached one; it reports, but does not
  fail, an untaken sub-line branch, because an untaken defensive `?? 0` arm is a legitimate steady state. So a
  green `reach` means "every line of every named range ran", never "every branch inside them was taken" — and
  never that a constant's neighborhood was straddled, which stays a unit test's job.

Committed reach specs still store positional `lines` plus exact trimmed `{ line, text }` anchors. Before
coverage runs, `reach` (and the committed-spec Vitest guard) **content-locate** each entry: every candidate
occurrence of the first anchor's text implies one line delta, and that delta is accepted only when every
anchor matches at its recorded line plus the same delta and the shifted range stays valid. An entry must
either match at its recorded location or share exactly one non-zero delta with every other anchored entry
for that file — zero matches, an uncorroborated non-zero location, ambiguous locations, stale anchor evidence
at the recorded location, inconsistent relative anchor layout, or an invalid shifted range fail closed. An
unchanged file therefore resolves at delta zero; insertions or deletions above a group of blocks resolve
without rewriting the JSON, while a corroborated verbatim move only needs each entry's `file` changed rather
than every stored line. A lone moved entry must update its positional lines explicitly. Edits that change
relative anchor spacing inside the measured block still fail. Do not add marker comments
throughout production source to make ranges relocatable.

[`scripts/equivalence/specs/simulate-batch.json`](../packages/engine/scripts/equivalence/specs/simulate-batch.json)
is the worked example of a spec, and
[`scripts/equivalence/corpus/blocks.mjs`](../packages/engine/scripts/equivalence/corpus/blocks.mjs) of a
purpose-built corpus tier — each member names in `covers` the branch or hazard it exists to reach, which
`reach` then turns into a measured hit count instead of a claim.

## When a calculation changes

Every change to a calculated rule carries this checklist:

1. Add or update the **smallest atomic oracle test** for the changed rule.
2. Add an **integration test through `simulatePlan`** if the rule affects cash flow, tax, MAGI, balances,
   or warnings.
3. Update the rule's own section under [domain/domain-rules-reference/](domain/domain-rules-reference/)
   (rule + source URL) — the section file, not the
   [index](domain/domain-rules-reference.md) — and the relevant `features/*` doc.
4. If a current-year parameter changed, update provenance
   (`packages/engine/src/params/provenance.ts`) and [maintenance-schedule.md](maintenance-schedule.md).
5. If a characterization snapshot changed, include a review note explaining why.
