## Claim

Kind: model. `montecarlo/riskBasedGuardrails.ts#solveRiskBasedGuardrails` evaluates the plan's own Monte Carlo success at scaled investable balances; `RiskBasedGuardrailSolveOptions` has no injectable success rule. For each target band fraction, it first classifies the endpoints or performs ten bisections on `[0.02, 4]`, moving `hi` when `success(mid) >= target` and returning `hi`. With one path, a solved lower edge at 70% and upper edge at 95% use the identical Boolean predicate and therefore have identical balance fractions. The band-edge dollar values are not evidenced until a success-probe seam exists (decision D-SOLVER-SEAM in the plan's decision backlog).

## Justification

Common seeded paths make every balance probe compare the same market histories, but the success values still come only from full plan simulation. The analytic illustration `S(f) = min(1, f/2)` crosses 70% at `f = 1.40` (`$700,000` for `$500,000` starting investable) and 95% at `f = 1.90` (`$950,000`); it illustrates how a crossing is found, but those values are not observables of any solver call because no success function can be injected.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Plan | any plan used by the evidence test | plan |
| `pathCount` | 1 | path |
| Lower/upper band | 70 / 95 | percent success |
| Search bracket | 0.02 / 4 | fraction of starting investable |
| Balance bisections | 10 | iterations |

## Arithmetic

The initial bracket width is `4 - 0.02 = 3.98`. After ten midpoint splits, its lattice spacing is `3.98 / 2^10 = 3.98 / 1024 = 0.00388671875`. Therefore every solved returned upper endpoint has

`balanceFrac = 0.02 + k(3.98 / 1024)`

for an integer `k` from 1 through 1023, equivalently `(balanceFrac - 0.02) * 1024 / 3.98 = k`. Rounding that expression to the nearest integer must differ from it by at most `1e-9`.

With one path, `success(f)` is either 0 or 1. For both targets, `success(mid) >= 0.70` and `success(mid) >= 0.95` are therefore the same test, so the endpoint classifications and all ten bisection choices match; when solved, the two returned `balanceFrac` values match. For either solved edge, `balanceDollars = balanceFrac * startingInvestable`, and `successAtThreshold` is 0 or 1.

## Expected

For each solved edge:

- `balanceFrac` is on `0.02 + k(3.98 / 1024)` for integer `k` in `[1, 1023]`, with the recovered integer exact after rounding to tolerance `1e-9`.
- The solved 70% and 95% edges have identical `balanceFrac` values because every one-path success comparison is identical.
- `balanceDollars = balanceFrac * startingInvestable` exactly.
- `successAtThreshold` is a member of `{0, 1}`.

If an endpoint check instead yields `always-above-band` or `never-reaches-band`, no threshold is returned; with one path, the two band edges receive the same classification.

## Wrong readings

- Using step `4 / 1024` forgets the lower endpoint. At `k = 1`, the correct point is `0.02388671875`, whereas `0.02 + 4/1024 = 0.02390625`.
- Returning `lo` rather than `hi` returns the lattice point immediately below the first known successful endpoint and does not satisfy the specified solved-threshold contract.
- Treating the analytic `S(f)` values `1.40` and `1.90` as expected solver outputs invents a success-rule input absent from the options.

## Family

`display-guardrail-balance-thresholds`, `monte-carlo-success-rate`, `monte-carlo-required-floor-success-rate`, `monte-carlo-target-lifestyle-success-rate`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment corrections) and the orchestrator's contract statements, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.

Revision: the first derivation treated an analytic success function as injectable and asserted dollar thresholds that no available call can force or evidence.

Status (orchestrator, 2026-09-18): no catalog record. The solver's thresholds have no output family in the census (display-guardrail-balance-thresholds is the UI's policy-percent-times-investable callout, a different number), and the solver takes no success rule, so neither its outputs nor its bisection can be evidenced yet; see D-SOLVER-SEAM in the plan's decision backlog.
