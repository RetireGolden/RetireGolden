# Monte Carlo and scenarios

Two ways to stress-test a plan: **Monte Carlo** drives the deterministic projection with random
returns/inflation to produce a success probability and outcome distribution; **scenarios** compare named
what-if variants (and whole separate plans) side by side. Both reuse the same `simulate` ledger — Monte
Carlo never runs a second, simplified model, so a stochastic run can't diverge from the deterministic one.

**Code:** [engine/montecarlo/](../../app/src/engine/montecarlo/) (`marketModels.ts`, `historicalReturns.ts`,
`rng.ts`, `mortality.ts`, `ltcShock.ts`, `run.ts`, `sharedPaths.ts`, `frontiers.ts`,
`historicalSuites.ts`); the Web Worker pool in
[app/src/mc/](../../app/src/mc/) (`monteCarlo.worker.ts`, `pool.ts`); scenarios in
[engine/scenarios/](../../app/src/engine/scenarios/) and [engine/projection/compare.ts](../../app/src/engine/projection/compare.ts);
UI in [planner/MonteCarloPage.tsx](../../app/src/planner/MonteCarloPage.tsx),
[ScenariosPage.tsx](../../app/src/planner/ScenariosPage.tsx), and
[ComparePlansPage.tsx](../../app/src/planner/ComparePlansPage.tsx).

## Monte Carlo

- **Same engine, stochastic inputs.** Each path runs the annual ledger with drawn real returns and
  inflation. Runs execute in a **Web Worker pool** (`navigator.hardwareConcurrency`) so the UI stays
  responsive; the RNG is **seedable** (so runs reproduce and scenario diffs aren't sampling noise).
- **Return models** behind one interface: lognormal IID per asset class with correlation, historical bootstrap (iid/block/sequence), plus more (Student-t, regime-switch Markov, CAPE-conditioned, stationary/empirical bootstrap variants, GARCH, inflation regime, reversed-history, user-shock, additive Gaussian, AR(1) mean-reverting). **15 total** — exceeds Owl's advertised 14 — selectable on Monte Carlo page (default unchanged). All drive the *exact* tax/ledger engine. 1,000 paths by default, 10,000 on demand. See domain-rules §12.
- **Class-level correlated shocks:** when any account opts into a four-class allocation
  ([domain-rules-reference.md §15](../domain/domain-rules-reference.md)), both models also emit per-class
  shocks sharing the deterministic ledger's allocation schema — the lognormal model via a Cholesky draw over
  the documented correlation matrix (the single market factor doubles as the first Gaussian, so allocated
  and unallocated accounts co-move), the historical models by replaying the S&P/Treasury series of the same
  sampled year (each centered on its own mean; international proxies US, cash unshocked). Plans without
  allocations consume identical RNG draws as before, so their distributions are unchanged.
- **Outputs report magnitude, not just success %:** the success probability (plan never depletes
  investable assets), a percentile **fan chart**, the after-tax ending-estate distribution, and a
  first-depletion-age histogram. Success % alone overweights tail behavior, so the distribution is shown
  alongside it.
- **Downside-risk metrics:** aggregation also reports cumulative probability of depletion by year, median
  and 10th-percentile after-tax ending estate, spending-shortfall dollars, and expected shortfall defined as
  the average total unfunded spending across failing paths. The Monte Carlo page surfaces these as a
  downside-risk card plus a depletion-by-year curve.
- **Same-path frontiers:** bounded spending-level and retirement-age sweeps run each variant over the same
  seeded market paths, then render success-probability curves so deltas are not sampling noise. The same
  shared-path primitive is available to decision surfaces that need stochastic candidate comparisons.
- **Historical stress suites:** on demand, the Monte Carlo page replays every rolling historical window and
  the same windows in reverse order through the normal ledger, then lists the worst windows by after-tax
  ending estate and shortfall.
- **Stochastic longevity:** mortality-weighted per-path lifespans (instead of a fixed end age) feed the
  **LTC Monte-Carlo shock** ([ltcShock.ts](../../app/src/engine/montecarlo/ltcShock.ts),
  [mortality.ts](../../app/src/engine/montecarlo/mortality.ts)) — see [insurance.md](insurance.md).
- **Spending layers & guardrails (opt-in):** a plan can split baseline spending into a **required floor**,
  target lifestyle, annual ideal/excess upside layers, and flexible one-time goals with earliest/latest windows,
  priority, skip/defer rules, and partial funding. **Withdrawal-rate guardrails** (Guyton-Klinger style) ration
  those flexible layers path by path, cutting when the withdrawal rate climbs above the starting rate, restoring
  target spending when it falls back, and optionally funding upside or pulling goals earlier in strong paths.
  Monte Carlo reports **required-floor** and **target-lifestyle** success alongside the classic success %, plus
  target-attainment percentiles, target shortfall, ideal/excess funding rates, flexible-goal outcomes, and
  guardrail action counts. Absent a policy, behavior is unchanged. Details and defaults:
  [domain-rules-reference.md](../domain/domain-rules-reference.md) Section 14; code in
  [engine/spending/](../../app/src/engine/spending/).
- **Risk-based guardrails + adjustment outlook (opt-in):** the alternative guardrail mode triggers on
  **dollar portfolio thresholds** solved from a target probability-of-success band
  ([riskBasedGuardrails.ts](../../app/src/engine/montecarlo/riskBasedGuardrails.ts): bisection over the
  starting-balance scale on shared seeded paths, plus $/mo adjustment sizing), instead of the withdrawal-rate
  ratio. For any guardrail plan the Monte Carlo page adds an **Adjustment outlook** card — P(any cut), median/
  p90 deepest cut, cut duration, P(raise), P(ending surplus), and P(clearing the bequest target) — the
  probability-and-magnitude-of-adjustment framing that replaces a bare success %. Thresholds are solved on
  demand from Spending and persist on the policy; until solved the mode is inert.

## Scenarios

A plan holds named **scenarios**: a base plus clones with partial overrides — retire at 62 vs 65, convert
vs not, a 17% SS trust-fund cut, an LTC shock, a bad-decade start. The compare view shows success %,
lifetime taxes, ending estate, and a key-year table, plus a diff of exactly which assumptions changed.
Scenarios are stored as overrides applied at run time, not as duplicated plans.

Separately, whole **plans** can be duplicated and compared ([ComparePlansPage.tsx](../../app/src/planner/ComparePlansPage.tsx))
for A/B or year-over-year review — useful when the differences are too structural for a scenario override.

## Related

The optimizer auto-runs Monte Carlo on its proposed schedule as a robustness check — see
[optimizer.md](optimizer.md). Methodology notes and defaults are in
[domain-rules-reference.md](../domain/domain-rules-reference.md) §11–12.
