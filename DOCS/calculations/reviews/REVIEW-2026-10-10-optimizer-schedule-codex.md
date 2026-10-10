# Review, 2026-10-10 (optimizer-schedule-codex)

Reviewer: Codex (GPT-6-Sol), headless and read-only, by independent recomputation without executing the engine's tests, on a snapshot of RetireGolden branch `claude/census-optimizer-schedule` at `163ebc56a` and RetireGolden-MCP at `b2c7f717` (paths under `mcp/` are RetireGolden-MCP's). The work was done by Claude (Opus). Scope: the two calculation records of decision D-MCP-OPTIMIZER-SCHEDULE, `optimizer-schedule-objective-and-lifetime-tax` and `optimizer-schedule-year-solution`, and their census selectors. Verdicts: 2 approve, 0 reject. `163ebc56a` is the slice's commit on RetireGolden#791's head `429bbca7`, before it was rebased onto main and squashed into RetireGolden#792; at the pull request's first head the reviewed records, worksheets, evidence and census rows are the same except for the `reviewedBy` flips, these Reviewed-by lines and the corrected digit below. The case-2 intermediate product it flags is corrected in the worksheet to 364,632.76634; the objective and the published cents were already right. The only edits to the report below replace local snapshot paths with repository paths (the RetireGolden snapshot's root is the repository root) and drop the snapshot's `engine/` prefix. Verbatim output follows.

---

# Independent review — optimizer schedule published figures

Reviewer: Codex GPT; headless, read-only review. Date: 2026-10-10. Supplied snapshots: RetireGolden `163ebc56a` (the repository root) and RetireGolden-MCP `b2c7f717` (`mcp/`). No repository files were changed, no tests were run, and no engine package was imported. The calculations below use independent decimal arithmetic from the stated model and code.

## `optimizer-schedule-objective-and-lifetime-tax` — approve

The MCP adapter's `runOptimizer` returns `optimizePlan(...).schedule` directly (`mcp/src/adapter.ts:658-675`). With no convergence option, `optimizePlan` returns its first `optimizeSchedule(buildOptimizerInput(...))` schedule (`packages/engine/src/projection/optimizePlan.ts:2848-2913`). The LP objective is the stated end-bucket expression plus `0.000001` per conversion; `fmt` writes nonintegers to eight decimal places (`optimizer.ts:547-558, 1018-1038`). `buildOptimizerInput` supplies `1/(1+i)^n` and the heir rate (`optimizePlan.ts:709-729`). The returned `endingAfterTax` rounds HiGHS's `ObjectiveValue`; `lifetimeTax` recomputes federal bracket tax, flat and bracket state tax, cumulative IRMAA surcharge, and realized gain times the gain rate from the published per-year readout (`optimizer.ts:1128-1238`). These are solver figures, not projection results.

Independent recomputation, using the LP's eight-decimal coefficients and then its six-significant-digit per-year readout:

| Case | End balances used in objective (other, taxable, traditional, inherited) | Objective before cent rounding | Lifetime tax from published readout | Published |
|---|---|---:|---:|---|
| 1 | 128,419.41; 420,000; 1,756,817.79; 0 | 1,769,100.80272448 | 41,024.00 | 1,769,100.80; 41,024.00 |
| 2 | 7,410.11434; 375,682.18426; 1,350,562.49344; 354,900 | 1,825,588.15025833 | 47,664.034 | 1,825,588.15; 47,664.03 |

For case 1, the conversion reward is $0.10702888. For case 2, tax is $20,182.40 + $2,884.80 + $2,666.034 in 2026 and $20,782.40 + $1,148.40 in 2027. The worksheet's case-2 intermediate product `0.9518144 × 383,092.29860` is printed as `364,632.76633`; ordinary rounding gives `364,632.76634`. Its final objective and cents remain correct.

The record's limits plainly cover the potentially misleading results: an infeasible solve's HiGHS objective is retained (Infinity with IRMAA binaries, serialized as JSON null, or 0 without them); per-year readout precision is six significant digits; the default 10-second solve limit makes a timeout incumbent machine dependent; the solver deflates over `n` years while the engine's final-year dollar basis uses `n−1`; and the solver's estate and tax can differ materially from projecting the same conversions. The `bracket-fill-roth` exact dollar comparison is explicitly labeled measured rather than independently derived, and the evidence only asserts the direction and a $1,000 minimum gap. The census rows `optimizer-schedule-ending-after-tax-objective` and `optimizer-schedule-lifetime-tax` use the matching MCP selectors and distinguish these values from projection families (`output-families.json:5439-5492`).

## `optimizer-schedule-year-solution` — approve

`optimizeSchedule` reads each `OptimizedYear` field from the indicated LP column, rounds it to cents, computes gain from the rounded sale, and copies each conversion above $0.50 into `schedule.conversions` (`optimizer.ts:1142-1204`). The model's cash, RMD, IRMAA, and next-year balance constraints match the worksheet (`optimizer.ts:875-1016`). The MCP adapter returns the whole schedule.

Independent recomputation gives case 1 `wt=69,811.3225`, `conv=107,028.8775`, `wo=34,724.6775`, taxable ordinary income `201,775`, and year-end balances traditional `1,756,817.79`, other `128,419.41`, taxable `420,000`. Case 2 gives 2026 `wt=50,000.00125`, inherited draw `40,000`, sale `59,245.18434555`, taxable ordinary income `114,934.80125`, gain from the *published* sale `59,245.2 × 0.3 = 17,773.56`, tier 2, and balances traditional `1,338,749.99869`, inherited `378,000`, taxable `357,792.55644`. In 2027 it gives `wt=52,500.00494`, inherited draw `40,000`, taxable ordinary income `117,434.80494`, tier 1, saving `7,057.25175`, and end balances traditional `1,350,562.49344`, inherited `354,900`, other `7,410.11434`, taxable `375,682.18426`. Six-significant-digit reading followed by cent rounding yields every Expected-table field.

The record calls these the solver's planned withdrawals, gain, income, and balances and explains why executing its conversions in the projection can differ. It discloses six-significant-digit precision, the unpublished saving behind `withdrawOther`, and the branches the two examples do not exercise. The copied conversion value is exactly the value in `schedule.conversions[].amount`, so its join to `optimizer-recommended-conversion-annual` is valid. The five year-solution census family rows and the shared conversion family have matching MCP selectors (`output-families.json:2797-2840, 5494-5605`).
