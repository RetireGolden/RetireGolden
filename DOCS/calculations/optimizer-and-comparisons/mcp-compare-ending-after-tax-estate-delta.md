## Claim

Kind: composition. RetireGolden-MCP's `compare_scenarios` reports `deltaEndingAfterTaxEstate` as the engine's `scenarios/comparison.ts#compareScenarioPlans(planA, planB, { startYear, taxCalculatorForPlan }).headline.endingAfterTaxEstate.delta`. Each plan is projected from the same start year with its own tax calculator and summarized (`projection/compare.ts#summarizeProjection`), and the delta is `scenarios/scalarComparison.ts#compareScalars(a.endingAfterTaxEstate, b.endingAfterTaxEstate).delta = b − a`: Plan B, the proposal, minus Plan A, the baseline. A negative zero is published as 0, and a non-finite figure is refused with a `RangeError`. Each ending after-tax estate is in nominal dollars of its own plan's last year, and the delta subtracts the two as they are: when the plans end in different years nothing converts them to one year's dollars. No new engine function was needed: the existing comparison cell is exactly this family's value.

## What the adapter computed

At the census pin (RetireGolden-MCP `3197d359`), `src/adapter.ts#compareScenarios` projected and summarized each plan with its own calculator and subtracted:

```ts
deltaEndingAfterTaxEstate: sb.endingAfterTaxEstate - sa.endingAfterTaxEstate
```

Since RetireGolden-MCP #81 (`fc13b94`, 2026-09-24, not yet released) it reads `compareScenarioPlans(a.plan, b.plan, { startYear, taxCalculatorForPlan: taxCalc }).headline.endingAfterTaxEstate.delta`. The number is the same subtraction of the same two summary figures. One behaviour differs: a comparison the engine refuses (a non-finite figure) returns `ok: false` with `COMPARISON_FAILED`, where the pinned adapter returned a non-finite delta.

## Justification

The tool's field names a difference of ending after-tax estates, and the census gives its meaning as Plan B minus Plan A, nominal. The ending after-tax estate is the summary's `endingNetWorth − endingEstateToCharity − endingEstateHeirTax`, with heirs taxed on inherited pre-tax balances at the plan's heir rate (default 25 percent), and cash passing untaxed. So for plans that hold only cash and a traditional IRA, with no income, no spending and 0% returns, each account ends where it starts and `E = cash + traditional − rate × traditional`; the delta is `E_B − E_A`.

## Inputs

Both plans: one person born 1990-01-01, start year 2026, inflation 2.5 percent, heir tax rate 25 percent, no income, no spending, every return 0 percent, a zero flat-rate tax calculator. Each plan ends in the year its person reaches the planning age.

| Plan | Planning age | Last year | Cash | Traditional IRA | Unit |
|---|---:|---:|---:|---:|---|
| A (baseline) | 60 | 2050 | 1,500,000.00 | 400,000.00 | nominal dollars |
| B (proposal) | 64 | 2054 | 1,400,000.00 | 800,000.00 | nominal dollars |

## Arithmetic

A: net worth 1,500,000 + 400,000 = 1,900,000; heir tax 0.25 × 400,000 = 100,000; estate 1,800,000.

B: net worth 1,400,000 + 800,000 = 2,200,000; heir tax 0.25 × 800,000 = 200,000; estate 2,000,000.

Delta: 2,000,000 − 1,800,000 = +200,000.00, in nominal dollars (2054 dollars less 2050 dollars).

The Compare page's reading, for the wrong reading below (`scenarios/planHeadlines.ts#comparePlanHeadlines`, owner decision R13: today's dollars when the plans end in different years): A's factor 1.025^24 = 1.808725949582591, B's 1.025^28 = 1.996495018757208; 1,800,000 / 1.808725949582591 = 995,175.637533920 and 2,000,000 / 1.996495018757208 = 1,001,755.567236513; difference +6,579.929702593. `DOCS/calculations/optimizer-and-comparisons/scripts/mcp_compare_delta.py` prints every figure here in exact decimals (run from the repository root; it reads nothing from `packages/`).

## Expected

| Case | Expected |
|---|---|
| Baseline ending after-tax estate | 1,800,000.00 |
| Proposal ending after-tax estate | 2,000,000.00 |
| Delta, B minus A | 200,000.00 |

Tolerance: absolute $0.005.

## Wrong readings

- A minus B: −200,000.00.
- The ending net worth delta, heir tax left out: 2,200,000 − 1,900,000 = +300,000.00.
- The Compare page's basis, each estate in 2026 dollars by its own plan's factor: +6,579.93.

## Family

outputs: `mcp-compare-ending-after-tax-estate-delta`.

feeds: none.

The headline `endingAfterTaxEstate` cell of `scenario-comparison-cell`, which `compare_scenarios` returns as its own field; the census keeps it as its own family.

## Provenance

Derived by: claude (opus 5.5), 2026-09-30, from the census family's meaning (RetireGolden-Docs `output-families.json`) and the summary's after-tax estate identity, the arithmetic by hand and in exact decimals by the script above. Implemented by: claude (opus 5.5), 2026-09-30: no engine change (the figure is `compareScenarioPlans`'s existing headline cell); the evidence is `packages/engine/src/scenarios/comparison.mcpDelta.evidence.test.ts`. Reviewed by: unreviewed.

Reviewed by: Codex (GPT-6-Sol), 2026-09-30, `DOCS/calculations/reviews/REVIEW-2026-09-30-round3-codex.md`.
