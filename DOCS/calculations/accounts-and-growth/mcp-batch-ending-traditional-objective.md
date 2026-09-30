## Claim

Kind: composition. RetireGolden-MCP's `batch_evaluate`, called with `objective: "ending_trad"`, reports for each candidate plan it projects the engine's `projection/compare.ts#summarizeProjection` field `endingByCategory.traditional`: the last ledger row's published balances summed over the plan's accounts of type `traditional`, each logical account id once (`projection/yearFigures.ts#balancesByCategory`). Type `traditional` covers both kinds, `ira` and `employer`, inherited accounts included. Roth, HSA, taxable, cash and equity-compensation balances are not in it, and it is the gross balance, before any heir tax. The engine publishes the figure; the adapter only selects it. No new engine function was needed: the existing summary field is exactly this family's value.

## What the adapter computed

At the census pin (RetireGolden-MCP `3197d359`), `src/adapter.ts#batchEvaluate` computed the objective itself:

```ts
const last = proj.years[proj.years.length - 1]!
obj = Object.entries(last.balances).reduce((s, [id, bal]) => {
  const acct = parsed.plan.accounts.find((a) => a.id === id)
  return acct?.type === 'traditional' ? s + bal : s
}, 0)
```

Since RetireGolden-MCP #81 (`fc13b94`, 2026-09-24, not yet released) it reads `summary.endingByCategory.traditional`. Both select the final row and keep the balances whose account type is `traditional`; the adapter walked the row's balance entries, the engine walks the plan's accounts (see Limits).

## Justification

"Ending traditional" names the pre-tax retirement balance a candidate leaves at the end of the plan. The ledger publishes each account's year-end balance under its id (`YearResult.balances`), and the plan says which accounts are traditional. So the objective is the final row's balances over the traditional accounts, gross. The HSA is pre-tax money too, but it is its own account type, and the objective's name says traditional.

## Inputs

A plan with six accounts, and a two-row ledger (2030, 2031). Every other field of each row is zero.

| Account ID | Type (kind) | 2030 balance | 2031 balance | Unit |
|---|---|---:|---:|---|
| `cash-1` | cash | 12,000.00 | 12,000.00 | nominal dollars |
| `tax-1` | taxable | 85,000.00 | 85,000.00 | nominal dollars |
| `ira-1` | traditional (ira) | 250,000.00 | 240,500.25 | nominal dollars |
| `k401-1` | traditional (employer) | 320,000.00 | 310,250.50 | nominal dollars |
| `roth-1` | roth (ira) | 150,000.00 | 150,000.00 | nominal dollars |
| `hsa-1` | hsa | 22,000.00 | 22,000.00 | nominal dollars |

Heir tax rate for the wrong reading below: 25 percent (the plan default).

## Arithmetic

The last row is 2031. Traditional accounts: `ira-1` and `k401-1`. 240,500.25 + 310,250.50 = 550,750.75.

## Expected

| Case | Expected |
|---|---|
| Ending traditional objective | 550,750.75 |

Tolerance: absolute $0.005, because the sum is binary floating point.

## Wrong readings

- The penultimate row: 250,000.00 + 320,000.00 = 570,000.00.
- All pre-tax money, the HSA included: 550,750.75 + 22,000.00 = 572,750.75.
- Every retirement account, Roth included: 550,750.75 + 150,000.00 = 700,750.75.
- The first traditional account only: 240,500.25.
- After heir tax at 25 percent: 550,750.75 × 0.75 = 413,063.06.
- Every investable balance: 12,000.00 + 85,000.00 + 550,750.75 + 150,000.00 + 22,000.00 = 819,750.75.

## Family

outputs: `mcp-batch-ending-traditional-objective`.

feeds: none.

The traditional member of `accounts-ending-balance-by-category`, evaluated on each candidate plan the batch projects; the census keeps it as its own family.

## Provenance

Derived by: claude (opus 5.5), 2026-09-30, from the census family's transformation (RetireGolden-Docs `output-families.json`) and the plan's account types, the arithmetic by hand. Implemented by: claude (opus 5.5), 2026-09-30: no engine change (the figure is `summarizeProjection`'s existing field); the evidence is `packages/engine/src/projection/compareSummary.mcpObjectives.evidence.test.ts`. Reviewed by: unreviewed.

Reviewed by: Codex (GPT-6-Sol), 2026-09-30, `DOCS/calculations/reviews/REVIEW-2026-09-30-round3-codex.md`.
