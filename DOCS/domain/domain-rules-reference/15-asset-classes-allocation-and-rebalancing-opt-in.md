## 15. Asset classes, allocation, and rebalancing (opt-in)

Accounts can opt into a four-class allocation (`allocation` on taxable/traditional/Roth/HSA accounts):
**US stocks, international stocks, bonds, cash**. An account without an allocation keeps the single
expected-return model unchanged. When present, the allocation supersedes the account's `annualReturnPct`:
growth is the class-blended return, glidepaths compile to per-year target weights (static / linear from→to /
staged steps / custom interpolated year targets), and Monte Carlo shocks each class with correlated draws
sharing the same schema.

**Class defaults** (Assumptions-level, user-editable via `assumptions.assetClassParams`; code in
[engine/allocation/assetClasses.ts](../../../packages/engine/src/allocation/assetClasses.ts)):

| Class | Return (nominal) | Volatility | Yield | Qualified share |
|-------|------------------|------------|-------|-----------------|
| US stocks | 7.0% | 19.6% | 1.5% dividends | 95% |
| International stocks | 7.0% | 21.0% | 3.0% dividends | 70% |
| Bonds | 4.0% | 7.7% | 4.0% interest | — |
| Cash | 2.5% | 0.5% | 2.5% interest | — |

Returns match the in-app return estimator's long-run nominal conventions (§13: stocks 7%, bonds 4%, cash
2.5% — between forward CMAs and long-run history; intentionally consistent so opting into classes does not
silently change a 60/40 account's expected growth). Volatilities are long-horizon historical standard
deviations from the [Damodaran (NYU Stern) annual dataset](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html)
(S&P 500, 10-yr Treasury, 3-mo T-bill), the same source as the embedded Monte Carlo history; international
volatility proxies long-run MSCI EAFE (USD) history. Dividend/interest yields are current-era broad-index
figures (S&P 500 ≈ 1.2–1.6%, MSCI EAFE ≈ 3%, yield-to-maturity-driven bond funds ≈ coupon); the qualified
shares reflect that most US index dividends are qualified while a meaningful slice of foreign dividends is
not. Review annually with the parameter-pack workstream ([maintenance-schedule.md](../../maintenance-schedule.md)).

**Default correlation matrix** (long-horizon historical, documented here; editable defaults can ship later):
US/intl stocks **0.75**, stocks/bonds **0.10**, bonds/cash **0.20**, stocks/cash **0.00**. Stock-bond
correlation has swung between roughly −0.3 and +0.35 by decade in the Damodaran data; 0.10 is the
long-horizon average, deliberately not the post-2000 negative regime.

**Modeling conventions:**

- **Rebalancing** (`allocation.rebalancing`, default `annual`): each January the account trades drifted
  weights back to the year's glidepath target. Taxable sales realize gains pro-rata through the same
  aggregate basis-ratio machinery as withdrawals (basis rises by the realized gain); traditional/Roth/HSA
  rebalances are tax-free. `none` opts out — weights drift with returns and glidepath targets are ignored
  after the start.
- **Weights, not lots.** Withdrawals and deposits are assumed pro-rata across classes, so the engine tracks
  each account's weight vector; only differential class growth moves it. This is exact under the pro-rata
  assumption and keeps the ledger O(accounts) per year.
- **Taxable drag by class.** An allocated brokerage account derives its interest/dividend yield and
  qualified share from the blend (explicit account-level yield fields still override), so a bond-heavy
  taxable account drags more than a stock-heavy one through the §2 annual-yield machinery.
- **Monte Carlo.** With any allocated account, the lognormal model draws per-class correlated,
  mean-preserving shocks (Cholesky over the matrix above, the single market factor doubling as the first
  Gaussian so allocated and unallocated accounts co-move); the historical models key class shocks off the
  same sampled year (stocks → S&P series, bonds → Treasury series, each centered on its own mean;
  international proxies the US series; cash unshocked). Plans without allocations consume identical RNG
  draws as before, reproducing current distributions exactly.
- **Asset location.** The decision-engine generator `assetLocationGenerator` proposes bounded location swaps
  (bonds → traditional, stocks → taxable/Roth) that preserve the household's total dollars per class, as
  plan patches priced by the exact ledger — never recommended from generation-time heuristics. When a plan
  opts into static allocation on multiple eligible accounts, the Insights `asset-location` detector surfaces
  the generator's candidates as previewable scenarios (the Roth conversion optimizer tournament does not
  include them).

**Code:** [engine/allocation/assetClasses.ts](../../../packages/engine/src/allocation/assetClasses.ts) (params,
glidepath compilation, blends), applied in
[engine/projection/simulate.ts](../../../packages/engine/src/projection/simulate.ts) (rebalance pass, yield blend,
growth), [engine/montecarlo/marketModels.ts](../../../packages/engine/src/montecarlo/marketModels.ts) (class
shocks), [engine/decisions/generators.ts](../../../packages/engine/src/decisions/generators.ts) (location
candidates), [engine/insights/detectors/assetLocation.ts](../../../packages/engine/src/insights/detectors/assetLocation.ts);
account editor + Assumptions class table in
[planner/sections.tsx](../../../packages/planner-ui/src/planner/sections.tsx).
