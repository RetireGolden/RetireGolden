## 12. Monte Carlo methodology notes

- Drive the same annual ledger with stochastic real returns + inflation; never a separate simplified model (avoids divergence).
- Return models (15+): lognormal (correlated), historical (iid/block/sequence + more bootstrap flavors), Student-t fat-tailed, Markov regime-switch, CAPE-conditioned, stationary bootstrap, empirical (non-centered), GARCH(1,1), inflation-regime, reversed-history, user-shock, additive Gaussian (normal), AR(1) mean-reverting. See enhancements/stochastic-market-model-library.md. All mean-preserving except explicitly non-centered/forced-shock variants; class shocks supported; seed-deterministic; default unchanged. Exceeds Owl's advertised stochastic breadth while powering the exact tax/ledger (unique advantage).
- Report success probability **and** magnitude (median/percentile ending estate, depletion-age distribution, cumulative depletion probability by year, and spending shortfall dollars); success % alone overweights tail behavior.
- Expected shortfall is a user-facing plain-English metric: average total unfunded spending across failing paths. It is not finance CVaR.
- Scenario/candidate stochastic comparisons must reuse the same seeded market paths for every row; do not compare candidates from independently sampled Monte Carlo runs.
- Frontier views are bounded same-path sweeps (for example, spending level or retirement age vs. success probability), not optimizer searches.
- Historical stress reports replay every rolling window and reversed window through the same ledger, then identify the worst windows by ending estate and shortfall.
- Use seedable PRNG (e.g., PCG/xoshiro) so runs are reproducible and scenario diffs aren't noise; antithetic variates cheap variance reduction.
- 1,000 paths default / 10,000 on demand; Web Worker pool keeps UI responsive.
