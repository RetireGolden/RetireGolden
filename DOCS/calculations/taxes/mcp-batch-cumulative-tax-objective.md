## Claim

Kind: composition. RetireGolden-MCP's `batch_evaluate`, called with `objective: "cumulative_tax"`, reports for each candidate plan it projects the engine's `projection/compare.ts#summarizeProjection` field `lifetimeTaxesAndPenalties`: the sum over every projection year, in ledger order from 0, of that year's `YearResult.tax` plus `YearResult.penalties`, each in that year's nominal dollars, undiscounted. The engine publishes the figure; the adapter only selects it. No new engine function was needed: the existing summary field is exactly this family's value.

## What the adapter computed

At the census pin (RetireGolden-MCP `3197d359`), `src/adapter.ts#batchEvaluate` computed the objective itself from the candidate's projection:

```ts
obj = proj.years.reduce((s, y) => s + y.tax + y.penalties, 0)
```

Since RetireGolden-MCP #81 (`fc13b94`, 2026-09-24, not yet released) it reads `summary.lifetimeTaxesAndPenalties`, with a wiring test that fails if the adapter goes back to its own arithmetic. The two agree to the cent (see Limits); they can differ only in the order the additions are made.

## Justification

The result type fixes what each field holds (`projection/internal/types/result.ts`): `tax` is "total tax for the year", the composed calculator's amount, which is the federal total (regular tax, AMT and NIIT) plus the state amount, and "penalties are not in it"; `penalties` is "early-withdrawal penalties plus IRC §4974 RMD-shortfall excise; not in `tax`"; `amt` is "federal alternative minimum tax included in `tax`"; `medicarePremiums` and its IRMAA part `irmaaSurcharge` are premiums, not tax. A cumulative tax objective that means "all tax and penalty dollars the plan pays" is therefore `Σ_y (tax_y + penalties_y)`, with the AMT counted once (inside `tax`) and no Medicare premium in it. The objective's name says cumulative, so the sum is nominal and undiscounted.

## Inputs

A four-year ledger. Every other field of each row is zero.

| Year | tax | penalties | amt (inside tax) | irmaaSurcharge | Unit |
|---|---:|---:|---:|---:|---|
| 2026 | 18,250.40 | 0.00 | 0.00 | 0.00 | nominal dollars |
| 2027 | 21,030.15 | 2,500.00 | 1,200.00 | 0.00 | nominal dollars |
| 2028 | 0.00 | 0.00 | 0.00 | 0.00 | nominal dollars |
| 2029 | 24,410.62 | 1,000.35 | 0.00 | 1,105.20 | nominal dollars |

## Arithmetic

Tax: 18,250.40 + 21,030.15 + 0.00 + 24,410.62 = 63,691.17. Penalties: 0.00 + 2,500.00 + 0.00 + 1,000.35 = 3,500.35. Objective: 63,691.17 + 3,500.35 = 67,191.52.

Year by year, as the engine adds them: 18,250.40; + 23,530.15 = 41,780.55; + 0.00 = 41,780.55; + 25,410.97 = 67,191.52. As the pinned adapter added them (tax, then penalties, each year): the same partial sums, 67,191.52.

## Expected

| Case | Expected |
|---|---|
| Cumulative tax objective | 67,191.52 |

Tolerance: absolute $0.005, because the sum is binary floating point over cent-valued fields.

## Wrong readings

- Tax only, dropping the separate penalties channel: 63,691.17.
- Adding `amt` on top of `tax`, counting the AMT twice: 67,191.52 + 1,200.00 = 68,391.52.
- Counting the IRMAA surcharge as a tax: 67,191.52 + 1,105.20 = 68,296.72.
- The final year only: 24,410.62 + 1,000.35 = 25,410.97.
- Penalties only in the final year: 63,691.17 + 1,000.35 = 64,691.52.

## Family

outputs: `mcp-batch-cumulative-tax-objective`.

feeds: none.

The same quantity as `projection-summary-lifetime-taxes-and-penalties`, evaluated on each candidate plan the batch projects; the census keeps it as its own family.

## Provenance

Derived by: claude (opus 5.5), 2026-09-30, from the result type's field contracts and the census family's transformation (RetireGolden-Docs `output-families.json`), the arithmetic by hand. Implemented by: claude (opus 5.5), 2026-09-30: no engine change (the figure is `summarizeProjection`'s existing field); the evidence is `packages/engine/src/projection/compareSummary.mcpObjectives.evidence.test.ts`. Reviewed by: unreviewed.

Reviewed by: Codex (GPT-6-Sol), 2026-09-30, `DOCS/calculations/reviews/REVIEW-2026-09-30-round3-codex.md`.
