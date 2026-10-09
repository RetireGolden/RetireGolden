## Claim

Kind: data. `montecarlo/rng.ts#DEFAULT_MONTE_CARLO_SEED` is 0x5eeded, the one base seed every host's default Monte Carlo run draws from, the same for every plan whatever its id (decision D-MC-DEFAULT-SEED, 2026-09-28). `montecarlo/headline.ts#headlineMonteCarloOptions(plan, startYear, pathCount = 1000)` publishes the headline run's options: `{ startYear, pathCount, seed: DEFAULT_MONTE_CARLO_SEED, model: buildLognormalModelConfigForPlan(plan, 12) }`. Path i of such a run is seeded with `derivePathSeed(DEFAULT_MONTE_CARLO_SEED, i)` (`rng-derived-path-seed`). The Monte Carlo page starts from this seed and its Re-roll replaces it for that page's runs only, never saved with the plan; the Optimize tournament's downside-resilience metric, the guardrail threshold solve and every comparison the planner pairs with the headline run use it too.

## Justification

Domain rule 12 asks that stochastic comparisons reuse the same seeded market paths, and the Monte Carlo page promises results that do not jump as the plan is edited. A seed taken from the plan's id kept edits on fixed markets but drew new markets on Duplicate, Save to My Plans and import, and put two plans compared side by side on independent markets. One constant keeps both promises. Any fixed value is one draw from the same sampling distribution, because `derivePathSeed` mixes every base seed into independent path seeds; the one requirement is that the value is not chosen by looking at outcomes. 0x5eeded was already the tournament's seed, and was kept for that reason before any figure was measured on it.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Seed literal | 0x5eeded | hexadecimal |
| Path indices | 0 and 1 | index |
| Golden-ratio constant | 0x9e3779b9 = 2,654,435,769 | uint32 |
| Mixing constants | 0x21f0aaad = 569,420,461; 0x735a2d97 = 1,935,289,751 | uint32 |
| Headline path count, return volatility | 1,000; 12 | paths; percent |

## Arithmetic

0x5eeded = 5 x 16^5 + 14 x 16^4 + 14 x 16^3 + 13 x 16^2 + 14 x 16 + 13 = 5,242,880 + 917,504 + 57,344 + 3,328 + 224 + 13 = 6,221,293.

Path 0, all words unsigned 32-bit, products reduced mod 2^32 (worked with exact integers, not the engine):
- imul(0 + 1, 2,654,435,769) = 2,654,435,769; h0 = 6,221,293 XOR 2,654,435,769 = 2,657,719,380.
- h0 >>> 16 = 40,553; h0 XOR 40,553 times 569,420,461 mod 2^32 gives h1 = 1,140,354,361.
- h1 >>> 15 = 34,800; h1 XOR 34,800 times 1,935,289,751 mod 2^32 gives h2 = 2,931,937,679.
- h2 >>> 15 = 89,475; result = h2 XOR 89,475 = 2,931,854,348.

Path 1: imul(2, 2,654,435,769) mod 2^32 = 1,013,904,242; h0 = 1,009,786,527; h1 = 3,063,916,099; h2 = 3,741,766,180; result = 3,741,805,609.

The headline options for a single-return plan with 2.5 percent inflation and a 2026 start are therefore `{ startYear: 2026, pathCount: 1000, seed: 6221293, model: { type: 'lognormal', inflationMeanPct: 2.5, returnVolPct: 12 } }`, and a copy of the plan under any other id gets the same options and the same paths.

## Expected

| Quantity | Value |
|---|---:|
| DEFAULT_MONTE_CARLO_SEED | 6,221,293 |
| Path 0 seed | 2,931,854,348 |
| Path 1 seed | 3,741,805,609 |
| Headline path count | 1,000 |
| Headline return volatility, percent | 12 |

Exact integers.

## Wrong readings

- A seed taken from the plan's id (FNV-1a, the planner's rule before the decision): `example:all-401k-no-bridge` gives 1,339,074,469, and a copy under another id gives another seed and other markets.
- Reading the literal as decimal: 5,000,000 is not a hexadecimal reading; 0x5eeded is 6,221,293.
- Seeding path i with seed + i: path 1 would be 6,221,294, not 3,741,805,609.

## Family

outputs: none.

feeds: `monte-carlo-success-rate`; `monte-carlo-investable-fan-percentiles`; `monte-carlo-ending-investable-histogram`; `monte-carlo-ending-after-tax-estate-percentiles`; `monte-carlo-depletion-probability-by-year`; `insight-monte-carlo-success-delta`; `risk-based-guardrail-solved-balance-thresholds`.

## Provenance

Derived by: claude (Opus 5.5), 2026-09-28, from the decision's text (decisions-2026-09-25.md, "The Monte Carlo diagnosis, checked") and the check's section 4 (evidence/mc-example-source-check.md), the path seeds by exact integer arithmetic in a separate script that imports nothing from the engine. Implemented by the same session. Reviewed by: unreviewed at the time; see the review below.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-4-monte-carlo-optimizer.md`.

Restated 2026-10-09 by claude (Opus 5.5): the record's limit about other hosts now says RetireGolden-MCP adopted these options in 0.12.0 (`b2c7f717`). Its `run_monte_carlo` with no arguments runs `headlineMonteCarloOptions` (1,000 paths, this seed, the plan's lognormal model at 12 percent) where through 0.11.x it ran 200 paths on seed 42 with a plain lognormal model; an explicit argument replaces only its own default, and `returnVolPct` sets only the market factor. The seed, the path seeds and every expected value above are unchanged. (A first draft also named RetireGolden-Pro's meeting view, which the review below could not check from its snapshots; that host is tracked in the program tracker, not stated here.) The record's text changed after the review above, so it was unreviewed until the independent review of the restated text below.

Reviewed by: Codex (GPT-6-Sol), 2026-10-09, the 2026-10-09 restatement against RetireGolden-MCP b2c7f717 (0.12.0), `DOCS/calculations/reviews/REVIEW-2026-10-09-mcp-012-records-codex.md`.
