## Claim

Kind: model. `montecarlo/marketModels.ts#createGarchModel` runs textbook GARCH(1,1) on its own innovation, with the long-run variance pinned to the configured volatility:

- `sigmaBar = returnVolPct / 100` (default 12), `alpha` (default 0.1), `beta` (default 0.85);
- `omega = sigmaBar^2 (1 - alpha - beta)`, so `omega / (1 - alpha - beta) = sigmaBar^2`;
- the path starts at `v_1 = sigmaBar^2`;
- each year `t`, in this order: `Z1_t = rng.nextNormal()`; innovation `e_t = sqrt(v_t) Z1_t`; published shock `returnShockPct = 100 e_t`; `Z2_t = rng.nextNormal()`; inflation `= inflationMeanPct + inflationVolPct (rho Z1_t + sqrt(1 - rho^2) Z2_t)`; class shocks, when configured, from first factor `Z1_t` with the shared scale `sqrt(v_t) / sigmaBar` (this year's `v_t`, before the update; 1 when `sigmaBar = 0`); then `v_{t+1} = omega + alpha e_t^2 + beta v_t`.

`omega` is not configurable. A negative or non-finite `returnVolPct`, a negative or non-finite `alpha` or `beta`, `alpha + beta >= 1`, and the retired keys `omega` and `returnVolScalePct` passed by an untyped caller are refused with a RangeError before any draw; the messages for the retired keys name the replacement. The variance is internal; only the shock, inflation and class series are published.

## Justification

- **The recursion.** T. Bollerslev, "Generalized autoregressive conditional heteroskedasticity", Journal of Econometrics 31(3):307-327 (1986): `e_t = sqrt(v_t) Z_t`, `v_{t+1} = omega + alpha e_t^2 + beta v_t`, with the innovation `e_t` fed back. Variance targeting (R. F. Engle and J. Mezrich, "GARCH for groups", Risk 9(8):36-40, 1996) sets `omega = sigmaBar^2 (1 - alpha - beta)` so that the unconditional variance is the chosen `sigmaBar^2`.
- **Stationarity.** With `alpha, beta >= 0` and `alpha + beta < 1` the unconditional variance `omega / (1 - alpha - beta) = sigmaBar^2` is finite. At the defaults `alpha + beta = 0.95`.
- **Every year has the configured standard deviation.** `E[e_t^2 | past] = v_t`, so `E[v_{t+1}] = omega + (alpha + beta) E[v_t]`. With `E[v_1] = sigmaBar^2`, induction gives `E[v_t] = sigmaBar^2` for every `t`. The published shock has mean 0 and unconditional standard deviation `returnVolPct` in every year, and shocks are uncorrelated across years.
- **Clustering.** With Gaussian innovations the fourth moment is finite when `(alpha + beta)^2 + 2 alpha^2 < 1` (0.9225 at the defaults). The stationary kurtosis is `3(1 - (alpha + beta)^2) / (1 - (alpha + beta)^2 - 2 alpha^2) = 3.7742`, and the lag-1 autocorrelation of `e^2` is `alpha (1 - alpha beta - beta^2) / (1 - 2 alpha beta - beta^2) = 0.17907`, decaying by `alpha + beta` per lag.
- **Class shocks.** Each class draw after the Cholesky mix is multiplied by `sqrt(v_t) / sigmaBar`. Since `E[v_t / sigmaBar^2] = 1`, each class keeps its configured long-run volatility and its correlations, and its conditional volatility moves with the market's. There is one common variance, not one per class.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| `returnVolPct` | 12 | percentage points |
| `alpha`, `beta` | 0.1, 0.85 | weights |
| `inflationMeanPct`, `inflationVolPct`, `correlation` | 0, 0, 0 | percent, percentage points, correlation |
| `Z1` by year | 1, 0.5, -2, 0 | standard-normal draws |
| `Z2` every year | 0 | standard-normal draw |

## Arithmetic

`sigmaBar = 0.12`, `sigmaBar^2 = 0.0144`, `omega = 0.0144 (1 - 0.1 - 0.85) = 0.00072` (in doubles `1 - 0.1 - 0.85 = 0.050000000000000044`, so `omega = 0.0007200000000000006`).

| Year | `Z1` | `v_t` | `e_t` | Shock |
|---:|---:|---|---|---:|
| 1 | 1 | `0.0144` | `0.12` | `12` |
| 2 | 0.5 | `0.00072 + 0.1(0.0144) + 0.85(0.0144) = 0.0144` | `0.06` | `6` |
| 3 | -2 | `0.00072 + 0.1(0.0036) + 0.85(0.0144) = 0.01332` | `-2 sqrt(0.01332)` | `-23.082460874005616` |
| 4 | 0 | `0.00072 + 0.1(0.05328) + 0.85(0.01332) = 0.01737` | `0` | `0` |

With `Z1 = +-1` the variance stays at `sigmaBar^2`, a hand check. Inflation is 0 in every year.

A second case, `returnVolPct 100`, `alpha 0.1`, `beta 0.8` (so `omega = 0.1`), with `Z1 = 1, 0.5, -2`: `v = 1, 1, 0.925` and the shocks are `100, 50, -192.35384061671346`.

With `alpha = beta = 0` the model is an iid normal with standard deviation `sigmaBar`: `Z1 = 1, -2, 0.5` give `12, -24, 6`.

## Expected

For the inputs above the published shocks are `[12, 6, -23.082460874005616, 0]` percentage points and inflation is `[0, 0, 0, 0]`, with absolute tolerance `1e-12`. An empty config gives the same four shocks. The second case gives `[100, 50, -192.35384061671346]`.

Refusals, each a RangeError with the message shown:

- `returnVolPct` -12, NaN or Infinity: `GARCH returnVolPct must be a finite number of at least 0; got <value>.`
- `alpha -0.1`: `GARCH alpha and beta must be finite numbers of at least 0; got alpha -0.1, beta 0.85.`
- `alpha 0.1, beta 0.9`: `GARCH alpha + beta must be below 1 for a finite long-run variance; got alpha 0.1 + beta 0.9 = 1.`; `alpha 0.2, beta 0.85` prints `= 1.05.`
- `omega: 0.00001`: `GARCH omega is no longer an input: it is derived as (returnVolPct / 100)^2 * (1 - alpha - beta), so the long-run standard deviation equals returnVolPct; remove omega (got 0.00001).`
- `returnVolScalePct: 20`: `GARCH returnVolScalePct was renamed returnVolPct, the long-run standard deviation of the return shock in percentage points; pass returnVolPct instead (got returnVolScalePct 20).`
- `returnVolPct 0` and `alpha = beta = 0` are accepted.

Seeded moments: defaults with `inflationMeanPct 2.5`, `P = 2,000` paths seeded `createRng(derivePathSeed(20260925, p))`, `Y = 30` years, `r = shock / 12`.

| Statistic | Exact | Tolerance | Seed 20260925 |
|---|---:|---:|---:|
| `mean(r^2)`, pooled | 1 in every year | within 0.07 | 1.01805 |
| `mean(r)`, pooled | 0 | within 0.0205 | 0.00445 |
| Pooled lag-1 correlation of `r^2` | 0.179 stationary; lower here because paths start at `sigmaBar^2` | above 0.08 | 0.14338 |

- `mean(r^2)`: five times an upper bound of 0.01428 on its standard error (from the stationary fourth moment and `rho_k = 0.179 (0.95)^(k-1)`); over 60 replications the empirical standard deviation was 0.01114 and the worst was 3.2 of those. 20,000 paths give year 1 at 1.0004 and year 30 at 1.0044 (standard error 0.01), which confirms `E = 1` in every year.
- `mean(r)`: five times `1/sqrt(60,000) = 0.004082`.
- Clustering: the statistic is the Pearson correlation of `(r_{t-1}^2, r_t^2)` pooled over all `2,000 x 29` consecutive pairs within paths, with separate means for the two coordinates (not an average of per-path correlations). Over 20 seeds GARCH gives mean 0.151, standard deviation 0.0099 and minimum 0.131; an iid normal (`alpha = beta = 0`) never exceeds 0.008 and gives -0.0002 at this seed. The bound 0.08 sits 7 standard deviations below the GARCH mean and ten times above the largest iid value, so it separates the two on any seed; the evidence checks both.

## Wrong readings

Years 1 to 3 of the case above:

| Reading | Shocks |
|---|---|
| Feed back the published percent `100 e_t` instead of `e_t` | 12, 189.82202190473055, -12025.791842535777 |
| Keep `omega = 1e-5` | 12, 5.8502136713115016, -21.898630094140593 |
| Update the variance before the first draw, from `v_0 = sigmaBar^2` | 11.384199576606164, 5.7078892771321348, -22.02089916420308 |
| The earlier recursion (years 1 to 4) | 0.58480766068853784, 0.29112368505499508, -1.144047740262617, 0 |

The earlier recursion also fails the seeded `mean(r^2)` row at 0.00226.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Limits

- `alpha 0.1` and `beta 0.85` are illustrative, not fitted to annual data; no source fixes annual GARCH parameters.
- Innovations are Gaussian.
- Class shocks share one common variance with the market factor rather than each class following its own.
- `v_t` is internal and not published.
- An additive shock can take a year's return below -100 percent, and the ledger floors balances at zero (`projection/internal/annualPostSolveAccountGrowth.ts`); after a large shock the next year's variance, and with it that chance, is higher.
- A return-inflation correlation outside [-1, 1], or not finite, is refused with a message.

## Provenance

Derived by: claude (Opus 5.5), 2026-09-25/26, from origin/main `aeb2861a` (the Monte Carlo derivation for the decisions of 2026-09-25, section 2). Every expected value was computed twice, by scripts that do not import engine code and by a reference implementation, and the two agree to the bit. An independent checker reproduced every headline number, including the pooled clustering statistic. Reviewed by: not yet reviewed as a record. Implemented 2026-09-26.

Revision (D-GARCH-FEEDBACK, decided 2026-09-25): the earlier recursion fed back its already-scaled shock `s_t = sqrt(v_t)(returnVolScalePct/100)(5) Z1_t` with a fixed `omega` of `1e-5` and `v_0 = 0.0001`. At the planner's default 12 its alpha term was 0.36 times the textbook one (25 times at 100), and its long-run swing was about 0.56 points a year, so paths were nearly deterministic. At settings of 24.5 or more it had no finite long-run variance (`0.1 k^2 + 0.85 >= 1` with `k = 5 returnVolScalePct / 100`); the old recursion stays strictly stationary to about 26.2. `omega` is deleted from the config and `returnVolScalePct` is renamed `returnVolPct`, the name every sibling model uses.
