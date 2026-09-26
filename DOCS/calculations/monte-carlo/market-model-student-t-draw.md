## Claim

Kind: model. `montecarlo/marketModels.ts#createStudentTModel` draws a Student-t return shock whose standard deviation equals `returnVolPct`. For `df > 2` (default 5) and `sigma = returnVolPct / 100` (default 12), each path year, in this order:

1. `Z = rng.nextNormal()`;
2. `V = sampleChiSquare(rng, df)`, a chi-square variate with `df` degrees of freedom drawn from uniforms only;
3. `m = sqrt((df - 2) / V)`, `t = m * Z`, published shock `returnShockPct = sigma * t * 100`;
4. `z2 = rng.nextNormal()`, inflation `= inflationMeanPct + inflationVolPct * (rho * t + sqrt(1 - rho^2) * z2)`;
5. with class shocks configured, the class sampler takes `Z` as its first factor and `m` as a scale shared by every class.

`montecarlo/marketModels.ts#sampleChiSquare` returns `V = 2G` with `G ~ Gamma(df/2, 1)` by Marsaglia and Tsang: with `d = df/2 - 1/3` and `c = 1 / sqrt(9d)`, each attempt reads `u1 = max(next(), 1e-12)` and `u2 = next()`, forms `x = sqrt(-2 ln u1) cos(2 pi u2)` and `s = 1 + c x`, rejects when `s <= 0` (2 uniforms used), else reads `u = next()` with `v = s^3` and accepts `2 d v` when `u < 1 - 0.0331 x^4` or, failing that, when `ln u < x^2/2 + d(1 - v + ln v)`; otherwise it rejects (3 uniforms used) and repeats. A `df` of 2 or less, or not finite, is refused with a RangeError before any draw.

## Justification

- **The sampler.** G. Marsaglia and W. W. Tsang, "A simple method for generating gamma variables", ACM Transactions on Mathematical Software 26(3):363-372 (2000). The method is exact for every real shape `a >= 1`; here `a = df/2 > 1`, so a non-integer `df` needs no special case. The squeeze `u < 1 - 0.0331 x^4` is a lower bound of the exact test (the paper's claim), so it only saves work; the order of the two tests fixes which uniforms are read. A chi-square variate with `k` degrees of freedom is `2 G` with `G ~ Gamma(k/2, 1)`.
- **Why uniforms only.** The number of rejections varies by year. If the loop drew from `rng.nextNormal()`, a run with class shocks and one without would consume different numbers of normals after year 1. Building the normal from the loop's own two uniforms keeps Student-t at exactly two `nextNormal` calls per year and never touches the spare-normal cache.
- **Moments.** For `V ~ chi-square(k)`, `E[1/V] = 1/(k - 2)` for `k > 2` and `E[1/V^2] = 1/((k - 2)(k - 4))` for `k > 4`; `Z` is independent of `V`.
  - `E[t] = E[m] E[Z] = 0`.
  - `E[t^2] = E[m^2] E[Z^2] = (df - 2) E[1/V] = 1` for every `df > 2`, so the shock has mean 0 and standard deviation `returnVolPct` points. The unscaled `T = Z / sqrt(V/df)` has variance `df/(df - 2)` (5/3 at df 5); `t = sqrt((df - 2)/df) T`.
  - `E[t^4] = 3 E[m^4] = 3(df - 2)/(df - 4)` for `df > 4`: 9 at df 5, infinite for `df <= 4`.
  - Inflation: `Var(rho t + sqrt(1 - rho^2) z2) = rho^2 + 1 - rho^2 = 1`, and `Corr(shock, inflation) = rho E[t^2] = rho` exactly.
  - At df 5, `P(|t| > 3) = P(|T_5| > 3 / sqrt(0.6)) = 0.011724811003954616` from the closed-form `t_5` distribution function, against 0.0027 for a normal.
- **Class shocks.** With the shared scale `m`, the class vector is `m L g`, a multivariate t with correlation `L L^T` and covariance `E[m^2] L L^T = L L^T`. The first Cholesky row is `[1, 0, ...]`, so the first class (`usStocks`) draw is exactly `m Z = t`: allocated and unallocated accounts see the same market. What co-occurs across classes is large moves in magnitude; their direction follows the correlation.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| `df` | 5 | degrees of freedom |
| `returnVolPct` | 12 | percentage points |
| `inflationMeanPct`, `inflationVolPct`, `correlation` | 0, 0, 0 | percent, percentage points, correlation |
| Normal draws `Z`, `z2` | 1, 0 | standard-normal draws |
| Uniform draws for `V` | 0.5, 0, 0.5 | uniforms in [0, 1) |

## Arithmetic

`d = 5/2 - 1/3 = 13/6 = 2.1666666666666665`; `c = 1 / sqrt(9 d) = 1 / sqrt(19.5) = 0.22645540682891913`.

First attempt: `u1 = 0.5`, `u2 = 0`, so `cos(2 pi u2) = 1` exactly and `x = sqrt(-2 ln 0.5) = sqrt(2 ln 2) = 1.1774100225154747`. `s = 1 + c x = 1.26663...`, positive, so `v = s^3 = 2.0321239789552172` and the third uniform is read: `u = 0.5`.

Squeeze bound: `1 - 0.0331 x^4 = 1 - 0.0331 (2 ln 2)^2 = 0.9363880209572302`. `0.5 < 0.9363880209572302`, so the attempt accepts on the squeeze.

`V = 2 d v = (13/3)(2.0321239789552172) = 8.805870575472607`.

`m = sqrt((5 - 2) / V) = sqrt(3 / 8.805870575472607) = 0.5836795510996967`; `t = m Z = 0.5836795510996967`.

Shock `= 0.12 * 0.5836795510996967 * 100 = 7.00415461319636` points (the closed form `12 sqrt(3/V)` prints `7.004154613196361`, a different operation order; both are within `1e-12`).

Inflation `= 0 + 0 * (...) = 0`.

Draws consumed: two normals (`Z`, `z2`) and three uniforms.

Further scripted cases (same `returnVolPct`, `Z = 1` unless stated):

- **B2**, uniforms `1e-5, 0.5, 0.5, 0, 0.5`: the first attempt has `x = sqrt(-2 ln 1e-5) cos(pi) = -4.798525912188081`, `s = -0.0866521376236622 <= 0`, so it rejects after two uniforms; the second attempt is B1's. Shock `7.00415461319636`, five uniforms.
- **B3**, uniforms `0.5, 0, 0.999, 0.5, 0, 0.95`: attempt 1 fails the squeeze (`0.999 >= 0.93639`) and the exact test (`ln 0.999 = -0.0010005003335835344` is not below `x^2/2 + d(1 - v + ln v) = -0.006778101415568449`); attempt 2 fails the squeeze and passes the exact test (`ln 0.95 = -0.05129329438755058`). Shock `7.00415461319636`, six uniforms; a seventh read is not scripted.
- **B4**, `df = 2.5`, `Z = -2`, uniforms `0.5, 0, 0.5`: `d = 0.9166666666666667`, `c = 0.3481553119113957`, `v = 2.802753148384276`, squeeze accepts, `V = 5.13838077203784`, `m = 0.3119405691687425`, shock `-7.486573660049821`.
- **Inflation reads t**: B1 draws with `correlation = -0.2`, `inflationVolPct = 1.5`, `inflationMeanPct = 0` and `z2 = 0.5` give inflation `1.5 (-0.2 (0.5836795510996967) + sqrt(0.96)(0.5)) = 0.5597430575050444`.

## Expected

For the inputs above: `V = 8.805870575472607`, `m = 0.5836795510996967`, published shock `7.00415461319636` percentage points, inflation `0`, with absolute tolerance `1e-12`; three uniforms and two normals consumed. B2 and B3 give the same shock after five and six uniforms; B4 gives `-7.486573660049821`. With correlation -0.2, inflation volatility 1.5 and `z2 = 0.5`, inflation is `0.5597430575050444`.

Refusals: `df` of 2, 1.5, 0, -3, NaN and Infinity each throw `RangeError: Student-t degrees of freedom must be a finite number greater than 2 (at 2 or below the variance is infinite, so no volatility can be matched); got <df>.`; `df` 2.0000001, 2.5 and 3 are accepted.

Seeded moments (`df 5`, `returnVolPct 12`, one path of `N = 200,000` years from `createRng(20260925)`, `r = shock / 12`), each within five standard errors: `mean(r)` within `0.0112` of 0 (standard error `1/sqrt(N) = 0.002236`); `var(r)` within `0.0317` of 1 (standard error `sqrt((E[t^4] - 1)/N) = sqrt(8/N) = 0.006325`); the share of `|r| > 3` within `0.0012` of `0.011724811003954616` (standard error `sqrt(p(1 - p)/N) = 0.0002407`). At that seed the values are `-0.0032503`, `0.9952600` and `0.011510`. Across 20 seeds the worst `|z|` over the statistics was 3.08. `sampleChiSquare(createRng(7), 5)` over 200,000 draws has mean within `0.0354` of 5 (standard error `sqrt(10/N) = 0.00707`); it is `4.986582324435398`.

## Wrong readings

Case B1:

| Reading | Shock |
|---|---:|
| Unscaled t, `sqrt(df / V)` | 9.042324723723786 |
| `V = d v` (a Gamma variate, not chi-square = 2 Gamma) | 9.905370446940372 |
| Shape `a = df` instead of `df/2` | 5.296324532431464 |
| Sine branch for the private normal (`x = 0`, `V = 2d`) | `36 / sqrt(13) = 9.984603532054125` |
| The earlier normal-with-mixture model at `u = 0.5` | 12 |

For inflation, reading `Z` in place of `t` (`rho Z + sqrt(1 - rho^2) z2`) gives `0.4348469228349534` instead of `0.5597430575050444` in the inflation case above.

The seeded bands also reject the earlier mixture (variance 1.2625, 41 standard errors out), an unscaled t (variance 5/3, 105 out) and a plain normal (tail share 0.0027, 37 out, although its variance would pass).

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Limits

- A tail model with a fixed `df` (5 from the planner, which offers no df input); no source fixes `df`.
- For `df <= 4` the fourth moment is infinite; the seeded variance band is valid only at `df > 4`.
- Class shocks are a multivariate t sharing `V`: large moves in magnitude co-occur across classes even where the class correlation is low, and cash gets t tails too.
- An additive shock can take a year's return below -100 percent, and the ledger floors balances at zero (`projection/internal/annualPostSolveAccountGrowth.ts`). At df 5 the chance per year of a shock at or below -105 points (a -100 percent year at a 5 percent expected return) is 4.8e-5 at 12 percent volatility, 5.3e-4 at 20 percent and 1.4e-3 at 25 percent; the earlier mixture was about 2.3e-3 at 25 percent.
- The private normal's `u1` floor of `1e-12` caps `|x|` near 7.43, as `rng.ts` does.
- A return-inflation correlation outside [-1, 1], or not finite, is refused with a message.

## Provenance

Derived by: claude (Opus 5.5), 2026-09-25/26, from origin/main `aeb2861a` (the Monte Carlo derivation for the decisions of 2026-09-25, section 1). Every expected value was computed twice, by scripts that do not import engine code and by a reference implementation, and the two agree to the bit. An independent checker reproduced every headline number. Reviewed by: derived 2026-09-25 by a Claude Opus instance from the engine source and the formulas; independently checked by a second Claude Opus instance that recomputed every figure without the deriver's scripts; the implementation reviewed 2026-09-26 by a third, which ran 30 mutants. All three are the same model family, which the non-author rule of decision D-BIT-ARITHMETIC-REVIEWER allows. Implemented 2026-09-26.

Revision (D-STUDENT-T-MIXTURE, decided 2026-09-25): the earlier model drew a normal and multiplied one year in twenty by 2.5 (3.5 at `df <= 4`), so its variance was 1.2625 (1.5625) times the configured one and no t variate was sampled. This worksheet replaces the one derived on that mixture.
